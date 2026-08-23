// ═══════════════════════════════════════════════════════════
// PLC Discovery Service — Phase 1 + Phase 2 Deep Identification
//
// Phase 1 Features:
//   ✅ Subnet detection + ping sweep + port probing
//   ✅ Parallel scanning with concurrency limit
//   ✅ MAC vendor lookup (OUI database)
//   ✅ Protocol identification + confidence levels
//   ✅ Auto-generates recommended PLC settings
//
// Phase 2 Features (NEW):
//   ✅ S7 Deep Probe  — COTP + S7 PDU handshake → model/firmware/serial
//   ✅ OPC UA Deep Probe — node-opcua discovery → app name/manufacturer
//   ✅ Modbus FC43 Probe — Device Identification → vendor/product/firmware
//   ✅ Graceful fallback on every probe (never crashes scan)
//   ✅ "verified" flag when actual protocol handshake succeeds
// ═══════════════════════════════════════════════════════════

const net = require('net');
const os = require('os');
const { exec } = require('child_process');

// ─── Try to load node-opcua (optional — only used for deep probe) ───
let opcua = null;
try {
  opcua = require('node-opcua');
} catch {
  // node-opcua not installed — OPC UA deep probe will be skipped gracefully
}

// ─── Known PLC ports ───
const PLC_PORTS = [
  { port: 102, protocol: 'S7', label: 'Siemens S7' },
  { port: 502, protocol: 'MODBUS_TCP', label: 'Modbus TCP' },
  { port: 4840, protocol: 'OPC_UA', label: 'OPC UA' },
  { port: 44818, protocol: 'ETHERNET_IP', label: 'EtherNet/IP' },
];

// ─── MAC OUI Database ───
const OUI_DATABASE = {
  '00:1B:1B': 'SIEMENS', '00:0E:8C': 'SIEMENS', '00:1C:06': 'SIEMENS',
  '00:1B:1D': 'SIEMENS', '08:00:06': 'SIEMENS', '00:30:DE': 'SIEMENS',
  '98:80:BB': 'SIEMENS', 'B0:B2:DC': 'SIEMENS', 'AC:64:17': 'SIEMENS',
  '00:14:13': 'SIEMENS',
  '00:00:BC': 'ALLEN_BRADLEY', '00:1D:9C': 'ALLEN_BRADLEY',
  '5C:88:16': 'ALLEN_BRADLEY', 'B4:8A:0A': 'ALLEN_BRADLEY',
  '00:20:BD': 'ALLEN_BRADLEY',
  '00:80:F4': 'SCHNEIDER', '00:C0:02': 'SCHNEIDER', '00:60:38': 'SCHNEIDER',
  '00:30:11': 'MITSUBISHI', '00:04:A5': 'MITSUBISHI', '00:01:C0': 'MITSUBISHI',
  '00:00:0C': 'OMRON',
  '00:16:B6': 'DELTA',
  '00:01:05': 'BECKHOFF',
  '00:A0:45': 'PHOENIX_CONTACT',
  '00:60:65': 'B_AND_R',
  '00:80:25': 'ABB',
};

const VENDOR_NAMES = {
  SIEMENS: 'Siemens',
  ALLEN_BRADLEY: 'Allen-Bradley (Rockwell)',
  SCHNEIDER: 'Schneider Electric',
  MITSUBISHI: 'Mitsubishi Electric',
  OMRON: 'Omron',
  DELTA: 'Delta Electronics',
  WAGO: 'WAGO',
  BECKHOFF: 'Beckhoff',
  PHOENIX_CONTACT: 'Phoenix Contact',
  B_AND_R: 'B&R Automation',
  ABB: 'ABB',
  OTHER: 'Unknown Manufacturer',
};

const DEFAULT_SETTINGS = {
  SIEMENS: { rack: 0, slot: 1 },
  ALLEN_BRADLEY: { rack: 0, slot: 0 },
  SCHNEIDER: { rack: 0, slot: 0 },
  OTHER: { rack: 0, slot: 1 },
};

// ═══════════════════════════════════════════════════════════
// S7 PROTOCOL CONSTANTS
// These are the raw bytes for a minimal S7 handshake.
// We send COTP CR (Connection Request) then S7 Setup Communication.
// The response contains PLC identity info in the parameter section.
// ═══════════════════════════════════════════════════════════

// TPKT + COTP Connection Request (CR) PDU
// Connects to TSAP 0x0100 (PG/PC) → 0x0200 (S7 server)
const S7_COTP_CR = Buffer.from([
  // TPKT header (RFC 1006)
  0x03, 0x00,       // version=3, reserved=0
  0x00, 0x16,       // length = 22 bytes total

  // COTP Connection Request (CR = 0xE0)
  0x11,             // COTP data length = 17 bytes
  0xE0,             // PDU type: CR (Connection Request)
  0x00, 0x00,       // dst-ref = 0
  0x00, 0x01,       // src-ref = 1
  0x00,             // class=0, no options

  // COTP parameters
  0xC0, 0x01, 0x0A, // tpdu-size: 0x0A = 1024 bytes
  0xC1, 0x02, 0x01, 0x00, // src-tsap: PG/PC (0x0100)
  0xC2, 0x02, 0x01, 0x02, // dst-tsap: S7 server (0x0102)
]);

