// ═══════════════════════════════════════════════════════════
// Edge Service — Cloud ↔ Factory Gateway Bridge
//
// Manages the /edge Socket.io namespace where Edge Gateways
// connect from factory floors and push live PLC tag data.
//
// Responsibilities:
//   1. Authenticate gateways via API key (SHA-256)
//   2. Receive tag value batches from gateways
//   3. Cache latest tag values in memory (fast reads)
//   4. Update tag values in MongoDB (batched, every 2s)
//   5. Broadcast tag updates to browser clients (company room)
//   6. Track gateway heartbeats (mark offline after 60s)
//   7. Forward write commands from browsers to gateways
//
// Architecture:
//   Edge Gateway (factory) ──WSS──► /edge namespace (this service)
//                                       │
//                                       ├──► Tag Cache (in-memory Map)
//                                       ├──► MongoDB (batched writes)
//                                       └──► company:<id> room (browser clients)
// ═══════════════════════════════════════════════════════════

const crypto = require('crypto');
const EdgeGateway = require('../models/EdgeGateway');
const Tag = require('../models/Tag');
const Company = require('../models/Company');

// ─── Constants ────────────────────────────────────────────
const HEARTBEAT_TIMEOUT_MS = 60000;   // 60s no heartbeat → offline
const DB_FLUSH_INTERVAL_MS = 2000;    // Flush tag cache to MongoDB every 2s
const MAX_TAGS_PER_BATCH = 500;       // Max tags per edge:tagValues event
const MAX_WRITE_PER_SECOND = 100;     // Rate limit per gateway

class EdgeService {
    constructor() {
        // ─── Tag Cache ────────────────────────────────────────
        // Structure: Map<companyId, Map<tagName, { value, quality, timestamp }>>
        this.tagCache = new Map();

        // ─── Connected Gateways ───────────────────────────────
        // Structure: Map<gatewayId, { socketId, companyId, heartbeatTimer, name }>
        this.gateways = new Map();

        // ─── Socket Mappings ──────────────────────────────────
        // Structure: Map<socketId, gatewayId>  (reverse lookup)
        this.socketToGateway = new Map();

        // ─── Pending DB Writes (batched) ──────────────────────
        // Structure: Map<tagId, { currentValue, quality, lastUpdated }>
        this.pendingDbWrites = new Map();

        // ─── Write Rate Tracking ──────────────────────────────
        // Structure: Map<gatewayId, { count, resetTimer }>
        this.writeRateTracker = new Map();

        // ─── References ───────────────────────────────────────
        this.edgeNamespace = null;
        this.mainIo = null;
        this.dbFlushTimer = null;
        this.isInitialized = false;
    }

    // ═════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═════════════════════════════════════════════════════════
    init(edgeNamespace, mainIo) {
        if (this.isInitialized) {
            console.warn('⚠️  EdgeService already initialized');
            return;
        }

        this.edgeNamespace = edgeNamespace;
        this.mainIo = mainIo;

        // ─── Auth Middleware ──────────────────────────────────
        edgeNamespace.use(this._authenticate.bind(this));

        // ─── Connection Handler ───────────────────────────────
        edgeNamespace.on('connection', this._onConnection.bind(this));

        // ─── Start DB Flush Timer ─────────────────────────────
        this.dbFlushTimer = setInterval(
            this._flushToDatabase.bind(this),
            DB_FLUSH_INTERVAL_MS
        );

        this.isInitialized = true;
        console.log('🌐 EdgeService initialized — /edge namespace ready');
    }

