// ═══════════════════════════════════════════════════════════
// PLC Discovery Service — Phase 3.1 (Improved)
//
// FIXES & IMPROVEMENTS:
//   ✅ Discovers PLCs on ALL interfaces (including 169.254.x.x link-local & virtual)
//   ✅ Dual-Path Host Alive: checks Ping OR quick PLC ports to bypass ICMP firewalls
//   ✅ Smart PC Bypass: PLCs with active web servers (ports 80/443) are never ignored
//   ✅ S7 reads BuildInfo as STRUCT correctly
//   ✅ Sanitizes software versions & models reliably
// ═══════════════════════════════════════════════════════════

const net  = require('net');
const os   = require('os');
const { exec } = require('child_process');

let opcua = null;
try {
  opcua = require('node-opcua');
  console.log('✅ node-opcua loaded — OPC UA deep probe enabled');
} catch {
  console.warn('⚠️  node-opcua not installed — OPC UA deep probe disabled');
}

const PLC_PORTS = [
  { port: 102,   protocol: 'S7',           label: 'Siemens S7'  },
  { port: 502,   protocol: 'MODBUS_TCP',   label: 'Modbus TCP'  },
  { port: 4840,  protocol: 'OPC_UA',       label: 'OPC UA'      },
  { port: 44818, protocol: 'ETHERNET_IP',  label: 'EtherNet/IP' },
];

const OUI_DATABASE = {
  '00:1B:1B': 'SIEMENS', '00:0E:8C': 'SIEMENS', '00:1C:06': 'SIEMENS',
  '00:1B:1D': 'SIEMENS', '08:00:06': 'SIEMENS', '00:30:DE': 'SIEMENS',
  '98:80:BB': 'SIEMENS', 'B0:B2:DC': 'SIEMENS', 'AC:64:17': 'SIEMENS',
  '00:14:13': 'SIEMENS', '00:1F:F8': 'SIEMENS', '00:50:06': 'SIEMENS',
  '20:87:56': 'SIEMENS', '28:63:36': 'SIEMENS', '8C:F3:19': 'SIEMENS',
  'E0:DC:A0': 'SIEMENS', '00:09:8E': 'SIEMENS', '54:A2:74': 'SIEMENS',
  'D4:97:0B': 'SIEMENS', '00:A0:45': 'SIEMENS', 'B4:A9:FC': 'SIEMENS',
  '00:1B:44': 'SIEMENS', '00:E0:4C': 'SIEMENS',
  '00:00:BC': 'ALLEN_BRADLEY', '00:1D:9C': 'ALLEN_BRADLEY',
  '5C:88:16': 'ALLEN_BRADLEY', 'B4:8A:0A': 'ALLEN_BRADLEY',
  '00:20:BD': 'ALLEN_BRADLEY', 'F4:54:33': 'ALLEN_BRADLEY',
  '00:0F:73': 'ALLEN_BRADLEY', 'E4:90:69': 'ALLEN_BRADLEY',
  '00:80:F4': 'SCHNEIDER', '00:C0:02': 'SCHNEIDER', '00:60:38': 'SCHNEIDER',
  '00:00:54': 'SCHNEIDER', '00:1E:C0': 'SCHNEIDER', 'D4:F5:27': 'SCHNEIDER',
  '00:30:11': 'MITSUBISHI', '00:04:A5': 'MITSUBISHI', '00:01:C0': 'MITSUBISHI',
  '00:00:0C': 'OMRON', '00:20:FB': 'OMRON', '84:E3:27': 'OMRON',
  '00:16:B6': 'DELTA', '00:01:05': 'BECKHOFF',
  '00:80:25': 'ABB', 'A8:74:1D': 'PHOENIX_CONTACT',
  '00:60:65': 'B_AND_R',
};

const VENDOR_NAMES = {
  SIEMENS:         'Siemens',
  ALLEN_BRADLEY:   'Allen-Bradley (Rockwell)',
  SCHNEIDER:       'Schneider Electric',
  MITSUBISHI:      'Mitsubishi Electric',
  OMRON:           'Omron',
  DELTA:           'Delta Electronics',
  BECKHOFF:        'Beckhoff',
  ABB:             'ABB',
  PHOENIX_CONTACT: 'Phoenix Contact',
  B_AND_R:         'B&R Automation',
  OTHER:           'Unknown Manufacturer',
};

const S7_TSAP_PAIRS = [
  { src: [0x01, 0x00], dst: [0x01, 0x00] },
  { src: [0x01, 0x00], dst: [0x01, 0x01] },
  { src: [0x01, 0x00], dst: [0x03, 0x00] },
  { src: [0x01, 0x00], dst: [0x01, 0x02] },
];

const buildCotpCR = (srcTsap, dstTsap) => Buffer.from([
  0x03, 0x00, 0x00, 0x16,
  0x11, 0xE0, 0x00, 0x00,
  0x00, 0x01, 0x00,
  0xC0, 0x01, 0x0A,
  0xC1, 0x02, srcTsap[0], srcTsap[1],
  0xC2, 0x02, dstTsap[0], dstTsap[1],
]);