// TPKT + COTP DT + S7 Setup Communication Request (PDU type 0x01)
const S7_SETUP_COMM = Buffer.from([
  // TPKT
  0x03, 0x00, 0x00, 0x19,
  // COTP DT (Data Transfer)
  0x02, 0xF0, 0x80,
  // S7 header
  0x32,       // protocol id
  0x01,       // ROSCTR: JOB
  0x00, 0x00, // redundancy
  0x00, 0x01, // PDU ref
  0x00, 0x08, // param length = 8
  0x00, 0x00, // data length = 0
  // S7 parameter: Setup Communication
  0xF0, 0x00,         // function: Setup Communication
  0x00, 0x08,         // max AMQ caller
  0x00, 0x08,         // max AMQ callee
  0x01, 0xE0,         // PDU size = 480
]);

// S7 Read SZL (System Status List) — ID 0x001C (Module Identification)
// This returns order number, version info, etc.
const buildS7ReadSZL = (szlId, szlIndex) => Buffer.from([
  // TPKT
  0x03, 0x00, 0x00, 0x21,
  // COTP DT
  0x02, 0xF0, 0x80,
  // S7 header
  0x32,       // protocol id
  0x07,       // ROSCTR: USERDATA
  0x00, 0x00,
  0x00, 0x01,
  0x00, 0x08, // param length
  0x00, 0x04, // data length
  // Parameter
  0x00, 0x01, 0x12, 0x04,
  0x11, 0x44, 0x01, 0x00,
  // SZL ID + index
  (szlId >> 8) & 0xFF, szlId & 0xFF,
  (szlIndex >> 8) & 0xFF, szlIndex & 0xFF,
]);


class DiscoveryService {
  constructor() {
    this.isScanning = false;
    this.scanProgress = { total: 0, scanned: 0, found: 0, phase: 'idle' };
  }

  // ═══════════════════════════════════════════════════════════
  // NETWORK UTILITIES (unchanged from Phase 1)
  // ═══════════════════════════════════════════════════════════

  getNetworkInfo() {
    const interfaces = os.networkInterfaces();
    const networks = [];

    for (const [name, addrs] of Object.entries(interfaces)) {
      for (const addr of addrs) {
        if (addr.internal || addr.family !== 'IPv4') continue;
        if (addr.address.startsWith('169.254.')) continue;

        const ipParts = addr.address.split('.').map(Number);
        const maskParts = addr.netmask.split('.').map(Number);
        const networkParts = ipParts.map((ip, i) => ip & maskParts[i]);
        const broadcastParts = ipParts.map((ip, i) => ip | (~maskParts[i] & 255));
        const totalHosts = broadcastParts.reduce(
          (s, b, i) => s + ((b - networkParts[i]) << (8 * (3 - i))), 0
        ) - 1;

        networks.push({
          interface: name,
          address: addr.address,
          netmask: addr.netmask,
          mac: addr.mac,
          network: networkParts.join('.'),
          broadcast: broadcastParts.join('.'),
          cidr: `${networkParts.join('.')}/${this.netmaskToCidr(addr.netmask)}`,
          totalHosts: Math.min(totalHosts, 254),
          startIP: `${networkParts[0]}.${networkParts[1]}.${networkParts[2]}.${networkParts[3] + 1}`,
          endIP: `${broadcastParts[0]}.${broadcastParts[1]}.${broadcastParts[2]}.${broadcastParts[3] - 1}`,
        });
      }
    }
    return networks;
  }

  netmaskToCidr(netmask) {
    return netmask.split('.').reduce((cidr, octet) => {
      cidr += (octet >>> 0).toString(2).split('1').length - 1;
      return cidr;
    }, 0);
  }

  generateIPRange(startIP, endIP) {
    const start = startIP.split('.').map(Number);
    const end = endIP.split('.').map(Number);
    const ips = [];

    for (let a = start[0]; a <= end[0]; a++) {
      for (let b = (a === start[0] ? start[1] : 0); b <= (a === end[0] ? end[1] : 255); b++) {
        for (let c = (a === start[0] && b === start[1] ? start[2] : 0);
          c <= (a === end[0] && b === end[1] ? end[2] : 255); c++) {
          for (let d = (a === start[0] && b === start[1] && c === start[2] ? start[3] : 1);
            d <= (a === end[0] && b === end[1] && c === end[2] ? end[3] : 254); d++) {
            ips.push(`${a}.${b}.${c}.${d}`);
          }
        }
      }
    }
    return ips.slice(0, 1024);
  }

  probePort(ip, port, timeout = 1500) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let responded = false;