    // ═════════════════════════════════════════════════════════
    // AUTHENTICATION (API Key based, NOT JWT)
    // ═════════════════════════════════════════════════════════
    async _authenticate(socket, next) {
        try {
            const { apiKey, companyId } = socket.handshake.auth || {};

            if (!apiKey || !companyId) {
                console.warn(`🔒 Edge rejected ${socket.id} — missing apiKey or companyId`);
                return next(new Error('AUTH_MISSING: apiKey and companyId required'));
            }

            // ─── 1. Hash the incoming API key ───────────────────
            const incomingHash = crypto.createHash('sha256').update(apiKey).digest('hex');

            // ─── 2. Find gateway by company + hash ──────────────
            const gateway = await EdgeGateway.findOne({
                companyId,
                apiKeyHash: incomingHash,
            }).select('+apiKeyHash');

            if (!gateway) {
                console.warn(`🔒 Edge rejected ${socket.id} — invalid API key for company ${companyId}`);
                return next(new Error('AUTH_INVALID: API key not found'));
            }

            // ─── 3. Check company is active ─────────────────────
            const company = await Company.findById(companyId);
            if (!company || !company.canAccess()) {
                console.warn(`🔒 Edge rejected ${socket.id} — company ${companyId} inactive/expired`);
                return next(new Error('AUTH_EXPIRED: Company inactive or expired'));
            }

            // ─── 4. Check edge API is enabled ───────────────────
            if (!company.edgeApiEnabled) {
                console.warn(`🔒 Edge rejected ${socket.id} — edge API disabled for company ${companyId}`);
                return next(new Error('AUTH_DISABLED: Edge API disabled for this workspace'));
            }

            // ─── 5. Attach gateway info to socket ───────────────
            socket.gatewayId = gateway._id.toString();
            socket.companyId = String(companyId);
            socket.gatewayName = gateway.name;

            next();
        } catch (err) {
            console.error('❌ Edge auth error:', err.message);
            next(new Error('AUTH_FAILED'));
        }
    }

    // ═════════════════════════════════════════════════════════
    // CONNECTION HANDLER
    // ═════════════════════════════════════════════════════════
    _onConnection(socket) {
        const { gatewayId, companyId, gatewayName } = socket;
        const companyRoom = `company:${companyId}`;
        const edgeRoom = `edge:company:${companyId}`;

        // ─── Join Rooms ───────────────────────────────────────
        socket.join(edgeRoom);
        socket.join(companyRoom); // Also join company room for direct broadcasts

        // ─── Track Gateway ────────────────────────────────────
        // If this gateway was already connected (reconnect), clean up old socket
        if (this.gateways.has(gatewayId)) {
            const old = this.gateways.get(gatewayId);
            if (old.heartbeatTimer) clearTimeout(old.heartbeatTimer);
            this.socketToGateway.delete(old.socketId);
            console.log(`🔄 Edge gateway reconnected: ${gatewayName} (${gatewayId})`);
        }

        // Start heartbeat timeout
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

        // ─── Update Gateway Status in DB ──────────────────────
        EdgeGateway.findByIdAndUpdate(gatewayId, {
            status: 'online',
            lastHeartbeat: new Date(),
            ipAddress: socket.handshake.address || '',
        }).catch(err => console.error('Edge status update error:', err.message));

        console.log(`🟢 Edge Gateway ONLINE: ${gatewayName} | company=${companyId} | socket=${socket.id}`);

        // ─── Send Welcome ─────────────────────────────────────
        socket.emit('edge:welcome', {
            message: 'Connected to OnlineSCADA Edge Bridge',
            gatewayId,
            companyId,
            timestamp: Date.now(),
        });

        // ─── EVENT: Heartbeat ─────────────────────────────────
        socket.on('edge:heartbeat', (data) => {
            this._handleHeartbeat(socket, data);
        });

        // ─── EVENT: Tag Values Batch ──────────────────────────
        socket.on('edge:tagValues', (data) => {
            this._handleTagValues(socket, data);
        });

        // ─── EVENT: Write Result ──────────────────────────────
        socket.on('edge:writeResult', (data) => {
            this._handleWriteResult(socket, data);
        });

        // ─── EVENT: Error Report ──────────────────────────────
        socket.on('edge:error', (data) => {
            console.error(`⚠️  Edge error from ${gatewayName}:`, data.message || data);
        });

        // ─── EVENT: Disconnect ────────────────────────────────
        socket.on('disconnect', (reason) => {
            this._handleDisconnect(socket, reason);
        });
    }

