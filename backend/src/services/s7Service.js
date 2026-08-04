// ============================================
// S7 Service - Using nodes7 with auto-register write
// ============================================

const nodes7 = require('nodes7');
const Tag = require('../models/Tag');
const { writeTagValue: writeTagToInflux } = require('./influxService');

class S7Service {
  constructor() {
    this.connections = new Map();     // plcId -> connection
    this.intervals = new Map();       // plcId -> intervalId
    this.tagCache = new Map();        // plcId -> tags array
    this.registeredTags = new Map();  // plcId -> Set of registered tag names
  }

  async connect(plc) {
    return new Promise((resolve) => {
      const conn = new nodes7();

      console.log(`🔌 Connecting to S7 PLC: ${plc.name}`);
      console.log(`   IP: ${plc.ipAddress} | Rack: ${plc.rack} | Slot: ${plc.slot}`);

      const connectionParams = {
        port: plc.port || 102,
        host: plc.ipAddress,
        rack: plc.rack || 0,
        slot: plc.slot || 1,
        timeout: 5000,
      };

      conn.initiateConnection(connectionParams, (err) => {
        if (err) {
          const errStr = typeof err === 'string' ? err : JSON.stringify(err);
          console.error(`❌ S7 connection failed for ${plc.name}: ${errStr}`);
          return resolve({ success: false, error: errStr });
        }

        this.connections.set(plc._id.toString(), conn);
        console.log(`✅ S7 connected to ${plc.name} successfully!`);
        resolve({ success: true, conn });
      });
    });
  }

  async start(plc, io) {
    console.log(`▶️  Starting S7 service for: ${plc.name}`);

    this.stop(plc._id);

    const result = await this.connect(plc);
    if (!result.success) {
      throw new Error(result.error);
    }

    const conn = result.conn;

    const tags = await Tag.find({
      plcConnection: plc._id,
      isActive: true,
    });

    console.log(`📊 Loaded ${tags.length} tags for ${plc.name}`);

    if (tags.length === 0) {
      console.warn(`⚠️  No tags configured for ${plc.name}`);
      // Still setup translation callback so future writes work
      const emptyVars = {};
      conn.setTranslationCB((t) => emptyVars[t]);
      this.tagCache.set(plc._id.toString(), []);
      this.registeredTags.set(plc._id.toString(), new Set());
      return { success: true, message: 'Connected but no tags' };
    }

    // Build variables for nodes7
    const variables = {};
    const registered = new Set();
    tags.forEach((tag) => {
      const nodes7Address = this.convertAddress(tag);
      if (nodes7Address) {
        variables[tag.tagName] = nodes7Address;
        registered.add(tag.tagName);
        console.log(`   ✓ ${tag.tagName} → ${tag.plcAddress} → ${nodes7Address}`);
      } else {
        console.warn(`   ✗ Invalid address: ${tag.tagName} (${tag.plcAddress || '<empty>'})`);
      }
    });

    this.tagCache.set(plc._id.toString(), tags);
    this.registeredTags.set(plc._id.toString(), registered);

    // ✅ Store variables map on connection for later auto-register
    conn._variables = variables;

    conn.setTranslationCB((t) => conn._variables[t]);
    conn.addItems(Object.keys(variables));

    const pollRate = plc.pollingRate || 1000;
    console.log(`⏱️  Polling rate: ${pollRate}ms`);

    let consecutiveFailures = 0;
    const MAX_FAILURES = 5;

    const intervalId = setInterval(() => {
      conn.readAllItems(async (err, values) => {
        if (err) {
          consecutiveFailures += 1;
          console.error(`❌ S7 read error (${consecutiveFailures}/${MAX_FAILURES}):`, err);

          if (consecutiveFailures >= MAX_FAILURES) {
            console.warn(`⚠️  S7 ${plc.name}: too many failures, stopping (plcManager will reconnect)`);
            this.stop(plc._id);
          }
          return;
        }

        consecutiveFailures = 0;

        const updates = [];

        for (const tagName in values) {
          try {
            const tag = await Tag.findOne({ tagName });
            if (!tag) continue;

            const value = values[tagName];

            if (value === 'BAD 255' || value === null || value === undefined) continue;

            tag.currentValue = value;
            tag.quality = 'GOOD';
            tag.lastUpdated = Date.now();
            await tag.save();

            updates.push({
              tagName: tag.tagName,
              value: value,
              quality: 'GOOD',
              timestamp: tag.lastUpdated,
            });

            if (tag.enableLogging) {
              try {
                await writeTagToInflux({
                  tagId: tag._id,
                  tagName: tag.tagName,
                  value: typeof value === 'boolean' ? (value ? 1 : 0) : value,
                  unit: tag.unit,
                  plcId: plc._id,
                  quality: 'GOOD',
                });
              } catch (e) {}
            }
          } catch (err) {
            console.error(`❌ Tag update error: ${err.message}`);
          }
        }

        if (io && updates.length > 0) {
          io.emit('tagsUpdate', updates);
        }
      });
    }, pollRate);

    this.intervals.set(plc._id.toString(), intervalId);

    return { success: true, message: 'S7 polling started' };
  }