      socket.setTimeout(timeout);
      socket.on('connect', () => {
        responded = true; socket.destroy();
        resolve({ open: true, ip, port });
      });
      socket.on('timeout', () => {
        if (!responded) { socket.destroy(); resolve({ open: false, ip, port }); }
      });
      socket.on('error', () => {
        if (!responded) { responded = true; socket.destroy(); resolve({ open: false, ip, port }); }
      });
      try { socket.connect(port, ip); } catch { resolve({ open: false, ip, port }); }
    });
  }

  pingHost(ip, timeout = 1500) {
    return new Promise((resolve) => {
      const isWindows = os.platform() === 'win32';
      const cmd = isWindows
        ? `ping -n 1 -w ${timeout} ${ip}`
        : `ping -c 1 -W ${Math.ceil(timeout / 1000)} ${ip}`;

      const child = exec(cmd, { timeout: timeout + 500 }, (error, stdout) => {
        if (error) { resolve({ alive: false, ip }); return; }
        const isAlive = isWindows
          ? !stdout.includes('Request timed out') && !stdout.includes('unreachable') && stdout.includes('Reply from')
          : stdout.includes('1 received') || stdout.includes('1 packets received') || stdout.includes('bytes from');
        resolve({ alive: isAlive, ip });
      });
      setTimeout(() => { try { child.kill(); } catch { } }, timeout + 1000);
    });
  }

  getMacAddress(ip) {
    return new Promise((resolve) => {
      const isWindows = os.platform() === 'win32';
      const cmd = isWindows ? `arp -a ${ip}` : `arp -n ${ip}`;
      exec(cmd, { timeout: 2000 }, (error, stdout) => {
        if (error) { resolve(null); return; }
        const macRegex = /([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}/;
        const match = stdout.match(macRegex);
        resolve(match ? match[0].replace(/-/g, ':').toUpperCase() : null);
      });
    });
  }

  lookupVendor(mac) {
    if (!mac) return null;
    const oui = mac.split(':').slice(0, 3).join(':').toUpperCase();
    return OUI_DATABASE[oui] || null;
  }

  async runParallel(tasks, concurrency = 30) {
    const results = [];
    let index = 0;
    const runNext = async () => {
      const i = index++;
      if (i >= tasks.length) return;
      results[i] = await tasks[i]();
      this.scanProgress.scanned += 1;
      return runNext();
    };
    const workers = Array.from(
      { length: Math.min(concurrency, tasks.length) }, () => runNext()
    );
    await Promise.all(workers);
    return results;
  }

  // ═══════════════════════════════════════════════════════════
  // PHASE 2 — DEEP PROBES
  // ═══════════════════════════════════════════════════════════

  // ───────────────────────────────────────────────────────────
  // S7 DEEP PROBE
  // Performs a real S7 protocol handshake on port 102.
  // Steps:
  //   1. TCP connect to port 102
  //   2. Send COTP Connection Request → wait for CC (0xD0)
  //   3. Send S7 Setup Communication → wait for ACK (0x32 0x03)
  //   4. Send SZL Read 0x0011 (Module Order Number) → parse response
  //   5. Send SZL Read 0x001C (Component Name)      → parse response
  // Returns: { success, orderNumber, model, firmware, serial, plcName }
  // ───────────────────────────────────────────────────────────
  probeS7(ip, timeout = 3000) {
    return new Promise((resolve) => {
      const result = {
        success: false,
        orderNumber: null,  // e.g. "6ES7 515-2FM01-0AB0"
        model: null,  // e.g. "CPU 1515F-2 PN"
        firmware: null,  // e.g. "V2.9.2"
        serial: null,
        plcName: null,
      };

      let socket = null;
      let timer = null;
      let stage = 'cotp_cr';  // cotp_cr → setup_comm → szl_0011 → szl_001c → done
      let rxBuf = Buffer.alloc(0);

      const done = (err) => {
        clearTimeout(timer);
        if (socket) { try { socket.destroy(); } catch { } socket = null; }
        if (err) {
          resolve(result);
        } else {
          result.success = true;
          resolve(result);
        }
      };

      timer = setTimeout(() => done(new Error('timeout')), timeout);

      try {
        socket = new net.Socket();
        socket.setTimeout(timeout);

        socket.on('error', () => done(new Error('socket error')));
        socket.on('timeout', () => done(new Error('socket timeout')));
        socket.on('close', () => { if (stage !== 'done') done(new Error('closed')); });

        socket.on('data', (chunk) => {
          rxBuf = Buffer.concat([rxBuf, chunk]);

          try {
            // ── We need at least 4 bytes (TPKT header) to know total length ──
            while (rxBuf.length >= 4) {
              const pktLen = rxBuf.readUInt16BE(2);
              if (rxBuf.length < pktLen) break; // wait for more data

              const pkt = rxBuf.slice(0, pktLen);
              rxBuf = rxBuf.slice(pktLen);

              const cotpType = pkt.length > 5 ? pkt[5] : 0;

              if (stage === 'cotp_cr') {
                // Expect COTP CC (Connection Confirm = 0xD0)
                if (cotpType === 0xD0) {
                  stage = 'setup_comm';
                  socket.write(S7_SETUP_COMM);
                }

              } else if (stage === 'setup_comm') {
                // Expect S7 ACK (0x32 0x03) — Setup Comm response
                if (pkt.length > 8 && pkt[7] === 0x32 && pkt[8] === 0x03) {
                  stage = 'szl_0011';
                  // Read SZL 0x0011 — Module Order Number
                  socket.write(buildS7ReadSZL(0x0011, 0x0001));
                }

              } else if (stage === 'szl_0011') {
                // Parse SZL 0x0011 response — contains order number & firmware
                this._parseS7SZL0011(pkt, result);
                stage = 'szl_001c';
                // Read SZL 0x001C — Component Name (station name)
                socket.write(buildS7ReadSZL(0x001C, 0x0001));

              } else if (stage === 'szl_001c') {
                // Parse SZL 0x001C response — contains PLC name
                this._parseS7SZL001C(pkt, result);
                stage = 'done';
                done(null); // success!
              }
            }
          } catch (parseErr) {
            // Parse failure — still mark partial success if we got setup comm ack
            if (stage !== 'cotp_cr' && stage !== 'setup_comm') {
              result.success = true;
            }
            done(parseErr);
          }
        });

        socket.connect(102, ip, () => {
          socket.write(S7_COTP_CR);
        });

      } catch (connectErr) {
        done(connectErr);
      }
    });
  }

  // ── Parse SZL 0x0011 — Module Order Number ──
  // Byte layout (after TPKT+COTP+S7 headers = 21 bytes):
  //   +0  : SZL ID (2 bytes)
  //   +2  : SZL Index (2 bytes)
  //   +4  : data length (2 bytes)
  //   +6  : element count (2 bytes)
  //   +8  : each element:
  //     +0  : index (2 bytes)
  //     +2  : order number (20 bytes, ASCII, null-padded)
  //     +22 : version (2 bytes: major.minor)
  //     +24 : reserved ...
  _parseS7SZL0011(pkt, result) {
    try {
      // S7 USERDATA response header ends at byte 21
      // Find SZL data start: look for 0x0011 marker
      const offset = 21; // typical header size
      if (pkt.length < offset + 28) return;

      // Order number: 20 ASCII bytes at offset+8+2 = offset+10
      const orderRaw = pkt.slice(offset + 10, offset + 30).toString('ascii').replace(/\0/g, '').trim();
      if (orderRaw && orderRaw.length > 3) {
        result.orderNumber = orderRaw;
        // Derive model from order number pattern
        result.model = this._deriveModelFromOrder(orderRaw);
      }

      // Firmware version: 2 bytes at offset+30 (major) and offset+31 (minor)
      if (pkt.length > offset + 32) {
        const major = pkt[offset + 30];
        const minor = pkt[offset + 31];
        if (major > 0) {
          result.firmware = `V${major}.${minor}`;
        }
      }
    } catch { /* ignore parse errors */ }
  }

  // ── Parse SZL 0x001C — Component / Station Name ──
  _parseS7SZL001C(pkt, result) {
    try {
      const offset = 21;
      if (pkt.length < offset + 24) return;

      // Station name: up to 24 ASCII bytes at offset+10
      const nameRaw = pkt.slice(offset + 10, offset + 34).toString('ascii').replace(/\0/g, '').trim();
      if (nameRaw && nameRaw.length > 0) {
        result.plcName = nameRaw;
      }
    } catch { /* ignore */ }
  }

  // ── Derive human-readable model from Siemens order number ──
  // Order number format: "6ES7 NNN-XXXXX-XXXX"
  _deriveModelFromOrder(orderNum) {
    // Known Siemens CPU order number prefixes → model names
    const modelMap = [
      { prefix: '6ES7 511', model: 'CPU 1511' },
      { prefix: '6ES7 513', model: 'CPU 1513' },
      { prefix: '6ES7 515', model: 'CPU 1515' },
      { prefix: '6ES7 516', model: 'CPU 1516' },
      { prefix: '6ES7 517', model: 'CPU 1517' },
      { prefix: '6ES7 518', model: 'CPU 1518' },
      { prefix: '6ES7 212', model: 'S7-1200 CPU 1212' },
      { prefix: '6ES7 214', model: 'S7-1200 CPU 1214' },
      { prefix: '6ES7 215', model: 'S7-1200 CPU 1215' },
      { prefix: '6ES7 217', model: 'S7-1200 CPU 1217' },
      { prefix: '6ES7 312', model: 'S7-300 CPU 312' },
      { prefix: '6ES7 314', model: 'S7-300 CPU 314' },
      { prefix: '6ES7 315', model: 'S7-300 CPU 315' },
      { prefix: '6ES7 317', model: 'S7-300 CPU 317' },
      { prefix: '6ES7 412', model: 'S7-400 CPU 412' },
      { prefix: '6ES7 414', model: 'S7-400 CPU 414' },
      { prefix: '6ES7 416', model: 'S7-400 CPU 416' },
    ];

    for (const { prefix, model } of modelMap) {
      if (orderNum.startsWith(prefix)) {
        // Add F suffix if it's a fail-safe CPU
        const isSafety = orderNum.includes('-2FM') || orderNum.includes('-2AM') || orderNum.includes('F');
        return isSafety && !model.includes('F') ? model + 'F' : model;
      }
    }
    return null; // unknown — let UI show order number instead
  }

  // ───────────────────────────────────────────────────────────
  // OPC UA DEEP PROBE
  // Uses node-opcua to connect to discovery endpoint and
  // read server application description.
  // Returns: { success, appName, productUri, manufacturer, serverState, securityPolicies }
  // ───────────────────────────────────────────────────────────
  async probeOPCUA(ip, timeout = 5000) {
    const result = {
      success: false,
      appName: null,  // e.g. "SIMATIC S7-1500 Station_1"
      productUri: null,
      manufacturer: null,
      serverState: null,  // e.g. "Running"
      securityPolicies: [],
    };

    if (!opcua) {
      // node-opcua not available — skip gracefully
      return result;
    }

    const endpointUrl = `opc.tcp://${ip}:4840`;

    try {
      // Use a short timeout via Promise.race
      const probePromise = (async () => {
        // Get endpoints (no session needed — just discovery)
        const endpoints = await opcua.getEndpointUrl(endpointUrl);

        // Try to get application descriptions
        const client = opcua.OPCUAClient.create({
          applicationName: 'OnlineSCADA-Discovery',
          connectionStrategy: { maxRetry: 0, initialDelay: 100, maxDelay: 200 },
          securityMode: opcua.MessageSecurityMode.None,
          securityPolicy: opcua.SecurityPolicy.None,
          endpointMustExist: false,
          requestedSessionTimeout: 2000,
          keepSessionAlive: false,
        });

        await client.connect(endpointUrl);

        try {
          const session = await client.createSession();
          try {
            // Read ServerStatus → State
            const stateNode = await session.readVariableValue('ns=0;i=2259');
            if (stateNode && stateNode.value && stateNode.value.value !== undefined) {
              const stateNames = ['Running', 'Failed', 'NoConfiguration', 'Suspended', 'Shutdown', 'Test', 'CommunicationFault', 'Unknown'];
              result.serverState = stateNames[stateNode.value.value] || `State:${stateNode.value.value}`;
            }

            // Read ServerStatus → BuildInfo → ManufacturerName
            const mfgNode = await session.readVariableValue('ns=0;i=2264');
            if (mfgNode && mfgNode.value && mfgNode.value.value) {
              result.manufacturer = String(mfgNode.value.value).trim();
            }

            // Read ServerStatus → BuildInfo → ProductName
            const prodNode = await session.readVariableValue('ns=0;i=2265');
            if (prodNode && prodNode.value && prodNode.value.value) {
              result.appName = String(prodNode.value.value).trim();
            }

            // Read Server → ServerArray (gives URIs)
            const uriNode = await session.readVariableValue('ns=0;i=2254');
            if (uriNode && uriNode.value && Array.isArray(uriNode.value.value) && uriNode.value.value.length > 0) {
              result.productUri = String(uriNode.value.value[0]).trim();
            }

            result.success = true;
          } finally {
            await session.close();
          }
        } finally {
          await client.disconnect();
        }

        return result;
      })();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('OPC UA probe timeout')), timeout)
      );

      return await Promise.race([probePromise, timeoutPromise]);

    } catch (err) {
      // Any error (timeout, connection refused, etc.) — return partial result
      return result;
    }
  }

  // ───────────────────────────────────────────────────────────
  // MODBUS FC43 DEEP PROBE
  // Sends Modbus Function Code 43 (Read Device Identification)
  // with MEI type 0x0E (Regular identification).
  //
  // Response object IDs:
  //   0x00 = VendorName
  //   0x01 = ProductCode
  //   0x02 = MajorMinorRevision (firmware)
  //   0x03 = VendorUrl
  //   0x04 = ProductName
  //   0x05 = ModelName
  //   0x06 = ApplicationName
  //
  // NOT all Modbus devices support FC43 — graceful fallback.
  // Returns: { success, vendorName, productCode, firmware, modelName }
  // ───────────────────────────────────────────────────────────
  probeModbus(ip, timeout = 3000) {
    return new Promise((resolve) => {
      const result = {
        success: false,
        vendorName: null,
        productCode: null,
        firmware: null,
        modelName: null,
      };

      // Build Modbus TCP FC43 Request
      // Transaction ID: 0x0001
      // Protocol ID: 0x0000 (Modbus)
      // Length: 5 bytes (unit + func + MEI type + read code + object id)
      // Unit ID: 1
      // FC: 43 (0x2B)
      // MEI Type: 14 (0x0E) = Read Device Identification
      // Read Device ID Code: 1 (0x01) = stream access, basic
      // Object ID: 0 (start from beginning)
      const request = Buffer.from([
        0x00, 0x01,   // Transaction ID
        0x00, 0x00,   // Protocol ID
        0x00, 0x05,   // Length
        0x01,         // Unit ID
        0x2B,         // Function Code 43
        0x0E,         // MEI Type: Read Device Identification
        0x01,         // Read Device ID Code: Basic
        0x00,         // Object ID: start at 0
      ]);

      let socket = null;
      let timer = null;
      let rxBuf = Buffer.alloc(0);

      const done = (success) => {
        clearTimeout(timer);
        if (socket) { try { socket.destroy(); } catch { } socket = null; }
        result.success = success;
        resolve(result);
      };

      timer = setTimeout(() => done(false), timeout);

      try {
        socket = new net.Socket();
        socket.setTimeout(timeout);
        socket.on('error', () => done(false));
        socket.on('timeout', () => done(false));

        socket.on('data', (chunk) => {
          rxBuf = Buffer.concat([rxBuf, chunk]);

          // Modbus TCP response: 6-byte MBAP header + PDU
          // MBAP: TransID(2) + ProtoID(2) + Length(2)
          if (rxBuf.length < 6) return;
          const pduLen = rxBuf.readUInt16BE(4);
          if (rxBuf.length < 6 + pduLen) return;

          const pdu = rxBuf.slice(6, 6 + pduLen);

          // pdu[0] = unit id
          // pdu[1] = function code (0x2B = FC43, or 0xAB = exception)
          if (pdu.length < 2 || pdu[1] !== 0x2B) {
            // FC43 not supported or exception response
            done(false);
            return;
          }

          // pdu[2] = MEI Type (0x0E)
          // pdu[3] = Read Device ID Code
          // pdu[4] = Conformity Level
          // pdu[5] = More Follows (0 = last)
          // pdu[6] = Next Object Id
          // pdu[7] = Number of Objects
          if (pdu.length < 8) { done(false); return; }

          const objectCount = pdu[7];
          let pos = 8; // start of first object

          for (let i = 0; i < objectCount && pos + 2 < pdu.length; i++) {
            const objId = pdu[pos];
            const objLen = pdu[pos + 1];
            pos += 2;

            if (pos + objLen > pdu.length) break;

            const objVal = pdu.slice(pos, pos + objLen).toString('ascii').trim();
            pos += objLen;

            switch (objId) {
              case 0x00: result.vendorName = objVal; break;
              case 0x01: result.productCode = objVal; break;
              case 0x02: result.firmware = objVal; break;
              case 0x04: result.modelName = objVal; break;
              case 0x05: if (!result.modelName) result.modelName = objVal; break;
            }
          }

          done(true);
        });

        socket.connect(502, ip, () => {
          socket.write(request);
        });

      } catch {
        done(false);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  // SINGLE IP DEEP PROBE (for /api/discovery/probe endpoint)
  // Probes one specific IP across all known PLC protocols.
  // Returns comprehensive device info.
  // ═══════════════════════════════════════════════════════════
  async probeDevice(ip, ports = null) {
    // If no ports provided, first detect which are open
    let openPorts = ports;
    if (!openPorts) {
      const portChecks = await Promise.all(
        PLC_PORTS.map(({ port }) => this.probePort(ip, port, 2000))
      );
      openPorts = portChecks.filter(r => r.open).map(r => r.port);
    }

    const mac = await this.getMacAddress(ip);
    const vendor = this.lookupVendor(mac);
    const protocols = this.identifyProtocols(openPorts);
    const confidence = this.calculateConfidence(openPorts, vendor);
    const recommended = this.getRecommendedSettings(ip, openPorts, vendor, protocols);

    // ── Run deep probes in parallel ──
    const deepProbes = await Promise.allSettled([
      openPorts.includes(102) ? this.probeS7(ip, 4000) : Promise.resolve(null),
      openPorts.includes(4840) ? this.probeOPCUA(ip, 6000) : Promise.resolve(null),
      openPorts.includes(502) ? this.probeModbus(ip, 3000) : Promise.resolve(null),
    ]);

    const s7Info = deepProbes[0].value;
    const opcuaInfo = deepProbes[1].value;
    const modbusInfo = deepProbes[2].value;

    // ── Build enriched deepInfo object ──
    const deepInfo = this._mergeDeepInfo(s7Info, opcuaInfo, modbusInfo, vendor);

    // ── Verified = at least one deep probe succeeded ──
    const verified = !!(s7Info?.success || opcuaInfo?.success || modbusInfo?.success);

    // ── Recalculate confidence with deep info ──
    const finalConfidence = verified
      ? (confidence === 'low' ? 'medium' : confidence === 'medium' ? 'high' : confidence)
      : confidence;

    return {
      ip,
      mac: mac || 'Unknown',
      vendor: vendor || 'OTHER',
      vendorName: VENDOR_NAMES[vendor] || VENDOR_NAMES.OTHER,
      ports: openPorts,
      protocols,
      confidence: finalConfidence,
      verified,
      deepInfo,
      recommended: {
        ...recommended,
        model: deepInfo.model || recommended.model || '',
      },
      // Raw probe results (for debugging)
      probeResults: {
        s7: s7Info,
        opcua: opcuaInfo,
        modbus: modbusInfo,
      },
    };
  }

  // ── Merge deep probe results into a unified deepInfo object ──
  _mergeDeepInfo(s7, opcua, modbus, vendor) {
    const info = {
      model: null,
      firmware: null,
      serial: null,
      orderNumber: null,
      plcName: null,
      manufacturer: null,
      probeMethod: null,  // which probe gave us the info
    };

    // Priority: S7 > OPC UA > Modbus
    if (s7 && s7.success) {
      info.model = s7.model || null;
      info.firmware = s7.firmware || null;
      info.serial = s7.serial || null;
      info.orderNumber = s7.orderNumber || null;
      info.plcName = s7.plcName || null;
      info.manufacturer = VENDOR_NAMES[vendor] || 'Siemens';
      info.probeMethod = 'S7 Protocol';
    }

    if (opcua && opcua.success) {
      if (!info.model && opcua.appName) info.model = opcua.appName;
      if (!info.firmware && opcua.serverState) info.firmware = null; // state ≠ firmware
      if (!info.manufacturer && opcua.manufacturer) info.manufacturer = opcua.manufacturer;
      if (!info.plcName && opcua.appName) info.plcName = opcua.appName;
      if (!info.probeMethod) info.probeMethod = 'OPC UA';
      else info.probeMethod += ' + OPC UA';

      // OPC UA gives us richer app name
      info.opcuaAppName = opcua.appName || null;
      info.opcuaServerState = opcua.serverState || null;
    }

    if (modbus && modbus.success) {
      if (!info.model && modbus.modelName) info.model = modbus.modelName;
      if (!info.firmware && modbus.firmware) info.firmware = modbus.firmware;
      if (!info.manufacturer && modbus.vendorName) info.manufacturer = modbus.vendorName;
      if (!info.probeMethod) info.probeMethod = 'Modbus FC43';
      else info.probeMethod += ' + Modbus FC43';
    }

    return info;
  }

  // ═══════════════════════════════════════════════════════════
  // MAIN DISCOVERY — Phase 1 scan + Phase 2 deep probes
  // ═══════════════════════════════════════════════════════════
  async discover(options = {}) {
    if (this.isScanning) {
      return { success: false, message: 'Scan already in progress' };
    }
    this.isScanning = true;

    try {
      const {
        startIP = null,
        endIP = null,
        networkIndex = 0,
        timeout = 1500,
        concurrency = 30,
        deepProbe = true,   // NEW: whether to run deep probes
      } = options;

      // ── Phase 0: IP range ──
      let ips;
      if (startIP && endIP) {
        ips = this.generateIPRange(startIP, endIP);
      } else {
        const networks = this.getNetworkInfo();
        if (networks.length === 0) {
          this.isScanning = false;
          return { success: false, message: 'No network interfaces found' };
        }
        const network = networks[networkIndex] || networks[0];
        ips = this.generateIPRange(network.startIP, network.endIP);
      }

      console.log(`🔍 Discovery Phase 1: scanning ${ips.length} IPs...`);
      this.scanProgress = { total: ips.length, scanned: 0, found: 0, phase: 'pinging' };

      // ── Phase 1a: Ping sweep ──
      const pingTasks = ips.map(ip => () => this.pingHost(ip, timeout));
      const pingResults = await this.runParallel(pingTasks, concurrency);

      // Exclude own IPs
      const ownIPs = new Set(['127.0.0.1']);
      for (const addrs of Object.values(os.networkInterfaces())) {
        for (const addr of addrs) {
          if (addr.family === 'IPv4') ownIPs.add(addr.address);
        }
      }
      const aliveHosts = pingResults
        .filter(r => r && r.alive)
        .map(r => r.ip)
        .filter(ip => !ownIPs.has(ip));

      console.log(`   📡 ${aliveHosts.length} hosts alive (own IPs excluded: ${[...ownIPs].join(', ')})`);
      this.scanProgress.phase = 'probing';
      this.scanProgress.scanned = 0;
      this.scanProgress.total = aliveHosts.length * PLC_PORTS.length;

      // ── Phase 1b: Port probing ──
      const portTasks = [];
      aliveHosts.forEach(ip => {
        PLC_PORTS.forEach(({ port }) => {
          portTasks.push(() => this.probePort(ip, port, timeout));
        });
      });
      const portResults = await this.runParallel(portTasks, concurrency);
      const openPorts = portResults.filter(r => r && r.open);

      const deviceMap = new Map();
      openPorts.forEach(({ ip, port }) => {
        if (!deviceMap.has(ip)) deviceMap.set(ip, []);
        deviceMap.get(ip).push(port);
      });

      console.log(`   🔌 ${deviceMap.size} devices with PLC-like ports`);

      // ── Phase 2: Deep identification ──
      const devices = [];

      if (deepProbe && deviceMap.size > 0) {
        console.log(`🔬 Discovery Phase 2: deep probing ${deviceMap.size} device(s)...`);
        this.scanProgress.phase = 'deep_probing';
        this.scanProgress.scanned = 0;
        this.scanProgress.total = deviceMap.size;

        for (const [ip, ports] of deviceMap) {
          console.log(`   🔬 Deep probing ${ip} (ports: ${ports.join(', ')})`);
          try {
            const deviceInfo = await this.probeDevice(ip, ports);
            devices.push(deviceInfo);
            if (deviceInfo.verified) {
              console.log(`   ✅ ${ip} VERIFIED — ${deviceInfo.deepInfo.probeMethod}`);
            }
          } catch (e) {
            // Fallback to Phase 1 info only
            const mac = await this.getMacAddress(ip);
            const vendor = this.lookupVendor(mac);
            const protocols = this.identifyProtocols(ports);
            const confidence = this.calculateConfidence(ports, vendor);
            const recommended = this.getRecommendedSettings(ip, ports, vendor, protocols);
            devices.push({
              ip, mac: mac || 'Unknown',
              vendor: vendor || 'OTHER',
              vendorName: VENDOR_NAMES[vendor] || VENDOR_NAMES.OTHER,
              ports, protocols, confidence,
              verified: false,
              deepInfo: { model: null, firmware: null, serial: null, orderNumber: null, plcName: null, manufacturer: null, probeMethod: null },
              recommended,
            });
          }
          this.scanProgress.scanned += 1;
          this.scanProgress.found = devices.filter(d => d.verified).length;
        }
      } else {
        // No deep probe — Phase 1 only (fast mode)
        for (const [ip, ports] of deviceMap) {
          const mac = await this.getMacAddress(ip);
          const vendor = this.lookupVendor(mac);
          const protocols = this.identifyProtocols(ports);
          const confidence = this.calculateConfidence(ports, vendor);
          const recommended = this.getRecommendedSettings(ip, ports, vendor, protocols);
          devices.push({
            ip, mac: mac || 'Unknown',
            vendor: vendor || 'OTHER',
            vendorName: VENDOR_NAMES[vendor] || VENDOR_NAMES.OTHER,
            ports, protocols, confidence,
            verified: false,
            deepInfo: { model: null, firmware: null, serial: null, orderNumber: null, plcName: null, manufacturer: null, probeMethod: null },
            recommended,
          });
        }
      }

      // Sort: verified first, then highest confidence, then by IP
      devices.sort((a, b) => {
        if (a.verified !== b.verified) return a.verified ? -1 : 1;
        const order = { high: 0, medium: 1, low: 2 };
        const diff = (order[a.confidence] || 2) - (order[b.confidence] || 2);
        return diff !== 0 ? diff : a.ip.localeCompare(b.ip, undefined, { numeric: true });
      });

      this.scanProgress = { total: ips.length, scanned: ips.length, found: devices.length, phase: 'done' };
      console.log(`✅ Discovery complete: ${devices.length} device(s) found, ${devices.filter(d => d.verified).length} verified`);

      this.isScanning = false;
      return {
        success: true,
        scannedIPs: ips.length,
        aliveHosts: aliveHosts.length,
        devices,
        networks: this.getNetworkInfo(),
        deepProbeUsed: deepProbe,
      };

    } catch (error) {
      this.isScanning = false;
      console.error('❌ Discovery error:', error.message);
      return { success: false, message: error.message };
    }
  }

  // ── Protocol helpers ──
  identifyProtocols(ports) {
    return PLC_PORTS
      .filter(p => ports.includes(p.port))
      .map(p => ({ protocol: p.protocol, port: p.port, label: p.label }));
  }

  calculateConfidence(ports, vendor) {
    let score = 0;
    if (vendor && vendor !== 'OTHER') score += 3;
    if (ports.includes(102)) score += 3;
    if (ports.includes(4840)) score += 2;
    if (ports.includes(502)) score += 1;
    if (ports.includes(44818)) score += 2;
    if (ports.length >= 2) score += 1;
    return score >= 4 ? 'high' : score >= 2 ? 'medium' : 'low';
  }

  getRecommendedSettings(ip, ports, vendor, protocols) {
    let bestProtocol = 'MODBUS_TCP';
    let bestPort = 502;

    if (ports.includes(4840)) { bestProtocol = 'OPC_UA'; bestPort = 4840; }
    else if (ports.includes(102)) { bestProtocol = 'S7'; bestPort = 102; }
    else if (ports.includes(502)) { bestProtocol = 'MODBUS_TCP'; bestPort = 502; }
    else if (ports.includes(44818)) { bestProtocol = 'ETHERNET_IP'; bestPort = 44818; }

    const brandKey = vendor || 'OTHER';
    const settings = DEFAULT_SETTINGS[brandKey] || DEFAULT_SETTINGS.OTHER;
    const vendorShort = vendor === 'SIEMENS' ? 'Siemens'
      : vendor === 'ALLEN_BRADLEY' ? 'AB'
        : vendor === 'SCHNEIDER' ? 'Schneider'
          : 'PLC';
    const name = `${vendorShort}_${ip.split('.').pop()}`;

    return {
      name,
      description: `Discovered on network (${ip})`,
      protocol: bestProtocol,
      ipAddress: ip,
      port: bestPort,
      rack: settings.rack,
      slot: settings.slot,
      brand: brandKey,
      model: '',
      pollingRate: 1000,
      allProtocols: protocols,
      recommendedProtocol: bestProtocol,
      reasonForRecommendation: this.getRecommendationReason(bestProtocol, vendor),
    };
  }

  getRecommendationReason(protocol, vendor) {
    if (protocol === 'OPC_UA') return 'OPC UA is modern, secure, and supports the most features';
    if (protocol === 'S7' && vendor === 'SIEMENS') return 'Native Siemens S7 protocol — fastest for Siemens PLCs';
    if (protocol === 'MODBUS_TCP') return 'Universal protocol — works with most PLCs';
    if (protocol === 'ETHERNET_IP') return 'Native Rockwell protocol';
    return 'Best available protocol';
  }

  getProgress() {
    return { ...this.scanProgress, isScanning: this.isScanning };
  }

  cancel() {
    this.isScanning = false;
    this.scanProgress.phase = 'cancelled';
  }
}

module.exports = new DiscoveryService();