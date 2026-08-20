// ═══════════════════════════════════════════════════════════
// Modbus Service — Multi-Tenant Update
//
// ✅ FIXED: Broadcasts to company room only
// ✅ FIXED: Tag lookup scoped by companyId
// ✅ IMPROVED: Added Discrete Input (10001-19999) read support
// ✅ IMPROVED: REAL (float) write support for holding registers
// ✅ IMPROVED: Better error messages
// ✅ Batch InfluxDB writes
// ═══════════════════════════════════════════════════════════

const ModbusRTU = require('modbus-serial');
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

class ModbusService {
  constructor() {
    this.connections        = new Map();
    this.intervals          = new Map();
    this.plcCompanyMap      = new Map(); // ✅ plcId → companyId
    this.influxWriteCounter = new Map();
    this.INFLUX_LOG_EVERY   = 10;
  }

  async connect(plc) {
    try {
      const client = new ModbusRTU();

      console.log(`🔌 Connecting to Modbus: ${plc.name} (${plc.ipAddress}:${plc.port || 502})`);

      await client.connectTCP(plc.ipAddress, {
        port: plc.port || 502,
      });

      client.setID(1);
      client.setTimeout(3000);

      this.connections.set(plc._id.toString(), client);
      console.log(`✅ Modbus connected to ${plc.name}`);

      return { success: true, client };
    } catch (error) {
      console.error(`❌ Modbus connection failed for ${plc.name}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async start(plc, io) {
    console.log(`▶️  Starting MODBUS for PLC: ${plc.name} [company=${plc.companyId}]`);

    this.stop(plc._id);

    const result = await this.connect(plc);
    if (!result.success) throw new Error(result.error);

    const client = result.client;
    const plcId = plc._id.toString();
    const companyId = plc.companyId.toString();
    const companyRoom = `company:${companyId}`;

    // ✅ Store company mapping
    this.plcCompanyMap.set(plcId, companyId);
    this.influxWriteCounter.set(plcId, 0);

    let consecutiveFailures = 0;
    const MAX_FAILURES = 5;

    const intervalId = setInterval(async () => {
      try {
        // ✅ Load tags scoped by company + PLC
        const tags = await Tag.find({
          companyId:     plc.companyId,
          plcConnection: plc._id,
          isActive:      true,
        });

        const updates = [];
        const influxPoints = [];
        let anySuccess = false;

        for (const tag of tags) {
          try {
            const value = await this.readTag(client, tag);
            anySuccess = true;

            tag.currentValue = value;
            tag.quality      = 'GOOD';
            tag.lastUpdated  = Date.now();
            await tag.save();

            updates.push({
              tagName:   tag.tagName,
              value,
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
          } catch (err) {
            tag.quality = 'BAD';
            await tag.save();
            // Only log first failure per cycle to avoid spam
            if (!anySuccess) {
              console.error(`❌ Modbus read error for ${tag.tagName} (addr: ${tag.plcAddress}): ${err.message}`);
            }
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
                console.log(`📈 [${plc.name}] Modbus: Logged ${influxPoints.length} values (${counter} batches)`);
              }
            }
          } catch (influxErr) {
            // Silent
          }
        }

        if (anySuccess) {
          consecutiveFailures = 0;
        } else if (tags.length > 0) {
          consecutiveFailures += 1;
          if (consecutiveFailures >= MAX_FAILURES) {
            console.warn(`⚠️  Modbus ${plc.name}: connection lost, stopping`);
            this.stop(plc._id);
          }
        }
      } catch (error) {
        consecutiveFailures += 1;
        console.error(`❌ Modbus poll error (${consecutiveFailures}/${MAX_FAILURES}):`, error.message);
        if (consecutiveFailures >= MAX_FAILURES) {
          console.warn(`⚠️  Modbus ${plc.name}: too many errors, stopping`);
          this.stop(plc._id);
        }
      }
    }, plc.pollingRate || 1000);

    this.intervals.set(plcId, intervalId);
    return { success: true, message: 'Modbus polling started' };
  }

  // ═══════════════════════════════════════════════════════════
  // ✅ IMPROVED: readTag — supports all Modbus areas
  //
  // Address ranges:
  //   00001-09999  → Coils (FC01, read-write BOOL)
  //   10001-19999  → Discrete Inputs (FC02, read-only BOOL) ← NEW
  //   30001-39999  → Input Registers (FC04, read-only)
  //   40001-49999  → Holding Registers (FC03, read-write)
  // ═══════════════════════════════════════════════════════════
  async readTag(client, tag) {
    const address = parseInt(tag.plcAddress);

    if (isNaN(address)) {
      throw new Error(
        `Invalid Modbus address: "${tag.plcAddress}". ` +
        `Expected: 00001-09999 (coils), 10001-19999 (discrete inputs), ` +
        `30001-39999 (input registers), 40001-49999 (holding registers)`
      );
    }

    // ─── Holding Registers (40001-49999) — FC03 ───
    if (address >= 40001 && address <= 49999) {
      const regAddr = address - 40001;

      if (tag.dataType === 'BOOL') {
        const data = await client.readHoldingRegisters(regAddr, 1);
        return data.data[0] !== 0;
      }

      if (tag.dataType === 'INT' || tag.dataType === 'WORD') {
        const data = await client.readHoldingRegisters(regAddr, 1);
        // INT is signed 16-bit
        if (tag.dataType === 'INT') {
          const val = data.data[0];
          return val > 32767 ? val - 65536 : val;
        }
        return data.data[0]; // WORD is unsigned
      }

      if (tag.dataType === 'DINT' || tag.dataType === 'DWORD') {
        const data = await client.readHoldingRegisters(regAddr, 2);
        const combined = (data.data[0] << 16) | data.data[1];
        if (tag.dataType === 'DINT' && combined > 2147483647) {
          return combined - 4294967296; // Signed 32-bit
        }
        return combined;
      }

      if (tag.dataType === 'REAL') {
        const data = await client.readHoldingRegisters(regAddr, 2);
        const buffer = Buffer.alloc(4);
        buffer.writeUInt16BE(data.data[0], 0);
        buffer.writeUInt16BE(data.data[1], 2);
        return parseFloat(buffer.readFloatBE(0).toFixed(4));
      }

      // Default: read 1 register as unsigned
      const data = await client.readHoldingRegisters(regAddr, 1);
      return data.data[0];
    }

    // ─── Coils (00001-09999) — FC01 ───
    if (address >= 1 && address <= 9999) {
      const data = await client.readCoils(address - 1, 1);
      return data.data[0];
    }

    // ─── Discrete Inputs (10001-19999) — FC02 ── ✅ NEW
    if (address >= 10001 && address <= 19999) {
      const data = await client.readDiscreteInputs(address - 10001, 1);
      return data.data[0];
    }

    // ─── Input Registers (30001-39999) — FC04 ───
    if (address >= 30001 && address <= 39999) {
      const regAddr = address - 30001;

      if (tag.dataType === 'REAL') {
        const data = await client.readInputRegisters(regAddr, 2);
        const buffer = Buffer.alloc(4);
        buffer.writeUInt16BE(data.data[0], 0);
        buffer.writeUInt16BE(data.data[1], 2);
        return parseFloat(buffer.readFloatBE(0).toFixed(4));
      }

      if (tag.dataType === 'DINT' || tag.dataType === 'DWORD') {
        const data = await client.readInputRegisters(regAddr, 2);
        return (data.data[0] << 16) | data.data[1];
      }

      const data = await client.readInputRegisters(regAddr, 1);
      return data.data[0];
    }

    throw new Error(
      `Unsupported Modbus address: ${tag.plcAddress}. ` +
      `Valid ranges: 1-9999 (coils), 10001-19999 (discrete), ` +
      `30001-39999 (input reg), 40001-49999 (holding reg)`
    );
  }

  // ═══════════════════════════════════════════════════════════
  // ✅ IMPROVED: writeTag — supports REAL + DINT + BOOL
  // ═══════════════════════════════════════════════════════════
  async writeTag(plcId, tag, value) {
    const client = this.connections.get(plcId.toString());
    if (!client) throw new Error('PLC not connected');

    const address = parseInt(tag.plcAddress);

    if (isNaN(address)) {
      throw new Error(`Invalid Modbus address: "${tag.plcAddress}"`);
    }

    // ─── Holding Registers (40001-49999) ───
    if (address >= 40001 && address <= 49999) {
      const regAddr = address - 40001;

      if (tag.dataType === 'REAL') {
        // ✅ NEW: Write float as 2 registers
        const buffer = Buffer.alloc(4);
        buffer.writeFloatBE(parseFloat(value), 0);
        await client.writeRegisters(regAddr, [
          buffer.readUInt16BE(0),
          buffer.readUInt16BE(2),
        ]);
      } else if (tag.dataType === 'DINT' || tag.dataType === 'DWORD') {
        // ✅ NEW: Write 32-bit as 2 registers
        const intVal = parseInt(value);
        await client.writeRegisters(regAddr, [
          (intVal >> 16) & 0xFFFF,
          intVal & 0xFFFF,
        ]);
      } else {
        // INT/WORD: single register
        await client.writeRegister(regAddr, parseInt(value));
      }
    }
    // ─── Coils (00001-09999) ───
    else if (address >= 1 && address <= 9999) {
      await client.writeCoil(address - 1, Boolean(value));
    }
    // ─── Input areas are read-only ───
    else if (address >= 10001 && address <= 39999) {
      throw new Error('Cannot write to Input area (read-only). Use Holding Registers (40001+) or Coils (00001+).');
    }
    else {
      throw new Error(`Unsupported write address: ${address}`);
    }

    // Log to InfluxDB on write
    if (tag.enableLogging && isInfluxAvailable()) {
      const influxValue = toInfluxValue(value, tag.dataType);
      if (influxValue !== null) {
        try {
          await writeMultipleTagValues([{
            tagId:   tag._id.toString(),
            tagName: tag.tagName,
            value:   influxValue,
            unit:    tag.unit || '',
            plcId:   plcId.toString(),
            quality: 'GOOD',
          }]);
        } catch {}
      }
    }

    console.log(`✅ Modbus write: ${tag.tagName} = ${value} (addr: ${address})`);
    return true;
  }

  stop(plcId) {
    const id = plcId.toString();

    if (this.intervals.has(id)) {
      clearInterval(this.intervals.get(id));
      this.intervals.delete(id);
    }

    if (this.connections.has(id)) {
      const client = this.connections.get(id);
      try { client.close(() => {}); } catch (e) {}
      this.connections.delete(id);
      console.log(`⏹️  Modbus disconnected: ${id}`);
    }

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

module.exports = new ModbusService();