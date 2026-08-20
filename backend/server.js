// ═══════════════════════════════════════════════════════════
// Server Entry Point — OnlineSCADA Backend (Multi-Tenant)
// ✅ FIXED: Socket.IO now authenticates + joins company room
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

// ═══════════════════════════════════════════════════════════
// APP + SERVER SETUP
// ═══════════════════════════════════════════════════════════
const app    = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  maxHttpBufferSize: 50 * 1024 * 1024,
});
// ─── LEADS route (public POST from landing site, super-admin GET/PUT/DELETE) ───
// Rate-limit lead creation to prevent spam
const leadsCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,                   // 10 lead submissions per IP per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many demo requests from this IP. Please wait an hour or contact us directly.',
  },
  // Apply only to POST /api/leads (not the super-admin GETs)
  skip: (req) => req.method !== 'POST',
});
app.use('/api/leads', leadsCreateLimiter);
app.use('/api/leads', require('./src/routes/leadsRoutes'));
// ═══════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════
// ✅ NEW: Allow landing site (CRA on 3000) + app (Vite on 5173) + production domain
const allowedOrigins = [
  'http://localhost:5173',    // App dev (Vite)
  'http://localhost:5174',    // App dev (alt port)
  'http://localhost:3000',    // Landing site dev (CRA default)
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'https://onlinescada.in',       // Landing site prod
  'https://www.onlinescada.in',   // Landing site prod (www)
  'https://app.onlinescada.in',   // App prod
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman)
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

app.use('/api', generalLimiter);
app.use('/api/workspace/verify',     authLimiter);
app.use('/api/workspace/login-user', authLimiter);
app.use('/api/super-admin/login',    authLimiter);
app.use('/api/auth/login',           authLimiter);
app.use('/api/tags/write',           writeLimiter);

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
// ✅ SOCKET.IO — MULTI-TENANT AUTHENTICATED
//
// Every socket connection MUST authenticate with a userToken.
// After auth, socket joins a room named "company:<companyId>".
// All broadcasts use io.to(`company:${companyId}`).emit(...)
// so users only receive events for THEIR company.
// ═══════════════════════════════════════════════════════════

// ─── Socket auth middleware (runs on every new connection) ───
io.use(async (socket, next) => {
  try {
    // Token can be passed via handshake.auth (preferred) or query (fallback)
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

    // ✅ Attach tenant context to socket
    socket.userId    = payload.userId;
    socket.companyId = String(payload.companyId);
    socket.userRole  = payload.role;

    next();
  } catch (err) {
    console.error('Socket auth error:', err.message);
    next(new Error('AUTH_FAILED'));
  }
});

// ─── Handle authenticated socket connections ───
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

  // ─── Send initial tags SCOPED to this user's company ───
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
    console.log(`   📦 Sent ${initialData.length} initial tags to ${socket.id}`);
  } catch (err) {
    console.error('Error sending initial tags:', err.message);
  }

  // ─── writeTag socket event — scoped to user's company ───
  socket.on('writeTag', async (data) => {
    try {
      // Viewers can't write
      if (socket.userRole === 'viewer') {
        socket.emit('error', { message: 'Viewers cannot write tags' });
        return;
      }

      const Tag = require('./src/models/Tag');
      // ✅ Scoped by companyId — user can't write to other companies' tags
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

      // ✅ Broadcast ONLY to this company's room
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

// ═══════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log(`║  🚀 OnlineSCADA Server running on port ${PORT}            ║`);
  console.log(`║  🌍 Environment: ${(process.env.NODE_ENV || 'development').padEnd(37)}║`);
  console.log(`║  🔗 URL: http://localhost:${PORT}                          ║`);
  console.log('║  🏢 Multi-Tenant Mode: ENABLED                         ║');
  console.log('║  🔒 Socket auth: REQUIRED (userToken)                  ║');
  console.log('║  🛡️  Rate limiting: enabled                            ║');
  console.log('║                                                        ║');
  console.log('║  Auth endpoints:                                        ║');
  console.log('║    POST /api/workspace/verify         (Step 1)         ║');
  console.log('║    POST /api/workspace/login-user     (Step 2)         ║');
  console.log('║    POST /api/super-admin/login        (Super Admin)    ║');
  console.log('╚════════════════════════════════════════════════════════╝');
});