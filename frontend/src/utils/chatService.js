// Polling-based chat service for Vercel serverless backend
const backendUrl = import.meta.env.VITE_BACKEND_URL;

let userId = null;
let sessionId = null;
let isConnected = false;
let pollInterval = null;
const listeners = {};

const emit = (event, data) => {
  if (listeners[event]) {
    listeners[event].forEach(callback => callback(data));
  }
};

const on = (event, callback) => {
  if (!listeners[event]) {
    listeners[event] = [];
  }
  listeners[event].push(callback);
};

const off = (event, callback) => {
  if (listeners[event]) {
    listeners[event] = listeners[event].filter(cb => cb !== callback);
  }
};

// Start polling for messages
const startPolling = () => {
  pollInterval = setInterval(async () => {
    if (!sessionId || !userId) return;

    try {
      const response = await fetch(`${backendUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get-messages',
          userId,
          sessionId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.messages) {
          emit('messages', data.messages);
        }
      }
    } catch (error) {
      console.error('Polling error:', error);
    }
  }, 1000); // Poll every second
};

const stopPolling = () => {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
};

export const chatService = {
  connect: async () => {
    console.log('📡 Connecting to chat service...');
    emit('connect', {});
    return true;
  },

  disconnect: async () => {
    console.log('📡 Disconnecting from chat service...');
    stopPolling();
    
    if (userId) {
      await fetch(`${backendUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'skip',
          userId,
        }),
      });
    }
    
    userId = null;
    sessionId = null;
    isConnected = false;
    emit('disconnect', {});
  },

  startChat: async (userProfile) => {
    try {
      const response = await fetch(`${backendUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start-chat',
          userProfile,
        }),
      });

      const data = await response.json();

      if (data.status === 'matched') {
        userId = data.userId;
        sessionId = data.sessionId;
        isConnected = true;
        
        startPolling();
        emit('matched', {
          partnerId: data.partnerId,
          sessionId: data.sessionId,
        });
        
        return data;
      } else if (data.status === 'waiting') {
        userId = data.userId;
        emit('waiting', { userId });
        
        // Poll for match
        const matchPoller = setInterval(async () => {
          try {
            const res = await fetch(`${backendUrl}/api/chat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'poll-match',
                userId,
              }),
            });

            const matchData = await res.json();
            if (matchData.matched) {
              clearInterval(matchPoller);
              sessionId = matchData.sessionId;
              isConnected = true;
              startPolling();
              
              emit('matched', {
                partnerId: matchData.partnerId,
                sessionId: matchData.sessionId,
              });
            }
          } catch (error) {
            console.error('Match polling error:', error);
          }
        }, 2000); // Check every 2 seconds

        return data;
      }
    } catch (error) {
      console.error('Start chat error:', error);
      emit('error', { message: error.message });
    }
  },

  sendMessage: async (message) => {
    if (!sessionId || !userId) {
      console.error('Not connected to a chat session');
      return;
    }

    try {
      const response = await fetch(`${backendUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send-message',
          userId,
          sessionId,
          message,
        }),
      });

      const data = await response.json();
      if (data.success) {
        emit('message', data.message);
      }
    } catch (error) {
      console.error('Send message error:', error);
      emit('error', { message: error.message });
    }
  },

  getUserCount: async () => {
    try {
      const response = await fetch(`${backendUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get-user-count',
        }),
      });

      const data = await response.json();
      emit('user-count', data);
      return data;
    } catch (error) {
      console.error('Get user count error:', error);
      return { count: 0 };
    }
  },

  on,
  off,
  emit,
};

export default chatService;
