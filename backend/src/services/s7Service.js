// ============================================
// S7 Service - Using nodes7 with auto-register write
//
// Task Bundle applied:
//   ✅ INFLUX  — Batch write to InfluxDB (was per-tag, now single call)
//   ✅ INFLUX  — Proper BOOL → 0/1 conversion
//   ✅ INFLUX  — Skip STRING tags in InfluxDB writes
//   ✅ INFLUX  — Diagnostic logging every 10 batches
// ============================================

const nodes7 = require('nodes7');
const Tag = require('../models/Tag');
const { writeMultipleTagValues, isInfluxAvailable } = require('./influxService');

// ─── Helper: Convert tag value to InfluxDB-safe number ───
const toInfluxValue = (value, dataType) => {
  if (value === null || value === undefined) return null;
  if (dataType === 'BOOL' || typeof value === 'boolean') return value ? 1 : 0;
  if (dataType === 'STRING' || typeof value === 'string') {
    const n = Number(value);
    return isNaN(n) ? null : n;
  }
  const n = Number(value);
  return isNaN(n) ? null : n;
};

class S7Service {
  constructor() {
    this.connections = new Map();
    this.intervals = new Map();
    this.tagCache = new Map();
    this.registeredTags = new Map();
    this.influxWriteCounter = new Map();
    this.INFLUX_LOG_EVERY = 10;
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
    if (!result.success) throw new Error(result.error);

    const conn = result.conn;

    const tags = await Tag.find({
      plcConnection: plc._id,
      isActive: true,
    });

    console.log(`📊 Loaded ${tags.length} tags for ${plc.name}`);

    if (tags.length === 0) {
      console.warn(`⚠️  No tags configured for ${plc.name}`);
      const emptyVars = {};
      conn.setTranslationCB((t) => emptyVars[t]);
      this.tagCache.set(plc._id.toString(), []);
      this.registeredTags.set(plc._id.toString(), new Set());
      return { success: true, message: 'Connected but no tags' };
    }

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
    this.influxWriteCounter.set(plc._id.toString(), 0);

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
        const influxPoints = []; // ✅ Collect for batch write

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

            // ✅ Collect for batch InfluxDB write
            if (tag.enableLogging) {
              const influxValue = toInfluxValue(value, tag.dataType);
              if (influxValue !== null) {
                influxPoints.push({
                  tagId: tag._id.toString(),
                  tagName: tag.tagName,
                  value: influxValue,
                  unit: tag.unit || '',
                  plcId: plc._id.toString(),
                  quality: 'GOOD',
                });
              }
            }
          } catch (err) {
            console.error(`❌ Tag update error: ${err.message}`);
          }
        }

        if (io && updates.length > 0) {
          io.emit('tagsUpdate', updates);
        }

        // ✅ Batch write to InfluxDB (1 call for ALL loggable tags)
        if (influxPoints.length > 0 && isInfluxAvailable()) {
          try {
            const success = await writeMultipleTagValues(influxPoints);
            if (success) {
              const counter = (this.influxWriteCounter.get(plc._id.toString()) || 0) + 1;
              this.influxWriteCounter.set(plc._id.toString(), counter);
              if (counter % this.INFLUX_LOG_EVERY === 0) {
                console.log(`📈 [${plc.name}] Logged ${influxPoints.length} values to InfluxDB (${counter} batches so far)`);
              }
            }
          } catch (influxErr) {
            // Silent — influxService handles anti-spam logging
          }
        }
      });
    }, pollRate);

    this.intervals.set(plc._id.toString(), intervalId);
    return { success: true, message: 'S7 polling started' };
  }

  convertAddress(tag) {
    let addr = tag.plcAddress;
    if (!addr || typeof addr !== 'string') return null;

    addr = addr.trim().toUpperCase();
    if (addr === '') return null;

    if (addr.match(/^M\d+\.\d+$/)) return addr;
    if (addr.match(/^MB\d+$/))     return addr;
    if (addr.match(/^MW\d+$/))     return addr;
    if (addr.match(/^MD\d+$/))     return addr;

    if (addr.match(/^I\d+\.\d+$/)) return addr;
    if (addr.match(/^IB\d+$/))     return addr;
    if (addr.match(/^IW\d+$/))     return addr;
    if (addr.match(/^ID\d+$/))     return addr;

    if (addr.match(/^Q\d+\.\d+$/)) return addr;
    if (addr.match(/^QB\d+$/))     return addr;
    if (addr.match(/^QW\d+$/))     return addr;
    if (addr.match(/^QD\d+$/))     return addr;

    const dbBoolMatch = addr.match(/^DB(\d+)\.DBX(\d+)\.(\d+)$/);
    if (dbBoolMatch) {
      return `DB${dbBoolMatch[1]},X${dbBoolMatch[2]}.${dbBoolMatch[3]}`;
    }

    const dbByteMatch = addr.match(/^DB(\d+)\.DBB(\d+)$/);
    if (dbByteMatch) {
      return `DB${dbByteMatch[1]},B${dbByteMatch[2]}`;
    }

    const dbWordMatch = addr.match(/^DB(\d+)\.DBW(\d+)$/);
    if (dbWordMatch) {
      const type = tag.dataType === 'WORD' ? 'WORD' : 'INT';
      return `DB${dbWordMatch[1]},${type}${dbWordMatch[2]}`;
    }

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

  _ensureTagRegistered(plcId, tag) {
    const id = plcId.toString();
    const conn = this.connections.get(id);
    const registered = this.registeredTags.get(id) || new Set();

    if (!conn) throw new Error('PLC not connected');
    if (registered.has(tag.tagName)) return true;

    const nodes7Address = this.convertAddress(tag);
    if (!nodes7Address) {
      throw new Error(`Invalid PLC address: "${tag.plcAddress || '<empty>'}"`);
    }

    if (!conn._variables) conn._variables = {};
    conn._variables[tag.tagName] = nodes7Address;

    conn.addItems(tag.tagName);
    registered.add(tag.tagName);
    this.registeredTags.set(id, registered);

    console.log(`   🔧 Auto-registered new tag: ${tag.tagName} → ${nodes7Address}`);
    return true;
  }

  async writeTag(plcId, tag, value) {
    return new Promise((resolve, reject) => {
      const conn = this.connections.get(plcId.toString());
      if (!conn) return reject(new Error('PLC not connected'));

      if (!tag.plcAddress || typeof tag.plcAddress !== 'string' || tag.plcAddress.trim() === '') {
        return reject(new Error(`Tag "${tag.tagName}" has no PLC address configured`));
      }

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
        try { conn.dropConnection(); } catch (e) {}
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
      try { conn.dropConnection(); } catch (e) {}
      this.connections.delete(id);
      console.log(`⏹️  S7 disconnected: ${id}`);
    }

    this.tagCache.delete(id);
    this.registeredTags.delete(id);
    this.influxWriteCounter.delete(id);
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