    // ═════════════════════════════════════════════════════════
    // HEARTBEAT HANDLER
    // ═════════════════════════════════════════════════════════
    _handleHeartbeat(socket, data) {
        const gatewayId = socket.gatewayId;
        const gateway = this.gateways.get(gatewayId);

        if (!gateway) return;

        // Reset heartbeat timer
        if (gateway.heartbeatTimer) clearTimeout(gateway.heartbeatTimer);
        gateway.heartbeatTimer = setTimeout(() => {
            this._markGatewayOffline(gatewayId, 'heartbeat timeout');
        }, HEARTBEAT_TIMEOUT_MS);

        // Update DB (throttled — only every 30s to avoid excessive writes)
        const now = Date.now();
        if (!gateway.lastDbHeartbeat || now - gateway.lastDbHeartbeat > 30000) {
            gateway.lastDbHeartbeat = now;

            const updateData = {
                status: 'online',
                lastHeartbeat: new Date(),
            };

            // Include stats if provided
            if (data) {
                updateData.stats = {
                    uptimeSeconds: data.uptimeSeconds || 0,
                    tagsReadPerSecond: data.tagsReadPerSecond || 0,
                    memoryUsageMB: data.memoryUsageMB || 0,
                    cpuPercent: data.cpuPercent || 0,
                    totalReads: data.totalReads || 0,
                    totalErrors: data.totalErrors || 0,
                };

                if (data.version) updateData.version = data.version;
                if (data.hostname) updateData.hostname = data.hostname;
                if (data.os) updateData.os = data.os;
            }

            EdgeGateway.findByIdAndUpdate(gatewayId, updateData).catch(() => { });
        }

        // Acknowledge heartbeat
        socket.emit('edge:heartbeatAck', { timestamp: Date.now() });
    }

    // ═════════════════════════════════════════════════════════
    // TAG VALUES HANDLER (Core Data Pipeline)
    // ═════════════════════════════════════════════════════════
    _handleTagValues(socket, data) {
        const { companyId, gatewayId, gatewayName } = socket;

        if (!data || !Array.isArray(data.tags)) {
            return;
        }

        // Rate limit check
        if (data.tags.length > MAX_TAGS_PER_BATCH) {
            console.warn(`⚠️  Edge ${gatewayName}: batch too large (${data.tags.length} > ${MAX_TAGS_PER_BATCH})`);
            data.tags = data.tags.slice(0, MAX_TAGS_PER_BATCH);
        }

        const companyRoom = `company:${companyId}`;
        const now = Date.now();

        // ─── Ensure company cache exists ──────────────────────
        if (!this.tagCache.has(companyId)) {
            this.tagCache.set(companyId, new Map());
        }
        const companyCache = this.tagCache.get(companyId);

        // ─── Process each tag value ───────────────────────────
        const broadcastUpdates = [];

        for (const tagData of data.tags) {
            const { tagId, tagName, value, quality, timestamp } = tagData;

            if (!tagName && !tagId) continue;

            const key = tagName || tagId;
            const ts = timestamp || now;

            // 1. Update in-memory cache (instant reads)
            companyCache.set(key, {
                value,
                quality: quality || 'GOOD',
                timestamp: ts,
            });

            // 2. Queue for DB flush (batched every 2s)
            if (tagId) {
                this.pendingDbWrites.set(tagId, {
                    currentValue: value,
                    quality: quality || 'GOOD',
                    lastUpdated: new Date(ts),
                });
            }

            // 3. Prepare broadcast payload
            broadcastUpdates.push({
                tagName: key,
                value,
                quality: quality || 'GOOD',
                timestamp: ts,
                source: 'edge', // So frontend knows this came from a real PLC
            });
        }

        // ─── Broadcast to all browser clients in company room ─
        if (this.mainIo && broadcastUpdates.length > 0) {
            this.mainIo.to(companyRoom).emit('tagsUpdate', broadcastUpdates);
        }
    }

