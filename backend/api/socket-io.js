const socketIO = require('socket.io');
const { initRedisClient } = require('../utils/redis.client');
const socketHandler = require('../controllers/socket.controller');

let io = null;

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Get or create Socket.io instance
  if (!io) {
    try {
      const server = req.socket.server;

      if (!server._io) {
        io = socketIO(server, {
          cors: {
            origin: '*',
            methods: ['GET', 'POST'],
            credentials: false,
          },
          transports: ['polling', 'websocket'],
          upgradeTimeout: 10000,
          pingInterval: 25000,
          pingTimeout: 60000,
          maxHttpBufferSize: 1e6,
          allowEIO3: true,
        });

        server._io = io;

        // Initialize Redis
        try {
          initRedisClient();
        } catch (e) {
          console.warn('Redis init warning:', e.message);
        }

        // Initialize socket handlers
        try {
          socketHandler(io);
        } catch (e) {
          console.warn('Socket handler warning:', e.message);
        }

        console.log('✅ Socket.io initialized');
      } else {
        io = server._io;
      }
    } catch (error) {
      console.error('Socket.io initialization error:', error);
      return res.status(500).json({ error: 'Socket.io failed to initialize' });
    }
  }

  // Return status for HTTP requests
  return res.status(200).json({
    status: 'Socket.io server running',
    transports: ['polling', 'websocket'],
  });
};
