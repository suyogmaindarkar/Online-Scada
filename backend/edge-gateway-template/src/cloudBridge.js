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
    }

    connect() {
        return new Promise((resolve) => {
            let baseUrl = (this.config.cloudUrl || 'https://onlinescada-api.onrender.com')
                .replace(/^wss:/, 'https:')
                .replace(/^ws:/, 'http:')
                .replace(/\/$/, '');

            const namespace = this.config.namespace || '/edge';
            const fullTarget = `${baseUrl}${namespace}`;

            console.log(`☁️  Targeting Cloud URL: ${fullTarget}`);

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
                console.log(`☁️  Connected to Cloud Server! (Socket ID: ${this.socket.id})`);
                resolve();
            });

            this.socket.on('edge:welcome', (data) => {
                console.log(`☁️  Cloud Auth Verified! (${data.message || 'Connected'})`);
            });

            this.socket.on('disconnect', (reason) => {
                this.isConnected = false;
                console.log(`☁️  Disconnected from Cloud: ${reason}`);
            });

            this.socket.on('connect_error', (err) => {
                console.error(`❌ Cloud Connection Failed: ${err.message}`);
                if (err.message.includes('AUTH_INVALID') || err.message.includes('AUTH_')) {
                    console.error(`💡 Fix: Download a fresh Ready Package from PLC Management (new API key).`);
                }
                if (!this.isConnected) resolve();
            });

            this.socket.on('edge:writeCommand', (data) => {
                console.log(`📥 Write command: ${data.tagName} = ${data.value}`);
                if (this.writeCallback) this.writeCallback(data);
            });

            // ─── FULL CONFIG HOT-RELOAD ─────────────────────────
            this.socket.on('edge:configUpdate', (data) => {
                const plcCount = data?.plcs?.length || 0;
                const tagCount = (data?.plcs || []).reduce((n, p) => n + (p.tags?.length || 0), 0);
                console.log(`📥 Config update from cloud: ${plcCount} PLC(s), ${tagCount} tag(s) — hot reloading...`);
                if (this.configCallback && Array.isArray(data?.plcs)) {
                    this.configCallback(data);
                } else if (this.configCallback) {
                    // Fallback: empty payload — still notify
                    this.configCallback({ plcs: this.config.plcs || [] });
                }
            });

            this.socket.on('edge:heartbeatAck', () => {
                if (this.verbose) console.log(`💓 Heartbeat acknowledged`);
            });

            setTimeout(() => {
                if (!this.isConnected) resolve();
            }, 8000);
        });
    }

    sendTagValues(tags) {
        if (!this.isConnected || !this.socket) return;
        if (!tags || tags.length === 0) return;

        this.socket.emit('edge:tagValues', { tags });
        // Always log so user can see data is flowing
        const sample = tags.slice(0, 3).map((t) => `${t.tagName}=${t.value}`).join(', ');
        console.log(`📤 Streamed ${tags.length} tag(s): ${sample}${tags.length > 3 ? '...' : ''}`);
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

    onWriteCommand(callback) {
        this.writeCallback = callback;
    }

    onConfigUpdate(callback) {
        this.configCallback = callback;
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.isConnected = false;
        }
    }
}

module.exports = CloudBridge;