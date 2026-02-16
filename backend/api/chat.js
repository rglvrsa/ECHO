const { v4: uuidv4 } = require('uuid');

// In-memory storage for this serverless instance
const activeChats = new Map(); // sessionId -> { user1, user2, messages, createdAt }
const waitingUsers = []; // Users waiting for match
const userSessions = new Map(); // userId -> sessionId

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action, userId, sessionId, message, userProfile } = req.body || {};

  try {
    // Start a chat - finds a match or waits
    if (action === 'start-chat') {
      const newUserId = userId || uuidv4();
      
      // Try to find a waiting user
      if (waitingUsers.length > 0) {
        const partner = waitingUsers.shift();
        const newSessionId = uuidv4();
        
        activeChats.set(newSessionId, {
          user1: newUserId,
          user2: partner,
          messages: [],
          createdAt: Date.now(),
          user1Profile: userProfile,
        });
        
        userSessions.set(newUserId, newSessionId);
        userSessions.set(partner, newSessionId);
        
        return res.json({
          status: 'matched',
          sessionId: newSessionId,
          userId: newUserId,
          partnerId: partner,
        });
      } else {
        // No match available, add to waiting
        waitingUsers.push(newUserId);
        userSessions.set(newUserId, null);
        
        return res.json({
          status: 'waiting',
          userId: newUserId,
          message: 'Waiting for a match...',
        });
      }
    }

    // Send message
    if (action === 'send-message') {
      const chat = activeChats.get(sessionId);
      if (!chat) {
        return res.status(404).json({ error: 'Chat session not found' });
      }

      const msg = {
        id: uuidv4(),
        senderId: userId,
        content: message,
        timestamp: Date.now(),
      };

      chat.messages.push(msg);

      return res.json({
        success: true,
        message: msg,
      });
    }

    // Get messages
    if (action === 'get-messages') {
      const chat = activeChats.get(sessionId);
      if (!chat) {
        return res.status(404).json({ error: 'Chat session not found' });
      }

      return res.json({
        messages: chat.messages,
        partnerId: chat.user1 === userId ? chat.user2 : chat.user1,
      });
    }

    // Poll for match
    if (action === 'poll-match') {
      const sessionId = userSessions.get(userId);
      
      if (sessionId) {
        const chat = activeChats.get(sessionId);
        return res.json({
          matched: true,
          sessionId: sessionId,
          partnerId: chat.user1 === userId ? chat.user2 : chat.user1,
        });
      } else {
        return res.json({
          matched: false,
          message: 'Still waiting for a match...',
        });
      }
    }

    // Get user count (approximate)
    if (action === 'get-user-count') {
      const totalUsers = waitingUsers.length + (activeChats.size * 2);
      return res.json({
        count: totalUsers,
        waiting: waitingUsers.length,
        inChats: activeChats.size,
      });
    }

    // Skip/disconnect
    if (action === 'skip') {
      const sessionId = userSessions.get(userId);
      
      if (sessionId && activeChats.has(sessionId)) {
        activeChats.delete(sessionId);
      }
      
      userSessions.delete(userId);
      
      return res.json({
        success: true,
        message: 'Disconnected',
      });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (error) {
    console.error('Chat API Error:', error);
    return res.status(500).json({ error: error.message });
  }
};
