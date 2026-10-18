'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Discovery, range, validReply } = require('../src/discovery');

test('factory scan derives its default subnet locally and rejects invalid or oversized ranges', () => {
    assert.equal(range({}, { eth0: [{ family: 'IPv4', internal: false, address: '192.168.8.40' }] })[0], '192.168.8.1');
    assert.throws(() => range({ startIP: 'bad', endIP: '192.168.0.1' }));
    assert.throws(() => range({ startIP: '10.0.0.1', endIP: '10.0.8.1' }));
});

test('scan reports correlated progress and completes with protocol candidates', async () => {
    const reports = [];
    const scan = new Discovery((data) => reports.push(data), { probeHost: async (ip, service) => service.port === 502 ? { ip, ...service, confirmed: false } : null });
    await scan.start({ scanId: 'scan-1', startIP: '192.168.1.1', endIP: '192.168.1.9' });
    assert.equal(reports[0].scanId, 'scan-1');
    assert.equal(reports[0].phase, 'pinging');
    assert.ok(reports.some((report) => report.results.scannedIPs > 0 && report.phase === 'pinging'));
    const last = reports.at(-1);
    assert.equal(last.phase, 'done');
    assert.equal(last.results.scannedIPs, 9);
    assert.equal(last.results.aliveHosts, 9);
    assert.equal(last.results.devices[0].confirmed, false);
});

test('cancel aborts in-flight probes and replacement scan does not get silently dropped', async () => {
    const reports = [];
    let probes = 0;
    const scan = new Discovery((data) => reports.push(data), { probeHost: async (_ip, _service, { signal }) => {
        probes++;
        return new Promise((resolve) => { if (signal.aborted) resolve(null); else signal.addEventListener('abort', () => resolve(null), { once: true }); });
    } });
    const first = scan.start({ scanId: 'old', startIP: '192.168.1.1', endIP: '192.168.1.1' });
    assert.equal(probes, 4);
    scan.cancel('old');
    scan.probeHost = async () => null;
    const second = scan.start({ scanId: 'new', startIP: '192.168.1.2', endIP: '192.168.1.2' });
    await Promise.all([first, second]);
    assert.equal(reports.find((report) => report.scanId === 'old' && report.phase === 'cancelled').phase, 'cancelled');
    assert.equal(reports.at(-1).scanId, 'new');
    assert.equal(reports.at(-1).phase, 'done');
});

test('discovery reports finite timeout and validation failure', async () => {
    const reports = [];
    const scan = new Discovery((data) => reports.push(data), { timeoutMs: 5, probeHost: (_ip, _service, { signal }) => new Promise((resolve) => signal.addEventListener('abort', () => resolve(null), { once: true })) });
    await scan.start({ scanId: 'timeout', startIP: '192.168.1.1', endIP: '192.168.1.1' });
    assert.equal(reports.at(-1).phase, 'failed');
    assert.match(reports.at(-1).message, /timed out/);
    await scan.start({ scanId: 'invalid', startIP: 'invalid', endIP: 'invalid' });
    assert.equal(reports.at(-1).phase, 'failed');
});

test('deep probing requires a protocol reply, not a generic open HTTP/TCP service', () => {
    for (const protocol of ['S7', 'MODBUS_TCP', 'OPC_UA', 'ETHERNET_IP']) assert.equal(validReply(protocol, Buffer.from('HTTP/1.1 200 OK\r\n')), false);
    assert.equal(validReply('S7', Buffer.from('0300001611d000', 'hex')), false);
    assert.equal(validReply('S7', Buffer.from('0300000b06d00001000100', 'hex')), true);
    assert.equal(validReply('MODBUS_TCP', Buffer.from('00010000000301ab01', 'hex')), true);
    const ack = Buffer.alloc(28); ack.write('ACKF'); ack.writeUInt32LE(28, 4);
    assert.equal(validReply('OPC_UA', ack), true);
});
