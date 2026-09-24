// ═══════════════════════════════════════════════════════════
// Edge Gateway Controller — Clean Terminal UI + Allen-Bradley
// ═══════════════════════════════════════════════════════════

const path = require('path');
const fs = require('fs');
const archiverPkg = require('archiver');
const EdgeGateway = require('../models/EdgeGateway');
const PLCConnection = require('../models/PLCConnection');
const Tag = require('../models/Tag');
const edgeService = require('../services/edgeService');

const createArchive = (format = 'zip', options = {}) => {
  if (typeof archiverPkg === 'function') return archiverPkg(format, options);
  if (archiverPkg && typeof archiverPkg.default === 'function') return archiverPkg.default(format, options);
  if (archiverPkg && typeof archiverPkg.create === 'function') return archiverPkg.create(format, options);
  if (format === 'zip' && archiverPkg && typeof archiverPkg.ZipArchive === 'function') return new archiverPkg.ZipArchive(options);
  if (archiverPkg && typeof archiverPkg.Archiver === 'function') return new archiverPkg.Archiver(format, options);
  throw new Error('Unable to initialize archiver');
};

const compileGatewayConfig = async (companyId, gateway, rawKey = null) => {
  const plcs = await PLCConnection.find({ companyId, isSimulation: { $ne: true }, isActive: true });
  const plcConfigArray = [];

  for (const plc of plcs) {
    const tags = await Tag.find({ companyId, plcConnection: plc._id, isActive: true });
    if (tags.length === 0) continue;

    let normalizedProtocol = (plc.protocol || '').toLowerCase();
    if (normalizedProtocol.includes('modbus')) normalizedProtocol = 'modbus';
    if (normalizedProtocol.includes('opc')) normalizedProtocol = 'opcua';
    if (normalizedProtocol.includes('ethernet')) normalizedProtocol = 'ethernet_ip';

    plcConfigArray.push({
      plcId: plc._id.toString(),
      plcName: plc.name,
      protocol: normalizedProtocol,
      ip: plc.ipAddress,
      port: plc.port,
      rack: plc.rack || 0,
      slot: plc.slot || 0,
      opcuaUsername: plc.opcuaUsername || '',
      opcuaPassword: plc.opcuaPassword || '',
      pollIntervalMs: plc.pollingRate || 1000,
      tags: tags.map((t) => ({
        tagId: t._id.toString(),
        tagName: t.tagName,
        address: t.plcAddress,
        dataType: t.dataType,
      })),
    });
  }

  return {
    cloudUrl: process.env.CLOUD_PUBLIC_URL || 'https://onlinescada-api.onrender.com',
    namespace: '/edge',
    companyId: String(companyId),
    gatewayId: String(gateway._id),
    gatewayName: gateway.name,
    apiKey: rawKey || '<PASTE_YOUR_API_KEY_HERE>',
    plcs: plcConfigArray,
  };
};

const forceDisconnectGatewaySocket = (req, gatewayId) => {
  try {
    const io = req.app.get('io');
    const gatewayInfo = edgeService.gateways.get(String(gatewayId));
    if (gatewayInfo && gatewayInfo.socketId && io) io.of('/edge').sockets.get(gatewayInfo.socketId)?.disconnect(true);
  } catch (err) { }
};

