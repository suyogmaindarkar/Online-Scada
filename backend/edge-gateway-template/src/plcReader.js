// ═══════════════════════════════════════════════════════════
// PLC Reader Manager — Clean Value-Change Polling Engine
// ═══════════════════════════════════════════════════════════

const S7Reader = require('./readers/s7Reader');
const ModbusReader = require('./readers/modbusReader');
const OPCUAReader = require('./readers/opcuaReader');
const EthernetIPReader = require('./readers/ethernetIpReader');

class PLCReader {
    constructor(config, cloudBridge, verbose = false) {
        this.config = config;
        this.cloudBridge = cloudBridge;
        this.verbose = verbose;
        this.readers = new Map();
        this.intervals = new Map();
    this.previousValues = new Map();
    this.polling = new Set();
        this.statuses = new Map();
        this.stats = { totalReads: 0, totalErrors: 0, tagsReadPerSecond: 0, _readsThisSecond: 0 };
    }

    async startAll() {
        const plcs = this.config.plcs || [];
        for (const plcConfig of plcs) {
            await this._startPLC(plcConfig);
        }
    }

    _setStatus(plcConfig, state, message, extra = {}) {
        const status = {
            plcId: String(plcConfig.plcId),
            plcName: plcConfig.plcName || 'Equipment',
            protocol: plcConfig.protocol || '',
            state,
            message,
            isConnected: state === 'connected' || state === 'connected_no_tags' || state === 'streaming' || state === 'connected_no_data',
            hasTags: Array.isArray(plcConfig.tags) && plcConfig.tags.length > 0,
            tagCount: Array.isArray(plcConfig.tags) ? plcConfig.tags.length : 0,
            timestamp: Date.now(),
            ...extra,
        };
        this.statuses.set(String(plcConfig.plcId), status);
        plcConfig.isConnected = status.isConnected;
        plcConfig.connectionState = state;
        plcConfig.connectionMessage = message;
    }

    async _startPLC(plcConfig) {
        const plcId = plcConfig.plcId;
        const protocol = (plcConfig.protocol || '').toLowerCase();
        let reader;
        try {
            if (protocol === 's7') reader = new S7Reader(plcConfig);
            else if (protocol.includes('modbus')) reader = new ModbusReader(plcConfig);
            else if (protocol.includes('opc')) reader = new OPCUAReader(plcConfig);
            else if (protocol.includes('ethernet')) reader = new EthernetIPReader(plcConfig);
            else return;

            const success = await reader.connect();
            this.readers.set(plcId, reader);

            if (!success || reader.isConnected === false) {
                this._setStatus(plcConfig, 'failed', 'Equipment connection failed');
            } else if (!plcConfig.tags?.length) {
                this._setStatus(plcConfig, 'connected_no_tags', 'Equipment connected. Add tags to start data streaming');
            } else {
                this._setStatus(plcConfig, 'connected', 'Equipment connected. Waiting for tag data');
            }

            const intervalId = setInterval(() => this._pollPLC(plcId, plcConfig), plcConfig.pollIntervalMs || 1000);
            this.intervals.set(plcId, intervalId);
        } catch (err) {
            this._setStatus(plcConfig, 'failed', 'Equipment connection failed', { error: err.message });
        }
    }

    async _pollPLC(plcId, plcConfig) {
        if (this.polling.has(plcId)) return;
        this.polling.add(plcId);

        try {
            const reader = this.readers.get(plcId);
            if (!reader) return;

            if (reader.isConnected === false) {
                this._setStatus(plcConfig, 'failed', 'Equipment connection lost');
                return;
            }

            const tags = plcConfig.tags || [];
            if (tags.length === 0) {
                this._setStatus(plcConfig, 'connected_no_tags', 'Equipment connected. Add tags to start data streaming');
                return;
            }

            const values = await reader.readTags(tags);
            if (!values?.length) {
                this._setStatus(plcConfig, 'connected_no_data', 'Equipment connected, but no tag values were returned');
                return;
            }

            this.stats.totalReads += values.length;
            this.stats._readsThisSecond += values.length;
            this._setStatus(plcConfig, 'streaming', 'Equipment connected and data is streaming', { lastDataAt: Date.now() });

            const changed = [];
            const now = Date.now();
            for (const val of values) {
                const prev = this.previousValues.get(val.tagId);
                if (!prev || prev.value !== val.value) {
                    changed.push({ tagId: val.tagId, tagName: val.tagName, value: val.value, quality: val.quality || 'GOOD', timestamp: now });
                    this.previousValues.set(val.tagId, { value: val.value, timestamp: now });
                }
            }

            if (changed.length) {
                this.cloudBridge.sendTagValues(changed);
            }
        } catch (err) {
            this.stats.totalErrors += 1;
            this._setStatus(plcConfig, 'connected_read_error', 'Equipment connected, but tag reading failed', { error: err.message });
        } finally {
            this.polling.delete(plcId);
        }
    }

