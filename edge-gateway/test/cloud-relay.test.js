'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const CloudBridge = require('../src/cloudBridge');

test('cloud bridge retains initial config, ignores older snapshots, and relays discovery on its authenticated socket', async (t) => {
    t.mock.method(console, 'log', () => {});
    const handlers = new Map();
    const sent = [];
    const socket = { id: 'fake-socket', on: (event, handler) => handlers.set(event, handler), emit: (event, data) => sent.push({ event, data }), disconnect: () => handlers.get('disconnect')('test') };
    const bridge = new CloudBridge({ cloudUrl: 'https://cloud.example', companyId: 'workspace', apiKey: 'unit-test-only' }, false, { createSocket: (_url, options) => { assert.equal(options.auth.companyId, 'workspace'); return socket; } });
    const connecting = bridge.connect();
    handlers.get('connect')();
    await connecting;
    handlers.get('edge:configUpdate')({ plcs: [], generatedAt: '2026-01-02T00:00:00Z' });
    const configs = [];
    bridge.onConfigUpdate((config) => configs.push(config));
    assert.equal(configs.length, 1);
    assert.deepEqual(configs[0].plcs, []);
    handlers.get('edge:configUpdate')({ plcs: [{ plcId: 'stale' }], generatedAt: '2026-01-01T00:00:00Z' });
    assert.equal(configs.length, 1);
    let started;
    let cancelled;
    bridge.onStartDiscovery((options) => { started = options.scanId; });
    bridge.onCancelDiscovery((options) => { cancelled = options.scanId; });
    handlers.get('edge:startDiscovery')({ scanId: 'scan-1' });
    handlers.get('edge:cancelDiscovery')({ scanId: 'scan-1' });
    bridge.reportDiscovery({ scanId: 'scan-1', phase: 'cancelled', results: {} });
    assert.equal(started, 'scan-1');
    assert.equal(cancelled, 'scan-1');
    assert.deepEqual(sent[0], { event: 'edge:discoveryProgress', data: { scanId: 'scan-1', phase: 'cancelled', results: {} } });
    bridge.disconnect();
    assert.equal(bridge.pendingConfig, null);
});
