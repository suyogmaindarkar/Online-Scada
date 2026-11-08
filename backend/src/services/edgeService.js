// ═══════════════════════════════════════════════════════════
// Edge Service — Cloud ↔ Factory Gateway Bridge (ObjectId Fix)
// ═══════════════════════════════════════════════════════════

const crypto = require('crypto');
const EdgeGateway = require('../models/EdgeGateway');
const Tag = require('../models/Tag');
const Company = require('../models/Company');
const { increment, setPendingMongoQueueSize } = require('../utils/metrics');
const { logTelemetry } = require('./historianService');

const HEARTBEAT_TIMEOUT_MS = 60000;
const DB_FLUSH_INTERVAL_MS = 2000;
const MAX_TAGS_PER_BATCH = 500;

class EdgeService {
    constructor() {
        this.tagCache = new Map();
        this.tagMeta = new Map();
        this.gateways = new Map();
        this.socketToGateway = new Map();
        this.pendingDbWrites = new Map();
        this.edgeNamespace = null;
        this.mainIo = null;
        this.dbFlushTimer = null;
        this.isInitialized = false;
        this.equipmentStatuses = new Map();
        this.pendingCommands = new Map();
    }

    init(edgeNamespace, mainIo) {
        if (this.isInitialized) return;
        this.edgeNamespace = edgeNamespace;
        this.mainIo = mainIo;
        edgeNamespace.use(this._authenticate.bind(this));
        edgeNamespace.on('connection', this._onConnection.bind(this));
        this.dbFlushTimer = setInterval(this._flushToDatabase.bind(this), DB_FLUSH_INTERVAL_MS);
        this.isInitialized = true;
        console.log('🌐 EdgeService initialized — /edge namespace ready');
    }

    async _authenticate(socket, next) {
        try {
            const { apiKey, companyId } = socket.handshake.auth || {};
            if (!apiKey || !companyId) return next(new Error('AUTH_MISSING'));

            const incomingHash = crypto.createHash('sha256').update(apiKey).digest('hex');
            const gateway = await EdgeGateway.findOne({ companyId, apiKeyHash: incomingHash }).select('+apiKeyHash');

            if (!gateway) return next(new Error('AUTH_INVALID'));

            const company = await Company.findById(companyId);
            if (!company || !company.canAccess() || !company.edgeApiEnabled) {
                return next(new Error('AUTH_DENIED'));
            }

            socket.gatewayId = gateway._id.toString();
            socket.companyId = String(companyId);
            socket.gatewayName = gateway.name;
            next();
        } catch (err) {
            next(new Error('AUTH_FAILED'));
        }
    }

    _onConnection(socket) {
        const { gatewayId, companyId, gatewayName } = socket;
        const companyRoom = `company:${companyId}`;
        const edgeRoom = `edge:company:${companyId}`;

        socket.join(edgeRoom);
        socket.join(companyRoom);

        if (this.gateways.has(gatewayId)) {
            const old = this.gateways.get(gatewayId);
            if (old.heartbeatTimer) clearTimeout(old.heartbeatTimer);
            this.socketToGateway.delete(old.socketId);
        }

        const heartbeatTimer = setTimeout(() => {
            this._markGatewayOffline(gatewayId, 'heartbeat timeout');
        }, HEARTBEAT_TIMEOUT_MS);

        this.gateways.set(gatewayId, {
            socketId: socket.id,
            companyId,
            heartbeatTimer,
            name: gatewayName,
            connectedAt: Date.now(),
        });
        increment('heartbeatOnline');

        this.socketToGateway.set(socket.id, gatewayId);

        EdgeGateway.findOneAndUpdate({ _id: gatewayId, companyId }, {
            status: 'online',
            lastHeartbeat: new Date(),
            ipAddress: socket.handshake.address || '',
        }).catch(() => { });

        console.log(`🟢 Edge Gateway ONLINE: ${gatewayName} | company=${companyId} | socket=${socket.id}`);

        socket.emit('edge:welcome', { message: 'Connected to OnlineSCADA Edge Bridge' });

        socket.on('edge:heartbeat', (data) => this._handleHeartbeat(socket, data));
        socket.on('edge:tagValues', (data) => this._handleTagValues(socket, data));
        socket.on('edge:writeResult', (data) => this._handleWriteResult(socket, data));
        socket.on('edge:equipmentCommandResult', (data) => this._handleEquipmentCommandResult(socket, data));
        socket.on('edge:discoveryProgress', (data) => {
            if (!this._isCurrentSocket(socket)) return;
            require('./discoveryService').updateStatus(socket.companyId, data, socket.gatewayId);
        });
        socket.on('disconnect', (reason) => this._handleDisconnect(socket, reason));
        require('./edgeConfigBroadcaster').compileLiveConfig(companyId).then((config) => {
            if (this._isCurrentSocket(socket)) socket.emit('edge:configUpdate', config);
        }).catch(() => {
            if (this._isCurrentSocket(socket)) socket.emit('edge:configError', { message: 'Unable to load current equipment configuration' });
        });
    }

