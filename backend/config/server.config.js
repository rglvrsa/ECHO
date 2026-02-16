// Server Configuration
const CORS_ORIGINS = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ['https://echo-t4uu.vercel.app', 'https://echo-ten-neon.vercel.app', 'http://localhost:3000', 'http://localhost:5173', '*'];

module.exports = {
  PORT: process.env.PORT || 3000,
  CORS_ORIGIN: CORS_ORIGINS,
  NODE_ENV: process.env.NODE_ENV || 'development',

  // AI Integration Endpoints (to be implemented by teammate)
  AI_SERVICE: {
    BASE_URL: process.env.AI_SERVICE_URL || 'http://localhost:8000',
    ENDPOINTS: {
      ANALYZE_START: '/api/analysis/start',
      ANALYZE_MESSAGE: '/api/analysis/message',
      ANALYZE_END: '/api/analysis/end',
      MODERATION: '/api/moderation/check'
    }
  }
};
