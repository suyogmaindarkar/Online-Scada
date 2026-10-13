// ═══════════════════════════════════════════════════════════
// PLC Reader — Protocol Dispatcher (With Write Support)
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

        this.stats = {
            totalReads: 0,
            totalErrors: 0,
            tagsReadPerSecond: 0,
            _readsThisSecond: 0,
        };

        this.statsInterval = null;
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

        console.log(`🏭 Starting PLC: ${plcConfig.ip}:${plcConfig.port} (${protocol}) — ${plcConfig.tags?.length || 0} tags`);

        try {
            let reader;
            if (protocol === 's7') reader = new S7Reader(plcConfig, this.verbose);
            else if (protocol.includes('modbus')) reader = new ModbusReader(plcConfig, this.verbose);
            else if (protocol.includes('opc')) reader = new OPCUAReader(plcConfig, this.verbose);
            else if (protocol.includes('ethernet') || protocol === 'ab') reader = new EthernetIPReader(plcConfig);
            else return;

            const connected = await reader.connect();
            if (!connected) console.error(`❌ Connection pending for PLC ${plcConfig.ip}:${plcConfig.port}`);

            this.readers.set(plcId, reader);

            const pollMs = plcConfig.pollIntervalMs || 1000;
            const intervalId = setInterval(() => this._pollPLC(plcId, plcConfig), pollMs);
            this.intervals.set(plcId, intervalId);

            console.log(`✅ PLC ${plcId} polling active (${pollMs}ms)`);
        } catch (err) {
            console.error(`❌ Error starting PLC ${plcId}:`, err.message);
        }
    }

    async _pollPLC(plcId, plcConfig) {
        if (this.polling.has(plcId)) return;
        this.polling.add(plcId);
        const reader = this.readers.get(plcId);
        if (!reader) { this.polling.delete(plcId); return; }

        try {
            const tags = plcConfig.tags || [];
            if (tags.length === 0) return;

            const values = await reader.readTags(tags);
            if (!values || values.length === 0) return;

            const changed = [];
            const now = Date.now();

            for (const val of values) {
                const prev = this.previousValues.get(val.tagId);
                if (!prev || prev.value !== val.value || (now - prev.timestamp > 10000)) {
                    changed.push({ tagId: val.tagId, tagName: val.tagName, value: val.value, quality: val.quality || 'GOOD', timestamp: now });
                    this.previousValues.set(val.tagId, { value: val.value, timestamp: now });
                }
            }

            if (changed.length > 0) {
                this.cloudBridge.sendTagValues(changed);
            }
        } catch (err) { console.warn(`⚠️ PLC poll failed (${plcId}): ${err.message}`); }
        finally { this.polling.delete(plcId); }
    }

    // ═══════════════════════════════════════════════════════════
    // ✍️ WRITE COMMAND DISPATCHER
    // ═══════════════════════════════════════════════════════════
    async handleWriteCommand(cmd) {
        const { tagId, tagName, address, value, dataType, requestSocketId } = cmd;

        console.log(`✍️  Received Write Command: ${tagName} (${address}) = ${value} [${dataType}]`);

        let targetReader = null;

        for (const [plcId, reader] of this.readers) {
            const plcConfig = (this.config.plcs || []).find((p) => p.plcId === plcId);
            if (!plcConfig) continue;

            const hasTag = (plcConfig.tags || []).some((t) => t.tagId === tagId || t.address === address || t.tagName === tagName);
            if (hasTag) {
                targetReader = reader;
                break;
            }
        }

        // Fallback: If not found by tag, use the first active reader
        if (!targetReader && this.readers.size > 0) {
            targetReader = this.readers.values().next().value;
        }

        if (!targetReader) {
            console.warn(`⚠️  No active reader found to execute write for: ${tagName}`);
            this.cloudBridge.sendWriteResult({
                tagId,
                tagName,
                success: false,
                error: 'No active reader available',
                requestSocketId,
            });
            return;
        }

        try {
            await targetReader.writeTag(address, value, dataType);

            // Force-update memory cache so polling re-broadcasts immediately
            if (tagId) {
                this.previousValues.set(tagId, { value, timestamp: Date.now() });
            }

            this.cloudBridge.sendWriteResult({
                tagId,
                tagName,
                value,
                success: true,
                requestSocketId,
            });

            console.log(`✅ Write Executed Successfully: ${tagName} = ${value}`);
        } catch (err) {
            console.error(`❌ Write Execution Failed for ${tagName}: ${err.message}`);
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
        console.log('🔄 Hot-reloading PLC connections...');
        this.stopAll();
        this.previousValues.clear();
        this.config.plcs = newPlcConfigs || [];
        await this.startAll();
        console.log('✅ Hot reload complete');
    }

    stopAll() {
        for (const [, id] of this.intervals) clearInterval(id);
        this.intervals.clear();

        for (const [, reader] of this.readers) {
            try { reader.disconnect(); } catch (e) { }
        }
        this.readers.clear();
    }

    getStats() {
        return { ...this.stats };
    }
}

module.exports = PLCReader;