const getGateways = async (req, res) => {
  try {
    let gateways = await EdgeGateway.find({ companyId: req.companyId }).sort({ createdAt: -1 });
    if (gateways.length === 0) {
      const { rawKey, hash, prefix } = EdgeGateway.generateApiKey();
      const autoGateway = await EdgeGateway.create({
        companyId: req.companyId, name: 'Factory Connector', apiKeyHash: hash, apiKeyPrefix: prefix, status: 'never_connected',
      });
      gateways = [autoGateway];
    }
    const activeGateways = gateways.map((gw) => {
      const isLiveOnline = edgeService.hasActiveGateway(req.companyId) && edgeService.gateways.has(gw._id.toString());
      return { ...gw.toObject(), status: isLiveOnline ? 'online' : (gw.status === 'never_connected' ? 'never_connected' : 'offline') };
    });
    res.json({ success: true, count: gateways.length, data: activeGateways });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const getGateway = async (req, res) => {
  try {
    const gateway = await EdgeGateway.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!gateway) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: { ...gateway.toObject(), status: edgeService.gateways.has(gateway._id.toString()) ? 'online' : 'offline' } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const createGateway = async (req, res) => {
  try {
    const { rawKey, hash, prefix } = EdgeGateway.generateApiKey();
    const gateway = await EdgeGateway.create({ companyId: req.companyId, name: req.body.name || 'Connector', apiKeyHash: hash, apiKeyPrefix: prefix, status: 'never_connected' });
    res.status(201).json({ success: true, data: gateway });
  } catch (e) { res.status(500).json({ success: false }); }
};

const updateGateway = async (req, res) => {
  try {
    const gateway = await EdgeGateway.findOneAndUpdate({ _id: req.params.id, companyId: req.companyId }, { name: req.body.name }, { new: true });
    res.json({ success: true, data: gateway });
  } catch (e) { res.status(500).json({ success: false }); }
};

const regenerateApiKey = async (req, res) => {
  try {
    const gateway = await EdgeGateway.findOne({ _id: req.params.id, companyId: req.companyId });
    forceDisconnectGatewaySocket(req, gateway._id);
    const { rawKey, hash, prefix } = EdgeGateway.generateApiKey();
    gateway.apiKeyHash = hash; gateway.apiKeyPrefix = prefix; gateway.status = 'never_connected'; await gateway.save();
    res.json({ success: true, data: gateway });
  } catch (e) { res.status(500).json({ success: false }); }
};

const downloadGatewayConfig = async (req, res) => {
  try {
    const gateway = await EdgeGateway.findOne({ _id: req.params.id, companyId: req.companyId });
    const configProfile = await compileGatewayConfig(req.companyId, gateway, req.query.apiKey);
    res.setHeader('Content-Type', 'application/json'); res.send(JSON.stringify(configProfile, null, 2));
  } catch (e) { res.status(500).send(); }
};

// ─── DOWNLOAD READY PACKAGE ───
const downloadCompletePackage = async (req, res) => {
  try {
    const gateway = await EdgeGateway.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!gateway) return res.status(404).json({ success: false, message: 'Not found' });

    const { rawKey, hash, prefix } = EdgeGateway.generateApiKey();
    forceDisconnectGatewaySocket(req, gateway._id);
    gateway.apiKeyHash = hash; gateway.apiKeyPrefix = prefix; gateway.status = 'never_connected';
    await gateway.save();

    const configProfile = await compileGatewayConfig(req.companyId, gateway, rawKey);
    const companyName = String(req.company?.slug || 'company').replace(/[^a-z0-9\-]/gi, '');
    const filename = `OnlineSCADA-Connector-${companyName}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const archive = createArchive('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => { if (!res.headersSent) res.status(500).json({ success: false, message: err.message }); });
    archive.pipe(res);

    // 🟢 ALWAYS USE IN-MEMORY FILES FOR PERFECT CLEAN UI
    archive.append(getFallbackPackageJson(), { name: 'package.json' });
    archive.append(getFallbackStartBat(), { name: 'Start.bat' });
    archive.append(getFallbackRunBgVbs(), { name: 'Run-In-Background.vbs' });
    archive.append(getFallbackIndexJs(), { name: 'src/index.js' });
    archive.append(getFallbackCloudBridgeJs(), { name: 'src/cloudBridge.js' });
    archive.append(getFallbackPlcReaderJs(), { name: 'src/plcReader.js' });
    archive.append(getFallbackHealthMonitorJs(), { name: 'src/healthMonitor.js' });
    archive.append(getFallbackS7ReaderJs(), { name: 'src/readers/s7Reader.js' });
    archive.append(getFallbackModbusReaderJs(), { name: 'src/readers/modbusReader.js' });
    archive.append(getFallbackOpcuaReaderJs(), { name: 'src/readers/opcuaReader.js' });
    archive.append(getFallbackEthernetIpReaderJs(), { name: 'src/readers/ethernetIpReader.js' });

    archive.append(JSON.stringify(configProfile, null, 2), { name: 'config.json' });
    await archive.finalize();
  } catch (error) {
    if (!res.headersSent) res.status(500).json({ success: false, message: error.message });
  }
};

const deleteGateway = async (req, res) => {
  try {
    const gateway = await EdgeGateway.findOne({ _id: req.params.id, companyId: req.companyId });
    forceDisconnectGatewaySocket(req, gateway._id);
    await EdgeGateway.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
    res.json({ success: true, message: `Deleted.` });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// ═══════════════════════════════════════════════════════════
// CLEAN TERMINAL UI FILES
// ═══════════════════════════════════════════════════════════

function getFallbackPackageJson() {
  return JSON.stringify({
    "name": "onlinescada-connector",
    "version": "2.0.0",
    "main": "src/index.js",
    "scripts": { "start": "node src/index.js" },
    "dependencies": {
      "socket.io-client": "4.7.5", "nodes7": "0.3.14", "modbus-serial": "8.0.17", "node-opcua": "2.130.0", "ethernet-ip": "^2.0.0"
    }
  }, null, 2);
}

function getFallbackStartBat() {
  return `@echo off
title OnlineSCADA Factory Connector
cd /d "%~dp0"
color 0B

echo ========================================================
echo        OnlineSCADA Factory Connector
echo ========================================================
echo.

if not exist "config.json" (
    color 0C
    echo [ERROR] Configuration missing! Please download the Connector again.
    pause
    exit /b 1
)

where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    color 0C
    echo [ERROR] Node.js is required but not installed.
    echo Please download it from https://nodejs.org
    pause
    exit /b 1
)

if not exist "node_modules\\socket.io-client" (
    echo [SYSTEM] Running first-time setup. Please wait...
    call npm install socket.io-client nodes7 modbus-serial node-opcua ethernet-ip --no-audit --no-fund --silent
    cls
    color 0B
    echo ========================================================
    echo        OnlineSCADA Factory Connector
    echo ========================================================
    echo.
)

echo [SYSTEM] Starting Secure Tunnel...
node src\\index.js

if %ERRORLEVEL% neq 0 (
    color 0C
    echo.
    echo [ERROR] The Connector stopped unexpectedly.
    pause
)
`;
}

function getFallbackRunBgVbs() {
  return `Set WshShell = CreateObject("WScript.Shell")\nWshShell.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)\nWshShell.Run "cmd /c Start.bat", 0, False`;
}

function getFallbackIndexJs() {
  return `const fs = require('fs');
const path = require('path');
const CloudBridge = require('./cloudBridge');
const PLCReader = require('./plcReader');
const HealthMonitor = require('./healthMonitor');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

console.log(' [o] Initializing background services...');

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(' [x] Error: Configuration file missing.');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

async function main() {
  const config = loadConfig();
  
  // HIDE LOGS BY DEFAULT FOR CLEAN TERMINAL
  const cloudBridge = new CloudBridge(config, false); 
  const plcReader = new PLCReader(config, cloudBridge, false); 
  const healthMonitor = new HealthMonitor(config, cloudBridge, false);

  cloudBridge.onWriteCommand((cmd) => plcReader.handleWriteCommand(cmd));
  cloudBridge.onConfigUpdate((newConfig) => {
    if (Array.isArray(newConfig?.plcs)) plcReader.reload(newConfig.plcs);
  });

  await cloudBridge.connect();
  await plcReader.startAll();
  healthMonitor.start();
  
  console.log('\\n ========================================================');
  console.log('  [+] SYSTEM ONLINE AND SECURELY STREAMING DATA');
  console.log(' ========================================================\\n');
  console.log('  You can safely minimize this window.');
  console.log('  Close this window to stop streaming.\\n');
}

main().catch(() => console.error(' [x] Fatal System Error.'));
`;
}

function getFallbackCloudBridgeJs() {
  return `const { io } = require('socket.io-client');
const os = require('os');

class CloudBridge {
  constructor(config, verbose = false) {
    this.config = config;
    this.verbose = verbose;
    this.socket = null;
    this.isConnected = false;
  }
  connect() {
    return new Promise((resolve) => {
      let baseUrl = (this.config.cloudUrl || 'https://onlinescada-api.onrender.com').replace(/^wss:/, 'https:').replace(/^ws:/, 'http:').replace(/\\/$/, '');
      this.socket = io(\`\${baseUrl}/edge\`, { auth: { apiKey: this.config.apiKey, companyId: this.config.companyId }, transports: ['websocket', 'polling'], reconnection: true });

      this.socket.on('connect', () => {
        this.isConnected = true;
        console.log(' [o] Secure cloud tunnel established.');
        resolve();
      });
      this.socket.on('connect_error', () => { if (!this.isConnected) resolve(); });
      this.socket.on('edge:writeCommand', (data) => { 
        console.log(\` [>] Executing Write Command: \${data.tagName} = \${data.value}\`);
        if (this.writeCallback) this.writeCallback(data); 
      });
      this.socket.on('edge:configUpdate', (data) => { 
        console.log(' [i] Received configuration update. Reloading...');
        if (this.configCallback && Array.isArray(data?.plcs)) this.configCallback(data); 
      });

      setTimeout(() => resolve(), 5000);
    });
  }
  sendTagValues(tags) {
    if (!this.isConnected || !this.socket || !tags?.length) return;
    this.socket.emit('edge:tagValues', { tags });
    // NO SPAM LOGGING HERE. Clean terminal.
  }
  sendHeartbeat(stats) {
    if (this.isConnected && this.socket) this.socket.emit('edge:heartbeat', { ...stats, hostname: os.hostname(), os: os.type() });
  }
  sendWriteResult(result) {
    if (this.isConnected && this.socket) {
      if (result.success) console.log(\` [<] Write Confirmed: \${result.tagName}\`);
      else console.log(\` [x] Write Failed: \${result.tagName}\`);
      this.socket.emit('edge:writeResult', result);
    }
  }
  onWriteCommand(cb) { this.writeCallback = cb; }
  onConfigUpdate(cb) { this.configCallback = cb; }
  disconnect() { if (this.socket) this.socket.disconnect(); }
}
module.exports = CloudBridge;
`;
}

function getFallbackPlcReaderJs() {
  return `const S7Reader = require('./readers/s7Reader');
const ModbusReader = require('./readers/modbusReader');
const OPCUAReader = require('./readers/opcuaReader');
const EthernetIPReader = require('./readers/ethernetIpReader');

class PLCReader {
  constructor(config, cloudBridge, verbose = false) {
    this.config = config;
    this.cloudBridge = cloudBridge;
    this.verbose = verbose;
    this.readers = new Map();
    this.intervals = new Map();
    this.previousValues = new Map();
    this.stats = { totalReads: 0, totalErrors: 0, tagsReadPerSecond: 0, _readsThisSecond: 0 };
  }
  async startAll() {
    const plcs = this.config.plcs || [];
    for (const plcConfig of plcs) await this._startPLC(plcConfig);
  }
  async _startPLC(plcConfig) {
    const plcId = plcConfig.plcId;
    const protocol = (plcConfig.protocol || '').toLowerCase();
    let reader;
    try {
      if (protocol === 's7') reader = new S7Reader(plcConfig);
      else if (protocol.includes('modbus')) reader = new ModbusReader(plcConfig);
      else if (protocol.includes('opc')) reader = new OPCUAReader(plcConfig);
      else if (protocol.includes('ethernet')) reader = new EthernetIPReader(plcConfig);
      else return;

      await reader.connect();
      this.readers.set(plcId, reader);
      console.log(\` [o] Connected to equipment: \${plcConfig.plcName}\`);
      const intervalId = setInterval(() => this._pollPLC(plcId, plcConfig), plcConfig.pollIntervalMs || 1000);
      this.intervals.set(plcId, intervalId);
    } catch (err) {
      console.log(\` [!] Connection pending for: \${plcConfig.plcName}\`);
    }
  }
  async _pollPLC(plcId, plcConfig) {
    const reader = this.readers.get(plcId);
    if (!reader) return;
    try {
      const tags = plcConfig.tags || [];
      const values = await reader.readTags(tags);
      if (!values?.length) return;

      const changed = [];
      const now = Date.now();
      for (const val of values) {
        const prev = this.previousValues.get(val.tagId);
        if (!prev || prev.value !== val.value || (now - prev.timestamp > 10000)) {
          changed.push({ tagId: val.tagId, tagName: val.tagName, value: val.value, quality: val.quality || 'GOOD', timestamp: now });
          this.previousValues.set(val.tagId, { value: val.value, timestamp: now });
        }
      }
      if (changed.length) this.cloudBridge.sendTagValues(changed);
    } catch (err) {}
  }
  async handleWriteCommand(cmd) {
    for (const [, reader] of this.readers) {
      try {
        await reader.writeTag(cmd.address, cmd.value, cmd.dataType);
        this.cloudBridge.sendWriteResult({ tagId: cmd.tagId, tagName: cmd.tagName, value: cmd.value, success: true, requestSocketId: cmd.requestSocketId });
        return;
      } catch (err) {}
    }
  }
  async reload(newPlcConfigs) {
    this.stopAll();
    this.config.plcs = newPlcConfigs;
    await this.startAll();
  }
  stopAll() {
    for (const [, id] of this.intervals) clearInterval(id);
    this.intervals.clear();
    for (const [, r] of this.readers) try { r.disconnect(); } catch (e) {}
    this.readers.clear();
  }
}
module.exports = PLCReader;
`;
}

function getFallbackHealthMonitorJs() { return `class HealthMonitor { constructor(config, cloudBridge) { this.cloudBridge = cloudBridge; this.interval = null; } start() { this.interval = setInterval(() => { this.cloudBridge.sendHeartbeat({ uptimeSeconds: Math.floor(process.uptime()), tagsReadPerSecond: 1 }); }, 30000); } stop() { if (this.interval) clearInterval(this.interval); } } module.exports = HealthMonitor;`; }

// Driver files remain the same under the hood
function getFallbackS7ReaderJs() { return `const nodes7 = require('nodes7'); class S7Reader { constructor(c) { this.c = c; this.conn = null; this.ok = false; } connect() { return new Promise(r => { this.conn = new nodes7(); this.conn.initiateConnection({ host: this.c.ip, port: this.c.port || 102, rack: this.c.rack || 0, slot: this.c.slot || 0 }, e => { this.ok = !e; r(this.ok); }); }); } readTags(tags) { return new Promise(r => { if (!this.ok) return r([]); this.conn.readAllItems((e, v) => { if (e) return r([]); r(tags.map(t => ({ tagId: t.tagId, tagName: t.tagName, value: v[t.address], quality: 'GOOD' }))); }); this.conn.addItems(tags.map(t => t.address)); }); } writeTag(a, v) { return new Promise((res, rej) => this.conn.writeItems(a, v, e => e ? rej(e) : res())); } disconnect() { if(this.conn)try{this.conn.dropConnection();}catch(e){} } } module.exports = S7Reader;`; }
function getFallbackModbusReaderJs() { return `const ModbusRTU = require('modbus-serial'); class ModbusReader { constructor(c) { this.c = c; this.client = null; this.ok = false; } async connect() { try { this.client = new ModbusRTU(); this.client.setID(1); await this.client.connectTCP(this.c.ip, { port: this.c.port || 502 }); this.ok = true; return true; } catch(e) { return false; } } async readTags(tags) { if (!this.ok) return []; const res = []; for (const t of tags) { try { const reg = parseInt(t.address.replace(/[^0-9]/g,'')) % 10000 - 1; const data = await this.client.readHoldingRegisters(Math.max(0,reg), 1); res.push({ tagId: t.tagId, tagName: t.tagName, value: data.data[0], quality: 'GOOD' }); } catch(e) {} } return res; } async writeTag(a, v) { const reg = parseInt(a.replace(/[^0-9]/g,'')) % 10000 - 1; await this.client.writeRegister(Math.max(0,reg), parseInt(v)); } disconnect() { if(this.client)try{this.client.close(()=>{});}catch(e){} } } module.exports = ModbusReader;`; }
function getFallbackOpcuaReaderJs() { return `const opcua = require('node-opcua'); class OPCUAReader { constructor(c) { this.c = c; this.client = null; this.session = null; this.ok = false; } async connect() { try { const url = \`opc.tcp://\${this.c.ip}:\${this.c.port || 4840}\`; this.client = opcua.OPCUAClient.create({ securityMode: opcua.MessageSecurityMode.None, securityPolicy: opcua.SecurityPolicy.None }); await this.client.connect(url); this.session = await this.client.createSession(); this.ok = true; return true; } catch(e) { return false; } } async readTags(tags) { if (!this.ok || !this.session) return []; try { const nodes = tags.map(t => ({ nodeId: t.address, attributeId: opcua.AttributeIds.Value })); const dvs = await this.session.read(nodes); return tags.map((t, i) => { let v = dvs[i]?.value?.value; if (typeof v === 'bigint') v = Number(v); return { tagId: t.tagId, tagName: t.tagName, value: v, quality: dvs[i]?.statusCode?.isGood() ? 'GOOD' : 'BAD' }; }); } catch(e) { return []; } } async writeTag(a, v, dtStr) { let dt = opcua.DataType.Double; if (dtStr === 'BOOL') dt = opcua.DataType.Boolean; await this.session.write([{ nodeId: a, attributeId: opcua.AttributeIds.Value, value: { value: { dataType: dt, value: v } } }]); } disconnect() { if(this.client)try{this.client.disconnect(()=>{});}catch(e){} } } module.exports = OPCUAReader;`; }

function getFallbackEthernetIpReaderJs() {
  return `const { Controller, Tag } = require('ethernet-ip');
class EthernetIPReader {
  constructor(plcConfig) { this.config = plcConfig; this.PLC = new Controller(); this.isConnected = false; this.tags = new Map(); }
  async connect() { try { await this.PLC.connect(this.config.ip, this.config.slot || 0); this.isConnected = true; return true; } catch(e) { return false; } }
  async readTags(tagList) { if (!this.isConnected) return []; const results = []; for (const t of tagList) { try { let tagObj = this.tags.get(t.address); if (!tagObj) { tagObj = new Tag(t.address); this.tags.set(t.address, tagObj); } await this.PLC.readTag(tagObj); results.push({ tagId: t.tagId, tagName: t.tagName, value: tagObj.value, quality: 'GOOD' }); } catch(e) { results.push({ tagId: t.tagId, tagName: t.tagName, value: null, quality: 'BAD' }); } } return results; }
  async writeTag(addr, val, dataType) { let tagObj = this.tags.get(addr); if (!tagObj) { tagObj = new Tag(addr); this.tags.set(addr, tagObj); } tagObj.value = val; await this.PLC.writeTag(tagObj); }
  disconnect() { try { this.PLC.disconnect(); } catch(e) {} this.isConnected = false; }
}
module.exports = EthernetIPReader;`;
}

module.exports = { getGateways, getGateway, createGateway, updateGateway, regenerateApiKey, downloadGatewayConfig, downloadCompletePackage, deleteGateway };