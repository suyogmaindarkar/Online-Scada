// ═══════════════════════════════════════════════════════════
// Simulation Service — Realistic PLC simulation
//
// Task Bundle applied:
//   ✅ SIM  — Auto-create 5 realistic tags on start
//   ✅ SIM  — 5 patterns: sine, walk, ramp, toggle, counter
//   ✅ SIM  — Pause updates for 5s after user writes
//   ✅ SIM  — Auto-cleanup tags when PLC deleted (not when stopped, per Option A)
// ═══════════════════════════════════════════════════════════

const Tag = require('../models/Tag');
const PLCConnection = require('../models/PLCConnection');

// ─── How long to pause a tag's simulation after user writes to it ───
const WRITE_PAUSE_MS = 5000;

// ─── Template for the 5 demo tags ───
// Address format matches Modbus Holding Register style (40001-40005)
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
  },
];

class SimulationService {
  constructor() {
    this.intervals = new Map();   // plcId → intervalId
    this.startTimes = new Map();  // plcId → timestamp (for pattern calculations)
    this.walkStates = new Map();  // tagId → current walk value (persists across updates)
    this.rampStates = new Map();  // tagId → { direction: 1 or -1, value }
    this.counterStates = new Map(); // tagId → current counter
  }

  // ═══════════════════════════════════════════════════════════
  // START simulation for a PLC
  // If PLC is a simulation PLC, auto-create/reuse the 5 demo tags
  // ═══════════════════════════════════════════════════════════
  async start(plc, io) {
    console.log(`🎮 Starting SIMULATION for PLC: ${plc.name}`);

    // Stop existing simulation if running
    this.stop(plc._id);

    // ─── Auto-create/reuse demo tags for simulation PLCs ───
    if (plc.isSimulation) {
      await this.ensureSimulationTags(plc);
    }

    // Get all tags for this PLC
    this.startTimes.set(plc._id.toString(), Date.now());

    const intervalId = setInterval(async () => {
      try {
        const tags = await Tag.find({
          plcConnection: plc._id,
          isActive: true,
        });

        const updates = [];
        const now = Date.now();

        for (const tag of tags) {
          // ✅ Skip if user recently wrote to this tag (5s pause)
          if (tag.simulationPausedUntil && new Date(tag.simulationPausedUntil).getTime() > now) {
            continue;
          }

          const newValue = this.generateValue(tag, plc._id);

          // Update in database
          tag.currentValue = newValue;
          tag.quality = 'GOOD';
          tag.lastUpdated = Date.now();
          // Clear pause flag once expired
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
        }

        // Broadcast all updates via Socket.io
        if (io && updates.length > 0) {
          io.emit('tagsUpdate', updates);
        }
      } catch (error) {
        console.error(`❌ Simulation error for ${plc.name}:`, error.message);
      }
    }, plc.pollingRate || 1000);

    this.intervals.set(plc._id.toString(), intervalId);

    return { success: true, message: 'Simulation started' };
  }

