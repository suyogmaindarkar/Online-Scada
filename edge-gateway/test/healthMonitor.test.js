'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const HealthMonitor = require('../src/healthMonitor');

test('health monitor includes connector telemetry in heartbeat payload', () => {
    let payload;
    const monitor = new HealthMonitor(
        { heartbeatIntervalMs: 60_000 },
        { metrics: { heartbeatSent: 2, tagBatchesSent: 4 }, sendHeartbeat: (stats) => { payload = stats; } },
        { getStats: () => ({ tagsReadPerSecond: 3, totalReads: 20, totalErrors: 1, equipmentStatuses: [] }) },
    );

    monitor._sendHeartbeat();

    assert.equal(payload.totalReads, 20);
    assert.equal(payload.connectorMetrics.heartbeatSent, 2);
    assert.equal(payload.connectorMetrics.tagBatchesSent, 4);
});
