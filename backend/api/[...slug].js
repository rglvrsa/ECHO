// Catch-all handler for /api and other dynamic routes
module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    // Handle OPTIONS
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { slug } = req.query;
    const path = slug ? '/' + slug.join('/') : '/';

    // Parse body
    const body = await new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => data += chunk);
        req.on('end', () => {
            try {
                resolve(data ? JSON.parse(data) : {});
            } catch (e) {
                resolve({});
            }
        });
        req.on('error', reject);
    });

    try {
        // Route: /api/analysis/analyze
        if (path.includes('analysis') && path.includes('analyze') && req.method === 'POST') {
            const { text } = body;
            return res.status(200).json({
                success: true,
                analysis: {
                    sentiment: 'neutral',
                    topics: [],
                    emotions: {}
                }
            });
        }

        // Route: /api/analysis/start
        if (path.includes('analysis') && path.includes('start') && req.method === 'POST') {
            const { sessionId } = body;
            return res.status(200).json({
                success: true,
                sessionId: sessionId || 'session-' + Date.now(),
                analysisStarted: true
            });
        }

        // Route: /api/analysis/sentiment
        if (path.includes('analysis') && path.includes('sentiment') && req.method === 'POST') {
            const { text } = body;
            if (!text) {
                return res.status(400).json({ error: 'Text field is required' });
            }
            return res.status(200).json({
                sentiment: 'neutral',
                rawAnalysis: {}
            });
        }

        // Route: /api/analysis/full
        if (path.includes('analysis') && path.includes('full') && req.method === 'POST') {
            const { text } = body;
            if (!text) {
                return res.status(400).json({ error: 'Text field is required' });
            }
            return res.status(200).json({
                success: true,
                analysis: {
                    sentiment: 'neutral',
                    topics: [],
                    emotions: {},
                    toxicity: 0,
                    intent: 'neutral'
                }
            });
        }

        // Default 404
        return res.status(404).json({ error: 'Route not found: ' + path });
    } catch (error) {
        console.error('API Error:', error.message);
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
};
