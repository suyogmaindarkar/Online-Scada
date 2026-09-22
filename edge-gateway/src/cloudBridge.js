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
        this.reconnectAttempts = 0;
        this.maxReconnectDelay = 30000;
    }

    // ─── Connect to Cloud ───────────────────────────────────
    connect() {
        return new Promise((resolve) => {
            // Normalize URL (socket.io works best with http/https base URLs)
            let url = (this.config.cloudUrl || '').replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
            const namespace = this.config.namespace || '/edge';

            if (this.verbose) {
                console.log(`☁️  Connecting to: ${url}${namespace}`);
            }

            this.socket = io(`${url}${namespace}`, {
                auth: {
                    apiKey: this.config.apiKey,
                    companyId: this.config.companyId,
                },
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionDelay: this.config.reconnectDelayMs || 5000,
                reconnectionDelayMax: this.maxReconnectDelay,
                reconnectionAttempts: Infinity,
                timeout: 20000,
            });

            // ─── Connection Events ──────────────────────────────
            this.socket.on('connect', () => {
                this.isConnected = true;
                this.reconnectAttempts = 0;
                console.log(`☁️  Connected to cloud: ${this.socket.id}`);
                resolve();
            });

            this.socket.on('edge:welcome', (data) => {
                console.log(`☁️  Cloud Authentication Success! (${data.message || 'Connected'})`);
            });

            this.socket.on('disconnect', (reason) => {
                this.isConnected = false;
                console.log(`☁️  Disconnected from cloud: ${reason}`);
            });

            this.socket.on('reconnect_attempt', (attempt) => {
                this.reconnectAttempts = attempt;
                if (attempt % 3 === 0) {
                    console.log(`☁️  Reconnecting... attempt ${attempt}`);
                }
            });

            // 🚨 ALWAYS print connection errors so user knows why it failed
            this.socket.on('connect_error', (err) => {
                console.error(`❌ Cloud Connection Error: ${err.message}`);
                if (err.message.includes('AUTH_INVALID')) {
                    console.error(`💡 FIX: Your API key in config.json is invalid or expired!`);
                    console.error(`💡 Go to https://app.onlinescada.in/edge-gateways -> Click Key Icon -> Copy your real API key into config.json.`);
                }
                if (!this.isConnected) resolve();
            });

            // ─── Incoming: Write Command from Cloud ─────────────
            this.socket.on('edge:writeCommand', (data) => {
                if (this.verbose) {
                    console.log(`📥 Write command received: ${data.tagName} = ${data.value}`);
                }
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

            // ─── Fallback resolve after timeout ─────────────────
            setTimeout(() => {
                if (!this.isConnected) {
                    resolve();
                }
            }, 8000);
        });
    }

    // ─── Send Tag Values Batch ──────────────────────────────
    sendTagValues(tags) {
        if (!this.isConnected || !this.socket) return;
        if (!tags || tags.length === 0) return;

        this.socket.emit('edge:tagValues', { tags });

        if (this.verbose) {
            console.log(`📤 Sent ${tags.length} tag values to cloud`);
        }
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

    // ─── Send Write Result ──────────────────────────────────
    sendWriteResult(result) {
        if (!this.isConnected || !this.socket) return;
        this.socket.emit('edge:writeResult', result);
    }

    // ─── Send Error Report ──────────────────────────────────
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