  // ─────────────────────────────────────────
  // Convert Siemens Address to nodes7 Format
  // ─────────────────────────────────────────
  convertAddress(tag) {
    let addr = tag.plcAddress;
    if (!addr || typeof addr !== 'string') return null;

    addr = addr.trim().toUpperCase();
    if (addr === '') return null;

    // Memory areas
    if (addr.match(/^M\d+\.\d+$/)) return addr;
    if (addr.match(/^MB\d+$/))     return addr;
    if (addr.match(/^MW\d+$/))     return addr;
    if (addr.match(/^MD\d+$/))     return addr;

    // Input areas
    if (addr.match(/^I\d+\.\d+$/)) return addr;
    if (addr.match(/^IB\d+$/))     return addr;
    if (addr.match(/^IW\d+$/))     return addr;
    if (addr.match(/^ID\d+$/))     return addr;

    // Output areas
    if (addr.match(/^Q\d+\.\d+$/)) return addr;
    if (addr.match(/^QB\d+$/))     return addr;
    if (addr.match(/^QW\d+$/))     return addr;
    if (addr.match(/^QD\d+$/))     return addr;

    // DB Boolean: DB1.DBX0.0 → DB1,X0.0
    const dbBoolMatch = addr.match(/^DB(\d+)\.DBX(\d+)\.(\d+)$/);
    if (dbBoolMatch) {
      return `DB${dbBoolMatch[1]},X${dbBoolMatch[2]}.${dbBoolMatch[3]}`;
    }

    // DB Byte
    const dbByteMatch = addr.match(/^DB(\d+)\.DBB(\d+)$/);
    if (dbByteMatch) {
      return `DB${dbByteMatch[1]},B${dbByteMatch[2]}`;
    }

    // DB Word
    const dbWordMatch = addr.match(/^DB(\d+)\.DBW(\d+)$/);
    if (dbWordMatch) {
      const type = tag.dataType === 'WORD' ? 'WORD' : 'INT';
      return `DB${dbWordMatch[1]},${type}${dbWordMatch[2]}`;
    }

    // DB DWord
    const dbDwordMatch = addr.match(/^DB(\d+)\.DBD(\d+)$/);
    if (dbDwordMatch) {
      let type = 'DINT';
      if (tag.dataType === 'REAL') type = 'REAL';
      if (tag.dataType === 'DWORD') type = 'DWORD';
      return `DB${dbDwordMatch[1]},${type}${dbDwordMatch[2]}`;
    }

    console.warn(`⚠️  Unknown address format: ${addr}`);
    return null;
  }

  // ─────────────────────────────────────────
  // ✅ AUTO-REGISTER new tag if not already registered
  // ─────────────────────────────────────────
  _ensureTagRegistered(plcId, tag) {
    const id = plcId.toString();
    const conn = this.connections.get(id);
    const registered = this.registeredTags.get(id) || new Set();

    if (!conn) throw new Error('PLC not connected');

    // Already registered — done
    if (registered.has(tag.tagName)) return true;

    // Not registered — register now
    const nodes7Address = this.convertAddress(tag);
    if (!nodes7Address) {
      throw new Error(`Invalid PLC address: "${tag.plcAddress || '<empty>'}"`);
    }

    // Add to variables map
    if (!conn._variables) conn._variables = {};
    conn._variables[tag.tagName] = nodes7Address;

    // Register with nodes7
    conn.addItems(tag.tagName);
    registered.add(tag.tagName);
    this.registeredTags.set(id, registered);

    console.log(`   🔧 Auto-registered new tag: ${tag.tagName} → ${nodes7Address}`);
    return true;
  }

  // ─────────────────────────────────────────
  // Write Value to S7 (with auto-register)
  // ─────────────────────────────────────────
  async writeTag(plcId, tag, value) {
    return new Promise((resolve, reject) => {
      const conn = this.connections.get(plcId.toString());
      if (!conn) return reject(new Error('PLC not connected'));

      // ✅ Validate address first
      if (!tag.plcAddress || typeof tag.plcAddress !== 'string' || tag.plcAddress.trim() === '') {
        return reject(new Error(`Tag "${tag.tagName}" has no PLC address configured`));
      }

      // ✅ Auto-register if not already registered
      try {
        this._ensureTagRegistered(plcId, tag);
      } catch (err) {
        return reject(err);
      }

      conn.writeItems(tag.tagName, value, (err) => {
        if (err) {
          console.error(`❌ Write failed for ${tag.tagName}:`, err);
          return reject(new Error(typeof err === 'string' ? err : JSON.stringify(err)));
        }
        console.log(`✅ Write success: ${tag.tagName} = ${value}`);
        resolve(true);
      });
    });
  }

  async test(plc) {
    const result = await this.connect(plc);
    if (result.success) {
      const conn = result.conn;
      setTimeout(() => {
        try {
          conn.dropConnection();
        } catch (e) {}
        this.connections.delete(plc._id.toString());
      }, 500);
      return { success: true, message: 'Connection test successful' };
    }
    return result;
  }

  stop(plcId) {
    const id = plcId.toString();

    if (this.intervals.has(id)) {
      clearInterval(this.intervals.get(id));
      this.intervals.delete(id);
    }

    if (this.connections.has(id)) {
      const conn = this.connections.get(id);
      try {
        conn.dropConnection();
      } catch (e) {}
      this.connections.delete(id);
      console.log(`⏹️  S7 disconnected: ${id}`);
    }

    this.tagCache.delete(id);
    this.registeredTags.delete(id);
  }

  isRunning(plcId) {
    return this.intervals.has(plcId.toString());
  }

  stopAll() {
    for (const id of this.intervals.keys()) {
      this.stop(id);
    }
  }
}

module.exports = new S7Service();