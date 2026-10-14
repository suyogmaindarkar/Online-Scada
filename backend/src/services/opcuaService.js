// ═══════════════════════════════════════════════════════════
// OPC UA Service — Multi-Tenant & Cloud Safe
// ═══════════════════════════════════════════════════════════

const {
  OPCUAClient,
  AttributeIds,
  MessageSecurityMode,
  SecurityPolicy,
  DataType,
  UserTokenType,
} = require('node-opcua');
const { CODES, normalizeError } = require('../utils/diagnostics');

const Tag = require('../models/Tag');
const { writeMultipleTagValues, isInfluxAvailable } = require('./influxService');

const toInfluxValue = (value, dataType) => {
  if (value === null || value === undefined) return null;
  if (dataType === 'BOOL' || typeof value === 'boolean') return value ? 1 : 0;
  if (dataType === 'STRING' || typeof value === 'string') {
    const n = Number(value);
    return isNaN(n) ? null : n;
  }
  const n = Number(value);
  return isNaN(n) ? null : n;
};

class OPCUAService {
  constructor() {
    this.clients            = new Map();
    this.sessions           = new Map();
    this.intervals          = new Map();
    this.tagCache           = new Map();
    this.plcCompanyMap      = new Map();
    this.influxWriteCounter = new Map();
    this.INFLUX_LOG_EVERY   = 10;
  }

  buildEndpoint(plc) {
    if (plc.ipAddress && plc.ipAddress.startsWith('opc.tcp://')) {
      return plc.ipAddress;
    }
    const port = plc.port || 4840;
    return `opc.tcp://${plc.ipAddress}:${port}`;
  }

  async connect(plc) {
    try {
      const endpoint = this.buildEndpoint(plc);
      console.log(`🔌 Connecting to OPC UA: ${plc.name}`);
      console.log(`   Endpoint: ${endpoint}`);

      let securityMode = MessageSecurityMode.None;
      let securityPolicy = SecurityPolicy.None;
      let discoveredEndpoint = endpoint;

      try {
        console.log(`   Discovering endpoints...`);
        const tempClient = OPCUAClient.create({
          applicationName: 'OnlineSCADA',
          applicationUri: 'urn:OnlineSCADA:Client',
          clientName: 'OnlineSCADA-Discovery',
          connectionStrategy: { maxRetry: 0 },
          endpointMustExist: false,
        });

        // ✅ FIXED: Pass object to getEndpoints to avoid localeIds error
        const endpoints = await tempClient.getEndpoints({ endpointUrl: endpoint });
        await tempClient.disconnect();

        if (Array.isArray(endpoints) && endpoints.length > 0) {
          const noneEndpoint = endpoints.find(ep =>
            ep.securityMode === MessageSecurityMode.None &&
            ep.securityPolicyUri === SecurityPolicy.None
          );

          if (noneEndpoint) {
            securityMode = MessageSecurityMode.None;
            securityPolicy = SecurityPolicy.None;
            discoveredEndpoint = noneEndpoint.endpointUrl || endpoint;
            console.log(`   ✅ Using None/None endpoint: ${discoveredEndpoint}`);
          }
        }
      } catch (discoveryErr) {
        console.warn(`   ⚠️  Endpoint discovery warning (using default): ${discoveryErr.message}`);
      }

      const client = OPCUAClient.create({
        applicationName: 'OnlineSCADA',
        applicationUri: 'urn:OnlineSCADA:Client',
        clientName: 'OnlineSCADA',
        connectionStrategy: {
          initialDelay: 1000,
          maxRetry: 2,
          maxDelay: 5000,
        },
        securityMode,
        securityPolicy,
        endpointMustExist: false,
        requestedSessionTimeout: 60000,
        keepSessionAlive: true,
      });

      await client.connect(discoveredEndpoint);
      console.log(`✅ OPC UA transport connected to ${plc.name}`);

      let userIdentityInfo = { type: UserTokenType.Anonymous };
      if (plc.opcuaUsername && plc.opcuaPassword) {
        userIdentityInfo = {
          type: UserTokenType.UserName,
          userName: plc.opcuaUsername,
          password: plc.opcuaPassword,
        };
        console.log(`   Using username/password authentication`);
      } else {
        console.log(`   Using anonymous authentication`);
      }

      const session = await client.createSession(userIdentityInfo);
      console.log(`✅ OPC UA session created for ${plc.name}`);

      const plcId = plc._id.toString();

      client.on('connection_lost', () => {
        console.warn(`⚠️  OPC UA connection lost: ${plc.name}`);
        this._handleDisconnect(plcId);
      });

      client.on('close', () => {
        console.warn(`⚠️  OPC UA connection closed: ${plc.name}`);
        this._handleDisconnect(plcId);
      });

      this.clients.set(plcId, client);
      this.sessions.set(plcId, session);

      return { success: true, client, session };
    } catch (err) {
      console.error(`❌ OPC UA connect failed for ${plc.name}: ${err.message}`);
      const diagnostic = normalizeError(err, CODES.CONNECTION_FAILED);
      return { success: false, error: err.message, errorCode: diagnostic.code };
    }
  }

  _handleDisconnect(plcId) {
    const id = plcId.toString();
    if (this.intervals.has(id)) {
      clearInterval(this.intervals.get(id));
      this.intervals.delete(id);
    }
    this.sessions.delete(id);
    this.clients.delete(id);
    this.tagCache.delete(id);
  }

  async test(plc) {
    const result = await this.connect(plc);
    if (result.success) {
      const id = plc._id.toString();
      try {
        await result.session.close();
        await result.client.disconnect();
      } catch (e) {}
      this.sessions.delete(id);
      this.clients.delete(id);
      return { success: true, message: 'OPC UA connection successful' };
    }
    return result;
  }

