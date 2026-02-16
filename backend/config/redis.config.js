/**
 * Redis Configuration
 * For local development and production
 */

module.exports = {
  // Enable/disable Redis integration. Set REDIS_ENABLED=true to enable.
  enabled: process.env.REDIS_ENABLED === 'true',

  // Redis connection settings
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: process.env.REDIS_DB || 0,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    maxRetriesPerRequest: 3
  },

  // TTL (Time To Live) settings in seconds
  ttl: {
    SESSION: 60 * 60,           // 1 hour - active session data
    MESSAGES: 60 * 60,          // 1 hour - chat messages
    DISCONNECTED_USER: 30,      // 30 seconds - reconnection window
    WAITING_USER: 5 * 60        // 5 minutes - waiting in queue
  },

  // Key prefixes for organization
  keys: {
    SESSION: 'session:',
    MESSAGES: 'messages:',
    USER: 'user:',
    WAITING: 'waiting:queue'
  }
};
