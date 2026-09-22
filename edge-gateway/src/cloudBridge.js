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

    // ─── Connect to Cloud ───────────────────────────────────
    connect() {
        return new Promise((resolve) => {
            // Normalize URL (socket.io uses http/https)
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

            // ─── Connection Events ──────────────────────────────
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
                if (err.message.includes('AUTH_INVALID')) {
                    console.error(`💡 Your API key in config.json is invalid or expired!`);
                }
                if (!this.isConnected) resolve();
            });

            // ─── Incoming: Write Command from Cloud ─────────────
            this.socket.on('edge:writeCommand', (data) => {
                console.log(`📥 Write command received: ${data.tagName} = ${data.value}`);
                if (this.writeCallback) {
                    this.writeCallback(data);
                }
            });

            // ─── Incoming: Config Update from Cloud ─────────────
            this.socket.on('edge:configUpdate', (data) => {
                console.log(`📥 Config update received from cloud`);
                if (this.configCallback) {
                    this.configCallback(data);
                }
            });

            // ─── Incoming: Heartbeat Ack ────────────────────────
            this.socket.on('edge:heartbeatAck', () => {
                if (this.verbose) {
                    console.log(`💓 Heartbeat acknowledged`);
                }
            });

            setTimeout(() => {
                if (!this.isConnected) {
                    resolve();
                }
            }, 5000);
        });
    }

    // ─── Send Tag Values Batch ──────────────────────────────
    sendTagValues(tags) {
        if (!this.isConnected || !this.socket) return;
        if (!tags || tags.length === 0) return;

        this.socket.emit('edge:tagValues', { tags });
        console.log(`📤 Streamed ${tags.length} tag update(s) to Cloud`);
    }

    // ─── Send Heartbeat ─────────────────────────────────────
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