'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const edge = require('../src/services/edgeService');
const PLC = require('../src/models/PLCConnection');
const Tag = require('../src/models/Tag');
const plcController = require('../src/controllers/plcController');
const commands = require('../src/controllers/equipmentCommandController');

function response() {
    return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

function bridge(t) {
    edge.gateways.clear();
    edge.equipmentStatuses.clear();
    edge.pendingCommands.clear();
    const events = [];
    const socket = { id: 'socket-a', gatewayId: 'gateway-a', companyId: 'tenant-a' };
    edge.gateways.set(socket.gatewayId, { socketId: socket.id, companyId: socket.companyId });
    edge.gateways.set('gateway-b', { socketId: 'socket-b', companyId: 'tenant-b' });
    edge.mainIo = { to: (room) => ({ emit: (event, data) => events.push({ room, event, data }) }) };
    edge.edgeNamespace = { to: (room) => ({ emit: (event, data) => events.push({ room, event, data }) }) };
    t.after(() => {
        for (const pending of edge.pendingCommands.values()) clearTimeout(pending.timer);
        edge.pendingCommands.clear();
        edge.gateways.clear();
        edge.equipmentStatuses.clear();
        edge.mainIo = null;
        edge.edgeNamespace = null;
    });
    return { socket, events };
}

test('equipment commands are correlated to tenant, gateway, socket, action and equipment', async (t) => {
    const { socket, events } = bridge(t);
    const resultPromise = edge.requestEquipmentCommand('tenant-a', { equipmentId: 'machine-1', action: 'test' });
    const command = events[0];
    assert.equal(command.room, 'socket-a');
    const reply = { requestId: command.data.requestId, equipmentId: 'machine-1', action: 'test', success: true, connected: true, payload: { config: 'internal-only' } };
    edge._handleEquipmentCommandResult({ id: 'socket-b', gatewayId: 'gateway-b', companyId: 'tenant-b' }, reply);
    edge._handleEquipmentCommandResult(socket, { ...reply, equipmentId: 'different-machine' });
    edge._handleEquipmentCommandResult({ ...socket, id: 'old-socket' }, reply);
    assert.equal(edge.pendingCommands.size, 1);
    edge._handleEquipmentCommandResult(socket, reply);
    const result = await resultPromise;
    assert.equal(result.connected, true);
    assert.equal(result.payload, undefined);
    assert.equal(edge.pendingCommands.size, 0);
    assert.equal(edge.equipmentStatuses.size, 0, 'temporary tests must not make persistent equipment look running');
    assert.equal(events.filter((event) => event.event === 'equipmentCommandResult').length, 0);
});

test('silent connector produces a finite command failure', async (t) => {
    bridge(t);
    const keepAlive = setTimeout(() => {}, 100);
    try {
        const result = await edge.requestEquipmentCommand('tenant-a', { equipmentId: 'machine-1', action: 'test' }, { timeoutMs: 5 });
        assert.equal(result.success, false);
        assert.equal(result.code, 'COMMAND_TIMEOUT');
        assert.equal(edge.pendingCommands.size, 0);
    } finally { clearTimeout(keepAlive); }
});

test('connection check uses the connector with full configuration and leaves disabled equipment disabled', async (t) => {
    const { socket, events } = bridge(t);
    let saves = 0;
    const plc = { _id: 'machine-1', name: 'Pump', protocol: 'OPC_UA', isActive: false, opcuaUsername: 'operator', opcuaPassword: 'test-only-password', save: async () => { saves++; } };
    t.mock.method(PLC, 'findOne', async (filter) => { assert.equal(filter.companyId, 'tenant-a'); return plc; });
    t.mock.method(PLC, 'find', async (filter) => { assert.equal(filter.companyId, 'tenant-a'); assert.equal(filter._id, plc._id); assert.equal(filter.isActive, undefined); return [plc]; });
    t.mock.method(Tag, 'find', async () => []);
    edge.edgeNamespace = { to: (room) => ({ emit: (event, data) => {
        events.push({ room, event, data });
        edge._handleEquipmentCommandResult(socket, { ...data, success: true, connected: true, state: 'connected', message: 'Equipment connection test successful' });
    } }) };
    const res = response();
    await plcController.testPLCConnection({ params: { id: plc._id }, companyId: 'tenant-a' }, res);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.connected, true);
    assert.equal(events[0].data.action, 'test');
    assert.equal(events[0].data.payload.config.username, 'operator');
    assert.equal(events[0].data.payload.config.isActive, false);
    assert.equal(plc.isActive, false);
    assert.equal(saves, 0);
});

