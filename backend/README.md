# Backend - Anonymous Social Connector

## Overview
Node.js + Express + Socket.IO backend for anonymous 1-to-1 chat with WebRTC signaling.

## Quick Start

```bash
npm install
npm start
```

Server runs on: http://localhost:5000

## Development

```bash
npm run dev  # Auto-reload with nodemon
```

## Architecture

### Matchmaking Logic
- Users added to waiting queue
- First two users are paired automatically
- Session created with unique room ID
- Messages relayed only within rooms

### Session Management
- In-memory storage (no database)
- Automatic cleanup on disconnect
- Graceful session teardown

### WebRTC Signaling
- Relay offer/answer between peers
- ICE candidate exchange
- No media processing on server

## API Endpoints

### Health Check
```
GET /health
Response: { status: 'OK', message: 'Server is running' }
```

### AI Integration Stubs
```
POST /api/analysis/start
POST /api/analysis/message
POST /api/analysis/end
POST /api/analysis/moderation
```

See main README for full API documentation.

## Socket Events

### Incoming (from client)
- `start-chat` - Find match
- `send-message` - Send message
- `skip-chat` - Skip current chat
- `request-video` - Request video call
- `accept-video` - Accept video call
- `reject-video` - Reject video call
- `end-chat` - End chat
- `webrtc-offer/answer/ice-candidate` - WebRTC signaling

### Outgoing (to client)
- `waiting` - Added to queue
- `match-found` - Partner found
- `receive-message` - New message
- `video-call-request` - Incoming video request
- `video-call-accepted/rejected` - Video call response
- `chat-ended` - Session ended
- `error` - Error occurred

## Configuration

Edit `config/server.config.js`:
- PORT - Server port (default: 5000)
- CORS_ORIGIN - Frontend URL
- AI_SERVICE - Python AI service URL (for future integration)

## File Structure

```
backend/
├── app.js                    # Main server setup
├── package.json
├── config/
│   └── server.config.js      # Configuration
├── controllers/
│   └── socket.controller.js  # Socket.IO logic
└── routes/
    └── analysis.routes.js    # AI API stubs
```

## Environment Variables (Optional)

```bash
PORT=5000
CORS_ORIGIN=http://localhost:5173
AI_SERVICE_URL=http://localhost:8000
```

## Notes

- No database required (in-memory storage)
- Sessions cleared on server restart
- All messages deleted when chat ends
- Ready for horizontal scaling with Redis adapter