    _isCurrentSocket(socket) {
        return this.gateways.get(socket.gatewayId)?.socketId === socket.id;
    }

    _handleHeartbeat(socket, data) {
        const gateway = this.gateways.get(socket.gatewayId);
        if (!gateway || gateway.socketId !== socket.id) return;

        if (gateway.heartbeatTimer) clearTimeout(gateway.heartbeatTimer);
        gateway.heartbeatTimer = setTimeout(() => {
            this._markGatewayOffline(socket.gatewayId, 'heartbeat timeout');
        }, HEARTBEAT_TIMEOUT_MS);

        const now = Date.now();
        if (!gateway.lastDbHeartbeat || now - gateway.lastDbHeartbeat > 30000) {
            gateway.lastDbHeartbeat = now;
            const updateData = { status: 'online', lastHeartbeat: new Date() };
            if (data) updateData.stats = data;
            EdgeGateway.findOneAndUpdate({ _id: socket.gatewayId, companyId: socket.companyId }, updateData).catch(() => { });
        }
        if (Array.isArray(data?.equipmentStatuses)) {
            for (const status of data.equipmentStatuses) {
                if (!status?.plcId) continue;
                const liveStatus = {
                    plcId: String(status.plcId),
                    name: status.plcName || 'Equipment',
                    state: status.state || 'unknown',
                    message: status.message || '',
                    isConnected: status.isConnected === true,
                    hasTags: Boolean(status.hasTags),
                    tagCount: Number(status.tagCount || 0),
                    lastDataAt: status.lastDataAt || null,
                    error: status.error || null,
                    timestamp: Date.now(),
                    gatewayId: socket.gatewayId,
                };
                this.equipmentStatuses.set(`${socket.companyId}:${status.plcId}`, liveStatus);
                if (this.mainIo) this.mainIo.to(`company:${socket.companyId}`).emit('plcStatus', liveStatus);
            }
        }
        socket.emit('edge:heartbeatAck', { timestamp: Date.now() });
    }

    _handleTagValues(socket, data) {
        const { companyId } = socket;
        if (socket.gatewayId && !this._isCurrentSocket(socket)) return;
        if (!data || !Array.isArray(data.tags)) return;

        const companyRoom = `company:${companyId}`;
        if (!this.tagCache.has(companyId)) this.tagCache.set(companyId, new Map());
        const companyCache = this.tagCache.get(companyId);

        const broadcastUpdates = [];
        increment('tagBatchesReceived');
        increment('tagsReceived', data.tags.length);
        for (const tag of data.tags) {
            const key = tag.tagName || tag.tagId;
            if (!key) continue;

            companyCache.set(key, { value: tag.value, quality: tag.quality || 'GOOD', timestamp: tag.timestamp });

            if (tag.tagId) {
                this.pendingDbWrites.set(`${companyId}:${tag.tagId}`, {
                    tagId: tag.tagId,
                    companyId,
                    currentValue: tag.value,
                    quality: tag.quality || 'GOOD',
                    lastUpdated: new Date(tag.timestamp),
                });
            }

            broadcastUpdates.push({
                tagName: key,
                value: tag.value,
                quality: tag.quality || 'GOOD',
                timestamp: tag.timestamp,
                source: 'edge',
            });
        }

        if (this.mainIo && broadcastUpdates.length > 0) {
            this.mainIo.to(companyRoom).emit('tagsUpdate', broadcastUpdates);
            increment('broadcasts');
        }
        setPendingMongoQueueSize(this.pendingDbWrites.size);
    }

    _handleWriteResult(socket, data) {
        if (socket.gatewayId && !this._isCurrentSocket(socket)) return;
        if (!data || !data.tagId) return;
        if (data.success) {
            if (!this.tagCache.has(socket.companyId)) this.tagCache.set(socket.companyId, new Map());
            this.tagCache.get(socket.companyId).set(data.tagName, { value: data.value, quality: 'GOOD', timestamp: Date.now() });
            this.pendingDbWrites.set(`${socket.companyId}:${data.tagId}`, { tagId: data.tagId, companyId: socket.companyId, currentValue: data.value, quality: 'GOOD', lastUpdated: new Date() });
            setPendingMongoQueueSize(this.pendingDbWrites.size);
            if (this.mainIo) this.mainIo.to(`company:${socket.companyId}`).emit('tagsUpdate', [{ tagName: data.tagName, value: data.value, quality: 'GOOD', timestamp: Date.now(), source: 'edge-write' }]);
        }
    }

