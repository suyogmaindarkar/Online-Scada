// ═══════════════════════════════════════════════════════════
// OPC UA Service — Multi-Tenant Update
//
// ✅ FIXED: Tag lookup scoped by companyId
// ✅ FIXED: Broadcasts to company room only
// ✅ FIXED: Batch InfluxDB writes (was single per tag)
// ✅ IMPROVED: Better error messages for wrong node IDs
// ✅ IMPROVED: Detailed logging for debugging tag read issues
// ═══════════════════════════════════════════════════════════

const {
  OPCUAClient,
  AttributeIds,
  MessageSecurityMode,
  SecurityPolicy,
  DataType,
  UserTokenType,
  StatusCodes,
} = require('node-opcua');

const Tag = require('../models/Tag');
const PLCConnection = require('../models/PLCConnection');
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
    this.clients        = new Map();
    this.sessions       = new Map();
    this.intervals      = new Map();
    this.tagCache       = new Map();
    this.plcCompanyMap  = new Map(); // ✅ plcId → companyId
    this.influxWriteCounter = new Map();
    this.INFLUX_LOG_EVERY = 10;
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
        applicationName: 'OnlineSCADA',
        applicationUri: 'urn:OnlineSCADA:Client',
        clientName: 'OnlineSCADA',
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
      console.log(`✅ OPC UA transport connected to ${plc.name}`);

      const userIdentityInfo = { type: UserTokenType.Anonymous };
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

    // ✅ Store company mapping
    this.plcCompanyMap.set(plcId, companyId);
    this.influxWriteCounter.set(plcId, 0);

    // ✅ Load tags SCOPED to this PLC's company
    const tags = await Tag.find({
      companyId:     plc.companyId,
      plcConnection: plc._id,
      isActive:      true,
    });

    console.log(`📊 Loaded ${tags.length} OPC UA tags for ${plc.name}`);

    if (tags.length === 0) {
      console.warn(`⚠️  No tags configured for ${plc.name}`);
      return { success: true, message: 'Connected but no tags' };
    }

    // ✅ Validate each tag's node ID format
    tags.forEach((tag) => {
      const nodeId = tag.plcAddress;
      console.log(`   ✓ ${tag.tagName} → ${nodeId}`);

      // Warn about common mistakes
      if (!nodeId) {
        console.warn(`     ⚠️  EMPTY node ID — tag won't be read!`);
      } else if (!nodeId.includes(';')) {
        console.warn(`     ⚠️  Node ID missing semicolon. Expected format: ns=3;s="Block"."Var" or ns=2;i=1234`);
      }
    });

    this.tagCache.set(plcId, tags);

    const pollRate = plc.pollingRate || 1000;
    console.log(`⏱️  OPC UA polling rate: ${pollRate}ms | Company room: ${companyRoom}`);

    let consecutiveFailures = 0;
    const MAX_FAILURES = 5;

    const intervalId = setInterval(async () => {
      try {
        // ✅ Build read requests with validation
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
          console.error(`❌ OPC UA bulk read error (${consecutiveFailures}/${MAX_FAILURES}): ${readErr.message}`);
          if (consecutiveFailures >= MAX_FAILURES) {
            console.warn(`⚠️  OPC UA ${plc.name}: too many failures, stopping`);
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

          // ✅ Detailed status check with helpful error messages
          if (!dv || !dv.statusCode) {
            console.warn(`   ⚠️  ${tag.tagName}: No data value returned`);
            continue;
          }

          if (dv.statusCode.value !== 0) {
            // Only log errors occasionally to avoid spam
            if (consecutiveFailures === 0) {
              const statusName = dv.statusCode.name || `0x${dv.statusCode.value.toString(16)}`;
              console.warn(`   ⚠️  ${tag.tagName}: Read failed — status=${statusName}`);

              // ✅ Helpful hints for common errors
              if (dv.statusCode.value === 0x80730000 || statusName === 'BadNodeIdUnknown') {
                console.warn(`     💡 Node ID "${tag.plcAddress}" does not exist on the OPC UA server`);
                console.warn(`     💡 Check the correct namespace (ns=?) and path in UAExpert or TIA Portal`);
              }
              if (dv.statusCode.value === 0x80010000 || statusName === 'BadNodeIdInvalid') {
                console.warn(`     💡 Node ID format is invalid. Expected: ns=3;s="DBName"."VarName"`);
              }
            }
            continue;
          }

          let value = dv.value.value;
          if (typeof value === 'bigint') value = Number(value);

          try {
            // ✅ FIXED: Lookup tag scoped by companyId
            const freshTag = await Tag.findOne({
              _id: tag._id,
              companyId: companyId,
            });
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

            // ✅ Collect for batch InfluxDB write
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
          } catch (tagErr) {
            console.error(`❌ Tag update error: ${tagErr.message}`);
          }
        }

        // ✅ FIXED: Broadcast ONLY to this company's room
        if (io && updates.length > 0) {
          io.to(companyRoom).emit('tagsUpdate', updates);
        }

        // ✅ FIXED: Batch InfluxDB write (was single per tag)
        if (influxPoints.length > 0 && isInfluxAvailable()) {
          try {
            const success = await writeMultipleTagValues(influxPoints);
            if (success) {
              const counter = (this.influxWriteCounter.get(plcId) || 0) + 1;
              this.influxWriteCounter.set(plcId, counter);
              if (counter % this.INFLUX_LOG_EVERY === 0) {
                console.log(`📈 [${plc.name}] OPC UA: Logged ${influxPoints.length} values (${counter} batches)`);
              }
            }
          } catch (influxErr) {
            // Silent
          }
        }
      } catch (err) {
        consecutiveFailures++;
        console.error(`❌ OPC UA poll error (${consecutiveFailures}/${MAX_FAILURES}): ${err.message}`);
        if (consecutiveFailures >= MAX_FAILURES) {
          console.warn(`⚠️  OPC UA ${plc.name}: too many errors, stopping`);
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
      const statusName = statusCode.name || `0x${statusCode.value.toString(16)}`;
      throw new Error(`OPC UA write failed: ${statusName} — check if tag "${tag.tagName}" (${tag.plcAddress}) is writable`);
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
      try { await this.sessions.get(id).close(); } catch (e) {}
      this.sessions.delete(id);
    }

    if (this.clients.has(id)) {
      try { await this.clients.get(id).disconnect(); } catch (e) {}
      this.clients.delete(id);
      console.log(`⏹️  OPC UA disconnected: ${id}`);
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