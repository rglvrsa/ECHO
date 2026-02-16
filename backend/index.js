// Vercel requires an entry point - this serves as a placeholder
// All requests are handled by /api serverless functions
module.exports = (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Redirect to API root
    return res.status(200).json({
        name: 'ECHO Backend',
        status: 'running',
        environment: process.env.NODE_ENV || 'production',
        message: 'Use /api endpoints for requests'
    });
};
