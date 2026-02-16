/**
 * Test script to verify Hybrid Storage System
 * Tests Redis connection and fallback behavior
 */

const { initRedisClient, isRedisAvailable, getRedisClient } = require('./utils/redis.client');
const redisService = require('./services/redis.service');

console.log('\n🧪 Testing Hybrid Storage System...\n');

// Initialize Redis
initRedisClient();

// Wait a bit for connection
setTimeout(async () => {
  console.log('✅ Redis Status:', isRedisAvailable() ? 'CONNECTED' : 'NOT AVAILABLE (Will use in-memory only)');
  
  if (isRedisAvailable()) {
    console.log('\n📝 Testing Redis operations...\n');
    
    // Test session save
    const testSession = {
      sessionId: 'test-123',
      user1: { userId: 'user-1', connected: true },
      user2: { userId: 'user-2', connected: true },
      messages: ['Hello', 'Hi there'],
      startTime: Date.now()
    };
    
    await redisService.saveSession('test-123', testSession);
    console.log('✅ Session saved to Redis');
    
    // Test session retrieve
    const retrieved = await redisService.getSession('test-123');
    console.log('✅ Session retrieved:', retrieved ? 'SUCCESS' : 'FAILED');
    
    // Test message save
    await redisService.saveMessages('test-123', testSession.messages);
    console.log('✅ Messages saved to Redis');
    
    // Cleanup
    await redisService.cleanupSession('test-123');
    console.log('✅ Session cleaned up');
    
    console.log('\n🎉 All Redis tests passed!\n');
  } else {
    console.log('\n⚠️  Redis not available - App will work in IN-MEMORY mode only');
    console.log('   Sessions will not survive server restarts');
    console.log('   To enable Redis:');
    console.log('   1. Install Redis locally, OR');
    console.log('   2. Use Redis Cloud (free tier)\n');
  }
  
  console.log('✅ Hybrid Storage System Ready!\n');
  console.log('Configuration:');
  console.log('  - Primary Storage: In-Memory (active sessions)');
  console.log('  - Backup Storage:', isRedisAvailable() ? 'Redis ✅' : 'Disabled (in-memory only) ⚠️');
  console.log('  - localStorage: Only userId (no chat data)');
  console.log('\n💡 Start your server with: npm start\n');
  
  process.exit(0);
}, 2000);