  // ═══════════════════════════════════════════════════════════
  // ENSURE simulation tags exist (create if missing — Option A)
  // Reuses existing tags if they exist to preserve user bindings
  // ═══════════════════════════════════════════════════════════
  async ensureSimulationTags(plc) {
    const prefix = plc.simulationPrefix || 'SIM_';
    const created = [];
    const reused = [];

    for (const template of SIM_TAG_TEMPLATES) {
      const tagName = `${prefix}${template.suffix}`.toUpperCase();

      // Check if tag exists
      let tag = await Tag.findOne({ tagName });

      if (tag) {
        // Reuse existing tag — just ensure sim flags are set + correct PLC
        tag.isSimulationTag = true;
        tag.simulationPattern = template.simulationPattern;
        tag.plcConnection = plc._id;
        tag.simulationPausedUntil = null; // Clear any stale pause
        await tag.save();
        reused.push(tagName);
      } else {
        // Create fresh
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
    if (reused.length > 0) {
      console.log(`♻️  Simulation tags reused for ${plc.name}: ${reused.join(', ')}`);
    }

    return { created, reused };
  }

  // ═══════════════════════════════════════════════════════════
  // STOP simulation for a PLC (keeps tags in DB — Option A)
  // ═══════════════════════════════════════════════════════════
  stop(plcId) {
    const id = plcId.toString();
    if (this.intervals.has(id)) {
      clearInterval(this.intervals.get(id));
      this.intervals.delete(id);
      this.startTimes.delete(id);
      console.log(`⏹️  Simulation stopped for PLC: ${id}`);
      return true;
    }
    return false;
  }

  // ═══════════════════════════════════════════════════════════
  // DELETE simulation tags (called when PLC is deleted, not stopped)
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
  // WRITE handler — called when user writes to a sim tag
  // Pauses updates for 5s so their value shows before pattern resumes
  // ═══════════════════════════════════════════════════════════
  async writeTag(plcId, tag, value) {
    try {
      // Set pause flag
      await Tag.findByIdAndUpdate(tag._id, {
        currentValue: value,
        simulationPausedUntil: new Date(Date.now() + WRITE_PAUSE_MS),
        lastUpdated: new Date(),
      });
      console.log(`✍️  Sim write: ${tag.tagName} = ${value} (paused for ${WRITE_PAUSE_MS / 1000}s)`);
      return { success: true, simulated: true, pausedFor: WRITE_PAUSE_MS };
    } catch (error) {
      console.error('Sim write error:', error.message);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // GENERATE realistic value based on tag's simulation pattern
  // ═══════════════════════════════════════════════════════════
  generateValue(tag, plcId) {
    const plcStartTime = this.startTimes.get(plcId.toString()) || Date.now();
    const elapsed = (Date.now() - plcStartTime) / 1000;
    const tagId = tag._id.toString();

    // Use pattern from tag, or fall back to defaults based on data type
    const pattern = tag.simulationPattern || this.getDefaultPatternForType(tag.dataType);

    switch (pattern) {
      // ─── SINE: Smooth breathing wave ───
      case 'sine': {
        const min = tag.minValue ?? 0;
        const max = tag.maxValue ?? 100;
        const range = max - min;
        // Period = 30 seconds for a nice slow breath
        const sineValue = Math.sin((elapsed / 30) * 2 * Math.PI) * 0.5 + 0.5;
        const val = min + sineValue * range;
        return tag.dataType === 'REAL' ? parseFloat(val.toFixed(2)) : Math.round(val);
      }

      // ─── WALK: Random walk within range ───
      case 'walk': {
        const min = tag.minValue ?? 0;
        const max = tag.maxValue ?? 100;
        let current = this.walkStates.get(tagId);
        if (current === undefined) {
          current = (min + max) / 2; // Start at midpoint
        }
        // Random step ±2% of range
        const range = max - min;
        const step = (Math.random() - 0.5) * range * 0.04;
        current += step;
        // Clamp
        if (current < min) current = min + Math.random() * (range * 0.1);
        if (current > max) current = max - Math.random() * (range * 0.1);
        this.walkStates.set(tagId, current);
        return tag.dataType === 'REAL' ? parseFloat(current.toFixed(2)) : Math.round(current);
      }

      // ─── RAMP: Fills up then drains down cyclically ───
      case 'ramp': {
        const min = tag.minValue ?? 0;
        const max = tag.maxValue ?? 100;
        let state = this.rampStates.get(tagId);
        if (!state) {
          state = { direction: 1, value: min };
        }
        // Move by 2% of range per tick
        const range = max - min;
        const step = range * 0.02;
        state.value += state.direction * step;

        if (state.value >= max) {
          state.value = max;
          state.direction = -1;
        } else if (state.value <= min) {
          state.value = min;
          state.direction = 1;
        }
        this.rampStates.set(tagId, state);
        return tag.dataType === 'REAL' ? parseFloat(state.value.toFixed(2)) : Math.round(state.value);
      }

      // ─── TOGGLE: Boolean flip every 15s ───
      case 'toggle': {
        // Toggle every 15 seconds
        return Math.floor(elapsed / 15) % 2 === 0;
      }

      // ─── COUNTER: Increments and wraps ───
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

      // ─── NONE / Default: Sine wave fallback ───
      default:
        return this.generateDefaultValue(tag, elapsed);
    }
  }

  // ─── Default value generator for tags with no simulationPattern ───
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
      case 'BYTE':
        return 'sine';
      default: return 'none';
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Check if simulation is running for a PLC
  // ═══════════════════════════════════════════════════════════
  isRunning(plcId) {
    return this.intervals.has(plcId.toString());
  }

  // ═══════════════════════════════════════════════════════════
  // Stop all simulations
  // ═══════════════════════════════════════════════════════════
  stopAll() {
    for (const [id, intervalId] of this.intervals) {
      clearInterval(intervalId);
    }
    this.intervals.clear();
    this.startTimes.clear();
    this.walkStates.clear();
    this.rampStates.clear();
    this.counterStates.clear();
    console.log('⏹️  All simulations stopped');
  }
}

module.exports = new SimulationService();