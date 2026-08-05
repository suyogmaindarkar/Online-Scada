// ═══════════════════════════════════════════════════════════
// Simulation Service — Realistic PLC simulation
//
// Task Bundle applied:
//   ✅ SIM     — Auto-create 5 realistic tags on start
//   ✅ SIM     — 5 patterns: sine, walk, ramp, toggle, counter
//   ✅ SIM     — Pause updates for 5s after user writes
//   ✅ SIM     — Auto-cleanup tags when PLC deleted
//   ✅ INFLUX  — Batch write to InfluxDB every polling cycle
//   ✅ INFLUX  — All 5 sim tags now have enableLogging: true
// ═══════════════════════════════════════════════════════════

const Tag = require('../models/Tag');
const PLCConnection = require('../models/PLCConnection');
const { writeMultipleTagValues, isInfluxAvailable } = require('./influxService');

// ─── How long to pause a tag's simulation after user writes to it ───
const WRITE_PAUSE_MS = 5000;

// ─── Template for the 5 demo tags ───
// ✅ ALL tags now have enableLogging: true so they all appear in Trends
const SIM_TAG_TEMPLATES = [
  {
    suffix: 'TEMPERATURE',
    plcAddress: '40001',
    dataType: 'REAL',
    unit: '°C',
    minValue: 20,
    maxValue: 80,
    description: 'Simulated temperature sensor (sine wave)',
    simulationPattern: 'sine',
    group: 'Simulation',
    accessType: 'READ_WRITE',
    enableLogging: true,
  },
  {
    suffix: 'PRESSURE',
    plcAddress: '40002',
    dataType: 'REAL',
    unit: 'bar',
    minValue: 0,
    maxValue: 10,
    description: 'Simulated pressure sensor (random walk)',
    simulationPattern: 'walk',
    group: 'Simulation',
    accessType: 'READ_WRITE',
    enableLogging: true,
  },
  {
    suffix: 'LEVEL',
    plcAddress: '40003',
    dataType: 'INT',
    unit: '%',
    minValue: 0,
    maxValue: 100,
    description: 'Simulated tank level (fill/drain cycle)',
    simulationPattern: 'ramp',
    group: 'Simulation',
    accessType: 'READ_WRITE',
    enableLogging: true,
  },
  {
    suffix: 'MOTOR_RUN',
    plcAddress: '40004',
    dataType: 'BOOL',
    unit: '',
    minValue: 0,
    maxValue: 1,
    description: 'Simulated motor run status (toggles every 15s)',
    simulationPattern: 'toggle',
    group: 'Simulation',
    accessType: 'READ_WRITE',
    enableLogging: true,   // ✅ Now enabled
  },
  {
    suffix: 'COUNTER',
    plcAddress: '40005',
    dataType: 'DINT',
    unit: '',
    minValue: 0,
    maxValue: 9999,
    description: 'Simulated production counter (increments every 2s)',
    simulationPattern: 'counter',
    group: 'Simulation',
    accessType: 'READ_WRITE',
    enableLogging: true,   // ✅ Now enabled
  },
];

