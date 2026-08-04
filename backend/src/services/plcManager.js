// ═══════════════════════════════════════════════════════════
// PLC Manager - Central orchestrator with auto-reconnect
// ═══════════════════════════════════════════════════════════

const simulationService = require('./simulationService');
const modbusService = require('./modbusService');
const s7Service = require('./s7Service');
const opcuaService = require('./opcuaService');
const PLCConnection = require('../models/PLCConnection');

// ─── Reconnection settings ─────────────────────────────────────────────────
const RECONNECT_CONFIG = {
  enabled: true,
  initialDelay: 2000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  maxAttempts: Infinity,
  healthCheckInterval: 10000,
};

class PLCManager {
  constructor() {
    this.io = null;
    this.plcState = new Map();    // plcId -> { status, attempts, ... }
    this.retryTimers = new Map(); // plcId -> setTimeout ID
    this.healthCheckTimer = null;

    // ✅ T010: Track in-progress connection attempts to prevent duplicates
    this.connectingSet = new Set(); // plcId -> currently attempting connection
  }

  init(io) {
    this.io = io;
    console.log('📡 PLC Manager initialized');
    this.startHealthMonitor();
  }

  getService(protocol) {
    switch (protocol) {
      case 'SIMULATION':  return simulationService;
      case 'MODBUS_TCP':
      case 'MODBUS_RTU':  return modbusService;
      case 'S7':          return s7Service;
      case 'OPC_UA':      return opcuaService;
      default:
        throw new Error(`Unsupported protocol: ${protocol}`);
    }
  }

  async start(plcId) {
    const plc = await PLCConnection.findById(plcId);
    if (!plc) throw new Error('PLC not found');
    if (!plc.isActive) throw new Error('PLC is disabled');
    return this._startWithReconnect(plc);
  }

  // ─── Internal: Start with auto-reconnect logic ─────────────────────────
  async _startWithReconnect(plc) {
    const id = plc._id.toString();

    // ✅ T010: Prevent duplicate simultaneous connection attempts
    if (this.connectingSet.has(id)) {
      console.log(`⏳ ${plc.name} — connection already in progress, skipping duplicate`);
      return { success: false, message: 'Connection already in progress' };
    }

    // ✅ T010: Also skip if already connected and service is running
    const currentState = this.plcState.get(id);
    if (currentState?.status === 'connected') {
      try {
        const service = this.getService(plc.protocol);
        if (service.isRunning(id)) {
          console.log(`✅ ${plc.name} — already connected and running, skipping`);
          return { success: true, message: 'Already running' };
        }
      } catch {
        // Protocol error — allow reconnect
      }
    }

    // Cancel any pending retry before new attempt
    this._cancelRetry(id);

    // Mark as connecting
    this.connectingSet.add(id);

    try {
      const service = this.getService(plc.protocol);
      await service.start(plc, this.io);

      // ✅ Connection successful — reset state
      this.plcState.set(id, {
        status: 'connected',
        attempts: 0,
        lastConnected: Date.now(),
        lastError: null,
        protocol: plc.protocol,
        name: plc.name,
      });

      plc.isConnected = true;
      plc.lastConnected = Date.now();
      await plc.save();

      this._broadcastStatus(plc, 'connected', null);
      console.log(`✅ ${plc.name} — connected`);
      return { success: true, message: `PLC ${plc.name} started` };

    } catch (error) {
      // ❌ Connection failed — schedule retry
      const state = this.plcState.get(id) || {
        attempts: 0,
        protocol: plc.protocol,
        name: plc.name,
      };

      state.status = 'reconnecting';
      state.attempts += 1;
      state.lastError = error.message;
      state.protocol = plc.protocol;
      state.name = plc.name;
      this.plcState.set(id, state);

      plc.isConnected = false;
      await plc.save();

      const delay = this._getRetryDelay(state.attempts);

      console.warn(`⚠️  ${plc.name} — connect failed (attempt ${state.attempts}): ${error.message}`);
      console.warn(`   Retrying in ${delay / 1000}s...`);

      this._broadcastStatus(plc, 'reconnecting', {
        attempts: state.attempts,
        nextRetryIn: delay,
        error: error.message,
      });

      if (RECONNECT_CONFIG.enabled && state.attempts < RECONNECT_CONFIG.maxAttempts) {
        this._scheduleRetry(id, delay);
      }

      throw error;
    } finally {
      // ✅ T010: Always clear the connecting flag when done
      this.connectingSet.delete(id);
    }
  }

  // ─── Schedule automatic retry ──────────────────────────────────────────
  _scheduleRetry(plcId, delay) {
    this._cancelRetry(plcId);

    const timer = setTimeout(async () => {
      try {
        const plc = await PLCConnection.findById(plcId);
        if (!plc || !plc.isActive) {
          console.log(`⏸  Skipping reconnect for ${plcId} — PLC no longer active`);
          this._cleanupState(plcId);
          return;
        }
        console.log(`🔄 Retrying connection to ${plc.name}...`);
        await this._startWithReconnect(plc);
      } catch (err) {
        // Error handled in _startWithReconnect (schedules next retry)
      }
    }, delay);

    this.retryTimers.set(plcId, timer);
  }

