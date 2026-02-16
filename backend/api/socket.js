const socketIO = require('socket.io');
const { initRedisClient } = require('../utils/redis.client');
const socketHandler = require('../controllers/socket.controller');
const config = require('../config/server.config');

let io = null;

module.exports = (req, res) => {
  // For WebSocket upgrade requests
  if (req.headers.upgrade && req.headers.upgrade.toLowerCase() === 'websocket') {
    // Let the WebSocket handler take over
    if (io) {
      // Socket.io will handle this
      return;
    }
  }

  // Initialize Socket.io on first request
  if (!io) {
    const server = req.socket.server;

    if (!server.io) {
      const corsOptions = {
        origin: (origin, callback) => {
          // Allow all origins for development/testing
          callback(null, true);
        },
        methods: ['GET', 'POST'],
        credentials: true,
        transports: ['websocket', 'polling'],
        allowEIO3: true,
      };

      io = socketIO(server, corsOptions);
      server.io = io;

      // Initialize Redis
      initRedisClient();

      // Initialize socket handlers
      socketHandler(io);

      console.log('🔌 Socket.io server initialized on Vercel');
    } else {
      io = server.io;
    }
  }

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Return status for HTTP requests
  return res.status(200).json({
    status: 'Socket.io server running',
    message: 'Connect via WebSocket'
  });
};

