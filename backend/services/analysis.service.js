/**
 * AI Analysis Service
 * Integrates with HuggingFace Spaces for chat message analysis
 * Uses Gradio SSE queue API for reliable communication
 */

const { EventSource } = require('eventsource');

const HF_SPACE_URL = 'https://imagine-08-echo.hf.space';

/**
 * Generate a unique session hash
 */
const generateSessionHash = () => {
    return Math.random().toString(36).substring(2, 12) + Math.random().toString(36).substring(2, 12);
};

/**
 * Analyze a message using HuggingFace Spaces AI via Gradio Queue API
 * @param {string} text - The message text to analyze
 * @returns {Promise<Object>} Analysis results
 */
const analyzeMessage = async (text) => {
    return new Promise((resolve) => {
        const sessionHash = generateSessionHash();
        const fnIndex = 0; // full_analysis is fn_index 0

        console.log('🤖 Analyzing message:', text.substring(0, 50));

        // Build the SSE URL with parameters
        const params = new URLSearchParams({
            fn_index: fnIndex,
            session_hash: sessionHash
        });

        const sseUrl = `${HF_SPACE_URL}/queue/join?${params.toString()}`;

        // Create EventSource connection
        const eventSource = new EventSource(sseUrl, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        let resolved = false;
        let receivedSendData = false;
        const timeout = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                eventSource.close();
                console.error('❌ HuggingFace API timeout');
                resolve({
                    success: false,
                    error: 'Connection timeout',
                    analysis: null
                });
            }
        }, 30000);

        eventSource.onopen = async () => {
            console.log('🔌 Connected to HuggingFace queue');
        };

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('📡 SSE Event:', data.msg);

                if (data.msg === 'send_data') {
                    receivedSendData = true;
                    // Server is ready for data - send via POST using native fetch
                    console.log('📤 Sending data to queue with event_id:', data.event_id);
                    fetch(`${HF_SPACE_URL}/queue/data`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            data: [text],
                            fn_index: fnIndex,
                            session_hash: sessionHash,
                            event_id: data.event_id
                        })
                    }).then(resp => {
                        console.log('📨 Data sent, status:', resp.status);
                        return resp.text();
                    }).then(body => {
                        console.log('📥 Response:', body.substring(0, 200));
                    }).catch(e => console.log('Data send error:', e.message));
                }

                if (data.msg === 'process_completed' && data.output) {
                    clearTimeout(timeout);
                    resolved = true;
                    eventSource.close();

                    console.log('📊 HuggingFace response:', JSON.stringify(data.output.data).substring(0, 300));

                    resolve({
                        success: true,
                        analysis: data.output.data
                    });
                }

                if (data.msg === 'process_failed') {
                    clearTimeout(timeout);
                    resolved = true;
                    eventSource.close();

                    resolve({
                        success: false,
                        error: data.error || 'Process failed',
                        analysis: null
                    });
                }
            } catch (e) {
                console.log('SSE parse error:', e.message);
            }
        };

        eventSource.onerror = (error) => {
            console.log('⚠️ SSE error event (may be transient):', error.type);
            // Only resolve on error if we haven't received send_data yet
            // After send_data, wait for process_completed or timeout
            if (!resolved && !receivedSendData) {
                clearTimeout(timeout);
                resolved = true;
                eventSource.close();
                console.error('❌ SSE Error:', error);
                resolve({
                    success: false,
                    error: 'Connection error',
                    analysis: null
                });
            }
        };
    });
};

/**
 * Full analysis wrapper (uses same function)
 */
const fullAnalysis = async (text) => {
    return await analyzeMessage(text);
};

/**
 * Predict analysis wrapper
 */
const predictAnalysis = async (text) => {
    return await analyzeMessage(text);
};

/**
 * Parse sentiment from AI analysis result
 * @param {Object} analysis - Raw analysis from HuggingFace
 * @returns {Object} { sentiment: string, strength: string, score: number }
 */
const parseSentiment = (analysis) => {
    const result = { sentiment: 'neutral', strength: '', score: 0 };
    if (!analysis) return result;

    // Handle array response (Gradio returns data as array)
    if (Array.isArray(analysis)) {
        if (typeof analysis[0] === 'string') {
            return parseSentiment(analysis[0]);
        }
    }

    // Handle string response (markdown format from HuggingFace)
    if (typeof analysis === 'string') {
        // Look for sentiment section: **Overall:** Negative (moderate)
        const overallMatch = analysis.match(/\*\*Overall:\*\*\s*(\w+)(?:\s*\((\w+)\))?/i);
        if (overallMatch) {
            result.sentiment = overallMatch[1].toLowerCase();
            result.strength = overallMatch[2] ? overallMatch[2].toLowerCase() : '';
        }

        // Look for score: **Score:** -0.451
        const scoreMatch = analysis.match(/\*\*Score:\*\*\s*(-?[\d.]+)/i);
        if (scoreMatch) {
            result.score = parseFloat(scoreMatch[1]);
        }

        return result;
    }

    // Handle object response with sentiment field
    if (analysis.sentiment) {
        result.sentiment = analysis.sentiment;
    }

    return result;
};

