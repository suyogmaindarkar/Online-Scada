const net = require('net');
const os = require('os');

const SERVICES = [
    { port: 102, protocol: 'S7', vendorName: 'Siemens-compatible equipment' },
    { port: 502, protocol: 'MODBUS_TCP', vendorName: 'Modbus TCP equipment' },
    { port: 4840, protocol: 'OPC_UA', vendorName: 'OPC UA equipment' },
    { port: 44818, protocol: 'ETHERNET_IP', vendorName: 'EtherNet/IP equipment' },
];

function range(options, interfaces = os.networkInterfaces()) {
    let { startIP, endIP } = options;
    if (!startIP && !endIP) {
        const local = Object.values(interfaces).flat().find((nic) => !nic.internal && (nic.family === 'IPv4' || nic.family === 4));
        if (!local) throw new Error('No factory IPv4 network is available. Enter a scan range.');
        const prefix = local.address.split('.').slice(0, 3).join('.');
        startIP = `${prefix}.1`;
        endIP = `${prefix}.254`;
    }
    if (!net.isIPv4(startIP || '') || !net.isIPv4(endIP || '')) throw new Error('Invalid factory scan range');
    const numeric = (ip) => ip.split('.').reduce((n, part) => n * 256 + Number(part), 0);
    const start = numeric(startIP);
    const count = numeric(endIP) - start + 1;
    if (count < 1 || count > 1024) throw new Error('Scan range must contain between 1 and 1024 addresses');
    return Array.from({ length: count }, (_, i) => [24, 16, 8, 0].map((shift) => ((start + i) >>> shift) & 255).join('.'));
}

// Read-only protocol identification. An open TCP port alone is a candidate,
// never proof of an industrial device. Deep probing requires a valid reply.
function identifyRequest(protocol, ip, port) {
    if (protocol === 'S7') return Buffer.from('0300001611e00000000100c1020100c2020100c0010a', 'hex');
    if (protocol === 'MODBUS_TCP') return Buffer.from('000100000005012b0e0100', 'hex');
    if (protocol === 'ETHERNET_IP') { const packet = Buffer.alloc(24); packet.writeUInt16LE(0x63); return packet; }
    const endpoint = Buffer.from(`opc.tcp://${ip}:${port}`);
    const packet = Buffer.alloc(32 + endpoint.length);
    packet.write('HELF'); packet.writeUInt32LE(packet.length, 4);
    packet.writeUInt32LE(65536, 12); packet.writeUInt32LE(65536, 16);
    packet.writeInt32LE(endpoint.length, 28); endpoint.copy(packet, 32);
    return packet;
}

function validReply(protocol, buffer) {
    if (protocol === 'S7') return buffer.length >= 11 && buffer[0] === 3 && buffer[1] === 0 && buffer.readUInt16BE(2) >= 11 && buffer.length >= buffer.readUInt16BE(2) && buffer[4] >= 6 && buffer[5] === 0xd0;
    if (protocol === 'MODBUS_TCP') return buffer.length >= 9 && buffer.readUInt16BE(0) === 1 && buffer.readUInt16BE(2) === 0 && buffer.readUInt16BE(4) >= 3 && buffer.length >= 6 + buffer.readUInt16BE(4) && buffer[6] === 1 && (buffer[7] === 0xab || (buffer[7] === 0x2b && buffer[8] === 0x0e));
    if (protocol === 'ETHERNET_IP') return buffer.length >= 30 && buffer.readUInt16LE(0) === 0x63 && buffer.readUInt16LE(2) >= 6 && buffer.length >= 24 + buffer.readUInt16LE(2) && buffer.readUInt32LE(8) === 0 && buffer.readUInt16LE(24) > 0 && buffer.readUInt16LE(26) === 0x0c;
    return buffer.length >= 28 && buffer.subarray(0, 4).toString() === 'ACKF' && buffer.readUInt32LE(4) === 28;
}

