// ═══════════════════════════════════════════════════════════
// Cloud Bridge — Socket.io Client to OnlineSCADA /edge
// ═══════════════════════════════════════════════════════════

const { io } = require('socket.io-client');
const os = require('os');

class CloudBridge {
    constructor(config, verbose = false) {
        this.config = config;
        this.verbose = verbose;
        this.socket = null;
        this.isConnected = false;
        this.writeCallback = null;
        this.configCallback = null;
        this.discoveryCallback = null;
        this.equipmentCommandCallback = null;
    }

    connect() {
        return new Promise((resolve) => {
            let baseUrl = (this.config.cloudUrl || 'https://onlinescada-api.onrender.com')
                .replace(/^wss:/, 'https:')
                .replace(/^ws:/, 'http:')
                .replace(/\/$/, '');

            const namespace = this.config.namespace || '/edge';
            const fullTarget = `${baseUrl}${namespace}`;

            console.log(`[o] Targeting Cloud Infrastructure...`);

            this.socket = io(fullTarget, {
                auth: {
                    apiKey: this.config.apiKey,
                    companyId: this.config.companyId,
                },
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionDelay: 3000,
                reconnectionDelayMax: 10000,
                reconnectionAttempts: Infinity,
                timeout: 20000,
            });

            this.socket.on('connect', () => {
                this.isConnected = true;
                console.log(`[+] Connected to Cloud Server! (Session: ${this.socket.id})`);
                resolve();
            });

            this.socket.on('edge:welcome', (data) => {
                console.log(`[+] Cloud Auth Verified! (${data.message || 'Secure tunnel active'})`);
            });

            this.socket.on('disconnect', (reason) => {
                this.isConnected = false;
                console.log(`[x] Disconnected from Cloud: ${reason}`);
            });

            this.socket.on('connect_error', (err) => {
                console.error(`[ERROR] Cloud Connection Failed: ${err.message}`);
                if (err.message.includes('AUTH_INVALID') || err.message.includes('AUTH_')) {
                    console.error(`[!] Fix: Download a fresh Connector Package (new API key).`);
                }
                if (!this.isConnected) resolve();
            });

            this.socket.on('edge:writeCommand', (data) => {
                console.log(`[in] Write command: ${data.tagName} = ${data.value}`);
                if (this.writeCallback) this.writeCallback(data);
            });

            this.socket.on('edge:startDiscovery', (config) => {
                console.log(`[o] Network Discovery scan requested by cloud`);
                if (this.discoveryCallback) this.discoveryCallback(config);
            });

            // ─── FULL CONFIG HOT-RELOAD ─────────────────────────
            this.socket.on('edge:configUpdate', (data) => {
                const plcCount = data?.plcs?.length || 0;
                const tagCount = (data?.plcs || []).reduce((n, p) => n + (p.tags?.length || 0), 0);
                console.log(`[in] Config update from cloud: ${plcCount} Machine(s), ${tagCount} tag(s) — hot reloading...`);
                if (this.configCallback && Array.isArray(data?.plcs)) {
                    this.configCallback(data);
                } else if (this.configCallback) {
                    this.configCallback({ plcs: this.config.plcs || [] });
                }
            });

            this.socket.on('edge:equipmentCommand', (data) => {
                if (this.verbose) console.log('[in] Equipment command from cloud: ' + (data && data.action ? data.action : 'unknown'));
                if (this.equipmentCommandCallback) this.equipmentCommandCallback(data || {});
            });

            this.socket.on('edge:heartbeatAck', () => {
                if (this.verbose) console.log(`[+] Heartbeat acknowledged`);
            });

            setTimeout(() => {
                if (!this.isConnected) resolve();
            }, 8000);
        });
    }

    async reportDiscovery(phase, results) {
        try {
            let baseUrl = (this.config.cloudUrl || 'https://onlinescada-api.onrender.com')
                .replace(/^wss?:/, 'https:')
                .replace(/\/$/, '');

            const url = `${baseUrl}/api/discovery/edge-report`;
            const payload = JSON.stringify({
                companyId: this.config.companyId,
                apiKey: this.config.apiKey,
                phase,
                results
            });

            const http = url.startsWith('https') ? require('https') : require('http');
            const reqUrl = new URL(url);
            const options = {
                hostname: reqUrl.hostname,
                port: reqUrl.port,
                path: reqUrl.pathname,
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
            };

            return new Promise((resolve, reject) => {
                const req = http.request(options, (res) => { resolve(); });
                req.on('error', reject);
                req.write(payload);
                req.end();
            });
        } catch (err) {
            console.error(`[ERROR] Failed to report discovery status: ${err.message}`);
        }
    }

    sendTagValues(tags) {
        if (!this.isConnected || !this.socket) return;
        if (!tags || tags.length === 0) return;

        this.socket.emit('edge:tagValues', { tags });
        const sample = tags.slice(0, 3).map((t) => `${t.tagName}=${t.value}`).join(', ');
        // We removed terminal spam rules, but keep this brief
        if (this.verbose) console.log(`[out] Streamed ${tags.length} tag(s): ${sample}${tags.length > 3 ? '...' : ''}`);
    }

    sendHeartbeat(stats) {
        if (!this.isConnected || !this.socket) return;
        this.socket.emit('edge:heartbeat', {
            version: '1.0.0',
            hostname: os.hostname(),
            os: `${os.type()} ${os.release()}`,
            uptimeSeconds: Math.floor(process.uptime()),
            memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            cpuPercent: 0,
            tagsReadPerSecond: stats.tagsReadPerSecond || 0,
            totalReads: stats.totalReads || 0,
            totalErrors: stats.totalErrors || 0,
        });
    }

    sendWriteResult(result) {
        if (!this.isConnected || !this.socket) return;
        this.socket.emit('edge:writeResult', result);
    }

    sendError(message) {
        if (!this.isConnected || !this.socket) return;
        this.socket.emit('edge:error', { message, timestamp: Date.now() });
    }

    onEquipmentCommand(callback) { this.equipmentCommandCallback = callback; }

    // Reply to a start/stop/restart command from the cloud
    sendEquipmentCommandResult(data) {
        if (!this.isConnected || !this.socket) return;
        this.socket.emit('edge:equipmentCommandResult', data);
    }

    // Push live equipment state in the heartbeat (state: connecting/streaming/failed/stopped)
    sendEquipmentStatuses(statuses) {
        if (!this.isConnected || !this.socket || !Array.isArray(statuses)) return;
        this.socket.emit('edge:heartbeat', {
            status: 'ok',
            equipmentStatuses: statuses,
            stats: { uptime: Math.floor(process.uptime()), tags: statuses.length },
        });
    }

    onWriteCommand(callback) { this.writeCallback = callback; }
    onConfigUpdate(callback) { this.configCallback = callback; }
    onStartDiscovery(callback) { this.discoveryCallback = callback; }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.isConnected = false;
        }
    }
}

module.exports = CloudBridge;