    // ═════════════════════════════════════════════════════════
    // WRITE RESULT HANDLER
    // ═════════════════════════════════════════════════════════
    _handleWriteResult(socket, data) {
        const { companyId } = socket;
        const companyRoom = `company:${companyId}`;

        if (!data || !data.tagId) return;

        if (data.success) {
            // Update cache and DB with the written value
            if (!this.tagCache.has(companyId)) {
                this.tagCache.set(companyId, new Map());
            }

            const companyCache = this.tagCache.get(companyId);
            if (data.tagName) {
                companyCache.set(data.tagName, {
                    value: data.value,
                    quality: 'GOOD',
                    timestamp: Date.now(),
                });
            }

            this.pendingDbWrites.set(data.tagId, {
                currentValue: data.value,
                quality: 'GOOD',
                lastUpdated: new Date(),
            });

            // Broadcast the confirmed write to all browsers
            if (this.mainIo && data.tagName) {
                this.mainIo.to(companyRoom).emit('tagsUpdate', [{
                    tagName: data.tagName,
                    value: data.value,
                    quality: 'GOOD',
                    timestamp: Date.now(),
                    source: 'edge-write',
                }]);
            }

            console.log(`✅ Edge write confirmed: ${data.tagName} = ${data.value}`);
        } else {
            console.warn(`❌ Edge write failed: ${data.tagName} — ${data.error || 'unknown'}`);

            // Notify the requesting browser
            if (this.mainIo && data.requestSocketId) {
                this.mainIo.to(data.requestSocketId).emit('writeError', {
                    tagName: data.tagName,
                    error: data.error || 'Write failed at PLC',
                });
            }
        }
    }

    // ═════════════════════════════════════════════════════════
    // FORWARD WRITE COMMAND (Browser → Cloud → Edge → PLC)
    // ═════════════════════════════════════════════════════════
    forwardWriteCommand(companyId, tagData, requestSocketId) {
        if (!this.edgeNamespace) return false;

        const edgeRoom = `edge:company:${companyId}`;
        const sockets = this.edgeNamespace.adapter.rooms.get(edgeRoom);

        if (!sockets || sockets.size === 0) {
            return false; // No edge gateway connected for this company
        }

        // Emit write command to all edge gateways in this company
        // (In practice, only the gateway that serves this tag will execute it)
        this.edgeNamespace.to(edgeRoom).emit('edge:writeCommand', {
            tagId: tagData.tagId,
            tagName: tagData.tagName,
            address: tagData.address,
            protocol: tagData.protocol,
            plcIp: tagData.plcIp,
            value: tagData.value,
            dataType: tagData.dataType,
            requestSocketId, // So we can route the result back
            timestamp: Date.now(),
        });

        return true;
    }

    // ═════════════════════════════════════════════════════════
    // DISCONNECT HANDLER
    // ═════════════════════════════════════════════════════════
    _handleDisconnect(socket, reason) {
        const gatewayId = this.socketToGateway.get(socket.id);

        if (gatewayId) {
            this._markGatewayOffline(gatewayId, reason);
            this.socketToGateway.delete(socket.id);
        }

        console.log(`🔴 Edge Gateway disconnected: socket=${socket.id} | reason=${reason}`);
    }

    // ═════════════════════════════════════════════════════════
    // MARK GATEWAY OFFLINE
    // ═════════════════════════════════════════════════════════
    _markGatewayOffline(gatewayId, reason) {
        const gateway = this.gateways.get(gatewayId);
        if (!gateway) return;

        if (gateway.heartbeatTimer) {
            clearTimeout(gateway.heartbeatTimer);
        }

        this.gateways.delete(gatewayId);

        // Update DB
        EdgeGateway.findByIdAndUpdate(gatewayId, {
            status: 'offline',
        }).catch(() => { });

        console.log(`🔴 Edge Gateway OFFLINE: ${gateway.name} (${gatewayId}) | reason=${reason}`);
    }

