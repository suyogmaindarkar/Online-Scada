// ═══════════════════════════════════════════════════════════
// Server Entry Point — OnlineSCADA Backend (Hardened Production)
// ═══════════════════════════════════════════════════════════
const dns = require('dns');
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
const { snapshot, recordRequest } = require('./src/utils/metrics');
const logger = require('./src/utils/logger');

const { initInflux, closeInflux, isInfluxAvailable } = require('./src/services/influxService');
const trendRoutes = require('./src/routes/trendRoutes');
const connectDB = require('./src/config/database');

// 🟢 1. Initialize Express App First!
const app = express();
const server = http.createServer(app);

app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.set('trust proxy', 1);

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'https://onlinescada.in',
  'https://www.onlinescada.in',
  'https://app.onlinescada.in',
  'https://online-scada.vercel.app',
];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  maxHttpBufferSize: 50 * 1024 * 1024,
});

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS: origin ${origin} not allowed`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use((req, res, next) => {
  const requestId = req.get('x-request-id') || require('crypto').randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
    recordRequest(durationMs, res.statusCode);
    logger.info('request.completed', { requestId, method: req.method, path: req.originalUrl, statusCode: res.statusCode, durationMs: Math.round(durationMs * 100) / 100 });
  });
  next();
});

// ─── Rate Limiters ─────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, max: 300,
  standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please slow down.' },
});
const writeLimiter = rateLimit({
  windowMs: 60 * 1000, max: 60,
  standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Write rate limit exceeded.' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please wait 15 minutes.' },
});
const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many signup attempts. Please wait 15 minutes.' },
  skip: (req) => req.method !== 'POST',
});

app.use('/api', generalLimiter);
app.use('/api/workspace/verify', authLimiter);
app.use('/api/workspace/login-user', authLimiter);
app.use('/api/super-admin/login', authLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/tags/write', writeLimiter);
app.use('/api/signup', signupLimiter);
app.use('/api/workspace/register', signupLimiter);

// ═══════════════════════════════════════════════════════════
// DATABASE CONNECTION + AUTO-SEED
// ═══════════════════════════════════════════════════════════
(async () => {
  await connectDB();
  const { autoSeedIfEmpty } = require('./src/utils/seedDefaults');
  await autoSeedIfEmpty();
})();

// ═══════════════════════════════════════════════════════════
// API ROUTES
// ═══════════════════════════════════════════════════════════

// 🟢 Public Edge Status Route (NOW PLACED PROPERLY AFTER APP INITIALIZATION)
app.get('/api/edge/status', require('./src/controllers/edgePairingController').getEdgeStatus);

app.use('/api/workspace', require('./src/routes/workspaceRoutes'));
app.use('/api/super-admin', require('./src/routes/superAdminRoutes'));
app.use('/api/auth', require('./src/routes/authRoutes'));
app.use('/api/plc', require('./src/routes/plcRoutes'));
app.use('/api/tags', require('./src/routes/tagRoutes'));
app.use('/api/screens', require('./src/routes/screenRoutes'));
app.use('/api/alarms', require('./src/routes/alarmRoutes'));
app.use('/api/trends', trendRoutes);
app.use('/api/recipes', require('./src/routes/recipeRoutes'));
app.use('/api/users', require('./src/routes/userRoutes'));
app.use('/api/settings', require('./src/routes/settingsRoutes'));
app.use('/api/reports', require('./src/routes/reportRoutes'));
app.use('/api/discovery', require('./src/routes/discoveryRoutes'));
app.use('/api/leads', require('./src/routes/leadsRoutes'));
app.use('/api/signup', require('./src/routes/signupRoutes'));
app.use('/api/edge', require('./src/routes/edgeRoutes'));
app.use('/api/edge-pairing', require('./src/routes/edgePairingRoutes'));

app.set('io', io);

// ═══════════════════════════════════════════════════════════
// SYSTEM & DIAGNOSTIC ROUTES
// ═══════════════════════════════════════════════════════════
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🚀 OnlineSCADA Server (Multi-Tenant) is Running!',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.get('/favicon.ico', (req, res) => res.status(204).end());

app.get('/api/health', (req, res) => {
  const edgeService = require('./src/services/edgeService');
  res.json({
    status: 'OK',
    server: 'OnlineSCADA Backend',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    influxdb: typeof isInfluxAvailable === 'function' ? isInfluxAvailable() : 'unknown',
    edge: {
      initialized: edgeService.isInitialized,
      onlineGateways: edgeService.gateways.size,
    },
    metrics: snapshot(),
  });
});

// ═══════════════════════════════════════════════════════════
// SERVICE INITIALIZATION
// ═══════════════════════════════════════════════════════════
const plcManager = require('./src/services/plcManager');
plcManager.init(io);

const alarmEngine = require('./src/services/alarmEngine');
alarmEngine.init(io);

const timeService = require('./src/services/timeService');
timeService.init(io);

const edgeService = require('./src/services/edgeService');
const edgeNamespace = io.of('/edge');
edgeService.init(edgeNamespace, io);

initInflux();

setTimeout(() => {
  plcManager.startAll();
}, 3000);

// ═══════════════════════════════════════════════════════════
// SOCKET.IO (Browser Clients)
// ═══════════════════════════════════════════════════════════
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('AUTH_REQUIRED'));

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return next(new Error('AUTH_INVALID'));
    }

    if (payload.type !== 'user') return next(new Error('WRONG_TOKEN_TYPE'));

    socket.userId = payload.userId;
    socket.companyId = String(payload.companyId);
    socket.userRole = payload.role;

    next();
  } catch (err) {
    next(new Error('AUTH_FAILED'));
  }
});

io.on('connection', async (socket) => {
  const companyRoom = `company:${socket.companyId}`;
  socket.join(companyRoom);

  socket.emit('welcome', {
    message: 'Connected to OnlineSCADA Server',
    socketId: socket.id,
    companyId: socket.companyId,
    role: socket.userRole,
  });

  try {
    const Tag = require('./src/models/Tag');
    const tags = await Tag.find({ companyId: socket.companyId, isActive: true });
    const edgeCache = edgeService.getTagCache(socket.companyId);

    const initialData = tags.map((tag) => {
      const cached = edgeCache[tag.tagName];
      return {
        tagName: tag.tagName,
        value: cached ? cached.value : tag.currentValue,
        quality: cached ? cached.quality : tag.quality,
        timestamp: cached ? cached.timestamp : tag.lastUpdated,
        source: cached ? 'edge' : 'db',
      };
    });

    socket.emit('initialTags', initialData);
    socket.emit('edgeStatus', {
      hasActiveGateway: edgeService.hasActiveGateway(socket.companyId),
      gateways: edgeService.getCompanyGateways(socket.companyId),
    });
  } catch (err) {
    console.error('Error sending initial tags:', err.message);
  }

  socket.on('writeTag', async (data) => {
    try {
      if (socket.userRole === 'viewer') {
        socket.emit('error', { message: 'Viewers cannot write tags' });
        return;
      }

      const Tag = require('./src/models/Tag');
      const query = { companyId: socket.companyId };
      if (data.tagId) query._id = data.tagId;
      else if (data.tagName) query.tagName = data.tagName;
      else return;

      const tag = await Tag.findOne(query);
      if (!tag) {
        socket.emit('error', { message: `Tag "${data.tagName || data.tagId}" not found` });
        return;
      }

      if (tag.accessType === 'READ_ONLY') {
        socket.emit('error', { message: `Tag "${tag.tagName}" is read-only` });
        return;
      }

      const hasEdge = edgeService.hasActiveGateway(socket.companyId);

      if (hasEdge && !tag.isSimulationTag) {
        const edgeForwarded = edgeService.forwardWriteCommand(
          socket.companyId,
          {
            tagId: tag._id.toString(),
            tagName: tag.tagName,
            address: tag.plcAddress,
            value: data.value,
            dataType: tag.dataType,
          },
          socket.id
        );

        if (edgeForwarded) {
          socket.emit('writeAck', {
            tagName: tag.tagName,
            status: 'pending',
            message: 'Write command sent via Edge Gateway',
          });
          return;
        }
      }

      await plcManager.writeTag(tag.plcConnection, tag, data.value);

      tag.currentValue = data.value;
      tag.lastUpdated = Date.now();
      await tag.save();

      io.to(`company:${socket.companyId}`).emit('tagsUpdate', [{
        tagName: tag.tagName,
        value: tag.currentValue,
        quality: tag.quality,
        timestamp: tag.lastUpdated,
        source: 'socket-write',
      }]);
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  socket.on('disconnect', (reason) => {
    console.log(`❌ Socket disconnected: ${socket.id}`);
  });
});

// ═══════════════════════════════════════════════════════════
// ERROR HANDLING & SHUTDOWN
// ═══════════════════════════════════════════════════════════
const { notFound, errorHandler } = require('./src/middleware/errorHandler');
app.use(notFound);
app.use(errorHandler);

process.on('SIGINT', async () => {
  try {
    plcManager.stopAll();
    alarmEngine.stop();
    timeService.stop();
    edgeService.stop();
    await closeInflux();
  } catch (e) { }
  process.exit(0);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 OnlineSCADA Server running on port ${PORT}`);
});
