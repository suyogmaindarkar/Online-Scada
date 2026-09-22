// ═══════════════════════════════════════════════════════════
// PLC Reader — Protocol Dispatcher
// ═══════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const S7Reader = require('./readers/s7Reader');
const ModbusReader = require('./readers/modbusReader');
const OPCUAReader = require('./readers/opcuaReader');

class PLCReader {
    constructor(config, cloudBridge, verbose = false) {
        this.config = config;
        this.cloudBridge = cloudBridge;
        this.verbose = verbose;

        this.readers = new Map();
        this.intervals = new Map();
        this.previousValues = new Map();

        this.stats = {
            totalReads: 0,
            totalErrors: 0,
            tagsReadPerSecond: 0,
            _readsThisSecond: 0,
        };

        this.statsInterval = null;
    }

    // ─── Start All PLC Readers ──────────────────────────────
    async startAll() {
        const plcs = this.config.plcs || [];

        if (plcs.length === 0) {
            console.warn('⚠️  No PLCs configured in config.json');
            return;
        }

        this.statsInterval = setInterval(() => {
            this.stats.tagsReadPerSecond = this.stats._readsThisSecond;
            this.stats._readsThisSecond = 0;
        }, 1000);

        for (const plcConfig of plcs) {
            await this._startPLC(plcConfig);
        }
    }

    // ─── Start Single PLC ───────────────────────────────────
    async _startPLC(plcConfig) {
        const plcId = plcConfig.plcId;
        const protocol = (plcConfig.protocol || '').toLowerCase();

        console.log(`🏭 Starting PLC: ${plcConfig.ip}:${plcConfig.port} (${protocol}) — ${plcConfig.tags?.length || 0} tags`);

        try {
            let reader;

            switch (protocol) {
                case 's7':
                    if (!S7Reader) throw new Error('S7Reader file not found. Ensure s7Reader.js exists.');
                    reader = new S7Reader(plcConfig, this.verbose);
                    break;
                case 'modbus':
                case 'modbus_tcp':
                case 'modbus_rtu':
                    if (!ModbusReader) throw new Error('ModbusReader file not found. Ensure modbusReader.js exists.');
                    reader = new ModbusReader(plcConfig, this.verbose);
                    break;
                case 'opcua':
                case 'opc_ua':
                    if (!OPCUAReader) throw new Error('OPCUAReader file not found. Ensure opcuaReader.js exists.');
                    reader = new OPCUAReader(plcConfig, this.verbose);
                    break;
                default:
                    console.error(`❌ Unsupported protocol: ${protocol} for PLC ${plcId}`);
                    return;
            }

            const connected = await reader.connect();
            if (!connected) {
                console.error(`❌ Failed to connect to PLC ${plcId} at ${plcConfig.ip}:${plcConfig.port}`);
                this.stats.totalErrors++;
            }

            this.readers.set(plcId, reader);

            const pollMs = plcConfig.pollIntervalMs || this.config.pollIntervalMs || 500;
            const intervalId = setInterval(() => {
                this._pollPLC(plcId, plcConfig);
            }, pollMs);

            this.intervals.set(plcId, intervalId);

            console.log(`✅ PLC ${plcId} polling every ${pollMs}ms`);
        } catch (err) {
            console.error(`❌ Error starting PLC ${plcId}: ${err.message}`);
            this.stats.totalErrors++;
        }
    }

    // ─── Poll Single PLC ────────────────────────────────────
    async _pollPLC(plcId, plcConfig) {
        const reader = this.readers.get(plcId);
        if (!reader) return;

        try {
            const tags = plcConfig.tags || [];
            if (tags.length === 0) return;

            const values = await reader.readTags(tags);
            if (!values || values.length === 0) return;

            this.stats.totalReads += values.length;
            this.stats._readsThisSecond += values.length;

            const changedTags = [];
            const now = Date.now();

            for (const val of values) {
                const prev = this.previousValues.get(val.tagId);

                const hasChanged = prev === undefined || prev.value !== val.value || prev.quality !== val.quality;
                const stale = prev && (now - prev.timestamp > 10000);

                if (hasChanged || stale) {
                    changedTags.push({
                        tagId: val.tagId,
                        tagName: val.tagName,
                        value: val.value,
                        quality: val.quality || 'GOOD',
                        timestamp: now,
                    });

                    this.previousValues.set(val.tagId, {
                        value: val.value,
                        quality: val.quality,
                        timestamp: now,
                    });
                }
            }

            if (changedTags.length > 0) {
                this.cloudBridge.sendTagValues(changedTags);
            }
        } catch (err) {
            this.stats.totalErrors++;
            if (this.verbose) {
                console.error(`❌ Poll error PLC ${plcId}: ${err.message}`);
            }
        }
    }

    // ─── Handle Write Command from Cloud ────────────────────
    async handleWriteCommand(cmd) {
        const { tagId, tagName, address, plcIp, value, dataType, requestSocketId } = cmd;

        if (this.verbose) {
            console.log(`✍️  Write request: ${tagName} (${address}) = ${value}`);
        }

        let targetReader = null;

        for (const [plcId, reader] of this.readers) {
            const plcConfig = this.config.plcs.find((p) => p.plcId === plcId);
            if (!plcConfig) continue;

            if (plcIp && plcConfig.ip === plcIp) {
                targetReader = reader;
                break;
            }

            const hasTag = plcConfig.tags.some((t) => t.tagId === tagId || t.address === address);
            if (hasTag) {
                targetReader = reader;
                break;
            }
        }

        if (!targetReader) {
            console.warn(`⚠️  No reader found for write command: ${tagName}`);
            this.cloudBridge.sendWriteResult({
                tagId,
                tagName,
                success: false,
                error: 'No matching PLC connection found',
                requestSocketId,
            });
            return;
        }

        try {
            await targetReader.writeTag(address, value, dataType);

            this.previousValues.set(tagId, {
                value,
                quality: 'GOOD',
                timestamp: Date.now(),
            });

            this.cloudBridge.sendWriteResult({
                tagId,
                tagName,
                value,
                success: true,
                requestSocketId,
            });

            console.log(`✅ Write successful: ${tagName} = ${value}`);
        } catch (err) {
            console.error(`❌ Write failed: ${tagName} — ${err.message}`);
            this.cloudBridge.sendWriteResult({
                tagId,
                tagName,
                success: false,
                error: err.message,
                requestSocketId,
            });
        }
    }

    async reload(newPlcConfigs) {
        console.log('🔄 Reloading PLC configuration...');
        this.stopAll();
        this.previousValues.clear(); // force re-send of all tag values after reload
        this.config.plcs = newPlcConfigs || [];
        await this.startAll();
        console.log(`✅ Config reload complete — ${this.config.plcs.length} PLC(s)`);
    }

    // ─── Stop All ───────────────────────────────────────────
    stopAll() {
        for (const [, intervalId] of this.intervals) {
            clearInterval(intervalId);
        }
        this.intervals.clear();

        if (this.statsInterval) {
            clearInterval(this.statsInterval);
            this.statsInterval = null;
        }

        for (const [, reader] of this.readers) {
            try { reader.disconnect(); } catch (err) { }
        }
        this.readers.clear();
        this.previousValues.clear();

        console.log('⏹️  All PLC readers stopped');
    }

    getStats() {
        return { ...this.stats };
    }
}

module.exports = PLCReader;