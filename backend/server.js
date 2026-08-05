// ═══════════════════════════════════════════════════════════
// Server Entry Point — OnlineSCADA Backend
// ═══════════════════════════════════════════════════════════

// ⚠️ CRITICAL: dotenv MUST be loaded FIRST, before any other require()
const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

// ✅ T011: Rate limiter
const rateLimit = require('express-rate-limit');

const { initInflux, closeInflux, isInfluxAvailable } = require('./src/services/influxService');
const trendRoutes = require('./src/routes/trendRoutes');
const connectDB = require('./src/config/database');

// ═══════════════════════════════════════════════════════════
// APP + SERVER SETUP
// ═══════════════════════════════════════════════════════════
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  maxHttpBufferSize: 50 * 1024 * 1024,
});

// ═══════════════════════════════════════════════════════════
// MIDDLEWARE — MUST BE BEFORE ROUTES
// ═══════════════════════════════════════════════════════════
app.use(
  cors({
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ─── T011: Rate Limiters ───────────────────────────────────────────────────

// General API limit: 300 requests per minute per IP
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please slow down.',
  },
});

// Write limit: 60 tag writes per minute (1 per second average)
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Write rate limit exceeded. Max 60 writes per minute.',
  },
});

// Auth limit: 10 login attempts per 15 minutes (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts. Please wait 15 minutes.',
  },
});

// Apply general limiter to all routes
app.use('/api', generalLimiter);

// Apply auth limiter specifically to login
app.use('/api/auth/login', authLimiter);

// Apply write limiter to tag write endpoint
app.use('/api/tags/write', writeLimiter);

// Connect to MongoDB
connectDB();

// ═══════════════════════════════════════════════════════════
// API ROUTES
// ═══════════════════════════════════════════════════════════
app.use('/api/auth', require('./src/routes/authRoutes'));
app.use('/api/plc', require('./src/routes/plcRoutes'));
app.use('/api/tags', require('./src/routes/tagRoutes'));
app.use('/api/screens', require('./src/routes/screenRoutes'));
app.use('/api/alarms', require('./src/routes/alarmRoutes'));
app.use('/api/trends', trendRoutes);
app.use('/api/recipes', require('./src/routes/recipeRoutes'));
app.use('/api/users', require('./src/routes/userRoutes'));
app.use('/api/settings', require('./src/routes/settingsRoutes'));
app.use('/api/reports', require('./src/routes/reportRoutes'));  // ✅ Round 6
app.set('io', io);

// ═══════════════════════════════════════════════════════════
// SYSTEM ROUTES
// ═══════════════════════════════════════════════════════════
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🚀 OnlineSCADA Server is Running!',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    server: 'OnlineSCADA Backend',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    influxdb: typeof isInfluxAvailable === 'function' ? isInfluxAvailable() : 'unknown',
  });
});

// ═══════════════════════════════════════════════════════════
// SERVICE INITIALIZATION
// ═══════════════════════════════════════════════════════════
const plcManager = require('./src/services/plcManager');
plcManager.init(io);

const alarmEngine = require('./src/services/alarmEngine');
alarmEngine.init(io);

initInflux();

setTimeout(() => {
  plcManager.startAll();
}, 3000);

// ═══════════════════════════════════════════════════════════
// SOCKET.IO EVENTS
// ═══════════════════════════════════════════════════════════
io.on('connection', async (socket) => {
  console.log(`🔌 New client connected: ${socket.id}`);

  socket.emit('welcome', {
    message: 'Connected to OnlineSCADA Server',
    socketId: socket.id,
  });

  try {
    const Tag = require('./src/models/Tag');
    const tags = await Tag.find({ isActive: true });
    const initialData = tags.map((tag) => ({
      tagName: tag.tagName,
      value: tag.currentValue,
      quality: tag.quality,
      timestamp: tag.lastUpdated,
    }));
    socket.emit('initialTags', initialData);
  } catch (err) {
    console.error('Error sending initial tags:', err.message);
  }

  socket.on('writeTag', async (data) => {
    try {
      const Tag = require('./src/models/Tag');
      const tag = await Tag.findOne({ tagName: data.tagName });
      if (tag) {
        tag.currentValue = data.value;
        tag.lastUpdated = Date.now();
        await tag.save();
        io.emit('tagsUpdate', [
          {
            tagName: tag.tagName,
            value: tag.currentValue,
            quality: tag.quality,
            timestamp: tag.lastUpdated,
          },
        ]);
      }
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
  });
});

// ═══════════════════════════════════════════════════════════
// ERROR HANDLING (must be LAST — after all routes)
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
  console.log('========================================');
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 URL: http://localhost:${PORT}`);
  console.log(`🛡️  Rate limiting: enabled`);
  console.log('========================================');
});