  _cancelRetry(plcId) {
    const id = plcId.toString();
    if (this.retryTimers.has(id)) {
      clearTimeout(this.retryTimers.get(id));
      this.retryTimers.delete(id);
    }
  }

  _cleanupState(plcId) {
    const id = plcId.toString();
    this._cancelRetry(id);
    this.plcState.delete(id);
    this.connectingSet.delete(id);
  }

  // ─── Exponential backoff: 2s → 4s → 8s → 16s → 30s max ──────────────
  _getRetryDelay(attempts) {
    const delay = RECONNECT_CONFIG.initialDelay *
      Math.pow(RECONNECT_CONFIG.backoffMultiplier, attempts - 1);
    return Math.min(delay, RECONNECT_CONFIG.maxDelay);
  }

  // ─── Broadcast status to all connected clients ─────────────────────────
  _broadcastStatus(plc, status, extra = null) {
    if (!this.io) return;
    this.io.emit('plcStatus', {
      plcId: plc._id.toString(),
      name: plc.name,
      protocol: plc.protocol,
      status,
      isConnected: status === 'connected',
      ...(extra || {}),
      timestamp: Date.now(),
    });
  }

  // ─── Health Monitor — periodic check ──────────────────────────────────
  startHealthMonitor() {
    if (this.healthCheckTimer) return;

    this.healthCheckTimer = setInterval(async () => {
      try {
        for (const [id, state] of this.plcState.entries()) {
          if (state.status !== 'connected') continue;

          // ✅ T010: Skip if already attempting reconnect
          if (this.connectingSet.has(id)) continue;

          const service = this.getService(state.protocol);
          const isRunning = service.isRunning(id);

          if (!isRunning) {
            console.warn(`⚠️  ${state.name} — service stopped unexpectedly, attempting reconnect`);
            const plc = await PLCConnection.findById(id);
            if (plc && plc.isActive) {
              state.status = 'reconnecting';
              state.attempts = 0;
              this.plcState.set(id, state);
              try {
                await this._startWithReconnect(plc);
              } catch (err) {
                // Handled internally
              }
            }
          }
        }
      } catch (err) {
        console.error('Health monitor error:', err.message);
      }
    }, RECONNECT_CONFIG.healthCheckInterval);
  }

  stopHealthMonitor() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  // ─── Stop PLC (manual, no retry) ──────────────────────────────────────
  async stop(plcId) {
    const plc = await PLCConnection.findById(plcId);
    if (!plc) throw new Error('PLC not found');

    const id = plc._id.toString();
    this._cancelRetry(id);
    this.plcState.delete(id);
    this.connectingSet.delete(id);

    const service = this.getService(plc.protocol);
    await service.stop(plc._id);

    plc.isConnected = false;
    await plc.save();

    this._broadcastStatus(plc, 'disconnected');
    console.log(`⏹️  ${plc.name} — stopped manually`);
    return { success: true, message: `PLC ${plc.name} stopped` };
  }

  isRunning(plcId, protocol) {
    try {
      const service = this.getService(protocol);
      return service.isRunning(plcId);
    } catch {
      return false;
    }
  }

  getStatus(plcId) {
    const id = plcId.toString();
    const state = this.plcState.get(id);
    if (!state) return { status: 'disconnected', attempts: 0 };
    return {
      status: state.status,
      attempts: state.attempts,
      lastConnected: state.lastConnected,
      lastError: state.lastError,
    };
  }

  getAllStatuses() {
    const result = {};
    for (const [id, state] of this.plcState.entries()) {
      result[id] = { ...state };
    }
    return result;
  }

  async writeTag(tag, value) {
    try {
      const plc = await PLCConnection.findById(tag.plcConnection);
      if (!plc) throw new Error('PLC not found');
      const service = this.getService(plc.protocol);
      if (plc.protocol === 'SIMULATION') return { success: true, simulated: true };
      if (service.writeTag) await service.writeTag(plc._id, tag, value);
      return { success: true };
    } catch (error) {
      console.error(`❌ Write tag failed:`, error.message);
      throw error;
    }
  }

  // ─── Auto-start all active PLCs on server boot ─────────────────────────
  async startAll() {
    try {
      const plcs = await PLCConnection.find({ isActive: true });
      for (const plc of plcs) {
        try {
          await this.start(plc._id);
        } catch (err) {
          console.warn(`⚠️  Initial start failed for ${plc.name}, will auto-retry`);
        }
      }
      console.log(`✅ Auto-started ${plcs.length} PLCs (auto-reconnect enabled)`);
    } catch (error) {
      console.error('❌ Failed to auto-start PLCs:', error.message);
    }
  }

  // ─── Stop all PLCs and cleanup ─────────────────────────────────────────
  stopAll() {
    for (const timer of this.retryTimers.values()) clearTimeout(timer);
    this.retryTimers.clear();
    this.plcState.clear();
    this.connectingSet.clear();
    this.stopHealthMonitor();

    simulationService.stopAll();
    modbusService.stopAll();
    s7Service.stopAll();
    opcuaService.stopAll();

    console.log('⏹️  All PLCs stopped');
  }
}

module.exports = new PLCManager();