/**
 * Parse topics from AI analysis result
 * @param {Object} analysis - Raw analysis from HuggingFace
 * @returns {Object} { mainTopic: string, topics: Array<{name, category, score}> }
 */
const parseTopics = (analysis) => {
    const result = { mainTopic: '', topics: [] };
    if (!analysis) return result;

    // Handle array response
    if (Array.isArray(analysis)) {
        if (typeof analysis[0] === 'string') {
            return parseTopics(analysis[0]);
        }
    }

    // Handle string response (markdown format)
    if (typeof analysis === 'string') {
        // Look for main topic: **Main Topic:** travel (Lifestyle)
        const mainMatch = analysis.match(/\*\*Main Topic:\*\*\s*([\w\s]+)(?:\s*\(([^)]+)\))?/i);
        if (mainMatch) {
            result.mainTopic = mainMatch[1].trim();
        }

        // Look for topics section and extract all topics
        const topicsMatch = analysis.match(/## 📌 Topics[\s\S]*?(?=---|##|$)/i);
        if (topicsMatch) {
            // Extract topic lines: • travel (Lifestyle): 99%
            const topicLines = topicsMatch[0].match(/[•\-]\s*([\w\s]+)(?:\s*\(([^)]+)\))?:\s*(\d+)%/gi);
            if (topicLines) {
                topicLines.forEach(line => {
                    const parts = line.match(/[•\-]\s*([\w\s]+)(?:\s*\(([^)]+)\))?:\s*(\d+)%/i);
                    if (parts) {
                        result.topics.push({
                            name: parts[1].trim(),
                            category: parts[2] ? parts[2].trim() : '',
                            score: parseInt(parts[3])
                        });
                    }
                });
            }
        }

        return result;
    }

    return result;
};

/**
 * Parse emotions from AI analysis result
 * @param {Object} analysis - Raw analysis from HuggingFace
 * @returns {Object} { dominant: string, emoji: string, confidence: number, intensity: number, topEmotions: Array }
 */