    // ═════════════════════════════════════════════════════════
    // DATABASE FLUSH (Batched writes every 2s)
    // ═════════════════════════════════════════════════════════
    async _flushToDatabase() {
        if (this.pendingDbWrites.size === 0) return;

        // Swap out pending writes so new ones accumulate while we flush
        const writes = new Map(this.pendingDbWrites);
        this.pendingDbWrites.clear();

        try {
            // Build bulk operations for efficiency
            const bulkOps = [];

            for (const [tagId, data] of writes) {
                bulkOps.push({
                    updateOne: {
                        filter: { _id: tagId },
                        update: {
                            $set: {
                                currentValue: data.currentValue,
                                quality: data.quality,
                                lastUpdated: data.lastUpdated,
                            },
                        },
                    },
                });
            }

            if (bulkOps.length > 0) {
                // Batch in chunks of 500 (MongoDB limit)
                const CHUNK_SIZE = 500;
                for (let i = 0; i < bulkOps.length; i += CHUNK_SIZE) {
                    const chunk = bulkOps.slice(i, i + CHUNK_SIZE);
                    await Tag.bulkWrite(chunk, { ordered: false });
                }
            }
        } catch (err) {
            console.error('❌ Edge DB flush error:', err.message);
            // Re-queue failed writes (they'll be overwritten by newer values anyway)
        }
    }

    // ═════════════════════════════════════════════════════════
    // PUBLIC API: Get Tag Cache for a Company
    // ═════════════════════════════════════════════════════════
    getTagCache(companyId) {
        const companyCache = this.tagCache.get(companyId);
        if (!companyCache) return {};

        const result = {};
        for (const [tagName, data] of companyCache) {
            result[tagName] = data;
        }
        return result;
    }

    // ═════════════════════════════════════════════════════════
    // PUBLIC API: Get Single Tag Value from Cache
    // ═════════════════════════════════════════════════════════
    getTagValue(companyId, tagName) {
        const companyCache = this.tagCache.get(companyId);
        if (!companyCache) return null;
        return companyCache.get(tagName) || null;
    }

    // ═════════════════════════════════════════════════════════
    // PUBLIC API: Get Connected Gateways for a Company
    // ═════════════════════════════════════════════════════════
    getCompanyGateways(companyId) {
        const result = [];
        for (const [gatewayId, info] of this.gateways) {
            if (info.companyId === companyId) {
                result.push({
                    gatewayId,
                    name: info.name,
                    socketId: info.socketId,
                    connectedAt: info.connectedAt,
                    status: 'online',
                });
            }
        }
        return result;
    }

    // ═════════════════════════════════════════════════════════
    // PUBLIC API: Get All Gateway Stats (for Super Admin)
    // ═════════════════════════════════════════════════════════
    getAllGatewayStats() {
        const result = [];
        for (const [gatewayId, info] of this.gateways) {
            result.push({
                gatewayId,
                name: info.name,
                companyId: info.companyId,
                connectedAt: info.connectedAt,
                status: 'online',
            });
        }
        return {
            totalOnline: result.length,
            gateways: result,
        };
    }

    // ═════════════════════════════════════════════════════════
    // PUBLIC API: Check if Company Has Active Edge Gateway
    // ═════════════════════════════════════════════════════════
    hasActiveGateway(companyId) {
        for (const [, info] of this.gateways) {
            if (info.companyId === companyId) return true;
        }
        return false;
    }

    // ═════════════════════════════════════════════════════════
    // GRACEFUL SHUTDOWN
    // ═════════════════════════════════════════════════════════
    stop() {
        console.log('⏹️  Stopping EdgeService...');

        // Clear DB flush timer
        if (this.dbFlushTimer) {
            clearInterval(this.dbFlushTimer);
            this.dbFlushTimer = null;
        }

        // Final flush
        this._flushToDatabase().catch(() => { });

        // Clear all heartbeat timers
        for (const [gatewayId, info] of this.gateways) {
            if (info.heartbeatTimer) clearTimeout(info.heartbeatTimer);

            // Mark all gateways offline
            EdgeGateway.findByIdAndUpdate(gatewayId, {
                status: 'offline',
            }).catch(() => { });
        }

        this.gateways.clear();
        this.socketToGateway.clear();
        this.tagCache.clear();
        this.pendingDbWrites.clear();
        this.writeRateTracker.clear();
        this.isInitialized = false;

        console.log('⏹️  EdgeService stopped');
    }
}

module.exports = new EdgeService();