const S7_SETUP_COMM = Buffer.from([
  0x03, 0x00, 0x00, 0x19,
  0x02, 0xF0, 0x80,
  0x32, 0x01, 0x00, 0x00,
  0x00, 0x01, 0x00, 0x08, 0x00, 0x00,
  0xF0, 0x00, 0x00, 0x08, 0x00, 0x08, 0x03, 0xC0,
]);

const buildS7ReadSZL = (szlId, szlIndex) => Buffer.from([
  0x03, 0x00, 0x00, 0x21,
  0x02, 0xF0, 0x80,
  0x32, 0x07, 0x00, 0x00,
  0x00, 0x01, 0x00, 0x08, 0x00, 0x04,
  0x00, 0x01, 0x12, 0x04,
  0x11, 0x44, 0x01, 0x00,
  (szlId >> 8) & 0xFF, szlId & 0xFF,
  (szlIndex >> 8) & 0xFF, szlIndex & 0xFF,
]);

class DiscoveryService {
  constructor() {
    this.isScanning   = false;
    this.scanProgress = { total: 0, scanned: 0, found: 0, phase: 'idle' };
  }

  getNetworkInfo() {
    const interfaces = os.networkInterfaces();
    const networks   = [];

    for (const [name, addrs] of Object.entries(interfaces)) {
      for (const addr of addrs) {
        if (addr.family !== 'IPv4') continue;

        const ipParts        = addr.address.split('.').map(Number);
        const maskParts      = (addr.netmask || '255.255.255.0').split('.').map(Number);
        const networkParts   = ipParts.map((ip, i) => ip & maskParts[i]);
        const broadcastParts = ipParts.map((ip, i) => ip | (~maskParts[i] & 255));
        const totalHosts     = broadcastParts.reduce(
          (s, b, i) => s + ((b - networkParts[i]) << (8 * (3 - i))), 0
        ) - 1;

        networks.push({
          interface:  name,
          address:    addr.address,
          netmask:    addr.netmask || '255.255.255.0',
          mac:        addr.mac,
          network:    networkParts.join('.'),
          broadcast:  broadcastParts.join('.'),
          cidr:       `${networkParts.join('.')}/${this.netmaskToCidr(addr.netmask || '255.255.255.0')}`,
          totalHosts: Math.min(totalHosts, 254),
          startIP:    `${networkParts[0]}.${networkParts[1]}.${networkParts[2]}.${networkParts[3] + 1}`,
          endIP:      `${broadcastParts[0]}.${broadcastParts[1]}.${broadcastParts[2]}.${broadcastParts[3] - 1}`,
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

  getOwnIPs() {
    const ownIPs = new Set(['127.0.0.1', '0.0.0.0']);
    for (const addrs of Object.values(os.networkInterfaces())) {
      for (const addr of addrs) {
        if (addr.family === 'IPv4') ownIPs.add(addr.address);
      }
    }
    return ownIPs;
  }

  generateIPRange(startIP, endIP) {
    const start = startIP.split('.').map(Number);
    const end   = endIP.split('.').map(Number);
    const ips   = [];

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
      const socket  = new net.Socket();
      let responded = false;
      socket.setTimeout(timeout);
      socket.on('connect', () => { responded = true; socket.destroy(); resolve({ open: true,  ip, port }); });
      socket.on('timeout', () => { if (!responded) { socket.destroy(); resolve({ open: false, ip, port }); } });
      socket.on('error',   () => { if (!responded) { responded = true; socket.destroy(); resolve({ open: false, ip, port }); } });
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
          ? !stdout.includes('Request timed out') &&
            !stdout.includes('unreachable') &&
            stdout.includes('Reply from')
          : stdout.includes('1 received') ||
            stdout.includes('1 packets received') ||
            stdout.includes('bytes from');
        resolve({ alive: isAlive, ip });
      });
      setTimeout(() => { try { child.kill(); } catch {} }, timeout + 1000);
    });
  }

  // ═══════════════════════════════════════════════════════════
  // ✅ DUAL-PATH HOST DETECTION
  // A host is alive if it pings OR responds to any standard PLC port.
  // ═══════════════════════════════════════════════════════════
  async isHostAlive(ip, timeout = 1500) {
    const [pingRes, portChecks] = await Promise.all([
      this.pingHost(ip, timeout),
      Promise.all(PLC_PORTS.map(({ port }) => this.probePort(ip, port, Math.min(timeout, 1000))))
    ]);

    const isPingAlive = pingRes && pingRes.alive;
    const openPorts = portChecks.filter(r => r && r.open).map(r => r.port);
    const hasOpenPort = openPorts.length > 0;

    return {
      ip,
      alive: isPingAlive || hasOpenPort,
      openPorts
    };
  }

  getMacAddress(ip) {
    return new Promise((resolve) => {
      const isWindows = os.platform() === 'win32';
      const cmd = isWindows ? `arp -a ${ip}` : `arp -n ${ip}`;
      exec(cmd, { timeout: 2000 }, (error, stdout) => {
        if (error) { resolve(null); return; }
        const macRegex = /([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}/;
        const match    = stdout.match(macRegex);
        resolve(match ? match[0].replace(/-/g, ':').toUpperCase() : null);
      });
    });
  }

  getHostname(ip) {
    return new Promise((resolve) => {
      const dns = require('dns');
      try {
        dns.reverse(ip, (err, hostnames) => {
          if (err || !hostnames || hostnames.length === 0) return resolve(null);
          resolve(hostnames[0]);
        });
      } catch { resolve(null); }
      setTimeout(() => resolve(null), 2000);
    });
  }

  // ═══════════════════════════════════════════════════════════
  // PC DETECTION (FILTER OUT NON-PLCs)
  // ═══════════════════════════════════════════════════════════
  async isLikelyPC(ip, timeout = 800) {
    const pcPorts = [
      { port: 80,   name: 'HTTP' },
      { port: 443,  name: 'HTTPS' },
      { port: 3389, name: 'RDP' },
      { port: 445,  name: 'SMB' },
      { port: 22,   name: 'SSH' },
      { port: 135,  name: 'MSRPC' },
      { port: 139,  name: 'NetBIOS' },
      { port: 8080, name: 'HTTP-Alt' },
    ];

    const results = await Promise.all(
      pcPorts.map(p => this.probePort(ip, p.port, timeout))
    );

    const openPcPorts = results
      .filter(r => r.open)
      .map((r, i) => pcPorts[i]);

    const pcScore = openPcPorts.length;
    const hasRDP = openPcPorts.some(p => p.port === 3389);
    const hasSMB = openPcPorts.some(p => p.port === 445);

    const isPC = pcScore >= 2 || hasRDP || hasSMB;

    if (isPC) {
      console.log(`   🖥️  ${ip} identified as PC (open: ${openPcPorts.map(p => p.name).join(', ')})`);
    }

    return {
      isPC,
      pcScore,
      openPcPorts: openPcPorts.map(p => p.name),
    };
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
      try {
        results[i] = await tasks[i]();
      } catch (err) {
        console.error(`Task ${i} error:`, err.message);
        results[i] = null;
      }
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
  // S7 DEEP PROBE
  // ═══════════════════════════════════════════════════════════
  async probeS7(ip, timeout = 4000) {
    for (const tsap of S7_TSAP_PAIRS) {
      const result = await this._probeS7WithTSAP(ip, tsap.src, tsap.dst, timeout);
      if (result.success) {
        result.tsapUsed = `0x${tsap.src[0].toString(16).padStart(2,'0')}${tsap.src[1].toString(16).padStart(2,'0')}→0x${tsap.dst[0].toString(16).padStart(2,'0')}${tsap.dst[1].toString(16).padStart(2,'0')}`;
        console.log(`   ✅ S7 connected to ${ip} via TSAP ${result.tsapUsed}`);
        return result;
      }
    }
    return { success: false, orderNumber: null, model: null, firmware: null, plcName: null };
  }

  _probeS7WithTSAP(ip, srcTsap, dstTsap, timeout) {
    return new Promise((resolve) => {
      const result = {
        success: false, orderNumber: null, model: null,
        firmware: null, plcName: null,
      };
      let socket = null, timer = null, stage = 'cotp_cr', rxBuf = Buffer.alloc(0), resolved = false;

      const done = (err) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        if (socket) { try { socket.destroy(); } catch {} socket = null; }
        if (!err) result.success = true;
        resolve(result);
      };

      timer = setTimeout(() => done(new Error('timeout')), timeout);

      try {
        socket = new net.Socket();
        socket.setTimeout(timeout);
        socket.on('error',   () => done(new Error('socket error')));
        socket.on('timeout', () => done(new Error('socket timeout')));
        socket.on('close',   () => { if (stage !== 'done') done(new Error('closed')); });

        socket.on('data', (chunk) => {
          rxBuf = Buffer.concat([rxBuf, chunk]);
          try {
            while (rxBuf.length >= 4) {
              const pktLen = rxBuf.readUInt16BE(2);
              if (rxBuf.length < pktLen) break;
              const pkt  = rxBuf.slice(0, pktLen);
              rxBuf      = rxBuf.slice(pktLen);
              const cotpType = pkt.length > 5 ? pkt[5] : 0;

              if (stage === 'cotp_cr') {
                if (cotpType === 0xD0) {
                  stage = 'setup_comm';
                  socket.write(S7_SETUP_COMM);
                } else if (cotpType === 0x50) {
                  done(new Error('TSAP rejected'));
                }
              } else if (stage === 'setup_comm') {
                if (pkt.length > 8 && pkt[7] === 0x32 && pkt[8] === 0x03) {
                  stage = 'szl_0011';
                  socket.write(buildS7ReadSZL(0x0011, 0x0001));
                }
              } else if (stage === 'szl_0011') {
                this._parseS7SZL0011(pkt, result);
                stage = 'szl_001c';
                socket.write(buildS7ReadSZL(0x001C, 0x0001));
              } else if (stage === 'szl_001c') {
                this._parseS7SZL001C(pkt, result);
                stage = 'done';
                done(null);
              }
            }
          } catch (parseErr) {
            if (stage !== 'cotp_cr' && stage !== 'setup_comm') result.success = true;
            done(parseErr);
          }
        });

        socket.connect(102, ip, () => {
          socket.write(buildCotpCR(srcTsap, dstTsap));
        });
      } catch (connectErr) {
        done(connectErr);
      }
    });
  }

  _parseS7SZL0011(pkt, result) {
    try {
      const ascii = pkt.toString('latin1');
      const orderRegex = /6[A-Z]{2}[0-9][\s\-]?[0-9A-Z]{3}[\s\-]?[0-9A-Z]{4,5}[\s\-]?[0-9A-Z]{4}/;
      const m = ascii.match(orderRegex);
      if (m) {
        const raw = m[0].replace(/\s+/g, ' ').trim();
        result.orderNumber = raw;
        result.model = this._deriveModelFromOrder(raw);
      }
      const fwMatch = ascii.match(/V(\d{1,2})\.(\d{1,3})(\.(\d{1,3}))?/);
      if (fwMatch) {
        result.firmware = fwMatch[4]
          ? `V${fwMatch[1]}.${fwMatch[2]}.${fwMatch[4]}`
          : `V${fwMatch[1]}.${fwMatch[2]}`;
      }
    } catch { /* ignore */ }
  }

  _parseS7SZL001C(pkt, result) {
    try {
      const ascii = pkt.toString('latin1');
      const runs  = ascii.match(/[\x20-\x7E]{3,34}/g) || [];
      for (const run of runs) {
        const clean = run.trim();
        if (!clean || clean.length < 3) continue;
        if (result.orderNumber && clean.includes(result.orderNumber.slice(0, 6))) continue;
        if (/^6[A-Z]{2}[0-9]/.test(clean)) continue;
        if (['ISO', 'TCP', 'RFC', 'PDU', 'SZL'].includes(clean)) continue;
        result.plcName = clean;
        break;
      }
    } catch { /* ignore */ }
  }

  _deriveModelFromOrder(orderNum) {
    if (!orderNum) return null;
    const o = orderNum.replace(/[\s\-]/g, '');
    const modelMap = [
      { prefix: '6ES7511', model: 'S7-1500 CPU 1511' },
      { prefix: '6ES7513', model: 'S7-1500 CPU 1513' },
      { prefix: '6ES7515', model: 'S7-1500 CPU 1515' },
      { prefix: '6ES7516', model: 'S7-1500 CPU 1516' },
      { prefix: '6ES7517', model: 'S7-1500 CPU 1517' },
      { prefix: '6ES7518', model: 'S7-1500 CPU 1518' },
      { prefix: '6ES7212', model: 'S7-1200 CPU 1212' },
      { prefix: '6ES7214', model: 'S7-1200 CPU 1214' },
      { prefix: '6ES7215', model: 'S7-1200 CPU 1215' },
      { prefix: '6ES7217', model: 'S7-1200 CPU 1217' },
      { prefix: '6ES7312', model: 'S7-300 CPU 312'   },
      { prefix: '6ES7314', model: 'S7-300 CPU 314'   },
      { prefix: '6ES7315', model: 'S7-300 CPU 315'   },
      { prefix: '6ES7317', model: 'S7-300 CPU 317'   },
    ];
    for (const { prefix, model } of modelMap) {
      if (o.startsWith(prefix.replace(/[\s\-]/g, ''))) {
        const isSafety = o.includes('2FM') || o.includes('2AM') || orderNum.toUpperCase().includes('F-');
        return isSafety && !model.includes('F') ? model + 'F' : model;
      }
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════
  // OPC UA DEEP PROBE
  // ═══════════════════════════════════════════════════════════
  async probeOPCUA(ip, timeout = 10000) {
    const result = {
      success:         false,
      appName:         null,
      productUri:      null,
      manufacturer:    null,
      serverState:     null,
      softwareVersion: null,
      buildNumber:     null,
      productName:     null,
    };

    if (!opcua) {
      console.log(`   ⚠️  OPC UA probe skipped for ${ip} (node-opcua not installed)`);
      return result;
    }

    const endpointUrl = `opc.tcp://${ip}:4840`;
    console.log(`   🔶 OPC UA probing ${endpointUrl}...`);

    try {
      const probePromise = (async () => {
        const client = opcua.OPCUAClient.create({
          applicationName:         'OnlineSCADA-Discovery',
          connectionStrategy:      { maxRetry: 1, initialDelay: 500, maxDelay: 1000 },
          securityMode:            opcua.MessageSecurityMode.None,
          securityPolicy:          opcua.SecurityPolicy.None,
          endpointMustExist:       false,
          requestedSessionTimeout: 5000,
          keepSessionAlive:        false,
        });

        await client.connect(endpointUrl);
        console.log(`   🔶 OPC UA connected to ${ip}`);

        try {
          const session = await client.createSession();
          try {
            const buildInfoStruct = await session.readVariableValue('ns=0;i=2260');

            if (buildInfoStruct?.value?.value && typeof buildInfoStruct.value.value === 'object') {
              const bi = buildInfoStruct.value.value;
              if (bi.productUri)        result.productUri      = this._sanitizeString(bi.productUri);
              if (bi.manufacturerName)  result.manufacturer    = this._sanitizeString(bi.manufacturerName);
              if (bi.productName)       result.productName     = this._sanitizeString(bi.productName);
              if (bi.softwareVersion)   result.softwareVersion = this._sanitizeString(bi.softwareVersion);
              if (bi.buildNumber)       result.buildNumber     = this._sanitizeString(bi.buildNumber);

              result.appName = result.productName;
            }

            try {
              const stateNode = await session.readVariableValue('ns=0;i=2259');
              if (stateNode?.value?.value !== undefined && stateNode.value.value !== null) {
                const stateNames = ['Running','Failed','NoConfiguration','Suspended','Shutdown','Test','CommunicationFault','Unknown'];
                const stateNum = Number(stateNode.value.value);
                if (!isNaN(stateNum) && stateNum >= 0 && stateNum < stateNames.length) {
                  result.serverState = stateNames[stateNum];
                }
              }
            } catch { /* ignore */ }

            if (!result.productName) {
              const fallbackNodes = [
                { field: 'manufacturer',    nodeId: 'ns=0;i=2263' },
                { field: 'productName',     nodeId: 'ns=0;i=2261' },
                { field: 'productUri',      nodeId: 'ns=0;i=2262' },
                { field: 'softwareVersion', nodeId: 'ns=0;i=2264' },
                { field: 'buildNumber',     nodeId: 'ns=0;i=2265' },
              ];
              for (const { field, nodeId } of fallbackNodes) {
                try {
                  const v = await session.readVariableValue(nodeId);
                  const sanitized = this._sanitizeString(v?.value?.value);
                  if (sanitized) result[field] = sanitized;
                } catch { /* skip node */ }
              }
              if (result.productName && !result.appName) result.appName = result.productName;
            }

            result.success = true;
            console.log(`   ✅ OPC UA success for ${ip}: product="${result.productName}" mfg="${result.manufacturer}" sw="${result.softwareVersion}"`);
          } finally {
            try { await session.close(); } catch {}
          }
        } finally {
          try { await client.disconnect(); } catch {}
        }

        return result;
      })();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('OPC UA probe timeout')), timeout)
      );

      return await Promise.race([probePromise, timeoutPromise]);
    } catch (err) {
      console.log(`   ❌ OPC UA probe failed for ${ip}: ${err.message}`);
      return result;
    }
  }

  _sanitizeString(val) {
    if (val === null || val === undefined) return null;
    if (val instanceof Date) return null;
    if (Array.isArray(val)) return null;
    if (typeof val === 'object') return null;
    if (typeof val === 'boolean') return null;

    const str = String(val).trim();
    if (!str) return null;

    if (/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\w{3}\s+\d/.test(str)) return null;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str)) return null;
    if (/^\d+$/.test(str) && str.length < 4) return null;
    if (/^\d+(\.\d+)*$/.test(str) && !/[A-Za-z]/.test(str) && str.length < 5) return null;

