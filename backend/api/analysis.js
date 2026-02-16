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

    try {
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

        const { text, sessionId, userId1, userId2, timestamp } = body;

        // Route: POST /analyze
        if (req.method === 'POST' && req.url === '/' || req.url.includes('analyze')) {
            if (!text) {
                return res.status(200).json({
                    success: true,
                    analysis: { status: 'ready' }
                });
            }
            return res.status(200).json({
                success: true,
                analysis: {
                    sentiment: 'neutral',
                    topics: [],
                    emotions: {}
                }
            });
        }

        // Route: POST /start
        if (req.method === 'POST' && req.url.includes('start')) {
            return res.status(200).json({
                success: true,
                sessionId: sessionId || 'session-' + Date.now(),
                analysisStarted: true
            });
        }

        // Route: POST /sentiment
        if (req.method === 'POST' && req.url.includes('sentiment')) {
            if (!text) {
                return res.status(400).json({ error: 'Text field is required' });
            }
            return res.status(200).json({
                sentiment: 'neutral',
                rawAnalysis: {}
            });
        }

        // Route: POST /full
        if (req.method === 'POST' && req.url.includes('full')) {
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

        return res.status(404).json({ error: 'Route not found' });
    } catch (error) {
        console.error('API Error:', error.message);
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
};
