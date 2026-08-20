// ═══════════════════════════════════════════════════════════
// S7 Service — Multi-Tenant Update
//
// ✅ FIXED: Tag lookup scoped by companyId (no cross-company leak)
// ✅ FIXED: Broadcasts to company room only (io.to())
// ✅ FIXED: PLC companyId stored on start for scoping
// ✅ Improved address converter (more formats)
// ✅ Batch InfluxDB writes
// ═══════════════════════════════════════════════════════════

const nodes7 = require('nodes7');
const Tag = require('../models/Tag');
const PLCConnection = require('../models/PLCConnection');
const { writeMultipleTagValues, isInfluxAvailable } = require('./influxService');

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
    this.connections     = new Map();
    this.intervals       = new Map();
    this.tagCache        = new Map();
    this.registeredTags  = new Map();
    this.influxWriteCounter = new Map();
    this.plcCompanyMap   = new Map(); // ✅ NEW: plcId → companyId
    this.INFLUX_LOG_EVERY = 10;
  }

  async connect(plc) {
    return new Promise((resolve) => {
      const conn = new nodes7();

      console.log(`🔌 Connecting to S7 PLC: ${plc.name}`);
      console.log(`   IP: ${plc.ipAddress} | Rack: ${plc.rack} | Slot: ${plc.slot}`);

      const connectionParams = {
        port:    plc.port || 102,
        host:    plc.ipAddress,
        rack:    plc.rack || 0,
        slot:    plc.slot || 1,
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
    console.log(`▶️  Starting S7 service for: ${plc.name} [company=${plc.companyId}]`);

    this.stop(plc._id);

    const result = await this.connect(plc);
    if (!result.success) throw new Error(result.error);

    const conn = result.conn;
    const plcId = plc._id.toString();

    // ✅ Store companyId for this PLC
    this.plcCompanyMap.set(plcId, plc.companyId.toString());

    // ✅ Load tags SCOPED to this PLC's company
    const tags = await Tag.find({
      companyId:     plc.companyId,
      plcConnection: plc._id,
      isActive:      true,
    });

    console.log(`📊 Loaded ${tags.length} tags for ${plc.name}`);

    if (tags.length === 0) {
      console.warn(`⚠️  No tags configured for ${plc.name}`);
      const emptyVars = {};
      conn.setTranslationCB((t) => emptyVars[t]);
      this.tagCache.set(plcId, []);
      this.registeredTags.set(plcId, new Set());
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

    this.tagCache.set(plcId, tags);
    this.registeredTags.set(plcId, registered);
    this.influxWriteCounter.set(plcId, 0);

    conn._variables = variables;
    conn.setTranslationCB((t) => conn._variables[t]);
    conn.addItems(Object.keys(variables));

    const pollRate = plc.pollingRate || 1000;
    const companyId = plc.companyId.toString();
    const companyRoom = `company:${companyId}`;

    console.log(`⏱️  Polling rate: ${pollRate}ms | Company room: ${companyRoom}`);

    let consecutiveFailures = 0;
    const MAX_FAILURES = 5;

    const intervalId = setInterval(() => {
      conn.readAllItems(async (err, values) => {
        if (err) {
          consecutiveFailures += 1;
          console.error(`❌ S7 read error (${consecutiveFailures}/${MAX_FAILURES}):`, err);
          if (consecutiveFailures >= MAX_FAILURES) {
            console.warn(`⚠️  S7 ${plc.name}: too many failures, stopping`);
            this.stop(plc._id);
          }
          return;
        }

        consecutiveFailures = 0;

        const updates = [];
        const influxPoints = [];

        for (const tagName in values) {
          try {
            // ✅ FIXED: Lookup tag SCOPED by companyId
            const tag = await Tag.findOne({
              companyId,
              tagName,
            });
            if (!tag) continue;

            const value = values[tagName];
            if (value === 'BAD 255' || value === null || value === undefined) continue;

            tag.currentValue = value;
            tag.quality      = 'GOOD';
            tag.lastUpdated  = Date.now();
            await tag.save();

            updates.push({
              tagName:   tag.tagName,
              value:     value,
              quality:   'GOOD',
              timestamp: tag.lastUpdated,
            });

            if (tag.enableLogging) {
              const influxValue = toInfluxValue(value, tag.dataType);
              if (influxValue !== null) {
                influxPoints.push({
                  tagId:   tag._id.toString(),
                  tagName: tag.tagName,
                  value:   influxValue,
                  unit:    tag.unit || '',
                  plcId:   plcId,
                  quality: 'GOOD',
                });
              }
            }
          } catch (tagErr) {
            console.error(`❌ Tag update error: ${tagErr.message}`);
          }
        }

        // ✅ FIXED: Broadcast ONLY to this company's room
        if (io && updates.length > 0) {
          io.to(companyRoom).emit('tagsUpdate', updates);
        }

        // Batch InfluxDB write
        if (influxPoints.length > 0 && isInfluxAvailable()) {
          try {
            const success = await writeMultipleTagValues(influxPoints);
            if (success) {
              const counter = (this.influxWriteCounter.get(plcId) || 0) + 1;
              this.influxWriteCounter.set(plcId, counter);
              if (counter % this.INFLUX_LOG_EVERY === 0) {
                console.log(`📈 [${plc.name}] Logged ${influxPoints.length} values to InfluxDB (${counter} batches)`);
              }
            }
          } catch (influxErr) {
            // Silent
          }
        }
      });
    }, pollRate);

    this.intervals.set(plcId, intervalId);
    return { success: true, message: 'S7 polling started' };
  }

  // ═══════════════════════════════════════════════════════════
  // ✅ IMPROVED: Address converter — supports more formats
  // ═══════════════════════════════════════════════════════════
  convertAddress(tag) {
    let addr = tag.plcAddress;
    if (!addr || typeof addr !== 'string') return null;

    addr = addr.trim().toUpperCase();
    if (addr === '') return null;

    // ─── Direct nodes7 format (already valid) ───
    // DB1,X0.0 | DB1,INT0 | DB1,REAL4 | DB1,S8.20 | M0.0 | MW0 | etc.
    if (addr.match(/^DB\d+,[A-Z]+\d/)) return addr;

    // ─── Merker (M) area ───
    if (addr.match(/^M\d+\.\d+$/))  return addr;         // M0.0
    if (addr.match(/^MB\d+$/))      return addr;          // MB0
    if (addr.match(/^MW\d+$/))      return addr;          // MW0
    if (addr.match(/^MD\d+$/))      return addr;          // MD0

    // ─── Input (I/E) area ───
    if (addr.match(/^[IE]\d+\.\d+$/)) return addr.replace(/^E/, 'I');  // E0.0 → I0.0
    if (addr.match(/^[IE]B\d+$/))     return addr.replace(/^E/, 'I');  // EB0 → IB0
    if (addr.match(/^[IE]W\d+$/))     return addr.replace(/^E/, 'I');  // EW0 → IW0
    if (addr.match(/^[IE]D\d+$/))     return addr.replace(/^E/, 'I');  // ED0 → ID0

    // ─── Output (Q/A) area ───
    if (addr.match(/^[QA]\d+\.\d+$/)) return addr.replace(/^A/, 'Q');  // A0.0 → Q0.0
    if (addr.match(/^[QA]B\d+$/))     return addr.replace(/^A/, 'Q');  // AB0 → QB0
    if (addr.match(/^[QA]W\d+$/))     return addr.replace(/^A/, 'Q');  // AW0 → QW0
    if (addr.match(/^[QA]D\d+$/))     return addr.replace(/^A/, 'Q');  // AD0 → QD0

    // ─── TIA Portal DB format: DB1.DBX0.0 → DB1,X0.0 ───
    const dbBoolMatch = addr.match(/^DB(\d+)\.DBX(\d+)\.(\d+)$/);
    if (dbBoolMatch) {
      return `DB${dbBoolMatch[1]},X${dbBoolMatch[2]}.${dbBoolMatch[3]}`;
    }

    // ─── TIA Portal: DB1.DBB0 → DB1,BYTE0 ───
    const dbByteMatch = addr.match(/^DB(\d+)\.DBB(\d+)$/);
    if (dbByteMatch) {
      return `DB${dbByteMatch[1]},BYTE${dbByteMatch[2]}`;
    }

    // ─── TIA Portal: DB1.DBW0 → DB1,INT0 or DB1,WORD0 ───
    const dbWordMatch = addr.match(/^DB(\d+)\.DBW(\d+)$/);
    if (dbWordMatch) {
      const type = tag.dataType === 'WORD' ? 'WORD' : 'INT';
      return `DB${dbWordMatch[1]},${type}${dbWordMatch[2]}`;
    }

    // ─── TIA Portal: DB1.DBD0 → DB1,REAL0 or DB1,DINT0 or DB1,DWORD0 ───
    const dbDwordMatch = addr.match(/^DB(\d+)\.DBD(\d+)$/);
    if (dbDwordMatch) {
      let type = 'DINT';
      if (tag.dataType === 'REAL')  type = 'REAL';
      if (tag.dataType === 'DWORD') type = 'DWORD';
      return `DB${dbDwordMatch[1]},${type}${dbDwordMatch[2]}`;
    }

    // ─── Simple format: DB1,0 → DB1,INT0 (assume INT for offset-only) ───
    const dbSimpleMatch = addr.match(/^DB(\d+),(\d+)$/);
    if (dbSimpleMatch) {
      let type = 'INT';
      if (tag.dataType === 'REAL')   type = 'REAL';
      if (tag.dataType === 'DINT')   type = 'DINT';
      if (tag.dataType === 'BOOL')   type = 'X';
      if (tag.dataType === 'WORD')   type = 'WORD';
      if (tag.dataType === 'DWORD')  type = 'DWORD';
      if (tag.dataType === 'STRING') type = 'S';
      if (type === 'X') {
        return `DB${dbSimpleMatch[1]},X${dbSimpleMatch[2]}.0`;
      }
      return `DB${dbSimpleMatch[1]},${type}${dbSimpleMatch[2]}`;
    }

    // ─── Already in nodes7 format (catch-all) ───
    // e.g. DB1,INT0 | DB1,REAL4 | DB1,S0.50
    if (addr.match(/^DB\d+,/)) return addr;

    console.warn(`⚠️  Unknown S7 address format: ${addr} (tag: ${tag.tagName})`);
    console.warn(`   Supported formats:`);
    console.warn(`     DB1,X0.0 | DB1,INT0 | DB1,REAL4 | DB1,DINT0`);
    console.warn(`     DB1.DBX0.0 | DB1.DBW0 | DB1.DBD0`);
    console.warn(`     M0.0 | MW0 | MD0 | I0.0 | Q0.0`);
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
      throw new Error(`Invalid PLC address: "${tag.plcAddress || '<empty>'}". See supported formats in logs.`);
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
    this.plcCompanyMap.delete(id);
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