test('equipment start sends usable config and stop persists disabled state even when the connector is offline', async (t) => {
    bridge(t);
    const plc = { _id: 'machine-1', name: 'Pump', protocol: 'MODBUS_TCP', isActive: false, save: async () => {} };
    t.mock.method(PLC, 'findOne', async (filter) => { assert.equal(filter.companyId, 'tenant-a'); return plc; });
    t.mock.method(PLC, 'find', async () => plc.isActive ? [plc] : []);
    t.mock.method(Tag, 'find', async () => []);
    const sent = [];
    t.mock.method(edge, 'sendEquipmentCommand', (_company, command) => { sent.push(command); return { ok: true, requestId: 'command-1' }; });
    const req = { params: { id: plc._id }, companyId: 'tenant-a', app: { get: () => null } };
    const start = response();
    await commands.startEquipment(req, start);
    assert.equal(start.body.success, true);
    assert.equal(sent[0].payload.config.plcId, plc._id);
    assert.equal(sent[0].payload.config.isActive, true);
    assert.equal(plc.isActive, true);
    edge.gateways.clear();
    t.mock.method(edge, 'sendEquipmentCommand', () => ({ ok: false, code: 'CONNECTOR_OFFLINE' }));
    const stop = response();
    await commands.stopEquipment(req, stop);
    assert.equal(stop.body.success, true);
    assert.equal(stop.body.data.isActive, false);
    assert.equal(plc.isActive, false);
    assert.equal(plc.isConnected, false);
    const restart = response();
    await commands.restartEquipment(req, restart);
    assert.equal(restart.statusCode, 409);
    assert.equal(restart.body.code, 'EQUIPMENT_DISABLED');
});

test('gateway online is not physical connection proof and stopped equipment overrides cached success', async (t) => {
    bridge(t);
    const plc = { _id: 'machine-1', protocol: 'MODBUS_TCP', isActive: true, toObject() { return { _id: this._id, isActive: this.isActive }; } };
    t.mock.method(PLC, 'findOne', async () => plc);
    t.mock.method(Tag, 'countDocuments', async () => 1);
    const req = { params: { id: plc._id }, companyId: 'tenant-a' };
    const unknown = response();
    await plcController.getPLC(req, unknown);
    assert.equal(unknown.body.data.isConnected, false);
    edge.equipmentStatuses.set('tenant-a:machine-1', { gatewayId: 'gateway-a', timestamp: Date.now(), isConnected: true, state: 'streaming' });
    const connected = response();
    await plcController.getPLC(req, connected);
    assert.equal(connected.body.data.isConnected, true);
    plc.isActive = false;
    const stopped = response();
    await plcController.getPLC(req, stopped);
    assert.equal(stopped.body.data.isConnected, false);
    assert.equal(stopped.body.data.connectionState, 'stopped');
});

test('a config broadcast does not falsely confirm a start whose correlated command could not be delivered', async (t) => {
    bridge(t);
    const plc = { _id: 'machine-1', protocol: 'MODBUS_TCP', save: async () => {} };
    t.mock.method(PLC, 'findOne', async () => plc);
    t.mock.method(PLC, 'find', async (filter) => { assert.equal(filter.companyId, 'tenant-a'); assert.equal(filter.isActive, true); return [plc]; });
    t.mock.method(Tag, 'find', async () => []);
    t.mock.method(edge, 'sendEquipmentCommand', () => ({ ok: false, code: 'NOT_INITIALIZED', message: 'Factory Connector bridge is not ready' }));
    const io = { of: () => ({ to: () => ({ emit: () => {} }) }) };
    const res = response();
    await commands.startEquipment({ params: { id: plc._id }, companyId: 'tenant-a', app: { get: () => io } }, res);
    assert.equal(res.body.success, false);
    assert.equal(res.body.code, 'NOT_INITIALIZED');
});

test('initial socket connection sends live configuration including an authoritative empty config', async (t) => {
    const { events } = bridge(t);
    const Gateway = require('../src/models/EdgeGateway');
    const broadcaster = require('../src/services/edgeConfigBroadcaster');
    t.mock.method(Gateway, 'findOneAndUpdate', async () => ({}));
    t.mock.method(broadcaster, 'compileLiveConfig', async (companyId) => { assert.equal(companyId, 'tenant-c'); return { plcs: [], generatedAt: 'now' }; });
    const socket = { id: 'socket-c', gatewayId: 'gateway-c', companyId: 'tenant-c', gatewayName: 'Factory Connector', handshake: {}, join: () => {}, on: () => {}, emit: (event, data) => events.push({ event, data }) };
    edge._onConnection(socket);
    await new Promise(setImmediate);
    assert.deepEqual(events.find((event) => event.event === 'edge:configUpdate').data.plcs, []);
    clearTimeout(edge.gateways.get('gateway-c').heartbeatTimer);
});

test('tag database updates remain scoped to the authenticated workspace', async (t) => {
    bridge(t);
    edge.pendingDbWrites.clear();
    edge._handleTagValues({ companyId: 'tenant-a' }, { tags: [{ tagId: 'same-tag-id', value: 1, timestamp: Date.now() }] });
    edge._handleTagValues({ companyId: 'tenant-b' }, { tags: [{ tagId: 'same-tag-id', value: 2, timestamp: Date.now() }] });
    let operations;
    t.mock.method(Tag, 'bulkWrite', async (ops) => { operations = ops; });
    await edge._flushToDatabase();
    assert.equal(operations.length, 2);
    assert.deepEqual(operations.map((op) => op.updateOne.filter.companyId).sort(), ['tenant-a', 'tenant-b']);
});