    // ─── REMOTE EQUIPMENT COMMANDS (start/stop/restart from website) ───
    stopOnePLC(plcId) {
        const k = String(plcId);
        if (this.intervals.has(k)) clearInterval(this.intervals.get(k));
        this.intervals.delete(k);
        this.readers.delete(k);
        this.polling.delete(k);
        this.previousValues.delete(k);
        const status = this.statuses.get(k);
        if (status) { status.state = 'stopped'; status.message = 'Connection is stopped'; status.isConnected = false; }
    }

    async startOnePLC(plcConfig) {
        if (!plcConfig) return { ok: false, error: 'no config' };
        const k = String(plcConfig.plcId);
        this.stopOnePLC(k);
        const protocol = (plcConfig.protocol || '').toLowerCase();

        let reader;
        try {
            if (protocol === 's7') reader = new S7Reader(plcConfig);
            else if (protocol.includes('modbus')) reader = new ModbusReader(plcConfig);
            else if (protocol.includes('opc')) reader = new OPCUAReader(plcConfig);
            else if (protocol.includes('ethernet') || protocol === 'ab') reader = new EthernetIPReader(plcConfig);
            else return { ok: false, error: 'unsupported protocol' };

            const success = await reader.connect();
            this.readers.set(k, reader);
            const intervalId = setInterval(() => this._pollPLC(k, plcConfig), plcConfig.pollIntervalMs || 1000);
            this.intervals.set(k, intervalId);

            if (success === false || reader.isConnected === false) {
                this._setStatus(plcConfig, 'failed', 'Equipment connection failed');
                return { ok: false, error: 'connection failed' };
            }
            this._setStatus(plcConfig, 'connected', 'Equipment connected');
            return { ok: true, connected: true };
        } catch (err) {
            this._setStatus(plcConfig, 'failed', 'Equipment connection failed', { error: err.message });
            return { ok: false, error: err.message };
        }
    }

    async handleEquipmentCommand(cmd) {
        const { requestId, equipmentId, action } = cmd || {};
        const plcId = equipmentId ? String(equipmentId) : '';
        const reply = { requestId, equipmentId, action };

        if (!plcId) {
            this.cloudBridge.sendEquipmentCommandResult({ ...reply, success: false, state: 'error', message: 'Missing equipment id' });
            return;
        }

        const plcConfig = (this.config.plcs || []).find((p) => String(p.plcId) === plcId);

        if (action === 'start') {
            if (!plcConfig) {
                this.cloudBridge.sendEquipmentCommandResult({
                    ...reply, success: false, state: 'not_configured', message: 'Equipment config not delivered yet. Try again shortly.',
                });
                return;
            }
            const result = await this.startOnePLC(plcConfig);
            this.cloudBridge.sendEquipmentCommandResult({
                ...reply,
                success: result.ok,
                state: result.ok ? 'streaming' : 'failed',
                message: result.ok ? 'Equipment data is streaming' : (result.error || 'Equipment connection failed'),
            });
            return;
        }

        if (action === 'stop') {
            this.stopOnePLC(plcId);
            if (plcConfig) this._setStatus(plcConfig, 'stopped', 'Connection is stopped');
            this.cloudBridge.sendEquipmentCommandResult({
                ...reply, success: true, state: 'stopped', message: 'Equipment connection stopped',
            });
            return;
        }

        if (action === 'restart') {
            if (!plcConfig) {
                this.cloudBridge.sendEquipmentCommandResult({
                    ...reply, success: false, state: 'not_configured', message: 'Equipment config not available',
                });
                return;
            }
            const result = await this.startOnePLC(plcConfig);
            this.cloudBridge.sendEquipmentCommandResult({
                ...reply,
                success: result.ok,
                state: result.ok ? 'streaming' : 'failed',
                message: result.ok ? 'Equipment restarted and polling' : (result.error || 'Restart failed'),
            });
            return;
        }

        this.cloudBridge.sendEquipmentCommandResult({ ...reply, success: false, state: 'error', message: 'Unknown command: ' + action });
    }

    async handleWriteCommand(cmd) {
        for (const [, reader] of this.readers) {
            try {
                await reader.writeTag(cmd.address, cmd.value, cmd.dataType);
                return;
            } catch (err) {}
        }
    }

    async reload(newPlcConfigs) {
        this.stopAll();
        this.config.plcs = newPlcConfigs;
        this.statuses.clear();
        await this.startAll();
    }

    stopAll() {
        for (const [, id] of this.intervals) clearInterval(id);
        this.intervals.clear();
        for (const [, r] of this.readers) try { r.disconnect(); } catch (e) {}
        this.readers.clear();
    }

    getStats() {
        const tagsReadPerSecond = this.stats._readsThisSecond;
        this.stats._readsThisSecond = 0;
        this.stats.tagsReadPerSecond = tagsReadPerSecond;
        return { ...this.stats, equipmentStatuses: Array.from(this.statuses.values()) };
    }
}

module.exports = PLCReader;