function probe(ip, service, { deepProbe, signal, timeoutMs = 700 }) {
    return new Promise((resolve) => {
        if (signal.aborted) return resolve(null);
        const socket = new net.Socket();
        let done = false;
        let received = Buffer.alloc(0);
        const finish = (result) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            signal.removeEventListener('abort', abort);
            socket.destroy();
            resolve(result);
        };
        const abort = () => finish(null);
        const timer = setTimeout(() => finish(null), timeoutMs);
        signal.addEventListener('abort', abort, { once: true });
        socket.once('error', () => finish(null));
        socket.once('close', () => finish(null));
        socket.on('data', (chunk) => {
            received = Buffer.concat([received, chunk]);
            if (received.length > 65536) return finish(null);
            if (validReply(service.protocol, received)) finish({ ip, ...service, confirmed: true, evidence: 'protocol_handshake' });
        });
        socket.connect(service.port, ip, () => {
            if (!deepProbe) return finish({ ip, ...service, confirmed: false, evidence: 'open_tcp_port' });
            socket.write(identifyRequest(service.protocol, ip, service.port));
        });
    });
}

class Discovery {
    constructor(report, { probeHost = probe, interfaces, timeoutMs = 90000 } = {}) {
        this.report = report;
        this.probeHost = probeHost;
        this.interfaces = interfaces;
        this.timeoutMs = timeoutMs;
        this.current = null;
        this.requestedId = null;
    }

    cancel(scanId) {
        if (!scanId || this.requestedId === scanId) this.requestedId = null;
        if (this.current && (!scanId || this.current.scanId === scanId)) this.current.controller.abort();
    }

    async start(options = {}) {
        if (!options.scanId || this.current?.scanId === options.scanId) return;
        this.requestedId = options.scanId;
        if (this.current) {
            const previous = this.current;
            previous.controller.abort();
            await previous.done;
            if (this.requestedId !== options.scanId) return;
        }
        const run = { scanId: options.scanId, controller: new AbortController(), timedOut: false };
        let complete;
        run.done = new Promise((resolve) => { complete = resolve; });
        this.current = run;
        const results = { scannedIPs: 0, aliveHosts: 0, totalIPs: 0, devices: [] };
        const report = (phase, message) => this.report({ scanId: run.scanId, phase, results: { ...results, devices: [...results.devices] }, ...(message ? { message } : {}) });
        const timer = setTimeout(() => { run.timedOut = true; run.controller.abort(); }, this.timeoutMs);
        try {
            const addresses = range(options, this.interfaces);
            results.totalIPs = addresses.length;
            report(options.deepProbe ? 'probing' : 'pinging');
            let cursor = 0;
            const worker = async () => {
                while (!run.controller.signal.aborted && cursor < addresses.length) {
                    const ip = addresses[cursor++];
                    const found = await Promise.all(SERVICES.map((service) => this.probeHost(ip, service, { deepProbe: options.deepProbe === true, signal: run.controller.signal })));
                    if (run.controller.signal.aborted) break;
                    const devices = found.filter(Boolean);
                    results.scannedIPs++;
                    if (devices.length) results.aliveHosts++;
                    results.devices.push(...devices);
                    if (results.scannedIPs % 8 === 0 || results.scannedIPs === addresses.length) report(options.deepProbe ? 'probing' : 'pinging');
                }
            };
            await Promise.all(Array.from({ length: Math.min(16, addresses.length) }, worker));
            report(run.timedOut ? 'failed' : run.controller.signal.aborted ? 'cancelled' : 'done', run.timedOut ? 'Factory network scan timed out' : undefined);
        } catch (_) {
            run.controller.abort();
            report('failed', 'Unable to scan this factory network. Check the scan range and connector network access.');
        } finally {
            clearTimeout(timer);
            if (this.current === run) this.current = null;
            complete();
        }
    }
}

module.exports = { Discovery, range, validReply };