    return str;
  }

  // ═══════════════════════════════════════════════════════════
  // MODBUS FC43 DEEP PROBE
  // ═══════════════════════════════════════════════════════════
  probeModbus(ip, timeout = 3000) {
    return new Promise((resolve) => {
      const result = {
        success: false, vendorName: null,
        productCode: null, firmware: null, modelName: null,
      };
      const request = Buffer.from([
        0x00, 0x01, 0x00, 0x00, 0x00, 0x05,
        0x01, 0x2B, 0x0E, 0x01, 0x00,
      ]);
      let socket = null, timer = null, rxBuf = Buffer.alloc(0);

      const done = (success) => {
        clearTimeout(timer);
        if (socket) { try { socket.destroy(); } catch {} socket = null; }
        result.success = success;
        resolve(result);
      };

      timer = setTimeout(() => done(false), timeout);

      try {
        socket = new net.Socket();
        socket.setTimeout(timeout);
        socket.on('error',   () => done(false));
        socket.on('timeout', () => done(false));

        socket.on('data', (chunk) => {
          rxBuf = Buffer.concat([rxBuf, chunk]);
          if (rxBuf.length < 6) return;
          const pduLen = rxBuf.readUInt16BE(4);
          if (rxBuf.length < 6 + pduLen) return;
          const pdu = rxBuf.slice(6, 6 + pduLen);
          if (pdu.length < 2 || pdu[1] !== 0x2B) { done(false); return; }
          if (pdu.length < 8) { done(false); return; }
          const objectCount = pdu[7];
          let pos = 8;
          for (let i = 0; i < objectCount && pos + 2 < pdu.length; i++) {
            const objId = pdu[pos]; const objLen = pdu[pos + 1]; pos += 2;
            if (pos + objLen > pdu.length) break;
            const objVal = pdu.slice(pos, pos + objLen).toString('ascii').trim();
            pos += objLen;
            switch (objId) {
              case 0x00: result.vendorName  = objVal; break;
              case 0x01: result.productCode = objVal; break;
              case 0x02: result.firmware    = objVal; break;
              case 0x04: result.modelName   = objVal; break;
              case 0x05: if (!result.modelName) result.modelName = objVal; break;
            }
          }
          done(true);
        });

        socket.connect(502, ip, () => socket.write(request));
      } catch { done(false); }
    });
  }

  // ═══════════════════════════════════════════════════════════
  // SINGLE IP DEEP PROBE
  // ═══════════════════════════════════════════════════════════
  async probeDevice(ip, ports = null) {
    const ownIPs = this.getOwnIPs();
    if (ownIPs.has(ip)) {
      console.log(`   🔒 Skipping own IP: ${ip}`);
      return null;
    }

    let openPorts = ports;
    if (!openPorts) {
      const portChecks = await Promise.all(
        PLC_PORTS.map(({ port }) => this.probePort(ip, port, 2000))
      );
      openPorts = portChecks.filter(r => r.open).map(r => r.port);
    }

    const [mac, hostname] = await Promise.all([
      this.getMacAddress(ip),
      this.getHostname(ip),
    ]);

    const vendor    = this.lookupVendor(mac);
    const protocols = this.identifyProtocols(openPorts);

    const [s7Result, opcuaResult, modbusResult] = await Promise.all([
      openPorts.includes(102)  ? this.probeS7(ip, 5000)     : Promise.resolve(null),
      openPorts.includes(4840) ? this.probeOPCUA(ip, 10000) : Promise.resolve(null),
      openPorts.includes(502)  ? this.probeModbus(ip, 3000) : Promise.resolve(null),
    ]);

    const deepInfo = this._mergeDeepInfo(s7Result, opcuaResult, modbusResult, vendor);

    if (!deepInfo.plcName && hostname) {
      deepInfo.plcName = hostname.replace(/\.local$|\.lan$|\.localdomain$/i, '');
    }

    const verified   = !!(s7Result?.success || opcuaResult?.success || modbusResult?.success);
    const confidence = this.calculateConfidence(openPorts, vendor, verified);
    const recommended = this.getRecommendedSettings(ip, openPorts, vendor, protocols, deepInfo);

    const niceName =
      (deepInfo.plcName && deepInfo.plcName.replace(/[^\w\-]/g, '_').slice(0, 24)) ||
      recommended.name;

    return {
      ip,
      hostname:   hostname || null,
      mac:        mac || 'Unknown',
      vendor:     vendor || 'OTHER',
      vendorName: VENDOR_NAMES[vendor] || VENDOR_NAMES.OTHER,
      ports:      openPorts,
      protocols,
      confidence,
      verified,
      deepInfo,
      recommended: {
        ...recommended,
        name:  niceName,
        model: deepInfo.model || recommended.model || '',
      },
      probeResults: { s7: s7Result, opcua: opcuaResult, modbus: modbusResult },
    };
  }

  _mergeDeepInfo(s7, opcua, modbus, vendor) {
    const info = {
      model: null, firmware: null, serial: null,
      orderNumber: null, plcName: null, manufacturer: null,
      probeMethod: null, opcuaAppName: null,
      opcuaServerState: null, softwareVersion: null,
    };

    if (opcua && opcua.success) {
      info.manufacturer     = opcua.manufacturer || VENDOR_NAMES[vendor] || null;
      info.opcuaAppName     = opcua.productName || opcua.appName || null;
      info.opcuaServerState = opcua.serverState || null;
      info.softwareVersion  = opcua.softwareVersion || null;
      info.probeMethod      = 'OPC UA';

      if (opcua.productName && opcua.productName.length > 2) {
        info.model = opcua.productName;
      }

      if (opcua.softwareVersion) {
        const sv = opcua.softwareVersion;
        if (/^V?\d+[\.\d]*/.test(sv)) {
          info.firmware = sv.startsWith('V') ? sv : `V${sv}`;
        }
      }
    }

    if (s7 && s7.success) {
      if (s7.orderNumber) info.orderNumber = s7.orderNumber;
      if (s7.plcName)     info.plcName     = s7.plcName;
      if (s7.model && (!info.model || info.model.length < s7.model.length)) info.model = s7.model;
      if (s7.firmware && !info.firmware) info.firmware = s7.firmware;
      if (!info.manufacturer) info.manufacturer = VENDOR_NAMES[vendor] || 'Siemens';
      if (!info.probeMethod) info.probeMethod = 'S7 Protocol';
      else if (!info.probeMethod.includes('S7')) info.probeMethod += ' + S7';
    }

    if (modbus && modbus.success) {
      if (!info.model       && modbus.modelName)   info.model       = modbus.modelName;
      if (!info.firmware    && modbus.firmware)     info.firmware    = modbus.firmware;
      if (!info.manufacturer && modbus.vendorName)  info.manufacturer = modbus.vendorName;
      if (!info.probeMethod) info.probeMethod = 'Modbus FC43';
      else info.probeMethod += ' + Modbus';
    }

    return info;
  }

  // ═══════════════════════════════════════════════════════════
  // MAIN DISCOVERY
  // ═══════════════════════════════════════════════════════════
  async discover(options = {}) {
    if (this.isScanning) {
      return { success: false, message: 'Scan already in progress' };
    }
    this.isScanning = true;

    try {
      const {
        startIP      = null,
        endIP        = null,
        networkIndex = 0,
        timeout      = 1500,
        concurrency  = 30,
        deepProbe    = true,
      } = options;

      let ips;
      if (startIP && endIP) {
        ips = this.generateIPRange(startIP, endIP);
      } else {
        const networks = this.getNetworkInfo();
        if (networks.length === 0) {
          this.isScanning = false;
          return { success: false, message: 'No network interfaces found' };
        }
        const selectedNetwork = networks[networkIndex] || networks[0];
        console.log(`🌐 Using network interface: ${selectedNetwork.interface} (${selectedNetwork.cidr})`);
        ips = this.generateIPRange(selectedNetwork.startIP, selectedNetwork.endIP);
      }

      console.log(`🔍 Discovery Phase 1: Checking ${ips.length} IPs (Ping & PLC Port probing)...`);
      this.scanProgress = { total: ips.length, scanned: 0, found: 0, phase: 'pinging' };

      const aliveTasks = ips.map(ip => () => this.isHostAlive(ip, timeout));
      const aliveResults = await this.runParallel(aliveTasks, concurrency);

      const ownIPs = this.getOwnIPs();
      console.log(`   🔒 Own IPs excluded: ${[...ownIPs].join(', ')}`);

      // Filter out invalid/null results and exclude own IPs
      const aliveHostsInfo = aliveResults.filter(r => r && r.alive && !ownIPs.has(r.ip));
      console.log(`   📡 ${aliveHostsInfo.length} hosts found responsive to ping or PLC ports`);

      if (aliveHostsInfo.length === 0) {
        this.isScanning = false;
        this.scanProgress = { total: ips.length, scanned: ips.length, found: 0, phase: 'done' };
        return {
          success: true, scannedIPs: ips.length, aliveHosts: 0,
          devices: [], networks: this.getNetworkInfo(), deepProbeUsed: deepProbe,
        };
      }

      const deviceMap = new Map();
      aliveHostsInfo.forEach(info => {
        deviceMap.set(info.ip, info.openPorts || []);
      });

      // For hosts responsive only to Ping with no quick open ports found, execute a complete port sweep
      const pingOnlyHosts = aliveHostsInfo.filter(r => !r.openPorts || r.openPorts.length === 0).map(r => r.ip);
      if (pingOnlyHosts.length > 0) {
        console.log(`   🔌 Scanning ports on ${pingOnlyHosts.length} hosts that only responded to ping...`);
        this.scanProgress.phase   = 'probing';
        this.scanProgress.scanned = 0;
        this.scanProgress.total   = pingOnlyHosts.length * PLC_PORTS.length;

        const portTasks = [];
        pingOnlyHosts.forEach(ip => {
          PLC_PORTS.forEach(({ port }) => {
            portTasks.push(() => this.probePort(ip, port, timeout));
          });
        });
        const portResults = await this.runParallel(portTasks, concurrency);
        
        portResults.filter(r => r && r.open).forEach(({ ip, port }) => {
          if (!deviceMap.has(ip)) deviceMap.set(ip, []);
          const ports = deviceMap.get(ip);
          if (!ports.includes(port)) ports.push(port);
        });
      }

      // Filter out hosts that literally had no open industrial ports at the end of sweep
      for (const [ip, ports] of deviceMap.entries()) {
        if (ports.length === 0) {
          deviceMap.delete(ip);
        }
      }

      console.log(`   🎯 ${deviceMap.size} valid industrial devices found`);

      const devices = [];

      if (deepProbe && deviceMap.size > 0) {
        console.log(`🔬 Discovery Phase 2: deep probing ${deviceMap.size} device(s)...`);
        this.scanProgress.phase   = 'deep_probing';
        this.scanProgress.scanned = 0;
        this.scanProgress.total   = deviceMap.size;

        for (const [ip, ports] of deviceMap) {
          console.log(`   🔬 Deep probing ${ip} (ports: ${ports.join(', ')})`);
          try {
            // Check if standard industrial ports are present. If so, bypass PC check
            const hasIndustrialPorts = ports && ports.some(p => [102, 502, 4840, 44818].includes(p));
            let bypassPCFlag = hasIndustrialPorts;

            if (!bypassPCFlag) {
              const pcCheck = await this.isLikelyPC(ip, 800);
              if (pcCheck.isPC) {
                console.log(`   🖥️  Skipping ${ip} — identified as PC (${pcCheck.openPcPorts.join(', ')})`);
                this.scanProgress.scanned += 1;
                continue;
              }
            }

            const deviceInfo = await this.probeDevice(ip, ports);
            if (deviceInfo && !ownIPs.has(ip)) {
              devices.push(deviceInfo);
              if (deviceInfo.verified) {
                console.log(`   ✅ ${ip} VERIFIED — ${deviceInfo.deepInfo.probeMethod} — ${deviceInfo.deepInfo.model || 'unknown'}`);
              } else {
                console.log(`   ℹ️  ${ip} port scan only (no protocol response)`);
              }
            }
          } catch (e) {
            console.warn(`   ⚠️  Deep probe failed for ${ip}:`, e.message);
          }
          this.scanProgress.scanned += 1;
          this.scanProgress.found = devices.filter(d => d.verified).length;
        }
      } else {
        for (const [ip, ports] of deviceMap) {
          if (ownIPs.has(ip)) continue;

          // Quick PC Bypass
          const hasIndustrialPorts = ports && ports.some(p => [102, 502, 4840, 44818].includes(p));
          if (!hasIndustrialPorts) {
            const pcCheck = await this.isLikelyPC(ip, 500);
            if (pcCheck.isPC) {
              console.log(`   🖥️  Skipping ${ip} — identified as PC`);
              continue;
            }
          }

          const mac  = await this.getMacAddress(ip);
          const vendor = this.lookupVendor(mac);
          const prots  = this.identifyProtocols(ports);
          const conf   = this.calculateConfidence(ports, vendor, false);
          const rec    = this.getRecommendedSettings(ip, ports, vendor, prots);
          devices.push({
            ip, mac: mac || 'Unknown',
            vendor:     vendor || 'OTHER',
            vendorName: VENDOR_NAMES[vendor] || VENDOR_NAMES.OTHER,
            ports, protocols: prots, confidence: conf,
            verified: false,
            deepInfo: {
              model: null, firmware: null, serial: null,
              orderNumber: null, plcName: null, manufacturer: null,
              probeMethod: null, softwareVersion: null,
            },
            recommended: rec,
            probeResults: { s7: null, opcua: null, modbus: null },
          });
        }
      }

      devices.sort((a, b) => {
        if (a.verified !== b.verified) return a.verified ? -1 : 1;
        const order = { high: 0, medium: 1, low: 2 };
        const diff  = (order[a.confidence] || 2) - (order[b.confidence] || 2);
        return diff !== 0 ? diff : a.ip.localeCompare(b.ip, undefined, { numeric: true });
      });

      this.scanProgress = { total: ips.length, scanned: ips.length, found: devices.length, phase: 'done' };
      console.log(`✅ Discovery complete: ${devices.length} device(s), ${devices.filter(d => d.verified).length} verified`);

      this.isScanning = false;
      return {
        success:       true,
        scannedIPs:    ips.length,
        aliveHosts:    aliveHostsInfo.length,
        devices,
        networks:      this.getNetworkInfo(),
        deepProbeUsed: deepProbe,
      };

    } catch (error) {
      this.isScanning = false;
      console.error('❌ Discovery error:', error.message);
      console.error(error.stack);
      return { success: false, message: error.message };
    }
  }

  identifyProtocols(ports) {
    return PLC_PORTS
      .filter(p => ports.includes(p.port))
      .map(p => ({ protocol: p.protocol, port: p.port, label: p.label }));
  }

  calculateConfidence(ports, vendor, verified = false) {
    if (verified) return 'high';
    let score = 0;
    if (vendor && vendor !== 'OTHER') score += 3;
    if (ports.includes(102))          score += 3;
    if (ports.includes(4840))         score += 3;
    if (ports.includes(502))          score += 1;
    if (ports.includes(44818))        score += 2;
    if (ports.length >= 2)            score += 1;
    return score >= 5 ? 'high' : score >= 2 ? 'medium' : 'low';
  }

  getRecommendedSettings(ip, ports, vendor, protocols, deepInfo = {}) {
    let bestProtocol = 'MODBUS_TCP';
    let bestPort     = 502;
    let rack         = 0;
    let slot         = 0;

    if (ports.includes(4840)) {
      bestProtocol = 'OPC_UA';
      bestPort     = 4840;
      slot         = 0;
    } else if (ports.includes(102)) {
      bestProtocol = 'S7';
      bestPort     = 102;

      const model = (deepInfo?.model || '').toLowerCase();
      const orderNum = (deepInfo?.orderNumber || '').toLowerCase();

      const isS7_300 = model.includes('300') ||
                        orderNum.startsWith('6es731') ||
                        orderNum.startsWith('6es7 31');
      const isS7_400 = model.includes('400') ||
                        orderNum.startsWith('6es741') ||
                        orderNum.startsWith('6es7 41');

      if (isS7_300 || isS7_400) {
        slot = 2;
        console.log(`   📌 Detected S7-300/400 — using slot 2`);
      } else {
        slot = 0;
        if (model || orderNum) {
          console.log(`   📌 Detected ${model || orderNum} — using slot 0`);
        } else {
          console.log(`   📌 Model unknown — defaulting to slot 0 (S7-1500/1200 standard)`);
        }
      }
    } else if (ports.includes(44818)) {
      bestProtocol = 'ETHERNET_IP';
      bestPort     = 44818;
    } else if (ports.includes(502)) {
      bestProtocol = 'MODBUS_TCP';
      bestPort     = 502;
    }

    const brandKey    = vendor || 'OTHER';
    const vendorShort = vendor === 'SIEMENS' ? 'Siemens'
                      : vendor === 'ALLEN_BRADLEY' ? 'AB'
                      : vendor === 'SCHNEIDER' ? 'Schneider'
                      : 'PLC';

    const modelShort = deepInfo?.model
      ? deepInfo.model.replace(/\s+/g, '_').slice(0, 20)
      : null;
    const name = modelShort || `${vendorShort}_${ip.split('.').pop()}`;

    return {
      name,
      description:             `Discovered on network (${ip})`,
      protocol:                bestProtocol,
      ipAddress:               ip,
      port:                    bestPort,
      rack, slot,
      brand:                   brandKey,
      model:                   deepInfo?.model || '',
      pollingRate:             1000,
      allProtocols:            protocols,
      recommendedProtocol:     bestProtocol,
      reasonForRecommendation: this.getRecommendationReason(bestProtocol, vendor),
    };
  }

  getRecommendationReason(protocol, vendor) {
    if (protocol === 'OPC_UA')
      return 'OPC UA provides the richest data — preferred for S7-1500';
    if (protocol === 'S7' && vendor === 'SIEMENS')
      return 'Native Siemens S7 protocol — fast and reliable';
    if (protocol === 'MODBUS_TCP')
      return 'Universal protocol — compatible with most PLCs';
    if (protocol === 'ETHERNET_IP')
      return 'Native Rockwell/Allen-Bradley protocol';
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