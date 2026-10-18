'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const discovery = require('../src/services/discoveryService');
const edge = require('../src/services/edgeService');
const controller = require('../src/controllers/discoveryController');

function response() {
    return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

test('scan state is correlated to both workspace and assigned connector; stale reports cannot revive a cancelled scan', () => {
    const scan = discovery.initiateScan('discovery-a', {}, 'gateway-a');
    assert.equal(discovery.getStatus('discovery-b').phase, 'idle');
    assert.equal(discovery.updateStatus('discovery-a', { scanId: scan.scanId, phase: 'done' }, 'gateway-b'), false);
    assert.equal(discovery.updateStatus('discovery-b', { scanId: scan.scanId, phase: 'done' }, 'gateway-a'), false);
    assert.equal(discovery.updateStatus('discovery-a', { scanId: 'old', phase: 'done' }, 'gateway-a'), false);
    assert.equal(discovery.updateStatus('discovery-a', { scanId: scan.scanId, phase: 'probing', results: { scannedIPs: 10, aliveHosts: 2, devices: [{ ip: '192.168.1.5', protocol: 'S7', confirmed: true }] } }, 'gateway-a'), true);
    assert.equal(discovery.getStatus('discovery-a').scannedIPs, 10);
    assert.throws(() => discovery.initiateScan('discovery-a', {}, 'gateway-a'), /already running/);
    discovery.cancelScan('discovery-a');
    assert.equal(discovery.updateStatus('discovery-a', { scanId: scan.scanId, phase: 'done' }, 'gateway-a'), false);
    assert.equal(discovery.getStatus('discovery-a').phase, 'cancelled');
    const replacement = discovery.initiateScan('discovery-a', {}, 'gateway-a');
    assert.notEqual(replacement.scanId, scan.scanId);
    discovery.gatewayOffline('discovery-a', 'gateway-b');
    assert.equal(discovery.getStatus('discovery-a').phase, 'queued');
    discovery.gatewayOffline('discovery-a', 'gateway-a');
    assert.equal(discovery.getStatus('discovery-a').phase, 'failed');
});

test('discovery scan has a server-side deadline even if no connector ever reports', (t) => {
    const sent = [];
    t.mock.method(edge, 'sendDiscoveryCommand', (...args) => sent.push(args));
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
    discovery.initiateScan('discovery-timeout', {}, 'gateway-a');
    t.mock.timers.tick(120001);
    assert.equal(discovery.getStatus('discovery-timeout').phase, 'failed');
    assert.equal(sent[0][1], 'edge:cancelDiscovery');
});

test('start validates range, refuses offline delivery, and emits exactly once to one tenant connector', async (t) => {
    const req = { body: { startIP: '192.168.1.1', endIP: '192.168.1.5' }, companyId: 'discovery-route' };
    t.mock.method(edge, 'getCompanyGateways', () => []);
    const offline = response();
    await controller.startDiscovery(req, offline, (err) => { throw err; });
    assert.equal(offline.statusCode, 409);
    assert.equal(offline.body.code, 'CONNECTOR_OFFLINE');
    assert.equal(discovery.getStatus(req.companyId).phase, 'idle');
    t.mock.method(edge, 'getCompanyGateways', () => [{ gatewayId: 'gateway-a' }, { gatewayId: 'gateway-b' }]);
    const sent = [];
    t.mock.method(edge, 'sendDiscoveryCommand', (...args) => { sent.push(args); return { ok: true }; });
    const started = response();
    await controller.startDiscovery(req, started, (err) => { throw err; });
    assert.equal(sent.length, 1);
    assert.equal(sent[0][0], req.companyId);
    assert.equal(sent[0][3], 'gateway-a');
    assert.equal(sent[0][2].scanId, started.body.scanId);
    assert.equal(started.body.phase, 'queued');
    controller.cancelDiscovery(req, response());
    const invalid = response();
    await controller.startDiscovery({ ...req, body: { startIP: '192.168.1.9', endIP: '192.168.1.1' } }, invalid, (err) => { throw err; });
    assert.equal(invalid.statusCode, 400);
});

test('discovery routes authenticate normal user JWTs and reject workspace tokens and tenant mismatches', async (t) => {
    const jwt = require('jsonwebtoken');
    const User = require('../src/models/User');
    const Company = require('../src/models/Company');
    const router = require('../src/routes/discoveryRoutes');
    const oldSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'unit-test-jwt-key';
    t.after(() => { if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret; });
    t.mock.method(console, 'log', () => {});
    t.mock.method(User, 'findById', () => ({ select: async () => ({ isActive: true, companyId: 'jwt-company' }) }));
    t.mock.method(Company, 'findById', async () => ({ _id: 'jwt-company', canAccess: () => true }));
    const invoke = (payload) => new Promise((resolve, reject) => {
        const req = { method: 'GET', url: '/status', originalUrl: '/api/discovery/status', headers: { authorization: `Bearer ${jwt.sign(payload, process.env.JWT_SECRET)}` } };
        const res = response();
        res.json = (body) => { res.body = body; resolve(res); return res; };
        router.handle(req, res, reject);
    });
    const user = await invoke({ type: 'user', userId: 'user-1', companyId: 'jwt-company' });
    assert.equal(user.statusCode, 200);
    assert.equal(user.body.phase, 'idle');
    const workspace = await invoke({ type: 'workspace', companyId: 'jwt-company' });
    assert.equal(workspace.statusCode, 401);
    assert.equal(workspace.body.code, 'WRONG_TOKEN_TYPE');
    const mismatch = await invoke({ type: 'user', userId: 'user-1', companyId: 'other-company' });
    assert.equal(mismatch.statusCode, 403);
    assert.equal(mismatch.body.code, 'TENANT_MISMATCH');
});
