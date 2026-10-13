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