const parseEmotions = (analysis) => {
    const result = { dominant: 'neutral', emoji: '😐', confidence: 0, intensity: 0, topEmotions: [] };
    if (!analysis) return result;

    // Handle array response
    if (Array.isArray(analysis)) {
        if (typeof analysis[0] === 'string') {
            return parseEmotions(analysis[0]);
        }
    }

    // Handle string response (markdown format)
    if (typeof analysis === 'string') {
        // Look for dominant emotion: **Dominant:** 😐 **Neutral** (76% confidence)
        const dominantMatch = analysis.match(/\*\*Dominant:\*\*\s*([^\s]+)\s*\*\*([^*]+)\*\*\s*\((\d+)%\s*confidence\)/i);
        if (dominantMatch) {
            result.emoji = dominantMatch[1];
            result.dominant = dominantMatch[2].trim().toLowerCase();
            result.confidence = parseInt(dominantMatch[3]);
        }

        // Look for intensity: **Intensity:** 28%
        const intensityMatch = analysis.match(/\*\*Intensity:\*\*\s*(\d+)%/i);
        if (intensityMatch) {
            result.intensity = parseInt(intensityMatch[1]);
        }

        // Look for top emotions: • 😐 neutral: 76%
        const emotionsMatch = analysis.match(/\*\*Top Emotions:\*\*[\s\S]*?(?=---|##|$)/i);
        if (emotionsMatch) {
            const emotionLines = emotionsMatch[0].match(/[•\-]\s*([^\s]+)\s*([\w]+):\s*(\d+)%/gi);
            if (emotionLines) {
                emotionLines.forEach(line => {
                    const parts = line.match(/[•\-]\s*([^\s]+)\s*([\w]+):\s*(\d+)%/i);
                    if (parts) {
                        result.topEmotions.push({
                            emoji: parts[1],
                            name: parts[2],
                            score: parseInt(parts[3])
                        });
                    }
                });
            }
        }
    }

    return result;
};

/**
 * Calculate toxicity score from analysis
 * @param {Object} analysis - Raw analysis from HuggingFace
 * @returns {number} Toxicity score 0-1
 */
const parseToxicity = (analysis) => {
    if (!analysis) return 0;

    // Handle array response
    if (Array.isArray(analysis)) {
        if (typeof analysis[0] === 'string') {
            return parseToxicity(analysis[0]);
        }
    }

    // Handle string response (markdown format)
    if (typeof analysis === 'string') {
        const lower = analysis.toLowerCase();

        // Check safety status from HuggingFace response
        if (lower.includes('**status:** ✅ safe') || lower.includes('status: safe')) {
            return 0;
        }
        if (lower.includes('**status:** ⚠️') || lower.includes('unsafe') || lower.includes('toxic')) {
            return 0.8;
        }

        // Fallback toxicity detection
        const toxicWords = ['toxic', 'harmful', 'inappropriate', 'offensive', 'hate'];
        for (const word of toxicWords) {
            if (lower.includes(word)) {
                return 0.8;
            }
        }
    }

    // Handle object with toxicity field
    if (typeof analysis.toxicity === 'number') {
        return analysis.toxicity;
    }

    return 0;
};

/**
 * Parse intent and linguistics from AI analysis
 * @param {Object} analysis - Raw analysis from HuggingFace
 * @returns {Object} { intent: string, allIntents: Array, wordCount: number, emojis: number, engagementScore: number }
 */
const parseIntent = (analysis) => {
    const result = { intent: '', allIntents: [], wordCount: 0, emojis: 0, exclamations: 0, engagementScore: 0 };
    if (!analysis) return result;

    // Handle array response
    if (Array.isArray(analysis)) {
        if (typeof analysis[0] === 'string') {
            return parseIntent(analysis[0]);
        }
    }

    if (typeof analysis === 'string') {
        // Look for intent: **Intent:** Agreement
        const intentMatch = analysis.match(/\*\*Intent:\*\*\s*(\w+)/i);
        if (intentMatch) {
            result.intent = intentMatch[1];
        }

        // Look for all intents: **All Intents:** agreement, sharing
        const allIntentsMatch = analysis.match(/\*\*All Intents:\*\*\s*([^\n]+)/i);
        if (allIntentsMatch) {
            result.allIntents = allIntentsMatch[1].split(',').map(i => i.trim());
        }

        // Look for word count: **Word Count:** 8
        const wordCountMatch = analysis.match(/\*\*Word Count:\*\*\s*(\d+)/i);
        if (wordCountMatch) {
            result.wordCount = parseInt(wordCountMatch[1]);
        }

        // Look for emojis: **Emojis:** 0
        const emojisMatch = analysis.match(/\*\*Emojis:\*\*\s*(\d+)/i);
        if (emojisMatch) {
            result.emojis = parseInt(emojisMatch[1]);
        }

        // Look for exclamations: **Exclamations:** 0
        const exclamationsMatch = analysis.match(/\*\*Exclamations:\*\*\s*(\d+)/i);
        if (exclamationsMatch) {
            result.exclamations = parseInt(exclamationsMatch[1]);
        }

        // Look for engagement score: **Engagement Score:** 61/100
        const engagementMatch = analysis.match(/\*\*Engagement Score:\*\*\s*(\d+)\/100/i);
        if (engagementMatch) {
            result.engagementScore = parseInt(engagementMatch[1]);
        }
    }

    return result;
};

/**
 * Parse safety info from AI analysis
 * @param {Object} analysis - Raw analysis from HuggingFace
 * @returns {Object} { status: string, riskScore: number }
 */
const parseSafety = (analysis) => {
    const result = { status: 'safe', riskScore: 0 };
    if (!analysis) return result;

    // Handle array response
    if (Array.isArray(analysis)) {
        if (typeof analysis[0] === 'string') {
            return parseSafety(analysis[0]);
        }
    }

    if (typeof analysis === 'string') {
        // Look for status: **Status:** ✅ Safe
        if (analysis.includes('✅ Safe')) {
            result.status = 'safe';
        } else if (analysis.includes('⚠️')) {
            result.status = 'warning';
        } else if (analysis.includes('❌')) {
            result.status = 'unsafe';
        }

        // Look for risk score: **Risk Score:** 0/100
        const riskMatch = analysis.match(/\*\*Risk Score:\*\*\s*(\d+)\/100/i);
        if (riskMatch) {
            result.riskScore = parseInt(riskMatch[1]);
        }
    }

    return result;
};

/**
 * Determine if content should be flagged
 * @param {Object} analysis - Raw analysis from HuggingFace
 * @returns {boolean} Should flag the content
 */
const shouldFlag = (analysis) => {
    const toxicity = parseToxicity(analysis);
    return toxicity > 0.7;
};

module.exports = {
    analyzeMessage,
    fullAnalysis,
    predictAnalysis,
    parseSentiment,
    parseTopics,
    parseEmotions,
    parseToxicity,
    parseIntent,
    parseSafety,
    shouldFlag,
    HF_SPACE_URL
};