    forwardWriteCommand(companyId, tagData, requestSocketId) {
        if (!this.edgeNamespace) return false;
        const edgeRoom = `edge:company:${String(companyId)}`;
        const sockets = this.edgeNamespace.adapter.rooms.get(edgeRoom);
        if (!sockets || sockets.size === 0) return false;

        this.edgeNamespace.to(edgeRoom).emit('edge:writeCommand', {
            ...tagData, requestSocketId, timestamp: Date.now(),
        });
        return true;
    }

    _handleDisconnect(socket, reason) {
        const gatewayId = this.socketToGateway.get(socket.id);
        if (gatewayId) {
            this._markGatewayOffline(gatewayId, reason);
            this.socketToGateway.delete(socket.id);
        }
    }

    _markGatewayOffline(gatewayId, reason) {
        const gateway = this.gateways.get(gatewayId);
        if (!gateway) return;
        if (gateway.heartbeatTimer) clearTimeout(gateway.heartbeatTimer);
        this.gateways.delete(gatewayId);
        this.socketToGateway.delete(gateway.socketId);
        for (const [key, status] of this.equipmentStatuses) {
            if (status.gatewayId === gatewayId) this.equipmentStatuses.delete(key);
        }
        for (const [requestId, pending] of this.pendingCommands) {
            if (pending.gatewayId === gatewayId) this._finishCommand(requestId, { success: false, connected: false, state: 'connector_offline', code: 'CONNECTOR_OFFLINE', message: 'Factory Connector disconnected' });
        }
        require('./discoveryService').gatewayOffline(gateway.companyId, gatewayId);
        increment('heartbeatOffline');
        EdgeGateway.findOneAndUpdate({ _id: gatewayId, companyId: gateway.companyId }, { status: 'offline' }).catch(() => { });
        console.log(`🔴 Edge Gateway OFFLINE: ${gateway.name} | reason=${reason}`);
    }

    async _flushToDatabase() {
        if (this.pendingDbWrites.size === 0) return;
        const writes = new Map(this.pendingDbWrites);
        this.pendingDbWrites.clear();
        setPendingMongoQueueSize(this.pendingDbWrites.size);
        const started = process.hrtime.bigint();
        try {
            const bulkOps = [];
            for (const [, pending] of writes) {
                const { tagId, companyId, ...data } = pending;
                bulkOps.push({ updateOne: { filter: { _id: tagId, companyId }, update: { $set: data } } });
            }
            for (let i = 0; i < bulkOps.length; i += MAX_TAGS_PER_BATCH) {
                await Tag.bulkWrite(bulkOps.slice(i, i + MAX_TAGS_PER_BATCH), { ordered: false });
            }
            increment('flushes');
        } catch (err) {
            increment('flushFailures');
        } finally {
            const { metrics } = require('../utils/metrics');
            metrics.edge.flushDurationMs += Number(process.hrtime.bigint() - started) / 1e6;
        }
    }

    // ✅ FIXED: Safely convert ObjectIds to Strings for comparisons
    getTagCache(companyId) {
        const companyCache = this.tagCache.get(String(companyId));
        if (!companyCache) return {};
        const result = {};
        for (const [tagName, data] of companyCache) result[tagName] = data;
        return result;
    }

