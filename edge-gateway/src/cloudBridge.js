// ═══════════════════════════════════════════════════════════
// Cloud Bridge — Socket.io Client to OnlineSCADA /edge
//
// Connects to the cloud backend's /edge namespace using
// the gateway's API key. Pushes tag values, receives
// write commands and config updates.
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
            const url = this.config.cloudUrl;
            const namespace = this.config.namespace || '/edge';

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
                if (this.verbose) {
                    console.log(`☁️  Welcome from cloud:`, data.message);
                }
            });

            this.socket.on('disconnect', (reason) => {
                this.isConnected = false;
                console.log(`☁️  Disconnected from cloud: ${reason}`);
            });

            this.socket.on('reconnect_attempt', (attempt) => {
                this.reconnectAttempts = attempt;
                if (attempt % 5 === 0) {
                    console.log(`☁️  Reconnecting... attempt ${attempt}`);
                }
            });

            this.socket.on('connect_error', (err) => {
                if (this.verbose) {
                    console.error(`☁️  Connection error: ${err.message}`);
                }
                // Resolve anyway — we'll keep retrying in background
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
                if (this.verbose) {
                    console.log(`📥 Config update received from cloud`);
                }
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
                    console.warn('⚠️  Cloud connection pending — will retry in background');
                    resolve();
                }
            }, 10000);
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
            cpuPercent: 0, // Simplified — real CPU tracking needs extra lib
            tagsReadPerSecond: stats.tagsReadPerSecond || 0,
            totalReads: stats.totalReads || 0,
            totalErrors: stats.totalErrors || 0,
        });
    }

    // ─── Send Write Result ──────────────────────────────────
    sendWriteResult(result) {
        if (!this.isConnected || !this.socket) return;

        this.socket.emit('edge:writeResult', result);

        if (this.verbose) {
            console.log(`📤 Write result sent: ${result.tagName} → ${result.success ? 'OK' : 'FAIL'}`);
        }
    }

    // ─── Send Error Report ──────────────────────────────────
    sendError(message) {
        if (!this.isConnected || !this.socket) return;
        this.socket.emit('edge:error', { message, timestamp: Date.now() });
    }

    // ─── Register Callbacks ─────────────────────────────────
    onWriteCommand(callback) {
        this.writeCallback = callback;
    }

    onConfigUpdate(callback) {
        this.configCallback = callback;
    }

    // ─── Disconnect ─────────────────────────────────────────
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.isConnected = false;
        }
    }
}

module.exports = CloudBridge;