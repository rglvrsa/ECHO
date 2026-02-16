const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const config = require('./config/server.config');
const { initRedisClient, closeRedis } = require('./utils/redis.client');

const app = express();
const server = http.createServer(app);

// CORS configuration for production
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    const allowedOrigins = Array.isArray(config.CORS_ORIGIN)
      ? config.CORS_ORIGIN
      : [config.CORS_ORIGIN];

    if (allowedOrigins.includes(origin) || config.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
};

const io = socketIO(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
});

// Initialize Redis (will continue with in-memory if Redis unavailable)
initRedisClient();

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Trust proxy for production (needed behind load balancers)
if (config.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Import routes
const analysisRoutes = require('./routes/analysis.routes');

// API Routes
app.use('/api/analysis', analysisRoutes);

// Health check for production monitoring
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Server is running',
    environment: config.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'ECHO Backend API',
    version: '1.0.0',
    status: 'running'
  });
});

// Import socket handlers
const socketHandler = require('./controllers/socket.controller');
socketHandler(io);

// Start server
const HOST = '0.0.0.0';
server.listen(config.PORT, HOST, () => {
  console.log(`🚀 Server running on port ${config.PORT} (${config.NODE_ENV})`);
  console.log(`🔌 WebSocket server ready`);
  console.log(`💾 HYBRID: In-memory + Redis backup enabled`);
  console.log(`🤖 AI integration: HuggingFace Spaces (imagine-08-echo)`);
  console.log(`🌐 CORS origins: ${JSON.stringify(config.CORS_ORIGIN)}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await closeRedis();
  process.exit(0);
});

// Note: For Vercel serverless deployment, API routes are in /api folder
// This app.js is for local development only
if (process.env.NODE_ENV !== 'production') {
  module.exports = { app, io };
}