  async start(plc, io) {
    console.log(`▶️  Starting OPC UA service for: ${plc.name} [company=${plc.companyId}]`);
    await this.stop(plc._id);

    const result = await this.connect(plc);
    if (!result.success) throw new Error(result.error);

    const session = result.session;
    const plcId = plc._id.toString();
    const companyId = plc.companyId.toString();
    const companyRoom = `company:${companyId}`;

    this.plcCompanyMap.set(plcId, companyId);
    this.influxWriteCounter.set(plcId, 0);

    const tags = await Tag.find({
      companyId:     plc.companyId,
      plcConnection: plc._id,
      isActive:      true,
    });

    console.log(`📊 Loaded ${tags.length} OPC UA tags for ${plc.name}`);

    if (tags.length === 0) {
      return { success: true, message: 'Connected but no tags' };
    }

    this.tagCache.set(plcId, tags);
    const pollRate = plc.pollingRate || 1000;

    let consecutiveFailures = 0;
    const MAX_FAILURES = 5;

    const intervalId = setInterval(async () => {
      try {
        const validTags = tags.filter(t => t.plcAddress && t.plcAddress.includes(';'));
        if (validTags.length === 0) return;

        const nodesToRead = validTags.map((tag) => ({
          nodeId: tag.plcAddress,
          attributeId: AttributeIds.Value,
        }));

        let dataValues;
        try {
          dataValues = await session.read(nodesToRead);
        } catch (readErr) {
          consecutiveFailures++;
          if (consecutiveFailures >= MAX_FAILURES) {
            this.stop(plc._id);
          }
          return;
        }

        consecutiveFailures = 0;
        const updates = [];
        const influxPoints = [];

        for (let i = 0; i < validTags.length; i++) {
          const tag = validTags[i];
          const dv = dataValues[i];

          if (!dv || !dv.statusCode || dv.statusCode.value !== 0) continue;

          let value = dv.value.value;
          if (typeof value === 'bigint') value = Number(value);

          try {
            const freshTag = await Tag.findOne({ _id: tag._id, companyId: companyId });
            if (!freshTag) continue;

            freshTag.currentValue = value;
            freshTag.quality      = 'GOOD';
            freshTag.lastUpdated  = Date.now();
            await freshTag.save();

            updates.push({
              tagName:   freshTag.tagName,
              value:     value,
              quality:   'GOOD',
              timestamp: freshTag.lastUpdated,
            });

            if (freshTag.enableLogging) {
              const influxValue = toInfluxValue(value, freshTag.dataType);
              if (influxValue !== null) {
                influxPoints.push({
                  tagId:   freshTag._id.toString(),
                  tagName: freshTag.tagName,
                  value:   influxValue,
                  unit:    freshTag.unit || '',
                  plcId:   plcId,
                  quality: 'GOOD',
                });
              }
            }
          } catch (tagErr) {}
        }

        if (io && updates.length > 0) {
          io.to(companyRoom).emit('tagsUpdate', updates);
        }

        if (influxPoints.length > 0 && isInfluxAvailable()) {
          try {
            await writeMultipleTagValues(influxPoints);
          } catch (influxErr) {}
        }
      } catch (err) {
        consecutiveFailures++;
        if (consecutiveFailures >= MAX_FAILURES) {
          this.stop(plc._id);
        }
      }
    }, pollRate);

    this.intervals.set(plcId, intervalId);

    return { success: true, message: 'OPC UA polling started' };
  }

  async writeTag(plcId, tag, value) {
    const session = this.sessions.get(plcId.toString());
    if (!session) throw new Error('OPC UA session not active');

    let dataType = DataType.Double;
    switch (tag.dataType) {
      case 'BOOL':   dataType = DataType.Boolean; value = Boolean(value); break;
      case 'INT':    dataType = DataType.Int16;   value = parseInt(value); break;
      case 'DINT':   dataType = DataType.Int32;   value = parseInt(value); break;
      case 'WORD':   dataType = DataType.UInt16;  value = parseInt(value); break;
      case 'DWORD':  dataType = DataType.UInt32;  value = parseInt(value); break;
      case 'REAL':   dataType = DataType.Float;   value = parseFloat(value); break;
      case 'STRING': dataType = DataType.String;  value = String(value); break;
      case 'BYTE':   dataType = DataType.Byte;    value = parseInt(value); break;
      default:       dataType = DataType.Double;
    }

    const statusCode = await session.write({
      nodeId: tag.plcAddress,
      attributeId: AttributeIds.Value,
      value: { value: { dataType, value } },
    });

    if (statusCode.value !== 0) {
      throw new Error(`OPC UA write failed for tag "${tag.tagName}"`);
    }

    return true;
  }

  async stop(plcId) {
    const id = plcId.toString();

    if (this.intervals.has(id)) {
      clearInterval(this.intervals.get(id));
      this.intervals.delete(id);
    }

    if (this.sessions.has(id)) {
      try { await this.sessions.get(id).close(); } catch (e) {}
      this.sessions.delete(id);
    }

    if (this.clients.has(id)) {
      try { await this.clients.get(id).disconnect(); } catch (e) {}
      this.clients.delete(id);
    }

    this.tagCache.delete(id);
    this.plcCompanyMap.delete(id);
    this.influxWriteCounter.delete(id);
  }

  isRunning(plcId) {
    return this.intervals.has(plcId.toString());
  }

  async stopAll() {
    for (const id of Array.from(this.intervals.keys())) {
      await this.stop(id);
    }
  }
}

module.exports = new OPCUAService();
