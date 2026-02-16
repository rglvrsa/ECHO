/**
 * Redis Service Layer
 * Handles all Redis operations with fallback to in-memory
 * HYBRID APPROACH: Primary storage in-memory, Redis as backup for persistence
 */

const { getRedisClient, isRedisAvailable } = require('../utils/redis.client');
const redisConfig = require('../config/redis.config');

const { SESSION, MESSAGES, USER, WAITING } = redisConfig.keys;
const { SESSION: SESSION_TTL, MESSAGES: MESSAGES_TTL, DISCONNECTED_USER: USER_TTL } = redisConfig.ttl;

/**
 * Save session data to Redis (backup)
 * @param {string} sessionId - Session ID
 * @param {object} sessionData - Session data object
 */
const saveSession = async (sessionId, sessionData) => {
  if (!isRedisAvailable()) {
    console.log('⚠️  Redis unavailable, skipping session backup');
    return false;
  }

  try {
    const redis = getRedisClient();
    const key = `${SESSION}${sessionId}`;
    
    // Store as JSON string with TTL
    await redis.setex(key, SESSION_TTL, JSON.stringify(sessionData));
    console.log(`💾 Session ${sessionId} backed up to Redis`);
    return true;
  } catch (error) {
    console.error('❌ Error saving session to Redis:', error.message);
    return false;
  }
};

/**
 * Get session data from Redis
 * @param {string} sessionId - Session ID
 * @returns {object|null} Session data or null
 */
const getSession = async (sessionId) => {
  if (!isRedisAvailable()) {
    return null;
  }

  try {
    const redis = getRedisClient();
    const key = `${SESSION}${sessionId}`;
    const data = await redis.get(key);
    
    if (data) {
      console.log(`📥 Session ${sessionId} retrieved from Redis`);
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    console.error('❌ Error getting session from Redis:', error.message);
    return null;
  }
};

/**
 * Delete session from Redis
 * @param {string} sessionId - Session ID
 */
const deleteSession = async (sessionId) => {
  if (!isRedisAvailable()) {
    return false;
  }

  try {
    const redis = getRedisClient();
    await redis.del(`${SESSION}${sessionId}`);
    console.log(`🗑️  Session ${sessionId} deleted from Redis`);
    return true;
  } catch (error) {
    console.error('❌ Error deleting session from Redis:', error.message);
    return false;
  }
};

/**
 * Save chat messages to Redis (backup)
 * @param {string} sessionId - Session ID
 * @param {array} messages - Array of message objects
 */
const saveMessages = async (sessionId, messages) => {
  if (!isRedisAvailable() || !messages || messages.length === 0) {
    return false;
  }

  try {
    const redis = getRedisClient();
    const key = `${MESSAGES}${sessionId}`;
    
    // Store messages as JSON array
    await redis.setex(key, MESSAGES_TTL, JSON.stringify(messages));
    console.log(`💬 ${messages.length} messages backed up for session ${sessionId}`);
    return true;
  } catch (error) {
    console.error('❌ Error saving messages to Redis:', error.message);
    return false;
  }
};

/**
 * Get chat messages from Redis
 * @param {string} sessionId - Session ID
 * @returns {array} Array of messages or empty array
 */
const getMessages = async (sessionId) => {
  if (!isRedisAvailable()) {
    return [];
  }

  try {
    const redis = getRedisClient();
    const key = `${MESSAGES}${sessionId}`;
    const data = await redis.get(key);
    
    if (data) {
      const messages = JSON.parse(data);
      console.log(`📥 Retrieved ${messages.length} messages for session ${sessionId}`);
      return messages;
    }
    return [];
  } catch (error) {
    console.error('❌ Error getting messages from Redis:', error.message);
    return [];
  }
};

/**
 * Delete messages from Redis
 * @param {string} sessionId - Session ID
 */
const deleteMessages = async (sessionId) => {
  if (!isRedisAvailable()) {
    return false;
  }

  try {
    const redis = getRedisClient();
    await redis.del(`${MESSAGES}${sessionId}`);
    console.log(`🗑️  Messages deleted for session ${sessionId}`);
    return true;
  } catch (error) {
    console.error('❌ Error deleting messages from Redis:', error.message);
    return false;
  }
};

/**
 * Save disconnected user data for reconnection window
 * @param {string} userId - User ID
 * @param {object} userData - User reconnection data
 */
const saveDisconnectedUser = async (userId, userData) => {
  if (!isRedisAvailable()) {
    return false;
  }

  try {
    const redis = getRedisClient();
    const key = `${USER}${userId}`;
    
    // Short TTL for reconnection window
    await redis.setex(key, USER_TTL, JSON.stringify(userData));
    console.log(`⏰ User ${userId} reconnection data saved (${USER_TTL}s window)`);
    return true;
  } catch (error) {
    console.error('❌ Error saving disconnected user to Redis:', error.message);
    return false;
  }
};

/**
 * Get disconnected user data
 * @param {string} userId - User ID
 * @returns {object|null} User data or null
 */
const getDisconnectedUser = async (userId) => {
  if (!isRedisAvailable()) {
    return null;
  }

  try {
    const redis = getRedisClient();
    const key = `${USER}${userId}`;
    const data = await redis.get(key);
    
    if (data) {
      console.log(`📥 Disconnected user ${userId} data retrieved`);
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    console.error('❌ Error getting disconnected user from Redis:', error.message);
    return null;
  }
};

/**
 * Delete disconnected user data
 * @param {string} userId - User ID
 */
const deleteDisconnectedUser = async (userId) => {
  if (!isRedisAvailable()) {
    return false;
  }

  try {
    const redis = getRedisClient();
    await redis.del(`${USER}${userId}`);
    console.log(`🗑️  Disconnected user ${userId} data deleted`);
    return true;
  } catch (error) {
    console.error('❌ Error deleting disconnected user from Redis:', error.message);
    return false;
  }
};

/**
 * Clean up all data related to a session
 * @param {string} sessionId - Session ID
 */
const cleanupSession = async (sessionId) => {
  await deleteSession(sessionId);
  await deleteMessages(sessionId);
  console.log(`🧹 Cleaned up session ${sessionId} from Redis`);
};

module.exports = {
  saveSession,
  getSession,
  deleteSession,
  saveMessages,
  getMessages,
  deleteMessages,
  saveDisconnectedUser,
  getDisconnectedUser,
  deleteDisconnectedUser,
  cleanupSession
};