    // ─── REMOTE EQUIPMENT COMMAND RELAY (installer/service feature) ───
    // Sends start/stop/restart/reload to this company's Factory Connector
    // over the /edge namespace with requestId. Multi-tenant safe.
    sendEquipmentCommand(companyId, { equipmentId, action, payload = {} }, opts = {}) {
        const companyStr = String(companyId);
        let gatewayInfo = null;
        for (const [gid, info] of this.gateways) {
            if (String(info.companyId) === companyStr) { gatewayInfo = { gid, ...info }; break; }
        }
        if (!gatewayInfo || !gatewayInfo.socketId) {
            return { ok: false, code: 'CONNECTOR_OFFLINE', message: 'Factory Connector is offline' };
        }
        if (!this.edgeNamespace) {
            return { ok: false, code: 'NOT_INITIALIZED', message: 'Edge bridge not ready' };
        }
        const requestId = crypto.randomUUID ? crypto.randomUUID() : `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        const timer = setTimeout(() => this._finishCommand(requestId, {
            success: false, connected: false, state: 'timeout', code: 'COMMAND_TIMEOUT', message: 'Factory Connector did not confirm the command in time',
        }), opts.timeoutMs || 15000);
        timer.unref?.();
        this.pendingCommands.set(requestId, { companyId: companyStr, gatewayId: gatewayInfo.gid, socketId: gatewayInfo.socketId, equipmentId: String(equipmentId), action, timer, resolve: opts.resolve });
        if (action !== 'test') this.equipmentStatuses.delete(`${companyStr}:${equipmentId}`);
        this.edgeNamespace.to(gatewayInfo.socketId).emit('edge:equipmentCommand', {
            requestId,
            equipmentId,
            action,
            payload,
            timestamp: Date.now(),
        });
        return { ok: true, requestId, message: 'Command sent to Factory Connector' };
    }

    // Forward the connector's reply to every browser in the company room.
    _handleEquipmentCommandResult(socket, data) {
        const pending = this.pendingCommands.get(data?.requestId);
        if (!pending || pending.companyId !== String(socket.companyId) || pending.gatewayId !== socket.gatewayId || pending.socketId !== socket.id || pending.equipmentId !== String(data.equipmentId) || pending.action !== data.action || !this._isCurrentSocket(socket)) return;
        this._finishCommand(data.requestId, data);
    }

    _finishCommand(requestId, data) {
        const pending = this.pendingCommands.get(requestId);
        if (!pending) return;
        clearTimeout(pending.timer);
        this.pendingCommands.delete(requestId);
        const result = {
            requestId, equipmentId: pending.equipmentId, action: pending.action,
            success: data.success === true, connected: data.connected === true,
            state: data.state || 'unknown', message: data.message || '',
            error: data.error || null, code: data.code, timestamp: Date.now(),
        };
        if (pending.action !== 'test') {
            const status = { plcId: pending.equipmentId, gatewayId: pending.gatewayId, isConnected: result.connected, state: result.state || 'unknown', message: result.message || '', timestamp: result.timestamp };
            this.equipmentStatuses.set(`${pending.companyId}:${pending.equipmentId}`, status);
            if (this.mainIo) this.mainIo.to(`company:${pending.companyId}`).emit('plcStatus', status);
            if (this.mainIo) this.mainIo.to(`company:${pending.companyId}`).emit('equipmentCommandResult', result);
        }
        pending.resolve?.(result);
    }

    requestEquipmentCommand(companyId, command, opts = {}) {
        return new Promise((resolve) => {
            const relay = this.sendEquipmentCommand(companyId, command, { ...opts, resolve });
            if (!relay.ok) resolve({ success: false, connected: false, ...relay });
        });
    }

    getEquipmentStatus(companyId, equipmentId) {
        const status = this.equipmentStatuses.get(`${companyId}:${equipmentId}`);
        return status && Date.now() - status.timestamp < 12000 && this.gateways.has(status.gatewayId) ? status : null;
    }

    sendDiscoveryCommand(companyId, event, data, gatewayId) {
        for (const [id, gateway] of this.gateways) {
            if (String(gateway.companyId) !== String(companyId) || (gatewayId && gatewayId !== id)) continue;
            if (!this.edgeNamespace) break;
            this.edgeNamespace.to(gateway.socketId).emit(event, data);
            return { ok: true, gatewayId: id };
        }
        return { ok: false, code: 'CONNECTOR_OFFLINE', message: 'Factory Connector is offline' };
    }

    hasActiveGateway(companyId) {
        const targetId = String(companyId);
        for (const [, info] of this.gateways) {
            if (info.companyId === targetId) return true;
        }
        return false;
    }

    getCompanyGateways(companyId) {
        const targetId = String(companyId);
        const result = [];
        for (const [gatewayId, info] of this.gateways) {
            if (info.companyId === targetId) {
                result.push({ gatewayId, name: info.name, status: 'online' });
            }
        }
        return result;
    }

    stop() {
        if (this.dbFlushTimer) clearInterval(this.dbFlushTimer);
        for (const [gatewayId, info] of this.gateways) {
            if (info.heartbeatTimer) clearTimeout(info.heartbeatTimer);
            EdgeGateway.findOneAndUpdate({ _id: gatewayId, companyId: info.companyId }, { status: 'offline' }).catch(() => { });
        }
        this.gateways.clear();
        for (const requestId of this.pendingCommands.keys()) this._finishCommand(requestId, { success: false, connected: false, state: 'connector_offline', message: 'Factory Connector bridge stopped' });
        this.equipmentStatuses.clear();
    }
}

module.exports = new EdgeService();
