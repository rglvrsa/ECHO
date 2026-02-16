// REST-based polling service for Vercel serverless backend
// This replaces Socket.io which cannot run on serverless

const getBackendUrl = () => {
  const backendUrl = import.meta.env.VITE_BACKEND_URL;
  if (!backendUrl) {
    console.warn('⚠️ VITE_BACKEND_URL not set, using localhost:5000');
    return 'http://localhost:5000';
  }
  return backendUrl;
};

let pollInterval = null;
let userId = null;
let sessionId = null;
let connected = false;
const listeners = {};

const emit = (event, data) => {
  if (listeners[event]) {
    listeners[event].forEach(cb => cb(data));
  }
};

const on = (event, callback) => {
  if (!listeners[event]) listeners[event] = [];
  listeners[event].push(callback);
};

const off = (event, callback) => {
  if (listeners[event]) {
    listeners[event] = listeners[event].filter(cb => cb !== callback);
  }
};

const socketAdapter = {
  id: null,
  connected: false,
  
  emit: (event, data) => {
    console.log('📤 Event:', event, data);
    emit(event, data);
  },

  on: (event, callback) => {
    on(event, callback);
  },

  off: (event, callback) => {
    off(event, callback);
  },

  disconnect: () => {
    connected = false;
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    emit('disconnect', {});
  },

  connect: () => {
    connected = true;
    socketAdapter.id = Math.random().toString(36).substr(2, 9);
    emit('connect', {});
  },

  io: {
    engine: {
      transport: {
        name: 'polling'
      }
    }
  }
};

// Simulate socket.io with REST API polling
export const initSocket = () => {
  const backendUrl = getBackendUrl();
  console.log('🔌 Initializing polling connection to:', backendUrl);

  socketAdapter.connect();

  // Set up polling for server events
  if (!pollInterval) {
    pollInterval = setInterval(async () => {
      if (!connected || !sessionId || !userId) return;

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
          if (data.messages && data.messages.length > 0) {
            data.messages.forEach(msg => {
              emit('message', msg);
            });
          }
        }
      } catch (error) {
        console.warn('Polling error:', error.message);
      }
    }, 1000);
  }

  return socketAdapter;
};

export const getSocket = () => {
  if (!socketAdapter.connected) {
    return initSocket();
  }
  return socketAdapter;
};

export const disconnectSocket = () => {
  socketAdapter.disconnect();
};

// Event forwarding for compatibility with existing code
socketAdapter.on('start-chat', (data) => {
  emit('start-chat', data);
});

socketAdapter.on('waiting', (data) => {
  emit('waiting', data);
});

socketAdapter.on('matched', (data) => {
  emit('matched', data);
  sessionId = data.sessionId;
  userId = data.userId;
});

socketAdapter.on('message', (data) => {
  emit('message', data);
});

export default {
  initSocket,
  getSocket,
  disconnectSocket,
  emit,
  on,
  off,
  socketAdapter,
};
