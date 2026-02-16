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
      reconnectionAttempts: 20,
      reconnectionDelay: 500,
      reconnectionDelayMax: 10000,
      timeout: 30000,
      secure: backendUrl.startsWith('https'),
      rejectUnauthorized: false,
      upgrade: true,
      addTrailingSlash: true,
      path: '/socket.io/',
      forceNew: false,
      multiplex: true,
      autoConnect: true,
      // Additional settings for Vercel
      rememberUpgrade: true,
      reconnectionDelayMax: 10000,
    });

    socket.on('connect', () => {
      console.log('✅ Connected to server:', socket.id);
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected from server');
    });

    socket.on('connect_error', (error) => {
      console.error('🔴 Connection error:', error.message || error);
      console.log('📡 Retrying with polling transport...');
    });

    socket.on('error', (error) => {
      console.error('🔴 Socket error:', error);
    });

    socket.on('reconnect_attempt', () => {
      console.log('🔄 Attempting to reconnect...');
    });

    socket.on('reconnect', () => {
      console.log('✅ Reconnected to server');
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
