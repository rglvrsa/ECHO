// Socket.io polling endpoint for Vercel serverless
module.exports = (req, res) => {
  // Set comprehensive CORS headers FIRST before any response
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, Content-Type, Accept, Authorization, X-Requested-With, X-Socket-ID');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Type, X-Socket-ID');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH',
      'Access-Control-Allow-Headers': 'Origin, Content-Type, Accept, Authorization, X-Requested-With, X-Socket-ID',
      'Content-Length': 0
    });
    return res.end();
  }

  // Socket.io EIO (Engine.IO) protocol handler
  const query = req.query || {};
  const transport = query.transport || 'polling';
  const sid = query.sid || null;
  const EIO = query.EIO || '4';

  // Handle the Socket.io polling request
  if (transport === 'polling') {
    // Socket.io polling response
    const response = JSON.stringify([
      JSON.stringify({
        type: 0, // OPEN packet
        data: {
          sid: 'echo-' + Math.random().toString(36).substr(2, 9),
          upgrades: ['websocket'],
          pingInterval: 25000,
          pingTimeout: 20000,
          maxPayload: 1e6
        }
      })
    ]);

    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=UTF-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Allow-Credentials': 'false',
    });

    return res.end(response);
  }

  // Default response
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  
  res.end(JSON.stringify({
    status: 'Socket.io polling endpoint ready',
    transport: transport,
    EIO: EIO
  }));
};
