module.exports = (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    // Handle OPTIONS
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Root endpoint
    return res.status(200).json({
        name: 'ECHO Backend API',
        version: '1.0.0',
        status: 'running',
        message: 'Backend is operational',
        endpoints: {
            health: 'GET /health',
            analyze: 'POST /api/analysis/analyze',
            analyzeStart: 'POST /api/analysis/start',
            sentiment: 'POST /api/analysis/sentiment',
            full: 'POST /api/analysis/full'
        }
    });
};
