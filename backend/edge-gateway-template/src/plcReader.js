// ═══════════════════════════════════════════════════════════
// PLC Reader Manager — Instant Connection & Polling Engine
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
    }

    async startAll() {
        const plcs = this.config.plcs || [];
        for (const plcConfig of plcs) {
            await this._startPLC(plcConfig);
        }
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

            // Mark online immediately upon successful handshake
            plcConfig.isConnected = Boolean(success);

            const intervalId = setInterval(() => this._pollPLC(plcId, plcConfig), plcConfig.pollIntervalMs || 1000);
            this.intervals.set(plcId, intervalId);
        } catch (err) {
            plcConfig.isConnected = false;
        }
    }

    async _pollPLC(plcId, plcConfig) {
        const reader = this.readers.get(plcId);
        if (!reader) return;

        // Keep connection state live
        plcConfig.isConnected = reader.isConnected !== false;

        const tags = plcConfig.tags || [];
        if (tags.length === 0) return;

        try {
            const values = await reader.readTags(tags);
            if (!values?.length) return;

            const changed = [];
            const now = Date.now();
            for (const val of values) {
                const prev = this.previousValues.get(val.tagId);
                if (!prev || prev.value !== val.value || (now - prev.timestamp > 10000)) {
                    changed.push({ tagId: val.tagId, tagName: val.tagName, value: val.value, quality: val.quality || 'GOOD', timestamp: now });
                    this.previousValues.set(val.tagId, { value: val.value, timestamp: now });
                }
            }
            if (changed.length) this.cloudBridge.sendTagValues(changed);
        } catch (err) { }
    }

    async handleWriteCommand(cmd) {
        for (const [, reader] of this.readers) {
            try {
                await reader.writeTag(cmd.address, cmd.value, cmd.dataType);
                return;
            } catch (err) { }
        }
    }

    async reload(newPlcConfigs) {
        this.stopAll();
        this.config.plcs = newPlcConfigs;
        await this.startAll();
    }

    stopAll() {
        for (const [, id] of this.intervals) clearInterval(id);
        this.intervals.clear();
        for (const [, r] of this.readers) try { r.disconnect(); } catch (e) { }
        this.readers.clear();
    }
}

module.exports = PLCReader;