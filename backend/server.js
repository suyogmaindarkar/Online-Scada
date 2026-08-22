// ═══════════════════════════════════════════════════════════
// Server Entry Point — OnlineSCADA Backend (Multi-Tenant)
// ✅ FIXED: Added trust proxy for Render / Reverse Proxy support
// ═══════════════════════════════════════════════════════════

const dotenv = require('dotenv');
dotenv.config();

const express   = require('express');
const http      = require('http');
const cors      = require('cors');
const jwt       = require('jsonwebtoken');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');

const { initInflux, closeInflux, isInfluxAvailable } = require('./src/services/influxService');
const trendRoutes = require('./src/routes/trendRoutes');
const connectDB   = require('./src/config/database');

const app    = express();
const server = http.createServer(app);

// ✅ Enable trust proxy for Render/Cloudflare/Vercel reverse proxies
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
      console.warn(`⚠️  CORS blocked origin: ${origin}`);
      return callback(new Error(`CORS: origin ${origin} not allowed`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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
app.use('/api/workspace/verify',     authLimiter);
app.use('/api/workspace/login-user', authLimiter);
app.use('/api/super-admin/login',    authLimiter);
app.use('/api/auth/login',           authLimiter);
app.use('/api/tags/write',           writeLimiter);
app.use('/api/signup',               signupLimiter);

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
app.use('/api/workspace',   require('./src/routes/workspaceRoutes'));
app.use('/api/super-admin', require('./src/routes/superAdminRoutes'));
app.use('/api/auth',        require('./src/routes/authRoutes'));
app.use('/api/plc',         require('./src/routes/plcRoutes'));
app.use('/api/tags',        require('./src/routes/tagRoutes'));
app.use('/api/screens',     require('./src/routes/screenRoutes'));
app.use('/api/alarms',      require('./src/routes/alarmRoutes'));
app.use('/api/trends',      trendRoutes);
app.use('/api/recipes',     require('./src/routes/recipeRoutes'));
app.use('/api/users',       require('./src/routes/userRoutes'));
app.use('/api/settings',    require('./src/routes/settingsRoutes'));
app.use('/api/reports',     require('./src/routes/reportRoutes'));
app.use('/api/discovery',   require('./src/routes/discoveryRoutes'));
app.use('/api/leads',       require('./src/routes/leadsRoutes'));
app.use('/api/signup',      require('./src/routes/signupRoutes'));

app.set('io', io);

// ═══════════════════════════════════════════════════════════
// SYSTEM ROUTES
// ═══════════════════════════════════════════════════════════
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🚀 OnlineSCADA Server (Multi-Tenant) is Running!',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status:   'OK',
    server:   'OnlineSCADA Backend',
    uptime:   process.uptime(),
    memory:   process.memoryUsage(),
    influxdb: typeof isInfluxAvailable === 'function' ? isInfluxAvailable() : 'unknown',
  });
});

// ═══════════════════════════════════════════════════════════
// SERVICE INITIALIZATION
// ═══════════════════════════════════════════════════════════
const plcManager  = require('./src/services/plcManager');
plcManager.init(io);

const alarmEngine = require('./src/services/alarmEngine');
alarmEngine.init(io);

const timeService = require('./src/services/timeService');
timeService.init(io);

initInflux();

setTimeout(() => {
  plcManager.startAll();
}, 3000);

// ═══════════════════════════════════════════════════════════
// SOCKET.IO — MULTI-TENANT AUTHENTICATED
// ═══════════════════════════════════════════════════════════
io.use(async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.query?.token;

    if (!token) {
      console.warn(`🔒 Socket ${socket.id} rejected — no auth token`);
      return next(new Error('AUTH_REQUIRED'));
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      console.warn(`🔒 Socket ${socket.id} rejected — invalid token: ${err.message}`);
      return next(new Error('AUTH_INVALID'));
    }

    if (payload.type !== 'user') {
      console.warn(`🔒 Socket ${socket.id} rejected — wrong token type: ${payload.type}`);
      return next(new Error('WRONG_TOKEN_TYPE'));
    }

    socket.userId    = payload.userId;
    socket.companyId = String(payload.companyId);
    socket.userRole  = payload.role;

    next();
  } catch (err) {
    console.error('Socket auth error:', err.message);
    next(new Error('AUTH_FAILED'));
  }
});

io.on('connection', async (socket) => {
  const companyRoom = `company:${socket.companyId}`;
  socket.join(companyRoom);

  console.log(`🔌 Socket connected: ${socket.id} | company=${socket.companyId} | role=${socket.userRole}`);

  socket.emit('welcome', {
    message:   'Connected to OnlineSCADA Server',
    socketId:  socket.id,
    companyId: socket.companyId,
    role:      socket.userRole,
  });

  try {
    const Tag = require('./src/models/Tag');
    const tags = await Tag.find({
      companyId: socket.companyId,
      isActive:  true,
    });
    const initialData = tags.map((tag) => ({
      tagName:   tag.tagName,
      value:     tag.currentValue,
      quality:   tag.quality,
      timestamp: tag.lastUpdated,
    }));
    socket.emit('initialTags', initialData);
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
      const tag = await Tag.findOne({
        companyId: socket.companyId,
        tagName:   data.tagName,
      });

      if (!tag) {
        socket.emit('error', { message: `Tag "${data.tagName}" not found in your workspace` });
        return;
      }

      tag.currentValue = data.value;
      tag.lastUpdated  = Date.now();
      await tag.save();

      io.to(companyRoom).emit('tagsUpdate', [{
        tagName:   tag.tagName,
        value:     tag.currentValue,
        quality:   tag.quality,
        timestamp: tag.lastUpdated,
      }]);
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  socket.on('disconnect', (reason) => {
    console.log(`❌ Socket disconnected: ${socket.id} | company=${socket.companyId} | reason=${reason}`);
  });
});

// ═══════════════════════════════════════════════════════════
// ERROR HANDLING
// ═══════════════════════════════════════════════════════════
const { notFound, errorHandler } = require('./src/middleware/errorHandler');
app.use(notFound);
app.use(errorHandler);

// ═══════════════════════════════════════════════════════════
// GRACEFUL SHUTDOWN
// ═══════════════════════════════════════════════════════════
process.on('SIGINT', async () => {
  console.log('\n⏹️  Shutting down server...');
  try {
    plcManager.stopAll();
    alarmEngine.stop();
    timeService.stop();
    await closeInflux();
  } catch (e) {
    console.error('Shutdown error:', e.message);
  }
  process.exit(0);
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log(`║  🚀 OnlineSCADA Server running on port ${PORT}            ║`);
  console.log(`║  🌍 Environment: ${(process.env.NODE_ENV || 'development').padEnd(37)}║`);
  console.log(`║  🔗 URL: http://localhost:${PORT}                          ║`);
  console.log('║  🏢 Multi-Tenant Mode: ENABLED                         ║');
  console.log('║  🔒 Socket auth: REQUIRED (userToken)                  ║');
  console.log('╚════════════════════════════════════════════════════════╝');
});