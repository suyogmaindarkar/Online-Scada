// ═══════════════════════════════════════════════════════════
// PLC Reader — Protocol Dispatcher
//
// Manages multiple PLC connections across different protocols.
// Dispatches to protocol-specific readers (S7, Modbus, OPC-UA).
// Handles polling, value change detection, and write commands.
// ═══════════════════════════════════════════════════════════

const S7Reader = require('./readers/s7Reader');
const ModbusReader = require('./readers/modbusReader');
const OPCUAReader = require('./readers/opcuaReader');

class PLCReader {
    constructor(config, cloudBridge, verbose = false) {
        this.config = config;
        this.cloudBridge = cloudBridge;
        this.verbose = verbose;

        // Active reader instances: Map<plcId, ReaderInstance>
        this.readers = new Map();

        // Polling intervals: Map<plcId, intervalId>
        this.intervals = new Map();

        // Previous values for change detection: Map<tagId, lastValue>
        this.previousValues = new Map();

        // Stats
        this.stats = {
            totalReads: 0,
            totalErrors: 0,
            tagsReadPerSecond: 0,
            _readsThisSecond: 0,
        };

        // Stats calculator (runs every 1s)
        this.statsInterval = null;
    }

    // ─── Start All PLC Readers ──────────────────────────────
    async startAll() {
        const plcs = this.config.plcs || [];

        if (plcs.length === 0) {
            console.warn('⚠️  No PLCs configured in config.json');
            return;
        }

        // Start stats calculator
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
                    reader = new S7Reader(plcConfig, this.verbose);
                    break;
                case 'modbus':
                case 'modbus_tcp':
                case 'modbus_rtu':
                    reader = new ModbusReader(plcConfig, this.verbose);
                    break;
                case 'opcua':
                case 'opc_ua':
                    reader = new OPCUAReader(plcConfig, this.verbose);
                    break;
                default:
                    console.error(`❌ Unsupported protocol: ${protocol} for PLC ${plcId}`);
                    return;
            }

            // Connect to PLC
            const connected = await reader.connect();
            if (!connected) {
                console.error(`❌ Failed to connect to PLC ${plcId} at ${plcConfig.ip}:${plcConfig.port}`);
                this.stats.totalErrors++;
                // Still set up polling — reader will retry
            }

            this.readers.set(plcId, reader);

            // Start polling loop
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

            // Read all tags from this PLC
            const values = await reader.readTags(tags);

            if (!values || values.length === 0) return;

            this.stats.totalReads += values.length;
            this.stats._readsThisSecond += values.length;

            // Change detection + build batch
            const changedTags = [];
            const now = Date.now();

            for (const val of values) {
                const prev = this.previousValues.get(val.tagId);

                // Send if value changed OR if it's the first read OR every 10s for unchanged
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

            // Push changed values to cloud
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
        const { tagId, tagName, address, protocol, plcIp, value, dataType, requestSocketId } = cmd;

        if (this.verbose) {
            console.log(`✍️  Write request: ${tagName} (${address}) = ${value}`);
        }

        // Find the reader that serves this tag
        let targetReader = null;
        let targetPlcId = null;

        for (const [plcId, reader] of this.readers) {
            const plcConfig = this.config.plcs.find((p) => p.plcId === plcId);
            if (!plcConfig) continue;

            // Match by PLC IP or protocol
            if (plcIp && plcConfig.ip === plcIp) {
                targetReader = reader;
                targetPlcId = plcId;
                break;
            }

            // Match by tag address
            const hasTag = plcConfig.tags.some((t) => t.tagId === tagId || t.address === address);
            if (hasTag) {
                targetReader = reader;
                targetPlcId = plcId;
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

            // Update local cache
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

    // ─── Hot Reload Config ──────────────────────────────────
    async reload(newPlcConfigs) {
        console.log('🔄 Reloading PLC configuration...');

        // Stop all existing readers
        this.stopAll();

        // Update config
        this.config.plcs = newPlcConfigs;

        // Restart
        await this.startAll();
        console.log('✅ Config reload complete');
    }

    // ─── Stop All ───────────────────────────────────────────
    stopAll() {
        // Clear polling intervals
        for (const [plcId, intervalId] of this.intervals) {
            clearInterval(intervalId);
        }
        this.intervals.clear();

        // Clear stats interval
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
            this.statsInterval = null;
        }

        // Disconnect all readers
        for (const [plcId, reader] of this.readers) {
            try {
                reader.disconnect();
            } catch (err) {
                if (this.verbose) {
                    console.error(`⚠️  Error disconnecting PLC ${plcId}: ${err.message}`);
                }
            }
        }
        this.readers.clear();
        this.previousValues.clear();

        console.log('⏹️  All PLC readers stopped');
    }

    // ─── Get Stats ──────────────────────────────────────────
    getStats() {
        return { ...this.stats };
    }
}

module.exports = PLCReader;