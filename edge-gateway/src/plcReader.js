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

            const goodValues = values.filter((value) => value.quality === 'GOOD');
            if (goodValues.length > 0) {
                plcConfig.__freshData = true;
                plcConfig.lastDataAt = Date.now();
                this.stats.totalReads += goodValues.length;
                this.stats._readsThisSecond += goodValues.length;
            } else {
                this.stats.totalErrors += values.length;
            }

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

    // ─── PER-EQUIPMENT LIFECYCLE (remote start/stop from website) ───

    // Stop a single equipment's reader + interval. Returns the reader.
    stopOnePLC(plcId) {
        const k = String(plcId);
        if (this.intervals.has(k)) clearInterval(this.intervals.get(k));
        this.intervals.delete(k);
        this.readers.delete(k);
        this.polling.delete(k);
        this.previousValues.delete(k);
    }

    // Start (or restart) a single equipment's reader using its config entry.
    async startOnePLC(plcConfig) {
        if (!plcConfig) return { ok: false, error: 'no config' };
        const k = String(plcConfig.plcId || '');
        if (!k) return { ok: false, error: 'missing plcId' };

        // Stop existing instance first (idempotent)
        this.stopOnePLC(k);

        const protocol = (plcConfig.protocol || '').toLowerCase();

        let reader;
        if (protocol === 's7') reader = new S7Reader(plcConfig, this.verbose);
        else if (protocol.includes('modbus')) reader = new ModbusReader(plcConfig, this.verbose);
        else if (protocol.includes('opc')) reader = new OPCUAReader(plcConfig, this.verbose);
        else if (protocol.includes('ethernet') || protocol === 'ab') reader = new EthernetIPReader(plcConfig, this.verbose);
        else return { ok: false, error: 'unsupported protocol: ' + protocol };

        let connected = false;
        try { connected = await reader.connect(); } catch (e) { connected = false; }
        this.readers.set(k, reader);

        const pollMs = plcConfig.pollIntervalMs || 1000;
        const intervalId = setInterval(() => this._pollPLC(k, plcConfig), pollMs);
        this.intervals.set(k, intervalId);

        if (!connected) {
            console.warn('[!] Connection pending for ' + plcConfig.plcName + ' (' + plcConfig.ip + ':' + plcConfig.port + ')');
            return { ok: false, pending: true, error: 'connection pending / unreachable' };
        }
        console.log('[+] Equipment online: ' + plcConfig.plcName + ' (' + plcConfig.ip + ':' + plcConfig.port + ')');
        return { ok: true, connected: true };
    }

    // Handle a remote start/stop/restart command from the cloud, then reply via
    // the cloudBridge with a status so the website shows the result instantly.
    async handleEquipmentCommand(cmd) {
        const { requestId, equipmentId, action, payload } = cmd || {};
        const plcId = equipmentId ? String(equipmentId) : '';
        const reply = { requestId, equipmentId, action };

        if (!plcId) {
            this.cloudBridge.sendEquipmentCommandResult({ ...reply, success: false, state: 'error', message: 'Missing equipment id' });
            return;
        }

        // Resolve the matching config entry (current config or via plcId)
        const allConfigs = this.config.plcs || [];
        let plcConfig = allConfigs.find((p) => String(p.plcId) === plcId);
        const found = Boolean(plcConfig) || this.readers.has(plcId);

        // start
        if (action === 'start') {
            if (!plcConfig) {
                this.cloudBridge.sendEquipmentCommandResult({
                    ...reply, success: false, state: 'not_configured', message: 'Equipment config not delivered yet. Try again in a few seconds.',
                });
                return;
            }
            const result = await this.startOnePLC(plcConfig);
            this.cloudBridge.sendEquipmentCommandResult({
                ...reply,
                success: result.ok && result.connected,
                state: result.ok ? 'streaming' : 'failed',
                message: result.ok ? 'Equipment data is streaming' : (result.error || 'Equipment connection failed'),
            });
            return;
        }

        // stop
        if (action === 'stop') {
            this.stopOnePLC(plcId);
            this.cloudBridge.sendEquipmentCommandResult({
                ...reply, success: true, state: 'stopped', message: 'Equipment connection stopped',
            });
            return;
        }

        // restart
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
                success: result.ok && result.connected,
                state: result.ok ? 'streaming' : 'failed',
                message: result.ok ? 'Equipment restarted and polling' : (result.error || 'Restart failed'),
            });
            return;
        }

        // unknown
        this.cloudBridge.sendEquipmentCommandResult({
            ...reply, success: false, state: 'error', message: 'Unknown command: ' + action,
        });
    }

    // Build a fresh status array for the heartbeat — used by index.js so the
    // website shows per-equipment state (connector vs equipment vs tags) distinctly.
    getEquipmentStatuses() {
        const statuses = [];
        for (const plcConfig of (this.config.plcs || [])) {
            const plcId = String(plcConfig.plcId || '');
            const reader = this.readers.get(plcId);
            const active = plcConfig.isActive !== false;
            let state = 'stopped';
            let message = 'Connection is disabled';
            let isConnected = false;
            let hasTags = false;
            let tagCount = (plcConfig.tags || []).length;
            let lastDataAt = plcConfig.lastDataAt || null;

            if (active) {
                if (plcConfig.isSimulation) {
                    state = 'connected';
                    message = 'Simulation is running';
                    isConnected = true;
                    hasTags = Boolean(tagCount);
                } else if (!reader) {
                    state = 'waiting_connector';
                    message = 'Factory Connector online, equipment config pending';
                } else {
                    // Blocking happens in index.js via _pollPLC errors; here we just report
                    // based on interval + reader existence. Actual value freshness comes later.
                    state = 'connecting';
                    message = 'Reader created, awaiting tag data';
                    try {
                        const fresh = plcConfig.__freshData || false;
                        if (fresh) { state = 'streaming'; message = 'Equipment data is streaming'; isConnected = true; hasTags = true; }
                    } catch (e) { }
                }
            } else {
                continue; // disabled equipments not reported
            }

            statuses.push({
                plcId,
                plcName: plcConfig.plcName || plcConfig.name || plcConfig.ip,
                state,
                message,
                isConnected,
                hasTags: Boolean(tagCount),
                tagCount,
                lastDataAt,
                timestamp: Date.now(),
            });
        }
        return statuses;
    }

    getStats() {
        return { ...this.stats };
    }
}

module.exports = PLCReader;
