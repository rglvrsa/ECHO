import { io } from 'socket.io-client';

// Get backend URL - use environment variable or fallback to localhost
const getBackendUrl = () => {
  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  if (!backendUrl) {
    console.warn('⚠️ VITE_BACKEND_URL not set, using localhost:5000');
    return 'http://localhost:5000';
  }

  return backendUrl;
};

let socket = null;

export const initSocket = () => {
  if (!socket) {
    const backendUrl = getBackendUrl();
    console.log('🔌 Connecting to WebSocket:', backendUrl);

    socket = io(backendUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      secure: backendUrl.startsWith('https'),
      rejectUnauthorized: false
    });

    socket.on('connect', () => {
      console.log('✅ Connected to server:', socket.id);
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected from server');
    });

    socket.on('connect_error', (error) => {
      console.error('🔴 Connection error:', error.message);
    });
  }
  return socket;
};

export const getSocket = () => {
  if (!socket) {
    return initSocket();
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export default { initSocket, getSocket, disconnectSocket };
