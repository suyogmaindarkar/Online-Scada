// ============================================
// OPC UA Service - Using node-opcua
// Fixed for Prosys / Mongoose v9
// ============================================

const {
  OPCUAClient,
  AttributeIds,
  MessageSecurityMode,
  SecurityPolicy,
  DataType,
  UserTokenType,
} = require('node-opcua');

const Tag = require('../models/Tag');
const { writeTagValue: writeTagToInflux } = require('./influxService');

class OPCUAService {
  constructor() {
    this.clients = new Map();
    this.sessions = new Map();
    this.intervals = new Map();
    this.tagCache = new Map();
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

      const client = OPCUAClient.create({
        applicationName: 'WebSCADA',
        applicationUri: 'urn:WebSCADA:Client',
        clientName: 'WebSCADA',
        connectionStrategy: {
          initialDelay: 1000,
          maxRetry: 1,
          maxDelay: 2000,
        },
        securityMode: MessageSecurityMode.None,
        securityPolicy: SecurityPolicy.None,
        endpointMustExist: false,
        requestedSessionTimeout: 60000,
        keepSessionAlive: true,
      });

      client.on('backoff', (retry, delay) =>
        console.log(`⏳ OPC UA backoff retry=${retry} delay=${delay}ms`)
      );

      await client.connect(endpoint);
      console.log(`✅ OPC UA transport connected`);

            const userIdentityInfo = { type: UserTokenType.Anonymous };
      const session = await client.createSession(userIdentityInfo);
      console.log(`✅ OPC UA session created for ${plc.name}`);

      // ✅ Detect unexpected disconnects
      const plcId = plc._id.toString();

      client.on('connection_lost', () => {
        console.warn(`⚠️  OPC UA connection lost: ${plc.name}`);
        this._handleDisconnect(plcId);
      });

      client.on('close', () => {
        console.warn(`⚠️  OPC UA connection closed: ${plc.name}`);
        this._handleDisconnect(plcId);
      });

      session.on('session_closed', () => {
        console.warn(`⚠️  OPC UA session closed: ${plc.name}`);
      });

      this.clients.set(plcId, client);
      this.sessions.set(plcId, session);

      return { success: true, client, session };
    } catch (err) {
      console.error(`❌ OPC UA connect failed for ${plc.name}: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  // Called when connection drops unexpectedly
  _handleDisconnect(plcId) {
    const id = plcId.toString();

    // Stop polling but don't close everything (plcManager will reconnect)
    if (this.intervals.has(id)) {
      clearInterval(this.intervals.get(id));
      this.intervals.delete(id);
    }
    // Clean up references but let plcManager handle reconnect
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
    console.log(`▶️  Starting OPC UA service for: ${plc.name}`);
    await this.stop(plc._id);

    const result = await this.connect(plc);
    if (!result.success) {
      throw new Error(result.error);
    }

    const session = result.session;

    const tags = await Tag.find({
      plcConnection: plc._id,
      isActive: true,
    });

    console.log(`📊 Loaded ${tags.length} OPC UA tags for ${plc.name}`);

    if (tags.length === 0) {
      console.warn(`⚠️  No tags configured for ${plc.name}`);
      return { success: true, message: 'Connected but no tags' };
    }

    tags.forEach((tag) => {
      console.log(`   ✓ ${tag.tagName} → ${tag.plcAddress}`);
    });

    this.tagCache.set(plc._id.toString(), tags);

    const pollRate = plc.pollingRate || 1000;
    console.log(`⏱️  OPC UA polling rate: ${pollRate}ms`);

    const intervalId = setInterval(async () => {
      try {
        const nodesToRead = tags.map((tag) => ({
          nodeId: tag.plcAddress,
          attributeId: AttributeIds.Value,
        }));

        const dataValues = await session.read(nodesToRead);
        const updates = [];

        for (let i = 0; i < tags.length; i++) {
          const tag = tags[i];
          const dv = dataValues[i];

          if (!dv || !dv.statusCode || dv.statusCode.value !== 0) continue;

          let value = dv.value.value;
          if (typeof value === 'bigint') value = Number(value);

          try {
            const freshTag = await Tag.findById(tag._id);
            if (!freshTag) continue;

            freshTag.currentValue = value;
            freshTag.quality = 'GOOD';
            freshTag.lastUpdated = Date.now();
            await freshTag.save();

            updates.push({
              tagName: freshTag.tagName,
              value: value,
              quality: 'GOOD',
              timestamp: freshTag.lastUpdated,
            });

            if (freshTag.enableLogging) {
              try {
                await writeTagToInflux({
                  tagId: freshTag._id,
                  tagName: freshTag.tagName,
                  value: typeof value === 'boolean' ? (value ? 1 : 0) : value,
                  unit: freshTag.unit,
                  plcId: plc._id,
                  quality: 'GOOD',
                });
              } catch (e) {}
            }
          } catch (err) {
            console.error(`❌ Tag update error: ${err.message}`);
          }
        }

        if (io && updates.length > 0) {
          io.emit('tagsUpdate', updates);
        }
      } catch (err) {
        console.error(`❌ OPC UA poll error: ${err.message}`);
      }
    }, pollRate);

    this.intervals.set(plc._id.toString(), intervalId);

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
      throw new Error(`Write failed: ${statusCode.toString()}`);
    }

    console.log(`✅ OPC UA Write: ${tag.tagName} = ${value}`);
    return true;
  }

  async stop(plcId) {
    const id = plcId.toString();

    if (this.intervals.has(id)) {
      clearInterval(this.intervals.get(id));
      this.intervals.delete(id);
    }

    if (this.sessions.has(id)) {
      try {
        await this.sessions.get(id).close();
      } catch (e) {}
      this.sessions.delete(id);
    }

    if (this.clients.has(id)) {
      try {
        await this.clients.get(id).disconnect();
      } catch (e) {}
      this.clients.delete(id);
      console.log(`⏹️  OPC UA disconnected: ${id}`);
    }

    this.tagCache.delete(id);
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