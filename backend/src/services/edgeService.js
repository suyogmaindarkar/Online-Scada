// ═══════════════════════════════════════════════════════════
// Edge Service — Cloud ↔ Factory Gateway Bridge (ObjectId Fix)
// ═══════════════════════════════════════════════════════════

const crypto = require('crypto');
const EdgeGateway = require('../models/EdgeGateway');
const Tag = require('../models/Tag');
const Company = require('../models/Company');

const HEARTBEAT_TIMEOUT_MS = 60000;
const DB_FLUSH_INTERVAL_MS = 2000;
const MAX_TAGS_PER_BATCH = 500;

class EdgeService {
    constructor() {
        this.tagCache = new Map();
        this.gateways = new Map();
        this.socketToGateway = new Map();
        this.pendingDbWrites = new Map();
        this.edgeNamespace = null;
        this.mainIo = null;
        this.dbFlushTimer = null;
        this.isInitialized = false;
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

        this.socketToGateway.set(socket.id, gatewayId);

        EdgeGateway.findByIdAndUpdate(gatewayId, {
            status: 'online',
            lastHeartbeat: new Date(),
            ipAddress: socket.handshake.address || '',
        }).catch(() => { });

        console.log(`🟢 Edge Gateway ONLINE: ${gatewayName} | company=${companyId} | socket=${socket.id}`);

        socket.emit('edge:welcome', { message: 'Connected to OnlineSCADA Edge Bridge' });

        socket.on('edge:heartbeat', (data) => this._handleHeartbeat(socket, data));
        socket.on('edge:tagValues', (data) => this._handleTagValues(socket, data));
        socket.on('edge:writeResult', (data) => this._handleWriteResult(socket, data));
        socket.on('disconnect', (reason) => this._handleDisconnect(socket, reason));
    }

    _handleHeartbeat(socket, data) {
        const gateway = this.gateways.get(socket.gatewayId);
        if (!gateway) return;

        if (gateway.heartbeatTimer) clearTimeout(gateway.heartbeatTimer);
        gateway.heartbeatTimer = setTimeout(() => {
            this._markGatewayOffline(socket.gatewayId, 'heartbeat timeout');
        }, HEARTBEAT_TIMEOUT_MS);

        const now = Date.now();
        if (!gateway.lastDbHeartbeat || now - gateway.lastDbHeartbeat > 30000) {
            gateway.lastDbHeartbeat = now;
            const updateData = { status: 'online', lastHeartbeat: new Date() };
            if (data) updateData.stats = data;
            EdgeGateway.findByIdAndUpdate(socket.gatewayId, updateData).catch(() => { });
        }
        socket.emit('edge:heartbeatAck', { timestamp: Date.now() });
    }

    _handleTagValues(socket, data) {
        const { companyId } = socket;
        if (!data || !Array.isArray(data.tags)) return;

        const companyRoom = `company:${companyId}`;
        if (!this.tagCache.has(companyId)) this.tagCache.set(companyId, new Map());
        const companyCache = this.tagCache.get(companyId);

        const broadcastUpdates = [];
        for (const tag of data.tags) {
            const key = tag.tagName || tag.tagId;
            if (!key) continue;

            companyCache.set(key, { value: tag.value, quality: tag.quality || 'GOOD', timestamp: tag.timestamp });

            if (tag.tagId) {
                this.pendingDbWrites.set(tag.tagId, {
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
        }
    }

    _handleWriteResult(socket, data) {
        if (!data || !data.tagId) return;
        if (data.success) {
            if (!this.tagCache.has(socket.companyId)) this.tagCache.set(socket.companyId, new Map());
            this.tagCache.get(socket.companyId).set(data.tagName, { value: data.value, quality: 'GOOD', timestamp: Date.now() });
            this.pendingDbWrites.set(data.tagId, { currentValue: data.value, quality: 'GOOD', lastUpdated: new Date() });
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
        EdgeGateway.findByIdAndUpdate(gatewayId, { status: 'offline' }).catch(() => { });
        console.log(`🔴 Edge Gateway OFFLINE: ${gateway.name} | reason=${reason}`);
    }

    async _flushToDatabase() {
        if (this.pendingDbWrites.size === 0) return;
        const writes = new Map(this.pendingDbWrites);
        this.pendingDbWrites.clear();
        try {
            const bulkOps = [];
            for (const [tagId, data] of writes) {
                bulkOps.push({ updateOne: { filter: { _id: tagId }, update: { $set: data } } });
            }
            for (let i = 0; i < bulkOps.length; i += MAX_TAGS_PER_BATCH) {
                await Tag.bulkWrite(bulkOps.slice(i, i + MAX_TAGS_PER_BATCH), { ordered: false });
            }
        } catch (err) { }
    }

    // ✅ FIXED: Safely convert ObjectIds to Strings for comparisons
    getTagCache(companyId) {
        const companyCache = this.tagCache.get(String(companyId));
        if (!companyCache) return {};
        const result = {};
        for (const [tagName, data] of companyCache) result[tagName] = data;
        return result;
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
            EdgeGateway.findByIdAndUpdate(gatewayId, { status: 'offline' }).catch(() => { });
        }
        this.gateways.clear();
    }
}

module.exports = new EdgeService();