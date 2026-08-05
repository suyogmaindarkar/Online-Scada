// ═══════════════════════════════════════════════════════════
// Modbus Service
//
// Task Bundle applied:
//   ✅ INFLUX  — Batch write to InfluxDB (was missing entirely!)
//   ✅ INFLUX  — Proper BOOL → 0/1 conversion
//   ✅ INFLUX  — Skip STRING tags in InfluxDB writes
//   ✅ INFLUX  — Diagnostic logging every 10 batches
// ═══════════════════════════════════════════════════════════

const ModbusRTU = require('modbus-serial');
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

class ModbusService {
  constructor() {
    this.connections = new Map();
    this.intervals = new Map();
    this.influxWriteCounter = new Map();
    this.INFLUX_LOG_EVERY = 10;
  }

  /**
   * Connect to Modbus PLC
   */
  async connect(plc) {
    try {
      const client = new ModbusRTU();

      await client.connectTCP(plc.ipAddress, {
        port: plc.port || 502,
      });

      client.setID(1);
      client.setTimeout(2000);

      this.connections.set(plc._id.toString(), client);
      console.log(`✅ Modbus connected to ${plc.name} (${plc.ipAddress}:${plc.port})`);

      return { success: true, client };
    } catch (error) {
      console.error(`❌ Modbus connection failed for ${plc.name}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Start polling Modbus PLC
   */
  async start(plc, io) {
    console.log(`🔌 Starting MODBUS for PLC: ${plc.name}`);

    this.stop(plc._id);

    const result = await this.connect(plc);
    if (!result.success) {
      throw new Error(result.error);
    }

    const client = result.client;
    this.influxWriteCounter.set(plc._id.toString(), 0);

    let consecutiveFailures = 0;
    const MAX_FAILURES = 5;

    const intervalId = setInterval(async () => {
      try {
        const tags = await Tag.find({
          plcConnection: plc._id,
          isActive: true,
        });

        const updates = [];
        const influxPoints = []; // ✅ Collect for batch write
        let anySuccess = false;

        for (const tag of tags) {
          try {
            const value = await this.readTag(client, tag);
            anySuccess = true;

            tag.currentValue = value;
            tag.quality = 'GOOD';
            tag.lastUpdated = Date.now();
            await tag.save();

            updates.push({
              tagName: tag.tagName,
              value,
              quality: 'GOOD',
              timestamp: tag.lastUpdated,
            });

            // ✅ Collect for InfluxDB batch write
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
            tag.quality = 'BAD';
            await tag.save();
            console.error(`❌ Read error for ${tag.tagName}:`, err.message);
          }
        }

        if (io && updates.length > 0) {
          io.emit('tagsUpdate', updates);
        }

        // ✅ Batch write to InfluxDB
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

        if (anySuccess) {
          consecutiveFailures = 0;
        } else if (tags.length > 0) {
          consecutiveFailures += 1;
          if (consecutiveFailures >= MAX_FAILURES) {
            console.warn(`⚠️  Modbus ${plc.name}: connection lost, stopping (plcManager will reconnect)`);
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

    this.intervals.set(plc._id.toString(), intervalId);

    return { success: true, message: 'Modbus polling started' };
  }

  /**
   * Read a single tag value from Modbus
   */
  async readTag(client, tag) {
    const address = parseInt(tag.plcAddress);

    if (isNaN(address)) {
      throw new Error(`Invalid Modbus address: ${tag.plcAddress}`);
    }

    // Holding Registers (40001-49999)
    if (address >= 40001 && address <= 49999) {
      const regAddr = address - 40001;

      if (tag.dataType === 'INT' || tag.dataType === 'WORD') {
        const data = await client.readHoldingRegisters(regAddr, 1);
        return data.data[0];
      }

      if (tag.dataType === 'DINT' || tag.dataType === 'DWORD') {
        const data = await client.readHoldingRegisters(regAddr, 2);
        return (data.data[0] << 16) | data.data[1];
      }

      if (tag.dataType === 'REAL') {
        const data = await client.readHoldingRegisters(regAddr, 2);
        const buffer = Buffer.alloc(4);
        buffer.writeUInt16BE(data.data[0], 0);
        buffer.writeUInt16BE(data.data[1], 2);
        return parseFloat(buffer.readFloatBE(0).toFixed(2));
      }
    }

    // Coils (00001-09999)
    if (address >= 1 && address <= 9999) {
      const data = await client.readCoils(address - 1, 1);
      return data.data[0];
    }

    // Input Registers (30001-39999)
    if (address >= 30001 && address <= 39999) {
      const data = await client.readInputRegisters(address - 30001, 1);
      return data.data[0];
    }

    throw new Error(`Unsupported address: ${tag.plcAddress}`);
  }

  /**
   * Write value to Modbus tag
   */
  async writeTag(plcId, tag, value) {
    const client = this.connections.get(plcId.toString());
    if (!client) {
      throw new Error('PLC not connected');
    }

    const address = parseInt(tag.plcAddress);

    if (address >= 40001 && address <= 49999) {
      await client.writeRegister(address - 40001, value);
    } else if (address >= 1 && address <= 9999) {
      await client.writeCoil(address - 1, value);
    }

    // ✅ Also log to InfluxDB on write (immediate)
    if (tag.enableLogging && isInfluxAvailable()) {
      const influxValue = toInfluxValue(value, tag.dataType);
      if (influxValue !== null) {
        try {
          await writeMultipleTagValues([{
            tagId: tag._id.toString(),
            tagName: tag.tagName,
            value: influxValue,
            unit: tag.unit || '',
            plcId: plcId.toString(),
            quality: 'GOOD',
          }]);
        } catch {}
      }
    }

    return true;
  }

  /**
   * Stop polling
   */
  stop(plcId) {
    const id = plcId.toString();

    if (this.intervals.has(id)) {
      clearInterval(this.intervals.get(id));
      this.intervals.delete(id);
    }

    if (this.connections.has(id)) {
      const client = this.connections.get(id);
      client.close(() => {});
      this.connections.delete(id);
      console.log(`⏹️  Modbus disconnected: ${id}`);
    }

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

module.exports = new ModbusService();