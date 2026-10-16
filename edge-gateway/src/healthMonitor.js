// ═══════════════════════════════════════════════════════════
// Health Monitor — Heartbeat + Stats Reporter
//
// Sends periodic heartbeats to the cloud with gateway stats.
// Tracks uptime, memory, CPU, and PLC read rates.
// ═══════════════════════════════════════════════════════════

class HealthMonitor {
    constructor(config, cloudBridge, plcReader, verbose = false) {
        this.config = config;
        this.cloudBridge = cloudBridge;
        this.plcReader = plcReader;
        this.verbose = verbose;
        this.interval = null;
        this.heartbeatMs = config.heartbeatIntervalMs || 30000;
    }

    start() {
        if (this.interval) return;

        // Send first heartbeat after 5s
        this._sendHeartbeat();

        // Then every heartbeatMs
        this.interval = setInterval(() => {
            this._sendHeartbeat();
        }, this.heartbeatMs);

        if (this.verbose) {
            console.log(`💓 Health monitor started (every ${this.heartbeatMs / 1000}s)`);
        }
    }

    _sendHeartbeat() {
        // Gather stats from process
        const mem = process.memoryUsage();
        const readerStats = this.plcReader?.getStats?.() || {};
        const stats = {
            uptimeSeconds: Math.floor(process.uptime()),
            memoryUsageMB: Math.round(mem.heapUsed / 1024 / 1024),
            cpuPercent: 0,
            tagsReadPerSecond: readerStats.tagsReadPerSecond || 0,
            totalReads: readerStats.totalReads || 0,
            totalErrors: readerStats.totalErrors || 0,
            equipmentStatuses: readerStats.equipmentStatuses || [],
            connectorMetrics: this.cloudBridge.metrics ? { ...this.cloudBridge.metrics } : {},
        };

        this.cloudBridge.sendHeartbeat(stats);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }
}

module.exports = HealthMonitor;
