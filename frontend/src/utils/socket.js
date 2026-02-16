import { io } from 'socket.io-client';

// Get backend URL - use environment variable or fallback to localhost
const getBackendUrl = () => {
  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  if (!backendUrl) {
    console.warn('⚠️ VITE_BACKEND_URL not set, using localhost:5000');
    return 'http://localhost:5000';
  }

  console.log('✅ Backend URL configured:', backendUrl);
  return backendUrl;
};

let socket = null;

export const initSocket = () => {
  if (!socket) {
    const backendUrl = getBackendUrl();
    console.log('🔌 Initializing Socket.io connection to:', backendUrl);

    socket = io(backendUrl, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 100,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      secure: backendUrl.startsWith('https'),
      rejectUnauthorized: false,
      upgrade: false,  // Disable upgrade to prevent CORS issues
      path: '/socket.io/',
      forceNew: false,
      multiplex: true,
      autoConnect: true,
      rememberUpgrade: false,
      pollingInterval: 1000,
      pollingIntervalBackoff: 1.5,
      maxHttpBufferSize: 1e6,
    });

    socket.on('connect', () => {
      console.log('✅ Connected to server:', socket.id);
      console.log('📡 Transport:', socket.io.engine.transport.name);
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected from server');
    });

    socket.on('connect_error', (error) => {
      console.error('🔴 Connection error:', error.message || error);
      console.log('📡 Will retry with polling...');
    });

    socket.on('error', (error) => {
      console.error('🔴 Socket error:', error);
    });

    socket.on('reconnect_attempt', () => {
      console.log('🔄 Reconnecting...');
    });

    socket.on('reconnect', () => {
      console.log('✅ Reconnected successfully');
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
