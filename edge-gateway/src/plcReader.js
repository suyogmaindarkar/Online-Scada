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
        this.generations = new Map();
        this.lifecycle = Promise.resolve();

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
        await Promise.all(plcs.filter((config) => config.isActive !== false).map((config) => this.startOnePLC(config).catch(() => ({ ok: false }))));
    }

    async _startPLC(plcConfig) {
        return this.startOnePLC(plcConfig);
    }

    enqueue(operation) {
        const next = this.lifecycle.then(operation);
        this.lifecycle = next.catch(() => {});
        return next;
    }

    _createReader(config) {
        const protocol = String(config.protocol || '').toLowerCase();
        if (protocol === 's7') return new S7Reader(config, this.verbose);
        if (protocol.includes('modbus')) return new ModbusReader(config, this.verbose);
        if (protocol.includes('opc')) return new OPCUAReader({ ...config, username: config.username || config.opcuaUsername, password: config.password || config.opcuaPassword }, this.verbose);
        if (protocol.includes('ethernet') || protocol === 'ab') return new EthernetIPReader(config, this.verbose);
        throw new Error('Unsupported equipment protocol');
    }

    async _disconnect(reader) {
        if (!reader) return;
        try { await this._bounded(Promise.resolve(reader.disconnect()), 2000); } catch (_) {}
    }

    _bounded(promise, timeoutMs = 10000) {
        let timer;
        return Promise.race([promise, new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('Equipment connection timed out')), timeoutMs);
        })]).finally(() => clearTimeout(timer));
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
            if (this.readers.get(plcId) !== reader || plcConfig.isActive === false) return;
            if (!values || values.length === 0) return;

            const goodValues = values.filter((value) => value.quality === 'GOOD');
            if (goodValues.length > 0) {
                plcConfig.__freshData = true;
                plcConfig.lastDataAt = Date.now();
                this.stats.totalReads += goodValues.length;
                this.stats._readsThisSecond += goodValues.length;
            } else {
                plcConfig.__freshData = false;
                this.stats.totalErrors += values.length;
            }

            const changed = [];
            const now = Date.now();

            for (const val of values) {
                const prev = this.previousValues.get(val.tagId);
                if (!prev || prev.value !== val.value || prev.quality !== val.quality || (now - prev.timestamp > 10000)) {
                    changed.push({ tagId: val.tagId, tagName: val.tagName, value: val.value, quality: val.quality || 'GOOD', timestamp: now });
                    this.previousValues.set(val.tagId, { value: val.value, quality: val.quality, timestamp: now });
                }
            }

            if (changed.length > 0) {
                this.cloudBridge.sendTagValues(changed);
            }
        } catch (_) {
            plcConfig.__freshData = false;
            this.stats.totalErrors++;
        }
        finally {
            if (this.readers.get(plcId) === reader) this.polling.delete(plcId);
            else await this._disconnect(reader);
        }
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
            if (!plcConfig || plcConfig.isActive === false) continue;

            const hasTag = (plcConfig.tags || []).some((t) => tagId ? t.tagId === tagId : t.tagName === tagName);
            if (hasTag) {
                targetReader = reader;
                break;
            }
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
        const next = Array.isArray(newPlcConfigs) ? newPlcConfigs : [];
        const previous = this.config.plcs || [];
        const signature = (config) => JSON.stringify(Object.fromEntries(Object.entries(config).filter(([key]) => !['__freshData', 'lastDataAt', 'isConnected', 'connectionState', 'connectionMessage'].includes(key))));
        const retained = new Set();
        for (const config of next) {
            const old = previous.find((item) => String(item.plcId) === String(config.plcId));
            if (old && config.isActive !== false && this.readers.has(String(config.plcId)) && signature(old) === signature(config)) {
                config.lastDataAt = old.lastDataAt;
                config.__freshData = old.__freshData;
                retained.add(String(config.plcId));
            }
        }
        await Promise.all([...this.readers.keys()].filter((id) => !retained.has(id)).map((id) => this.stopOnePLC(id)));
        this.config.plcs = next;
        await Promise.all(next.filter((config) => config.isActive !== false && !retained.has(String(config.plcId))).map((config) => this.startOnePLC(config).catch(() => ({ ok: false }))));
    }

    async stopAll() {
        const ids = new Set([...this.readers.keys(), ...(this.config.plcs || []).map((config) => String(config.plcId))]);
        await Promise.all([...ids].map((id) => this.stopOnePLC(id)));
    }

    // ─── PER-EQUIPMENT LIFECYCLE (remote start/stop from website) ───

    // Stop a single equipment's reader + interval. Returns the reader.
    async stopOnePLC(plcId) {
        const k = String(plcId);
        this.generations.set(k, (this.generations.get(k) || 0) + 1);
        const reader = this.readers.get(k);
        if (this.intervals.has(k)) clearInterval(this.intervals.get(k));
        this.intervals.delete(k);
        this.readers.delete(k);
        this.polling.delete(k);
        const config = (this.config.plcs || []).find((item) => String(item.plcId) === k);
        if (config) {
            config.__freshData = false;
            config.lastDataAt = null;
            config.isConnected = false;
            for (const tag of config.tags || []) this.previousValues.delete(tag.tagId);
        }
        await this._disconnect(reader);
    }

    // Start (or restart) a single equipment's reader using its config entry.
    async startOnePLC(plcConfig, { force = false } = {}) {
        if (!plcConfig) return { ok: false, error: 'no config' };
        const k = String(plcConfig.plcId || '');
        if (!k) return { ok: false, error: 'missing plcId' };

        if (plcConfig.isActive === false) return { ok: false, error: 'Equipment is disabled' };
        if (!force && this.readers.get(k)?.isConnected === true) return { ok: true, connected: true };
        const stopping = this.stopOnePLC(k);
        const generation = this.generations.get(k);
        await stopping;
        if (this.generations.get(k) !== generation) return { ok: false, error: 'Equipment connection was stopped' };
        const reader = this._createReader(plcConfig);
        this.readers.set(k, reader);
        const connection = Promise.resolve().then(() => reader.connect());
        connection.finally(() => {
            if (this.generations.get(k) !== generation || this.readers.get(k) !== reader) this._disconnect(reader);
        }).catch(() => {});
        let connected = false;
        try { connected = (await this._bounded(connection)) === true; }
        catch (_) { await this.stopOnePLC(k); return { ok: false, error: 'Equipment connection timed out' }; }
        if (this.generations.get(k) !== generation || this.readers.get(k) !== reader) {
            await this._disconnect(reader);
            return { ok: false, error: 'Equipment connection was stopped' };
        }
        plcConfig.isConnected = connected;
        const pollMs = plcConfig.pollIntervalMs || 1000;
        const intervalId = setInterval(() => this._pollPLC(k, (this.config.plcs || []).find((config) => String(config.plcId) === k) || plcConfig), pollMs);
        this.intervals.set(k, intervalId);

        if (!connected) {
            return { ok: false, pending: true, error: 'connection pending / unreachable' };
        }
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
        const allConfigs = this.config.plcs || (this.config.plcs = []);
        let plcConfig = allConfigs.find((p) => String(p.plcId) === plcId);
        if (payload?.config && String(payload.config.plcId) === plcId && action !== 'stop') {
            if (action === 'test') plcConfig = payload.config;
            else if (!plcConfig) { plcConfig = payload.config; allConfigs.push(plcConfig); }
            else if (plcConfig.isActive === false && action === 'start') { Object.assign(plcConfig, payload.config); }
        }

        if (action === 'test') {
            let reader;
            let settled = false;
            let connected = false;
            try {
                if (!plcConfig) throw new Error('Equipment configuration is unavailable');
                reader = this._createReader(plcConfig);
                const connection = Promise.resolve().then(() => reader.connect());
                connection.finally(() => { if (settled) this._disconnect(reader); }).catch(() => {});
                connected = (await this._bounded(connection)) === true;
            } catch (_) { connected = false; }
            finally { settled = true; await this._disconnect(reader); }
            this.cloudBridge.sendEquipmentCommandResult({ ...reply, success: connected, connected, state: connected ? 'connected' : 'failed', message: connected ? 'Equipment connection test successful' : 'Equipment connection test failed or timed out' });
            return;
        }

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
                connected: result.connected === true,
                state: result.ok ? 'connected_no_data' : 'failed',
                message: result.ok ? 'Equipment connected; waiting for tag data' : (result.error || 'Equipment connection failed'),
            });
            return;
        }

        // stop
        if (action === 'stop') {
            if (plcConfig) plcConfig.isActive = false;
            await this.stopOnePLC(plcId);
            this.cloudBridge.sendEquipmentCommandResult({
                ...reply, success: true, connected: false, state: 'stopped', message: 'Equipment connection stopped',
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
            const result = await this.startOnePLC(plcConfig, { force: true });
            this.cloudBridge.sendEquipmentCommandResult({
                ...reply,
                success: result.ok && result.connected,
                connected: result.connected === true,
                state: result.ok ? 'connected_no_data' : 'failed',
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
                        const fresh = plcConfig.__freshData && plcConfig.lastDataAt && Date.now() - plcConfig.lastDataAt < Math.max(15000, (plcConfig.pollIntervalMs || 1000) * 3);
                        isConnected = reader.isConnected === true;
                        if (isConnected) { state = 'connected_no_data'; message = 'Equipment connected; no recent tag data'; }
                        else { state = 'failed'; message = 'Equipment connection is unavailable'; }
                        if (isConnected && fresh) { state = 'streaming'; message = 'Equipment data is streaming'; hasTags = true; }
                    } catch (e) { }
                }
            } else {
                state = 'stopped';
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
