// ═══════════════════════════════════════════════════════════
// Edge Gateway Controller — Multi-Tenant CRUD + Self-Generating ZIP
// ═══════════════════════════════════════════════════════════

const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const EdgeGateway = require('../models/EdgeGateway');
const PLCConnection = require('../models/PLCConnection');
const Tag = require('../models/Tag');
const edgeService = require('../services/edgeService');

// ─── Compile config profile ─────────────────────────
const compileGatewayConfig = async (companyId, gateway, rawKey = null) => {
  const plcs = await PLCConnection.find({
    companyId,
    isSimulation: { $ne: true },
    isActive: true,
  });

  const plcConfigArray = [];
  for (const plc of plcs) {
    const tags = await Tag.find({
      companyId,
      plcConnection: plc._id,
      isActive: true,
    });

    if (tags.length === 0) continue;

    let normalizedProtocol = (plc.protocol || '').toLowerCase();
    if (normalizedProtocol === 'modbus_tcp' || normalizedProtocol === 'modbus_rtu') {
      normalizedProtocol = 'modbus';
    }
    if (normalizedProtocol === 'opc_ua' || normalizedProtocol === 'opc-ua') {
      normalizedProtocol = 'opcua';
    }

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

  const cloudUrl = process.env.CLOUD_PUBLIC_URL || 'https://onlinescada-api.onrender.com';

  return {
    cloudUrl,
    namespace: '/edge',
    companyId: String(companyId),
    gatewayId: String(gateway._id),
    gatewayName: gateway.name,
    apiKey: rawKey || '<PASTE_YOUR_API_KEY_HERE>',
    plcs: plcConfigArray,
    generatedAt: new Date().toISOString(),
  };
};

const forceDisconnectGatewaySocket = (req, gatewayId) => {
  try {
    const io = req.app.get('io');
    const gatewayInfo = edgeService.gateways.get(String(gatewayId));
    if (gatewayInfo && gatewayInfo.socketId && io) {
      const socket = io.of('/edge').sockets.get(gatewayInfo.socketId);
      if (socket) socket.disconnect(true);
    }
  } catch (err) { }
};

// ─── GET ALL GATEWAYS ───────────────────────────────
const getGateways = async (req, res) => {
  try {
    const gateways = await EdgeGateway.find({ companyId: req.companyId }).sort({ createdAt: -1 });
    const activeGateways = gateways.map((gw) => {
      const isLiveOnline = edgeService.hasActiveGateway(req.companyId) && edgeService.gateways.has(gw._id.toString());
      return {
        ...gw.toObject(),
        status: isLiveOnline ? 'online' : (gw.status === 'never_connected' ? 'never_connected' : 'offline'),
      };
    });
    res.json({ success: true, count: gateways.length, data: activeGateways });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ─── GET SINGLE GATEWAY ─────────────────────────────
const getGateway = async (req, res) => {
  try {
    const gateway = await EdgeGateway.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!gateway) return res.status(404).json({ success: false, message: 'Gateway not found' });
    const isLiveOnline = edgeService.gateways.has(gateway._id.toString());
    res.json({
      success: true,
      data: {
        ...gateway.toObject(),
        status: isLiveOnline ? 'online' : (gateway.status === 'never_connected' ? 'never_connected' : 'offline'),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ─── CREATE GATEWAY ─────────────────────────────────
const createGateway = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Gateway name is required' });

    const currentCount = await EdgeGateway.countDocuments({ companyId: req.companyId });
    const maxGateways = req.company?.limits?.maxGateways || 1;
    if (currentCount >= maxGateways) {
      return res.status(403).json({
        success: false,
        message: `Plan limit reached: ${currentCount}/${maxGateways} Gateways.`,
        code: 'PLAN_LIMIT_EXCEEDED',
      });
    }

    const exists = await EdgeGateway.findOne({ companyId: req.companyId, name: name.trim() });
    if (exists) return res.status(400).json({ success: false, message: 'Gateway name already exists' });

    const { rawKey, hash, prefix } = EdgeGateway.generateApiKey();
    const gateway = await EdgeGateway.create({
      companyId: req.companyId,
      name: name.trim(),
      apiKeyHash: hash,
      apiKeyPrefix: prefix,
      status: 'never_connected',
    });

    res.status(201).json({
      success: true,
      message: 'Gateway created. Save the API key now.',
      data: {
        _id: gateway._id,
        name: gateway.name,
        apiKey: rawKey,
        apiKeyPrefix: gateway.apiKeyPrefix,
        status: gateway.status,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ─── UPDATE GATEWAY ─────────────────────────────────
const updateGateway = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Gateway name is required' });

    const duplicate = await EdgeGateway.findOne({
      companyId: req.companyId,
      name: name.trim(),
      _id: { $ne: req.params.id },
    });
    if (duplicate) return res.status(400).json({ success: false, message: 'Name already in use' });

    const gateway = await EdgeGateway.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      { name: name.trim() },
      { new: true, runValidators: true }
    );
    if (!gateway) return res.status(404).json({ success: false, message: 'Gateway not found' });

    res.json({ success: true, message: 'Gateway updated', data: gateway });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ─── REGENERATE API KEY ─────────────────────────────
const regenerateApiKey = async (req, res) => {
  try {
    const gateway = await EdgeGateway.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!gateway) return res.status(404).json({ success: false, message: 'Gateway not found' });

    forceDisconnectGatewaySocket(req, gateway._id);
    const { rawKey, hash, prefix } = EdgeGateway.generateApiKey();
    gateway.apiKeyHash = hash;
    gateway.apiKeyPrefix = prefix;
    gateway.status = 'never_connected';
    await gateway.save();

    res.json({
      success: true,
      message: 'API Key rotated',
      data: {
        _id: gateway._id,
        name: gateway.name,
        apiKey: rawKey,
        apiKeyPrefix: gateway.apiKeyPrefix,
        status: gateway.status,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ─── DOWNLOAD JSON CONFIG ONLY ──────────────────────
const downloadGatewayConfig = async (req, res) => {
  try {
    const gateway = await EdgeGateway.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!gateway) return res.status(404).json({ success: false, message: 'Gateway not found' });

    const { apiKey } = req.query;
    const configProfile = await compileGatewayConfig(req.companyId, gateway, apiKey);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="config.json"`);
    res.send(JSON.stringify(configProfile, null, 2));
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// 🆕 DOWNLOAD READY-TO-RUN PACKAGE (100% Fail-Proof Generator)
// ═══════════════════════════════════════════════════════════
const downloadCompletePackage = async (req, res) => {
  try {
    const gateway = await EdgeGateway.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!gateway) return res.status(404).json({ success: false, message: 'Gateway profile not found' });

    // Rotate API key so user always gets fresh key in bundle
    const { rawKey, hash, prefix } = EdgeGateway.generateApiKey();
    forceDisconnectGatewaySocket(req, gateway._id);

    gateway.apiKeyHash = hash;
    gateway.apiKeyPrefix = prefix;
    gateway.status = 'never_connected';
    await gateway.save();

    // Compile config with fresh key
    const configProfile = await compileGatewayConfig(req.companyId, gateway, rawKey);

    const companyName = String(req.company?.slug || 'company').replace(/[^a-z0-9\-]/gi, '');
    const filename = `OnlineSCADA-Gateway-${companyName}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', (err) => {
      console.error('❌ Archiver stream error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'ZIP stream error: ' + err.message });
      }
    });

    archive.pipe(res);

    // Candidate template directories
    const candidateDirs = [
      path.join(__dirname, '..', '..', 'edge-gateway-template'),
      path.join(__dirname, '..', '..', 'edge-gateway'),
      path.join(process.cwd(), 'edge-gateway-template'),
      path.join(process.cwd(), 'edge-gateway'),
      path.join(process.cwd(), '..', 'edge-gateway'),
    ];

    let templateDir = candidateDirs.find((d) => fs.existsSync(d) && fs.statSync(d).isDirectory());

    if (templateDir) {
      console.log(`📦 Bundling from disk template directory: ${templateDir}`);
      archive.directory(templateDir, false);
    } else {
      console.warn('⚠️  Template dir not on disk — using in-memory fallbacks to construct ZIP!');
      // 🛠️ IN-MEMORY FALLBACK INJECTION (GUARANTEES ZIP IS CREATED EVEN IF GIT DIDN'T PUSH TEMPLATE)
      archive.append(getFallbackPackageJson(), { name: 'package.json' });
      archive.append(getFallbackStartBat(), { name: 'Start-Gateway.bat' });
      archive.append(getFallbackRunBgVbs(), { name: 'Run-In-Background.vbs' });
      archive.append(getFallbackEnableAutoStart(), { name: 'Enable-AutoStart.bat' });
      archive.append(getFallbackDisableAutoStart(), { name: 'Disable-AutoStart.bat' });
      archive.append(getFallbackReadme(), { name: 'README.txt' });
      archive.append(getFallbackIndexJs(), { name: 'src/index.js' });
      archive.append(getFallbackCloudBridgeJs(), { name: 'src/cloudBridge.js' });
      archive.append(getFallbackPlcReaderJs(), { name: 'src/plcReader.js' });
      archive.append(getFallbackHealthMonitorJs(), { name: 'src/healthMonitor.js' });
      archive.append(getFallbackS7ReaderJs(), { name: 'src/readers/s7Reader.js' });
      archive.append(getFallbackModbusReaderJs(), { name: 'src/readers/modbusReader.js' });
      archive.append(getFallbackOpcuaReaderJs(), { name: 'src/readers/opcuaReader.js' });
    }

    // Always append the fresh config.json
    archive.append(JSON.stringify(configProfile, null, 2), { name: 'config.json' });

    await archive.finalize();
    console.log(`📦 Package successfully streamed: ${filename}`);
  } catch (error) {
    console.error('❌ downloadCompletePackage error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Server Error: ' + error.message });
    }
  }
};

// ─── DELETE GATEWAY ─────────────────────────────────
const deleteGateway = async (req, res) => {
  try {
    const gateway = await EdgeGateway.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!gateway) return res.status(404).json({ success: false, message: 'Gateway not found' });

    forceDisconnectGatewaySocket(req, gateway._id);
    await EdgeGateway.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });

    res.json({ success: true, message: `Gateway "${gateway.name}" deleted.` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// IN-MEMORY FALLBACK FILE STRINGS (Zero-Failure Guarantee)
// ═══════════════════════════════════════════════════════════
function getFallbackPackageJson() {
  return JSON.stringify({
    "name": "onlinescada-edge-gateway",
    "version": "1.0.0",
    "description": "OnlineSCADA Edge Gateway",
    "main": "src/index.js",
    "scripts": { "start": "node src/index.js" },
    "dependencies": {
      "socket.io-client": "^4.7.5",
      "nodes7": "^0.3.14",
      "modbus-serial": "^8.0.17",
      "node-opcua": "^2.130.0"
    }
  }, null, 2);
}

function getFallbackStartBat() {
  return `@echo off
title OnlineSCADA Edge Gateway
cd /d "%~dp0"
color 0A

echo ========================================================
echo   OnlineSCADA Edge Gateway
echo ========================================================
echo.

if not exist "config.json" (
    color 0C
    echo [x] ERROR: config.json missing!
    pause
    exit /b 1
)

where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    color 0C
    echo [x] ERROR: Node.js is not installed on this PC! Download from https://nodejs.org
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [i] First-time setup: Installing required modules...
    call npm install --omit=dev --no-audit --no-fund
    if %ERRORLEVEL% neq 0 (
        color 0C
        echo [x] Failed to install modules.
        pause
        exit /b 1
    )
    echo [ok] Modules installed successfully!
    echo.
)

echo [ok] Launching OnlineSCADA Gateway Engine...
echo.
node src\\index.js

if %ERRORLEVEL% neq 0 (
    color 0C
    echo.
    echo [x] Gateway engine stopped with error.
    pause
)
`;
}

function getFallbackRunBgVbs() {
  return `Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strPath = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = strPath
WshShell.Run "cmd /c Start-Gateway.bat", 0, False
`;
}

function getFallbackEnableAutoStart() {
  return `@echo off
title Enable Auto-Start
cd /d "%~dp0"
color 0A
set "STARTUP_DIR=%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Startup"
set "SHORTCUT=%STARTUP_DIR%\\OnlineSCADA-EdgeGateway.vbs"
copy /y "Run-In-Background.vbs" "%SHORTCUT%" >nul
echo [ok] Auto-Start Enabled!
pause
`;
}

function getFallbackDisableAutoStart() {
  return `@echo off
set "STARTUP_DIR=%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Startup"
set "SHORTCUT=%STARTUP_DIR%\\OnlineSCADA-EdgeGateway.vbs"
if exist "%SHORTCUT%" del /f /q "%SHORTCUT%"
pause
`;
}

function getFallbackReadme() {
  return `OnlineSCADA Edge Gateway
========================
Double-click Start-Gateway.bat to run!
`;
}

function getFallbackIndexJs() {
  return `const path = require('path');
const fs = require('fs');
const CloudBridge = require('./cloudBridge');
const PLCReader = require('./plcReader');
const HealthMonitor = require('./healthMonitor');

const VERBOSE = process.argv.includes('--verbose');
const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

console.log('\\n╔══════════════════════════════════════════════════════════╗');
console.log('║        🏭 OnlineSCADA Edge Gateway v1.0.0               ║');
console.log('╚══════════════════════════════════════════════════════════╝\\n');

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error('❌ config.json not found!');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

async function main() {
  const config = loadConfig();
  const cloudBridge = new CloudBridge(config, VERBOSE);
  const plcReader = new PLCReader(config, cloudBridge, VERBOSE);
  const healthMonitor = new HealthMonitor(config, cloudBridge, VERBOSE);

  cloudBridge.onWriteCommand((cmd) => plcReader.handleWriteCommand(cmd));
  cloudBridge.onConfigUpdate((newConfig) => {
    if (Array.isArray(newConfig?.plcs)) plcReader.reload(newConfig.plcs);
  });

  await cloudBridge.connect();
  await plcReader.startAll();
  healthMonitor.start();
}

main().catch(err => console.error('Fatal:', err.message));
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
      let baseUrl = (this.config.cloudUrl || 'https://onlinescada-api.onrender.com')
        .replace(/^wss:/, 'https:').replace(/^ws:/, 'http:').replace(/\\/$/, '');
      const namespace = this.config.namespace || '/edge';

      this.socket = io(\`\${baseUrl}\${namespace}\`, {
        auth: { apiKey: this.config.apiKey, companyId: this.config.companyId },
        transports: ['websocket', 'polling'],
        reconnection: true,
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
        console.log(\`☁️ Connected to Cloud: \${this.socket.id}\`);
        resolve();
      });

      this.socket.on('edge:writeCommand', (data) => {
        if (this.writeCallback) this.writeCallback(data);
      });

      this.socket.on('edge:configUpdate', (data) => {
        if (this.configCallback && Array.isArray(data?.plcs)) this.configCallback(data);
      });

      setTimeout(() => { if (!this.isConnected) resolve(); }, 5000);
    });
  }

  sendTagValues(tags) {
    if (!this.isConnected || !this.socket || !tags?.length) return;
    this.socket.emit('edge:tagValues', { tags });
    console.log(\`📤 Streamed \${tags.length} tag(s) to Cloud\`);
  }

  sendHeartbeat(stats) {
    if (!this.isConnected || !this.socket) return;
    this.socket.emit('edge:heartbeat', { ...stats, hostname: os.hostname(), os: os.type() });
  }

  sendWriteResult(result) {
    if (this.isConnected && this.socket) this.socket.emit('edge:writeResult', result);
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
      if (protocol === 's7') reader = new S7Reader(plcConfig, this.verbose);
      else if (protocol.includes('modbus')) reader = new ModbusReader(plcConfig, this.verbose);
      else if (protocol.includes('opc')) reader = new OPCUAReader(plcConfig, this.verbose);
      else return;

      await reader.connect();
      this.readers.set(plcId, reader);
      const intervalId = setInterval(() => this._pollPLC(plcId, plcConfig), plcConfig.pollIntervalMs || 1000);
      this.intervals.set(plcId, intervalId);
      console.log(\`✅ PLC \${plcId} polling active\`);
    } catch (err) {
      console.error(\`❌ Error starting PLC \${plcId}:\`, err.message);
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

  getStats() { return { ...this.stats }; }
}

module.exports = PLCReader;
`;
}

function getFallbackHealthMonitorJs() {
  return `class HealthMonitor {
  constructor(config, cloudBridge) {
    this.config = config;
    this.cloudBridge = cloudBridge;
    this.interval = null;
  }
  start() {
    this.interval = setInterval(() => {
      this.cloudBridge.sendHeartbeat({ uptimeSeconds: Math.floor(process.uptime()), tagsReadPerSecond: 1 });
    }, 30000);
  }
  stop() { if (this.interval) clearInterval(this.interval); }
}
module.exports = HealthMonitor;
`;
}

function getFallbackS7ReaderJs() {
  return `const nodes7 = require('nodes7');
class S7Reader {
  constructor(plcConfig) { this.config = plcConfig; this.conn = null; this.isConnected = false; }
  connect() {
    return new Promise((resolve) => {
      this.conn = new nodes7();
      this.conn.initiateConnection({ host: this.config.ip, port: this.config.port || 102, rack: this.config.rack || 0, slot: this.config.slot || 0 }, (err) => {
        this.isConnected = !err;
        resolve(this.isConnected);
      });
    });
  }
  readTags(tags) {
    return new Promise((resolve) => {
      if (!this.isConnected) return resolve([]);
      this.conn.readAllItems((err, values) => {
        if (err) return resolve([]);
        resolve(tags.map(t => ({ tagId: t.tagId, tagName: t.tagName, value: values[t.address], quality: 'GOOD' })));
      });
      this.conn.addItems(tags.map(t => t.address));
    });
  }
  writeTag(addr, val) {
    return new Promise((res, rej) => this.conn.writeItems(addr, val, (err) => err ? rej(err) : res()));
  }
  disconnect() { if (this.conn) try { this.conn.dropConnection(); } catch(e) {} }
}
module.exports = S7Reader;
`;
}

function getFallbackModbusReaderJs() {
  return `const ModbusRTU = require('modbus-serial');
class ModbusReader {
  constructor(plcConfig) { this.config = plcConfig; this.client = null; this.isConnected = false; }
  async connect() {
    try {
      this.client = new ModbusRTU();
      this.client.setID(1);
      await this.client.connectTCP(this.config.ip, { port: this.config.port || 502 });
      this.isConnected = true;
      return true;
    } catch(e) { return false; }
  }
  async readTags(tags) {
    if (!this.isConnected) return [];
    const res = [];
    for (const t of tags) {
      try {
        const reg = parseInt(t.address) % 10000 - 1;
        const data = await this.client.readHoldingRegisters(reg, 1);
        res.push({ tagId: t.tagId, tagName: t.tagName, value: data.data[0], quality: 'GOOD' });
      } catch(e) {}
    }
    return res;
  }
  async writeTag(addr, val) {
    const reg = parseInt(addr) % 10000 - 1;
    await this.client.writeRegister(reg, parseInt(val));
  }
  disconnect() { if (this.client) try { this.client.close(() => {}); } catch(e) {} }
}
module.exports = ModbusReader;
`;
}

function getFallbackOpcuaReaderJs() {
  return `const opcua = require('node-opcua');
class OPCUAReader {
  constructor(plcConfig) { this.config = plcConfig; this.client = null; this.session = null; this.isConnected = false; }
  async connect() {
    try {
      const url = \`opc.tcp://\${this.config.ip}:\${this.config.port || 4840}\`;
      this.client = opcua.OPCUAClient.create({ securityMode: opcua.MessageSecurityMode.None, securityPolicy: opcua.SecurityPolicy.None });
      await this.client.connect(url);
      this.session = await this.client.createSession();
      this.isConnected = true;
      return true;
    } catch(e) { return false; }
  }
  async readTags(tags) {
    if (!this.isConnected || !this.session) return [];
    try {
      const nodes = tags.map(t => ({ nodeId: t.address, attributeId: opcua.AttributeIds.Value }));
      const dvs = await this.session.read(nodes);
      return tags.map((t, i) => {
        let v = dvs[i]?.value?.value;
        if (typeof v === 'bigint') v = Number(v);
        return { tagId: t.tagId, tagName: t.tagName, value: v, quality: dvs[i]?.statusCode?.isGood() ? 'GOOD' : 'BAD' };
      });
    } catch(e) { return []; }
  }
  async writeTag(addr, val, dataType) {
    let dt = opcua.DataType.Double;
    if (dataType === 'BOOL') dt = opcua.DataType.Boolean;
    await this.session.write([{ nodeId: addr, attributeId: opcua.AttributeIds.Value, value: { value: { dataType: dt, value: val } } }]);
  }
  disconnect() { if (this.client) try { this.client.disconnect(() => {}); } catch(e) {} }
}
module.exports = OPCUAReader;
`;
}

module.exports = {
  getGateways,
  getGateway,
  createGateway,
  updateGateway,
  regenerateApiKey,
  downloadGatewayConfig,
  downloadCompletePackage,
  deleteGateway,
};