// ═══════════════════════════════════════════════════════════
// Cloud Bridge — Socket.io Client to OnlineSCADA /edge
//
// Communication behavior preserved.
// Terminal output reduced for SCADA dashboard presentation.
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
    }

    connect() {

        return new Promise((resolve) => {

            let baseUrl =
                (
                    this.config.cloudUrl ||
                    'https://onlinescada-api.onrender.com'
                )
                    .replace(/^wss:/, 'https:')
                    .replace(/^ws:/, 'http:')
                    .replace(/\/$/, '');

            const namespace =
                this.config.namespace ||
                '/edge';

            const fullTarget =
                `${baseUrl}${namespace}`;

            this.socket = io(
                fullTarget,
                {
                    auth: {
                        apiKey:
                            this.config.apiKey,

                        companyId:
                            this.config.companyId,
                    },

                    transports: [
                        'websocket',
                        'polling'
                    ],

                    reconnection: true,

                    reconnectionDelay: 3000,

                    reconnectionDelayMax: 10000,

                    reconnectionAttempts:
                        Infinity,

                    timeout: 20000,
                }
            );

            this.socket.on(
                'connect',
                () => {

                    this.isConnected = true;

                    resolve();
                }
            );

            this.socket.on(
                'edge:welcome',
                (data) => {

                    if (this.verbose) {
                        console.log(
                            `Cloud Auth Verified: ${data.message ||
                            'Secure tunnel active'
                            }`
                        );
                    }
                }
            );

            this.socket.on(
                'disconnect',
                (reason) => {

                    this.isConnected = false;

                    if (this.verbose) {
                        console.log(
                            `Cloud disconnected: ${reason}`
                        );
                    }
                }
            );

            this.socket.on(
                'connect_error',
                (err) => {

                    if (this.verbose) {
                        console.error(
                            `Cloud connection failed: ${err.message}`
                        );
                    }

                    if (
                        err.message.includes(
                            'AUTH_INVALID'
                        ) ||
                        err.message.includes(
                            'AUTH_'
                        )
                    ) {

                        if (this.verbose) {
                            console.error(
                                'Connector authentication requires a fresh configuration.'
                            );
                        }
                    }

                    if (!this.isConnected) {
                        resolve();
                    }
                }
            );

            this.socket.on(
                'edge:writeCommand',
                (data) => {

                    if (this.verbose) {
                        console.log(
                            `Write command received: ${data.tagName}`
                        );
                    }

                    if (this.writeCallback) {
                        this.writeCallback(data);
                    }
                }
            );

            this.socket.on(
                'edge:startDiscovery',
                (config) => {

                    if (this.verbose) {
                        console.log(
                            'Network discovery requested'
                        );
                    }

                    if (
                        this.discoveryCallback
                    ) {
                        this.discoveryCallback(
                            config
                        );
                    }
                }
            );

            this.socket.on(
                'edge:configUpdate',
                (data) => {

                    const plcCount =
                        data?.plcs?.length || 0;

                    const tagCount =
                        (
                            data?.plcs || []
                        ).reduce(
                            (n, p) =>
                                n +
                                (
                                    p.tags?.length ||
                                    0
                                ),
                            0
                        );

                    if (this.verbose) {
                        console.log(
                            `Configuration update: ${plcCount} machine(s), ${tagCount} tag(s)`
                        );
                    }

                    if (
                        this.configCallback &&
                        Array.isArray(
                            data?.plcs
                        )
                    ) {
                        this.configCallback(
                            data
                        );
                    } else if (
                        this.configCallback
                    ) {
                        this.configCallback({
                            plcs:
                                this.config.plcs ||
                                []
                        });
                    }
                }
            );

            this.socket.on(
                'edge:heartbeatAck',
                () => {

                    if (this.verbose) {
                        console.log(
                            'Heartbeat acknowledged'
                        );
                    }
                }
            );

            setTimeout(() => {

                if (!this.isConnected) {
                    resolve();
                }

            }, 8000);
        });
    }

    async reportDiscovery(
        phase,
        results
    ) {

        try {

            let baseUrl =
                (
                    this.config.cloudUrl ||
                    'https://onlinescada-api.onrender.com'
                )
                    .replace(
                        /^wss?:/,
                        'https:'
                    )
                    .replace(
                        /\/$/,
                        ''
                    );

            const url =
                `${baseUrl}/api/discovery/edge-report`;

            const payload =
                JSON.stringify({
                    companyId:
                        this.config.companyId,

                    apiKey:
                        this.config.apiKey,

                    phase,
                    results
                });

            const http =
                url.startsWith('https')
                    ? require('https')
                    : require('http');

            const reqUrl =
                new URL(url);

            const options = {
                hostname:
                    reqUrl.hostname,

                port:
                    reqUrl.port,

                path:
                    reqUrl.pathname,

                method:
                    'POST',

                headers: {
                    'Content-Type':
                        'application/json',

                    'Content-Length':
                        Buffer.byteLength(
                            payload
                        )
                }
            };

            return new Promise(
                (resolve, reject) => {

                    const req =
                        http.request(
                            options,
                            (res) => {
                                resolve();
                            }
                        );

                    req.on(
                        'error',
                        reject
                    );

                    req.write(payload);
                    req.end();
                }
            );

        } catch (err) {

            if (this.verbose) {
                console.error(
                    `Discovery report failed: ${err.message}`
                );
            }
        }
    }

    sendTagValues(tags) {

        if (
            !this.isConnected ||
            !this.socket
        ) {
            return;
        }

        if (
            !tags ||
            tags.length === 0
        ) {
            return;
        }

        this.socket.emit(
            'edge:tagValues',
            {
                tags
            }
        );

        if (this.verbose) {

            const sample =
                tags
                    .slice(0, 3)
                    .map(
                        (t) =>
                            `${t.tagName}=${t.value}`
                    )
                    .join(', ');

            console.log(
                `Streamed ${tags.length} tag(s): ${sample}${tags.length > 3
                    ? '...'
                    : ''
                }`
            );
        }
    }

    sendHeartbeat(stats) {

        if (
            !this.isConnected ||
            !this.socket
        ) {
            return;
        }

        this.socket.emit(
            'edge:heartbeat',
            {
                version: '1.0.0',

                hostname:
                    os.hostname(),

                os:
                    `${os.type()} ${os.release()}`,

                uptimeSeconds:
                    Math.floor(
                        process.uptime()
                    ),

                memoryUsageMB:
                    Math.round(
                        process
                            .memoryUsage()
                            .heapUsed /
                        1024 /
                        1024
                    ),

                cpuPercent:
                    0,

                tagsReadPerSecond:
                    stats.tagsReadPerSecond ||
                    0,

                totalReads:
                    stats.totalReads ||
                    0,

                totalErrors:
                    stats.totalErrors ||
                    0,
            }
        );
    }

    sendWriteResult(result) {

        if (
            !this.isConnected ||
            !this.socket
        ) {
            return;
        }

        this.socket.emit(
            'edge:writeResult',
            result
        );
    }

    sendError(message) {

        if (
            !this.isConnected ||
            !this.socket
        ) {
            return;
        }

        this.socket.emit(
            'edge:error',
            {
                message,
                timestamp: Date.now()
            }
        );
    }

    onWriteCommand(callback) {
        this.writeCallback = callback;
    }

    onConfigUpdate(callback) {
        this.configCallback = callback;
    }

    onStartDiscovery(callback) {
        this.discoveryCallback = callback;
    }

    disconnect() {

        if (this.socket) {

            this.socket.disconnect();

            this.isConnected = false;
        }
    }
}

module.exports = CloudBridge;