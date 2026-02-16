const { v4: uuidv4 } = require('uuid');
const redisService = require('../services/redis.service');
const matchingService = require('../services/matching.service');

/**
 * Socket.IO Controller - HYBRID STORAGE
 * Primary: In-memory (fast access for active sessions)
 * Backup: Redis (persistence for reconnection & recovery)
 */

// In-memory storage (PRIMARY - for active sessions)
const waitingUsers = []; // Users waiting to be matched
const waitingUsersSmartMatch = []; // Users waiting for smart match (with profiles)
const activeSessions = new Map(); // sessionId -> { user1, user2, room, messages, startTime, messageCount, user1Profile, user2Profile, matchInfo }
const userSessions = new Map(); // socketId -> sessionId
const connectedUsers = new Set(); // Set of all connected socket IDs
const userIdToSocketId = new Map(); // userId -> socketId (for reconnection)
const disconnectedUsers = new Map(); // userId -> { sessionId, disconnectTime } (30 second window)
const readyStatus = new Map(); // sessionId -> { user1Ready, user2Ready } - for WebRTC negotiation
const smartMatchTimers = new Map(); // socketId -> { timer, startTime, expiresAt } - 15 second timer for smart match

module.exports = (io) => {
  
  // Helper function to broadcast user count
  const broadcastUserCount = () => {
    const count = connectedUsers.size;
    io.emit('user-count', { count });
    console.log(`👥 Online users: ${count}`);
  };

  io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.id}`);
    
    // Add to connected users
    connectedUsers.add(socket.id);
    broadcastUserCount();

    /**
     * Client requests current user count
     */
    socket.on('get-user-count', () => {
      socket.emit('user-count', { count: connectedUsers.size });
    });

    /**
     * User requests to start chatting (Anonymous mode)
     * Generates anonymous user ID and tries to match with another user
     */
    socket.on('start-chat', () => {
      const userId = uuidv4();
      socket.userId = userId;

      console.log(`👤 User ${userId} looking for anonymous match...`);

      // Remove any stale duplicate entries for this socket from the waiting queue
      const existingIndex = waitingUsers.findIndex(s => s.id === socket.id);
      if (existingIndex !== -1) {
        waitingUsers.splice(existingIndex, 1);
      }

      // Find a waiting partner that is not the same socket and is still connected
      const partnerIndex = waitingUsers.findIndex(s => s.id !== socket.id && s.connected);

      if (partnerIndex !== -1) {
        const partnerSocket = waitingUsers.splice(partnerIndex, 1)[0];
        createMatchSession(socket, partnerSocket, null, null);
      } else {
        // No match available, add to waiting queue (if not already present)
        const alreadyWaiting = waitingUsers.findIndex(s => s.id === socket.id) !== -1;
        if (!alreadyWaiting) {
          waitingUsers.push(socket);
          socket.emit('waiting', { userId });
          console.log(`⏳ User ${userId} added to anonymous waiting queue (length=${waitingUsers.length})`);
        } else {
          // Already waiting - re-emit waiting state
          socket.emit('waiting', { userId });
          console.log(`⏳ User ${userId} already in anonymous waiting queue (length=${waitingUsers.length})`);
        }
      }
    });

    /**
     * User requests to start smart match chat
     * Includes profile: college (optional), city (required), interests (required)
     * Waits up to 15 seconds for best match based on common interests/city
     * Only matches with other smart match users, NEVER falls back to anonymous
     */
    socket.on('start-smart-match', (data) => {
      const { userProfile } = data;
      const userId = uuidv4();
      socket.userId = userId;
      socket.userProfile = userProfile;
      socket.isSmartMatchUser = true; // Mark as smart match user

      console.log(`🧠 User ${userId} starting smart match`);
      console.log(`   Received data:`, data);
      console.log(`   userProfile:`, userProfile);
      console.log(`   Profile details: city="${userProfile?.city}", college="${userProfile?.college}", interests=[${userProfile?.interests?.join(',')}]`);

      // Validate profile
      if (!matchingService.isValidSmartMatchProfile(userProfile)) {
        socket.emit('error', { message: 'Invalid profile: city and interests are required' });
        return;
      }

      // Remove from any existing queues
      let existingIndex = waitingUsersSmartMatch.findIndex(s => s.id === socket.id);
      if (existingIndex !== -1) {
        clearTimeout(smartMatchTimers.get(socket.id)?.timer);
        smartMatchTimers.delete(socket.id);
        waitingUsersSmartMatch.splice(existingIndex, 1);
      }

      // Remove from anonymous queue if present
      const anonIndex = waitingUsers.findIndex(s => s.id === socket.id);
      if (anonIndex !== -1) {
        waitingUsers.splice(anonIndex, 1);
      }

      // Try to find best match immediately from EXISTING smart match users
      const bestMatch = matchingService.findBestMatch(
        waitingUsersSmartMatch,
        socket.id,
        userProfile
      );

      if (bestMatch && bestMatch.matchScore >= 40) {
        // Good match found, create session immediately
        console.log(`🎯 Immediate smart match found! Score: ${bestMatch.matchScore}%`);
        const partnerSocket = bestMatch.socket;
        console.log(`   Partner profile: city="${partnerSocket.userProfile?.city}", college="${partnerSocket.userProfile?.college}", interests=[${partnerSocket.userProfile?.interests?.join(',')}]`);
        
        // Remove partner from waiting queue
        const partnerIndex = waitingUsersSmartMatch.findIndex(s => s.id === partnerSocket.id);
        if (partnerIndex !== -1) {
          waitingUsersSmartMatch.splice(partnerIndex, 1);
        }

        // Clear partner's timer
        if (smartMatchTimers.has(partnerSocket.id)) {
          clearTimeout(smartMatchTimers.get(partnerSocket.id).timer);
          smartMatchTimers.delete(partnerSocket.id);
        }

        console.log(`✅ Creating match session with score ${bestMatch.matchScore}%, commonInterests:`, bestMatch.commonInterests);
        createMatchSession(
          socket,
          partnerSocket,
          userProfile,
          partnerSocket.userProfile,
          bestMatch.commonInterests,
          bestMatch.matchScore
        );
      } else {
        // No good match available - immediately notify user and don't match with anonymous
        console.log(`❌ No good smart match found for user ${userId}. Telling user to try again.`);
        
        socket.emit('smart-match-no-match', {
          userId,
          reason: 'No suitable match found. Try again later or try anonymous chat.'
        });
        console.log(`⏳ User ${userId} notified - no match found for smart matching`);
      }
    });

    /**
     * User attempts to reconnect to existing session
     * Check if they have a disconnected session within reconnection window
     */
    socket.on('reconnect-session', async (data) => {
      const { userId } = data;
      
      if (!userId) return;

      // Check if user has a pending disconnection (in-memory first)
      let disconnectInfo = disconnectedUsers.get(userId);
      
      // 💾 HYBRID: If not in memory, check Redis backup
      if (!disconnectInfo) {
        disconnectInfo = await redisService.getDisconnectedUser(userId);
      }
      
      if (!disconnectInfo) {
        socket.emit('reconnect-failed', { reason: 'No session to reconnect to' });
        return;
      }

      const { sessionId, disconnectTime } = disconnectInfo;
      
      // Try to get session from memory first
      let session = activeSessions.get(sessionId);
      
      // 💾 HYBRID: If not in memory, try Redis backup
      if (!session) {
        session = await redisService.getSession(sessionId);
        if (session) {
          // Restore to in-memory
          activeSessions.set(sessionId, session);
          console.log(`📥 Session ${sessionId} restored from Redis`);
        }
      }

      // Check if session still exists and within 30 second window
      if (!session || Date.now() - disconnectTime > 30000) {
        disconnectedUsers.delete(userId);
        await redisService.deleteDisconnectedUser(userId);
        socket.emit('reconnect-failed', { reason: 'Session expired' });
        return;
      }

      // Reconnect user to session
      socket.userId = userId;
      const isUser1 = session.user1.userId === userId;
      
      if (isUser1) {
        session.user1.socketId = socket.id;
        session.user1.connected = true;
      } else {
        session.user2.socketId = socket.id;
        session.user2.connected = true;
      }

      socket.join(session.room);
      userSessions.set(socket.id, sessionId);
      userIdToSocketId.set(userId, socket.id);
      disconnectedUsers.delete(userId);
      await redisService.deleteDisconnectedUser(userId);

      // 💾 HYBRID: Update session in Redis
      redisService.saveSession(sessionId, session).catch(err => 
        console.error('Redis update failed:', err.message)
      );

      // Get partner info
      const partner = isUser1 ? session.user2 : session.user1;
      const partnerSocketId = userIdToSocketId.get(partner.userId);

      console.log(`🔄 User ${userId} reconnected to session ${sessionId}`);

      // Send session data to reconnected user
      socket.emit('session-reconnected', {
        sessionId,
        userId,
        partnerId: partner.userId,
        messages: session.messages,
        partnerConnected: partner.connected
      });

      // Notify partner that user reconnected
      if (partnerSocketId && partner.connected) {
        io.to(partnerSocketId).emit('partner-reconnected');
      }
    });

    /**
     * User sends a message
     * Relay message to partner in the same room
     */
    socket.on('send-message', (data) => {
      const { message, imageData, gifData, fileName } = data;
      const sessionId = userSessions.get(socket.id);

      if (!sessionId) {
        socket.emit('error', { message: 'No active session' });
        return;
      }

      const session = activeSessions.get(sessionId);
      if (!session) {
        socket.emit('error', { message: 'Session not found' });
        return;
      }

      // Increment message count
      session.messageCount++;

      const messageData = {
        messageId: uuidv4(),
        senderId: socket.userId,
        message,
        imageData,
        gifData,
        fileName,
        timestamp: Date.now()
      };

      // Store message for reconnection
      session.messages.push(messageData);

      // 💾 HYBRID: Backup messages to Redis (non-blocking)
      redisService.saveMessages(sessionId, session.messages).catch(err => 
        console.error('Redis message backup failed:', err.message)
      );

      // Send message ONLY to partner (not to sender - they already added it locally)
      socket.to(session.room).emit('receive-message', messageData);

      const logMessage = imageData ? '[Photo]' : gifData ? '[GIF]' : message.substring(0, 30);
      console.log(`💬 Message in session ${sessionId}: ${logMessage}...`);

      // 🤖 AI Integration Point: Message analysis
      // TODO: Call AI message analysis endpoint (non-blocking)
      // analyzeMessage(sessionId, messageData);
    });

    /**
     * User wants to skip current chat
     * End current session and look for new match
     */
    socket.on('skip-chat', () => {
      const sessionId = userSessions.get(socket.id);
      
      if (sessionId) {
        endSession(sessionId, socket.id, 'skip');
      }

      // Start new search immediately
      socket.emit('chat-ended', { reason: 'skip' });
      
      // Automatically trigger new match search
      setTimeout(() => {
        socket.emit('start-chat');
      }, 500);
    });

    /**
     * User requests video call
     * Send request to partner for consent
     */
    socket.on('request-video', () => {
      const sessionId = userSessions.get(socket.id);
      
      if (!sessionId) {
        socket.emit('error', { message: 'No active session' });
        return;
      }

      const session = activeSessions.get(sessionId);
      const partnerId = getPartnerId(session, socket.id);

      console.log(`📹 Video call requested in session ${sessionId}`);

      // Send request to partner
      io.to(partnerId).emit('video-call-request', {
        requesterId: socket.userId
      });
    });

    /**
     * User accepts video call
     * Both users can now start WebRTC connection
     */
    socket.on('accept-video', () => {
      const sessionId = userSessions.get(socket.id);
      
      if (!sessionId) return;

      const session = activeSessions.get(sessionId);
      const partnerId = getPartnerId(session, socket.id);

      console.log(`✅ Video call accepted in session ${sessionId}`);

      // Notify both users to start video
      io.to(session.room).emit('video-call-accepted', {
        sessionId,
        partnerId
      });
    });

    /**
     * User rejects video call
     */
    socket.on('reject-video', () => {
      const sessionId = userSessions.get(socket.id);
      
      if (!sessionId) return;

      const session = activeSessions.get(sessionId);
      const partnerId = getPartnerId(session, socket.id);

      console.log(`❌ Video call rejected in session ${sessionId}`);

      // Notify requester
      io.to(partnerId).emit('video-call-rejected');
    });

    /**
     * User signals they are ready for video call
     * Tracks ready status and determines who creates the offer
     */
    socket.on('video-ready', (data) => {
      console.log(`🎬 Received video-ready from socket ${socket.id}:`, data);
      const sessionId = data.sessionId;
      const session = activeSessions.get(sessionId);
      
      if (!session) {
        console.error(`❌ Session ${sessionId} not found for video-ready`);
        return;
      }

      // Track which user is ready
      if (!readyStatus.has(sessionId)) {
        readyStatus.set(sessionId, { user1Ready: false, user2Ready: false });
      }

      const status = readyStatus.get(sessionId);
      const isUser1 = session.user1.socketId === socket.id;
      
      if (isUser1) {
        status.user1Ready = true;
      } else {
        status.user2Ready = true;
      }

      console.log(`📡 User ${isUser1 ? 'User1' : 'User2'} ready for video in session ${sessionId}:`, status);

      // If both are ready, signal who should create the offer
      if (status.user1Ready && status.user2Ready) {
        // User1 will create the offer, User2 will wait for it
        console.log(`✅ Both users ready! Sending start-offer to user1 (${session.user1.socketId}) and wait-for-offer to user2 (${session.user2.socketId})`);
        
        io.to(session.user1.socketId).emit('start-offer', {
          sessionId,
          role: 'offerer'
        });
        
        io.to(session.user2.socketId).emit('wait-for-offer', {
          sessionId,
          role: 'answerer'
        });

        console.log(`✅ Both users ready! User1 will create offer, User2 will answer`);
      }
    });

    /**
     * WebRTC Signaling: Video Offer
     */
    socket.on('video-offer', (data) => {
      const sessionId = userSessions.get(socket.id);
      
      if (!sessionId) return;

      const session = activeSessions.get(sessionId);
      const partnerId = getPartnerId(session, socket.id);

      console.log(`📹 Sending video offer from ${socket.userId} to ${partnerId}`);

      io.to(partnerId).emit('video-offer', {
        offer: data.offer,
        senderId: socket.userId
      });
    });

    /**
     * WebRTC Signaling: Video Answer
     */
    socket.on('video-answer', (data) => {
      const sessionId = userSessions.get(socket.id);
      
      if (!sessionId) return;

      const session = activeSessions.get(sessionId);
      const partnerId = getPartnerId(session, socket.id);

      console.log(`📹 Sending video answer from ${socket.userId} to ${partnerId}`);

      io.to(partnerId).emit('video-answer', {
        answer: data.answer,
        senderId: socket.userId
      });
    });

    /**
     * WebRTC Signaling: ICE Candidate
     */
    socket.on('ice-candidate', (data) => {
      const sessionId = userSessions.get(socket.id);
      
      if (!sessionId) return;

      const session = activeSessions.get(sessionId);
      const partnerId = getPartnerId(session, socket.id);

      io.to(partnerId).emit('ice-candidate', {
        candidate: data.candidate,
        senderId: socket.userId
      });
    });

    /**
     * WebRTC Signaling: Offer (Legacy - keeping for compatibility)
     */
    socket.on('webrtc-offer', (data) => {
      const sessionId = userSessions.get(socket.id);
      
      if (!sessionId) return;

      const session = activeSessions.get(sessionId);
      const partnerId = getPartnerId(session, socket.id);

      io.to(partnerId).emit('webrtc-offer', {
        offer: data.offer,
        senderId: socket.userId
      });
    });

    /**
     * WebRTC Signaling: Answer
     */
    socket.on('webrtc-answer', (data) => {
      const sessionId = userSessions.get(socket.id);
      
      if (!sessionId) return;

      const session = activeSessions.get(sessionId);
      const partnerId = getPartnerId(session, socket.id);

      io.to(partnerId).emit('webrtc-answer', {
        answer: data.answer,
        senderId: socket.userId
      });
    });

    /**
     * WebRTC Signaling: ICE Candidate
     */
    socket.on('webrtc-ice-candidate', (data) => {
      const sessionId = userSessions.get(socket.id);
      
      if (!sessionId) return;

      const session = activeSessions.get(sessionId);
      const partnerId = getPartnerId(session, socket.id);

      io.to(partnerId).emit('webrtc-ice-candidate', {
        candidate: data.candidate,
        senderId: socket.userId
      });
    });

    /**
     * User disconnects
     * Don't end session immediately - allow 30 second reconnection window
     */
    socket.on('disconnect', () => {
      console.log(`❌ User disconnected: ${socket.id}`);

      // Remove from connected users
      connectedUsers.delete(socket.id);
      broadcastUserCount();

      // Clean up smart match timer if exists
      if (smartMatchTimers.has(socket.id)) {
        clearTimeout(smartMatchTimers.get(socket.id).timer);
        smartMatchTimers.delete(socket.id);
      }

      // Remove from anonymous waiting queue if present
      const waitingIndex = waitingUsers.findIndex(s => s.id === socket.id);
      if (waitingIndex !== -1) {
        waitingUsers.splice(waitingIndex, 1);
        return;
      }

      // Remove from smart match waiting queue if present
      const smartMatchWaitingIndex = waitingUsersSmartMatch.findIndex(s => s.id === socket.id);
      if (smartMatchWaitingIndex !== -1) {
        waitingUsersSmartMatch.splice(smartMatchWaitingIndex, 1);
        return;
      }

      // Handle active session disconnect
      const sessionId = userSessions.get(socket.id);
      if (sessionId) {
        const session = activeSessions.get(sessionId);
        if (!session) return;

        const userId = socket.userId;
        const isUser1 = session.user1.socketId === socket.id;
        
        // Mark user as disconnected
        if (isUser1) {
          session.user1.connected = false;
        } else {
          session.user2.connected = false;
        }

        // Get partner
        const partner = isUser1 ? session.user2 : session.user1;
        const partnerSocketId = userIdToSocketId.get(partner.userId);

        console.log(`⏳ User ${userId} disconnected from session ${sessionId}. 30s reconnection window started.`);

        // Store disconnect info for reconnection (in-memory)
        disconnectedUsers.set(userId, {
          sessionId,
          disconnectTime: Date.now()
        });

        // 💾 HYBRID: Also save to Redis for persistence
        redisService.saveDisconnectedUser(userId, {
          sessionId,
          disconnectTime: Date.now()
        }).catch(err => 
          console.error('Redis disconnection backup failed:', err.message)
        );

        // 💾 HYBRID: Backup session state to Redis
        redisService.saveSession(sessionId, session).catch(err => 
          console.error('Redis session backup failed:', err.message)
        );

        // Notify partner that user disconnected (but don't end session yet)
        if (partnerSocketId && partner.connected) {
          io.to(partnerSocketId).emit('partner-disconnected', {
            message: 'Your partner disconnected. They have 30 seconds to reconnect.'
          });
        }

        // Set timeout to end session if no reconnection
        setTimeout(() => {
          const stillDisconnected = disconnectedUsers.has(userId);
          if (stillDisconnected) {
            console.log(`⏰ Reconnection timeout for user ${userId}. Ending session ${sessionId}.`);
            disconnectedUsers.delete(userId);
            
            // Check if partner is still connected
            const currentSession = activeSessions.get(sessionId);
            if (currentSession) {
              endSession(sessionId, socket.id, 'disconnect-timeout');
            }
          }
        }, 30000); // 30 second timeout

        // Clean up socket mapping but keep session alive
        userSessions.delete(socket.id);
        userIdToSocketId.delete(userId);
      }
    });

    /**
     * User ends chat normally
     */
    socket.on('end-chat', () => {
      const sessionId = userSessions.get(socket.id);
      
      if (sessionId) {
        endSession(sessionId, socket.id, 'user-ended');
      }
    });

    /**
     * User leaves video call
     * Immediately notify partner and end session
     */
    socket.on('leave-video-call', (data) => {
      const sessionId = data.sessionId;
      const session = activeSessions.get(sessionId);
      
      if (!session) {
        console.log(`⚠️ Session ${sessionId} not found for leave-video-call`);
        return;
      }

      const partnerId = getPartnerId(session, socket.id);
      console.log(`📞 User leaving video call from session ${sessionId}, notifying partner`);

      // Immediately notify partner
      if (partnerId) {
        io.to(partnerId).emit('partner-left-call', {
          message: 'Your partner left the call'
        });
      }

      // End the session immediately
      endSession(sessionId, socket.id, 'user-left-video');
    });
  });

  /**
   * Helper: End a chat session
   */
  function endSession(sessionId, initiatorSocketId, reason) {
    const session = activeSessions.get(sessionId);
    
    if (!session) return;

    const duration = Date.now() - session.startTime;

    console.log(`🔚 Session ${sessionId} ended (${reason})`);

    // First, ensure video cleanup happens on both sides
    io.to(session.room).emit('cleanup-video');

    // Then notify both users that chat ended
    io.to(session.room).emit('chat-ended', {
      reason,
      duration,
      messageCount: session.messageCount
    });

    // 🤖 AI Integration Point: Session ended
    // TODO: Call AI analysis end endpoint
    // notifyAISessionEnd(sessionId, session, duration);

    // 💾 HYBRID: Clean up from Redis
    redisService.cleanupSession(sessionId).catch(err => 
      console.error('Redis cleanup failed:', err.message)
    );

    // Clean up in-memory storage
    userSessions.delete(session.user1.socketId);
    userSessions.delete(session.user2.socketId);
    activeSessions.delete(sessionId);
    readyStatus.delete(sessionId); // Clean up video ready status

    // Make both users leave the room
    io.in(session.room).socketsLeave(session.room);
  }

  /**
   * Helper: Get partner's socket ID
   */
  function getPartnerId(session, currentSocketId) {
    if (session.user1.socketId === currentSocketId) {
      return session.user2.socketId;
    }
    return session.user1.socketId;
  }

  /**
   * Helper: Create a match session between two users
   */
  function createMatchSession(
    socket1,
    socket2,
    profile1,
    profile2,
    commonInterests = [],
    matchScore = 0
  ) {
    console.log('\n========== 🤝 CREATE MATCH SESSION CALLED ==========');
    console.log('Socket1 ID:', socket1.id);
    console.log('Socket2 ID:', socket2.id);
    console.log('Profile1:', profile1);
    console.log('Profile2:', profile2);
    console.log('Common Interests:', commonInterests);
    console.log('Match Score:', matchScore);
    console.log('================================================\n');

    const sessionId = uuidv4();
    const room = `room-${sessionId}`;

    // Join both users to the same room
    socket1.join(room);
    socket2.join(room);

    // Calculate match info
    let matchInfo = null;
    if (profile1 && profile2) {
      console.log('🔍 About to calculate matchInfo with:');
      console.log('   profile1:', profile1);
      console.log('   profile2:', profile2);
      console.log('   commonInterests:', commonInterests);
      
      matchInfo = matchingService.formatMatchInfo(commonInterests, profile1, profile2);
      
      console.log('✅ Match Info Calculated:', JSON.stringify(matchInfo, null, 2));
      console.log('   Profile1:', { city: profile1.city, college: profile1.college, interests: profile1.interests });
      console.log('   Profile2:', { city: profile2.city, college: profile2.college, interests: profile2.interests });
      console.log('   Common Interests:', commonInterests);
      console.log('   Is matchInfo null?', matchInfo === null);
      console.log('   matchInfo keys:', Object.keys(matchInfo || {}));
    } else {
      console.log('⚠️ PROFILE MISSING! profile1:', profile1, 'profile2:', profile2);
    }

    // Create session
    const session = {
      sessionId,
      room,
      user1: {
        socketId: socket1.id,
        userId: socket1.userId,
        connected: true,
        profile: profile1
      },
      user2: {
        socketId: socket2.id,
        userId: socket2.userId,
        connected: true,
        profile: profile2
      },
      startTime: Date.now(),
      messageCount: 0,
      messages: [], // Store messages for reconnection
      user1Profile: profile1,
      user2Profile: profile2,
      matchInfo,
      matchScore,
      commonInterests,
      isSmartMatch: Boolean(profile1 && profile2)
    };

    activeSessions.set(sessionId, session);
    userSessions.set(socket1.id, sessionId);
    userSessions.set(socket2.id, sessionId);
    userIdToSocketId.set(socket1.userId, socket1.id);
    userIdToSocketId.set(socket2.userId, socket2.id);

    console.log(
      `🤝 Match created! Session: ${sessionId}${matchScore > 0 ? ` (Score: ${matchScore}%)` : ' (Anonymous)'}`
    );

    // 💾 HYBRID: Backup session to Redis
    redisService.saveSession(sessionId, session).catch(err =>
      console.error('Redis backup failed:', err.message)
    );

    // Notify both users
    console.log(`📤 Sending match-found to Socket 1 (${socket1.id})`);
    console.log('   matchInfo object:', matchInfo);
    console.log('   matchInfo.sameCityMessage:', matchInfo?.sameCityMessage);
    console.log('   matchInfo.sameCollegeMessage:', matchInfo?.sameCollegeMessage);
    console.log('   matchInfo.commonInterestsMessage:', matchInfo?.commonInterestsMessage);
    
    // Ensure matchInfo is always an object (never undefined or null)
    const finalMatchInfo = matchInfo || {};
    
    socket1.emit('match-found', {
      sessionId,
      userId: socket1.userId,
      partnerId: socket2.userId,
      matchInfo: finalMatchInfo,
      isSmartMatch: Boolean(profile1 && profile2)
    });

    console.log(`📤 Sending match-found to Socket 2 (${socket2.id})`);
    console.log('   matchInfo object:', matchInfo);
    console.log('   matchInfo.sameCityMessage:', matchInfo?.sameCityMessage);
    console.log('   matchInfo.sameCollegeMessage:', matchInfo?.sameCollegeMessage);
    console.log('   matchInfo.commonInterestsMessage:', matchInfo?.commonInterestsMessage);
    
    socket2.emit('match-found', {
      sessionId,
      userId: socket2.userId,
      partnerId: socket1.userId,
      matchInfo: finalMatchInfo,
      isSmartMatch: Boolean(profile1 && profile2)
    });
  }

  /**
   * 🤖 AI Integration Helper Functions (stubs)
   * These will make HTTP calls to Python AI service
   */

  // async function notifyAISessionStart(sessionId, userId1, userId2) {
  //   try {
  //     const response = await fetch('http://localhost:8000/api/analysis/start', {
  //       method: 'POST',
  //       headers: { 'Content-Type': 'application/json' },
  //       body: JSON.stringify({ sessionId, userId1, userId2, timestamp: Date.now() })
  //     });
  //     console.log('🤖 AI notified: Session started');
  //   } catch (error) {
  //     console.error('AI notification failed:', error);
  //   }
  // }

  // async function analyzeMessage(sessionId, messageData) {
  //   try {
  //     const response = await fetch('http://localhost:8000/api/analysis/message', {
  //       method: 'POST',
  //       headers: { 'Content-Type': 'application/json' },
  //       body: JSON.stringify({ sessionId, ...messageData })
  //     });
  //     console.log('🤖 AI analyzing message');
  //   } catch (error) {
  //     console.error('AI analysis failed:', error);
  //   }
  // }

  // async function notifyAISessionEnd(sessionId, session, duration) {
  //   try {
  //     const response = await fetch('http://localhost:8000/api/analysis/end', {
  //       method: 'POST',
  //       headers: { 'Content-Type': 'application/json' },
  //       body: JSON.stringify({
  //         sessionId,
  //         userId1: session.user1.userId,
  //         userId2: session.user2.userId,
  //         duration,
  //         messageCount: session.messageCount,
  //         timestamp: Date.now()
  //       })
  //     });
  //     console.log('🤖 AI notified: Session ended');
  //   } catch (error) {
  //     console.error('AI notification failed:', error);
  //   }
  // }
};
