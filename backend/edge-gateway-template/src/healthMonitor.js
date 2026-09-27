// ═══════════════════════════════════════════════════════════
// Health Monitor — Heartbeat + Stats Reporter
// ═══════════════════════════════════════════════════════════

class HealthMonitor {

    constructor(
        config,
        cloudBridge,
        verbose = false
    ) {

        this.config = config;
        this.cloudBridge = cloudBridge;
        this.verbose = verbose;

        this.interval = null;

        this.heartbeatMs =
            config.heartbeatIntervalMs ||
            30000;

        this.isRunning = false;
    }

    start() {

        if (this.interval) {
            return;
        }

        this.isRunning = true;

        // Send first heartbeat after 5s
        setTimeout(() => {
            this._sendHeartbeat();
        }, 5000);

        // Then every heartbeatMs
        this.interval = setInterval(
            () => {
                this._sendHeartbeat();
            },
            this.heartbeatMs
        );

        if (this.verbose) {
            console.log(
                `Health monitor started (${this.heartbeatMs / 1000}s)`
            );
        }
    }

    _sendHeartbeat() {

        const mem =
            process.memoryUsage();

        const stats = {

            uptimeSeconds:
                Math.floor(
                    process.uptime()
                ),

            memoryUsageMB:
                Math.round(
                    mem.heapUsed /
                    1024 /
                    1024
                ),

            cpuPercent: 0,

            tagsReadPerSecond: 0,

            totalReads: 0,

            totalErrors: 0,
        };

        this.cloudBridge
            .sendHeartbeat(stats);
    }

    stop() {

        if (this.interval) {

            clearInterval(
                this.interval
            );

            this.interval = null;
        }

        this.isRunning = false;
    }
}

module.exports = HealthMonitor;