// ═══════════════════════════════════════════════════════════
// HELPER: Convert any tag value to a number for InfluxDB
// InfluxDB's floatField can only store numbers — no booleans/strings
// ═══════════════════════════════════════════════════════════
const toInfluxValue = (value, dataType) => {
  if (value === null || value === undefined) return null;

  // BOOL → 0 or 1
  if (dataType === 'BOOL' || typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  // STRING → skip (can't store in floatField)
  if (dataType === 'STRING' || typeof value === 'string') {
    const n = Number(value);
    return isNaN(n) ? null : n; // Return null if string isn't numeric → will be filtered out
  }

  // Number types → ensure it's actually a number
  const n = Number(value);
  return isNaN(n) ? null : n;
};

class SimulationService {
  constructor() {
    this.intervals = new Map();
    this.startTimes = new Map();
    this.walkStates = new Map();
    this.rampStates = new Map();
    this.counterStates = new Map();

    // ✅ Track InfluxDB write stats per PLC (for logging every N cycles)
    this.influxWriteCounter = new Map();  // plcId → number of successful writes since last log
    this.INFLUX_LOG_EVERY = 10; // Log to terminal every 10 successful batches
  }

  // ═══════════════════════════════════════════════════════════
  // START simulation for a PLC
  // ═══════════════════════════════════════════════════════════
  async start(plc, io) {
    console.log(`🎮 Starting SIMULATION for PLC: ${plc.name}`);

    this.stop(plc._id);

    if (plc.isSimulation) {
      await this.ensureSimulationTags(plc);
    }

    this.startTimes.set(plc._id.toString(), Date.now());
    this.influxWriteCounter.set(plc._id.toString(), 0);

    const intervalId = setInterval(async () => {
      try {
        const tags = await Tag.find({
          plcConnection: plc._id,
          isActive: true,
        });

        const updates = [];
        const influxPoints = []; // ✅ Collect for batch write
        const now = Date.now();

        for (const tag of tags) {
          // Skip if paused (user recently wrote)
          if (tag.simulationPausedUntil && new Date(tag.simulationPausedUntil).getTime() > now) {
            continue;
          }

          const newValue = this.generateValue(tag, plc._id);

          // Update in database
          tag.currentValue = newValue;
          tag.quality = 'GOOD';
          tag.lastUpdated = Date.now();
          if (tag.simulationPausedUntil) {
            tag.simulationPausedUntil = null;
          }
          await tag.save();

          updates.push({
            tagName: tag.tagName,
            value: newValue,
            quality: 'GOOD',
            timestamp: tag.lastUpdated,
          });

          // ✅ Collect for InfluxDB batch write (only tags with logging enabled)
          if (tag.enableLogging) {
            const influxValue = toInfluxValue(newValue, tag.dataType);
            if (influxValue !== null) {  // Skip non-numeric tags
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
        }

        // Broadcast to Socket.io
        if (io && updates.length > 0) {
          io.emit('tagsUpdate', updates);
        }

        // ✅ Batch write to InfluxDB (1 call for ALL loggable tags)
        if (influxPoints.length > 0 && isInfluxAvailable()) {
          try {
            const success = await writeMultipleTagValues(influxPoints);
            if (success) {
              // Log every N cycles (avoid spam)
              const counter = (this.influxWriteCounter.get(plc._id.toString()) || 0) + 1;
              this.influxWriteCounter.set(plc._id.toString(), counter);
              if (counter % this.INFLUX_LOG_EVERY === 0) {
                console.log(`📈 [${plc.name}] Logged ${influxPoints.length} values to InfluxDB (${counter} batches so far)`);
              }
            }
          } catch (influxErr) {
            // Silent — influxService already logs errors with anti-spam
          }
        }
      } catch (error) {
        console.error(`❌ Simulation error for ${plc.name}:`, error.message);
      }
    }, plc.pollingRate || 1000);

    this.intervals.set(plc._id.toString(), intervalId);

    return { success: true, message: 'Simulation started' };
  }

  // ═══════════════════════════════════════════════════════════
  // ENSURE simulation tags exist
  // ✅ Now also UPGRADES existing tags to have enableLogging: true
  //    (so tags created before this fix will start logging)
  // ═══════════════════════════════════════════════════════════
  async ensureSimulationTags(plc) {
    const prefix = plc.simulationPrefix || 'SIM_';
    const created = [];
    const reused = [];
    const upgraded = [];

    for (const template of SIM_TAG_TEMPLATES) {
      const tagName = `${prefix}${template.suffix}`.toUpperCase();

      let tag = await Tag.findOne({ tagName });

      if (tag) {
        // ─── Upgrade existing tag: ensure sim flags + enableLogging ───
        let needsUpdate = false;

        tag.isSimulationTag = true;
        tag.simulationPattern = template.simulationPattern;
        tag.plcConnection = plc._id;
        tag.simulationPausedUntil = null;

        // ✅ Upgrade: if enableLogging is not set (existing tag from before fix)
        if (template.enableLogging && !tag.enableLogging) {
          tag.enableLogging = true;
          needsUpdate = true;
        }

        await tag.save();

        if (needsUpdate) {
          upgraded.push(tagName);
        } else {
          reused.push(tagName);
        }
      } else {
        try {
          tag = await Tag.create({
            tagName,
            description: template.description,
            group: template.group,
            dataType: template.dataType,
            plcConnection: plc._id,
            plcAddress: template.plcAddress,
            accessType: template.accessType,
            currentValue: template.dataType === 'BOOL' ? false : template.minValue,
            unit: template.unit,
            minValue: template.minValue,
            maxValue: template.maxValue,
            enableLogging: template.enableLogging || false,
            isSimulationTag: true,
            simulationPattern: template.simulationPattern,
          });
          created.push(tagName);
        } catch (err) {
          console.warn(`⚠️  Could not create sim tag ${tagName}: ${err.message}`);
        }
      }
    }

    if (created.length > 0) {
      console.log(`✅ Simulation tags created for ${plc.name}: ${created.join(', ')}`);
    }
    if (upgraded.length > 0) {
      console.log(`🔄 Simulation tags upgraded (logging enabled) for ${plc.name}: ${upgraded.join(', ')}`);
    }
    if (reused.length > 0) {
      console.log(`♻️  Simulation tags reused for ${plc.name}: ${reused.join(', ')}`);
    }

    return { created, reused, upgraded };
  }

  // ═══════════════════════════════════════════════════════════
  // STOP simulation
  // ═══════════════════════════════════════════════════════════
  stop(plcId) {
    const id = plcId.toString();
    if (this.intervals.has(id)) {
      clearInterval(this.intervals.get(id));
      this.intervals.delete(id);
      this.startTimes.delete(id);
      this.influxWriteCounter.delete(id);
      console.log(`⏹️  Simulation stopped for PLC: ${id}`);
      return true;
    }
    return false;
  }

  // ═══════════════════════════════════════════════════════════
  // DELETE simulation tags
  // ═══════════════════════════════════════════════════════════
  async deleteSimulationTags(plcId) {
    try {
      const result = await Tag.deleteMany({
        plcConnection: plcId,
        isSimulationTag: true,
      });
      console.log(`🗑️  Deleted ${result.deletedCount} simulation tags for PLC: ${plcId}`);
      return result.deletedCount;
    } catch (error) {
      console.error(`❌ Failed to delete sim tags for ${plcId}:`, error.message);
      return 0;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // WRITE handler
  // ═══════════════════════════════════════════════════════════
  async writeTag(plcId, tag, value) {
    try {
      await Tag.findByIdAndUpdate(tag._id, {
        currentValue: value,
        simulationPausedUntil: new Date(Date.now() + WRITE_PAUSE_MS),
        lastUpdated: new Date(),
      });
      console.log(`✍️  Sim write: ${tag.tagName} = ${value} (paused for ${WRITE_PAUSE_MS / 1000}s)`);

      // ✅ Also log the write to InfluxDB (immediate write for user actions)
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

      return { success: true, simulated: true, pausedFor: WRITE_PAUSE_MS };
    } catch (error) {
      console.error('Sim write error:', error.message);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // GENERATE realistic value based on pattern
  // ═══════════════════════════════════════════════════════════
  generateValue(tag, plcId) {
    const plcStartTime = this.startTimes.get(plcId.toString()) || Date.now();
    const elapsed = (Date.now() - plcStartTime) / 1000;
    const tagId = tag._id.toString();

    const pattern = tag.simulationPattern || this.getDefaultPatternForType(tag.dataType);

    switch (pattern) {
      case 'sine': {
        const min = tag.minValue ?? 0;
        const max = tag.maxValue ?? 100;
        const range = max - min;
        const sineValue = Math.sin((elapsed / 30) * 2 * Math.PI) * 0.5 + 0.5;
        const val = min + sineValue * range;
        return tag.dataType === 'REAL' ? parseFloat(val.toFixed(2)) : Math.round(val);
      }

      case 'walk': {
        const min = tag.minValue ?? 0;
        const max = tag.maxValue ?? 100;
        let current = this.walkStates.get(tagId);
        if (current === undefined) current = (min + max) / 2;
        const range = max - min;
        const step = (Math.random() - 0.5) * range * 0.04;
        current += step;
        if (current < min) current = min + Math.random() * (range * 0.1);
        if (current > max) current = max - Math.random() * (range * 0.1);
        this.walkStates.set(tagId, current);
        return tag.dataType === 'REAL' ? parseFloat(current.toFixed(2)) : Math.round(current);
      }

      case 'ramp': {
        const min = tag.minValue ?? 0;
        const max = tag.maxValue ?? 100;
        let state = this.rampStates.get(tagId);
        if (!state) state = { direction: 1, value: min };
        const range = max - min;
        const step = range * 0.02;
        state.value += state.direction * step;
        if (state.value >= max) { state.value = max; state.direction = -1; }
        else if (state.value <= min) { state.value = min; state.direction = 1; }
        this.rampStates.set(tagId, state);
        return tag.dataType === 'REAL' ? parseFloat(state.value.toFixed(2)) : Math.round(state.value);
      }

      case 'toggle': {
        return Math.floor(elapsed / 15) % 2 === 0;
      }

      case 'counter': {
        const min = tag.minValue ?? 0;
        const max = tag.maxValue ?? 9999;
        let current = this.counterStates.get(tagId);
        if (current === undefined) current = min;
        current += 1;
        if (current > max) current = min;
        this.counterStates.set(tagId, current);
        return current;
      }

      default:
        return this.generateDefaultValue(tag, elapsed);
    }
  }

  generateDefaultValue(tag, elapsed) {
    switch (tag.dataType) {
      case 'BOOL':
        return Math.floor(elapsed / 5) % 2 === 0;
      case 'INT':
      case 'DINT':
      case 'WORD':
      case 'DWORD':
      case 'BYTE': {
        const min = tag.minValue || 0;
        const max = tag.maxValue || 100;
        const range = max - min;
        const sineValue = Math.sin(elapsed / 5) * 0.5 + 0.5;
        return Math.round(min + sineValue * range);
      }
      case 'REAL': {
        const minR = tag.minValue || 0;
        const maxR = tag.maxValue || 100;
        const rangeR = maxR - minR;
        const sineR = Math.sin(elapsed / 3) * 0.5 + 0.5;
        return parseFloat((minR + sineR * rangeR).toFixed(2));
      }
      case 'STRING':
        return `Sim_${Math.floor(elapsed)}`;
      default:
        return 0;
    }
  }

  getDefaultPatternForType(dataType) {
    switch (dataType) {
      case 'BOOL': return 'toggle';
      case 'REAL': return 'sine';
      case 'INT':
      case 'DINT':
      case 'WORD':
      case 'DWORD':
      case 'BYTE': return 'sine';
      default: return 'none';
    }
  }

  isRunning(plcId) {
    return this.intervals.has(plcId.toString());
  }

  stopAll() {
    for (const [id, intervalId] of this.intervals) {
      clearInterval(intervalId);
    }
    this.intervals.clear();
    this.startTimes.clear();
    this.walkStates.clear();
    this.rampStates.clear();
    this.counterStates.clear();
    this.influxWriteCounter.clear();
    console.log('⏹️  All simulations stopped');
  }
}

module.exports = new SimulationService();