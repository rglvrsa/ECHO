/**
 * Redis Client Singleton
 * Manages Redis connection with automatic reconnection
 */

const Redis = require('ioredis');
const redisConfig = require('../config/redis.config');

let redisClient = null;

/**
 * Initialize Redis client (only if enabled)
 * @returns {Redis|null} Redis client instance or null if disabled
 */
const initRedisClient = () => {
  if (redisClient) {
    return redisClient;
  }

  // If Redis integration is disabled via config/env, don't attempt to connect.
  if (!redisConfig.enabled) {
    console.log('⚠️  Redis is disabled (set REDIS_ENABLED=true to enable). Skipping connection.');
    return null;
  }

  redisClient = new Redis(redisConfig.redis);

  redisClient.on('connect', () => {
    console.log('✅ Redis connected successfully');
  });

  redisClient.on('error', (err) => {
    // Log errors but don't crash the application. Keep messages concise.
    console.error('❌ Redis connection error:', err.message);
  });

  redisClient.on('ready', () => {
    console.log('🚀 Redis client ready');
  });

  redisClient.on('reconnecting', () => {
    console.log('🔄 Redis reconnecting...');
  });

  return redisClient;
};

/**
 * Get Redis client instance
 * @returns {Redis|null} Redis client or null if not connected or disabled
 */
const getRedisClient = () => {
  if (!redisClient) {
    return initRedisClient();
  }
  return redisClient;
};

/**
 * Check if Redis is available
 * @returns {boolean} True if Redis is connected
 */
const isRedisAvailable = () => {
  return redisClient && redisClient.status === 'ready';
};

/**
 * Close Redis connection gracefully
 */
const closeRedis = async () => {
  if (redisClient) {
    try {
      await redisClient.quit();
      console.log('👋 Redis connection closed');
    } catch (err) {
      console.warn('⚠️ Error while closing Redis connection:', err.message);
    }
  }
};

module.exports = {
  initRedisClient,
  getRedisClient,
  isRedisAvailable,
  closeRedis
};
