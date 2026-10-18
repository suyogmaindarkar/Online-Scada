'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const PLCReader = require('../src/plcReader');

const equipment = (extra = {}) => ({ plcId: 'machine-1', protocol: 'modbus', isActive: true, pollIntervalMs: 60000, tags: [{ tagId: 'tag-1', tagName: 'Speed' }], ...extra });
function fixture(configs = [equipment()]) {
    const results = [];
    const batches = [];
    const manager = new PLCReader({ plcs: configs }, { sendEquipmentCommandResult: (result) => results.push(result), sendTagValues: (values) => batches.push(values) });
    const created = [];
    manager._createReader = () => {
        const reader = { isConnected: false, disconnects: 0, connect: async () => { reader.isConnected = true; return true; }, disconnect: async () => { reader.disconnects++; reader.isConnected = false; }, readTags: async () => [{ tagId: 'tag-1', tagName: 'Speed', value: 42, quality: 'GOOD' }] };
        created.push(reader);
        return reader;
    };
    return { manager, created, results, batches };
}

test('disabled equipment never starts; an explicit test is temporary and preserves disabled configuration', async () => {
    const config = equipment({ isActive: false });
    const { manager, created, results } = fixture([config]);
    await manager.startAll();
    assert.equal(created.length, 0);
    await manager.handleEquipmentCommand({ requestId: 'test-1', equipmentId: config.plcId, action: 'test', payload: { config } });
    assert.equal(results[0].success, true);
    assert.equal(results[0].connected, true);
    assert.equal(config.isActive, false);
    assert.equal(created[0].disconnects, 1);
    assert.equal(manager.readers.size, 0);
    assert.equal(manager.intervals.size, 0);
    await manager.handleEquipmentCommand({ requestId: 'restart-1', equipmentId: config.plcId, action: 'restart' });
    assert.equal(results[1].success, false);
    assert.equal(created.length, 1);
});

test('stop disconnects the protocol client before acknowledging and discards an in-flight read', async () => {
    const { manager, created, results, batches } = fixture();
    await manager.startAll();
    let completeRead;
    created[0].readTags = () => new Promise((resolve) => { completeRead = resolve; });
    const poll = manager._pollPLC('machine-1', manager.config.plcs[0]);
    manager.previousValues.set('tag-1', { value: 10 });
    await manager.handleEquipmentCommand({ requestId: 'stop-1', equipmentId: 'machine-1', action: 'stop' });
    assert.equal(created[0].disconnects, 1);
    assert.equal(results[0].state, 'stopped');
    assert.equal(manager.readers.size, 0);
    assert.equal(manager.intervals.size, 0);
    assert.equal(manager.previousValues.has('tag-1'), false);
    completeRead([{ tagId: 'tag-1', value: 99, quality: 'GOOD' }]);
    await poll;
    assert.equal(batches.length, 0);
    assert.equal(manager.getEquipmentStatuses()[0].isConnected, false);
    assert.equal(manager.getEquipmentStatuses()[0].state, 'stopped');
});

test('a connection completing after stop cannot resurrect polling or a reader', async () => {
    const { manager, created } = fixture();
    let finishConnect;
    manager._createReader = () => {
        const reader = { isConnected: false, disconnects: 0, connect: () => new Promise((resolve) => { finishConnect = () => { reader.isConnected = true; resolve(true); }; }), disconnect: () => { reader.disconnects++; reader.isConnected = false; } };
        created.push(reader);
        return reader;
    };
    const starting = manager.startOnePLC(manager.config.plcs[0]);
    while (!finishConnect) await Promise.resolve();
    await manager.stopOnePLC('machine-1');
    finishConnect();
    assert.equal((await starting).ok, false);
    assert.equal(manager.readers.size, 0);
    assert.equal(manager.intervals.size, 0);
    assert.equal(created[0].isConnected, false);
});

test('identical config plus start command is idempotent; retained polling updates the current status', async (t) => {
    const { manager, created } = fixture();
    t.after(() => manager.stopAll());
    await manager.startAll();
    await manager.reload([equipment()]);
    await manager.handleEquipmentCommand({ requestId: 'start-1', equipmentId: 'machine-1', action: 'start', payload: { config: equipment() } });
    assert.equal(created.length, 1);
    assert.equal(manager.intervals.size, 1);
    assert.equal(manager.getEquipmentStatuses()[0].state, 'connected_no_data');
    await manager._pollPLC('machine-1', manager.config.plcs[0]);
    assert.equal(manager.getEquipmentStatuses()[0].state, 'streaming');
    manager.config.plcs[0].lastDataAt = Date.now() - 300000;
    assert.equal(manager.getEquipmentStatuses()[0].state, 'connected_no_data');
    created[0].isConnected = false;
    assert.equal(manager.getEquipmentStatuses()[0].isConnected, false);
});

test('temporary connection test has a finite deadline and closes late connections', async () => {
    const { manager, created, results } = fixture([equipment({ isActive: false })]);
    let complete;
    manager._createReader = () => {
        const reader = { isConnected: false, disconnects: 0, connect: () => new Promise((resolve) => { complete = resolve; }), disconnect: () => { reader.disconnects++; reader.isConnected = false; } };
        created.push(reader);
        return reader;
    };
    const originalBounded = manager._bounded.bind(manager);
    manager._bounded = (promise) => originalBounded(promise, 5);
    await manager.handleEquipmentCommand({ requestId: 'test-timeout', equipmentId: 'machine-1', action: 'test' });
    assert.equal(results[0].success, false);
    assert.equal(created[0].disconnects, 1);
    complete(true);
    await new Promise(setImmediate);
    assert.ok(created[0].disconnects >= 2);
    assert.equal(manager.intervals.size, 0);
});

test('a write for stopped equipment cannot fall through to another active reader with the same address', async (t) => {
    t.mock.method(console, 'log', () => {});
    t.mock.method(console, 'warn', () => {});
    const { manager, created } = fixture([
        equipment({ isActive: false, tags: [{ tagId: 'stopped-tag', address: '40001' }] }),
        equipment({ plcId: 'machine-2', tags: [{ tagId: 'active-tag', address: '40001' }] }),
    ]);
    t.after(() => manager.stopAll());
    await manager.startAll();
    let writes = 0;
    let result;
    created[0].writeTag = async () => { writes++; };
    manager.cloudBridge.sendWriteResult = (data) => { result = data; };
    await manager.handleWriteCommand({ tagId: 'stopped-tag', address: '40001', value: 1 });
    assert.equal(writes, 0);
    assert.equal(result.success, false);
});
