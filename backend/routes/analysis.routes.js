const express = require('express');
const router = express.Router();
const {
  analyzeMessage,
  fullAnalysis,
  parseSentiment,
  parseTopics,
  parseEmotions,
  parseToxicity,
  parseIntent,
  parseSafety,
  shouldFlag,
  HF_SPACE_URL
} = require('../services/analysis.service');

/**
 * 🤖 AI INTEGRATION ENDPOINTS
 * 
 * Integrated with HuggingFace Spaces: https://imagine-08-echo.hf.space
 * - Real-time message analysis
 * - Sentiment detection
 * - Toxicity/moderation checks
 */

/**
 * POST /api/analysis/start
 * Called when a chat session begins
 * 
 * Expected Request Body:
 * {
 *   sessionId: string,
 *   userId1: string,
 *   userId2: string,
 *   timestamp: number
 * }
 * 
 * Expected AI Response:
 * {
 *   sessionId: string,
 *   analysisStarted: boolean
 * }
 */
router.post('/start', async (req, res) => {
  try {
    const { sessionId, userId1, userId2, timestamp } = req.body;

    console.log('📊 [AI] Analysis session started:', { sessionId });

    res.json({
      success: true,
      message: 'AI analysis session started',
      sessionId,
      analysisStarted: true,
      provider: HF_SPACE_URL
    });
  } catch (error) {
    console.error('AI Analysis Start Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/analysis/message
 * Called for real-time message analysis
 * 
 * Expected Request Body:
 * {
 *   sessionId: string,
 *   messageId: string,
 *   userId: string,
 *   message: string,
 *   timestamp: number
 * }
 * 
 * Expected AI Response:
 * {
 *   messageId: string,
 *   sentiment: 'positive' | 'neutral' | 'negative',
 *   toxicity: number (0-1),
 *   shouldFlag: boolean
 * }
 */
router.post('/message', async (req, res) => {
  try {
    const { sessionId, messageId, userId, message, timestamp } = req.body;

    console.log('📊 [AI] Analyzing message:', { sessionId, messageId });

    // Call HuggingFace Spaces AI for analysis
    const result = await analyzeMessage(message);

    if (result.success) {
      const sentiment = parseSentiment(result.analysis);
      const toxicity = parseToxicity(result.analysis);
      const flagged = shouldFlag(result.analysis);

      res.json({
        success: true,
        messageId,
        sentiment,
        toxicity,
        shouldFlag: flagged,
        rawAnalysis: result.analysis
      });
    } else {
      // Return neutral fallback on API failure
      res.json({
        success: true,
        messageId,
        sentiment: 'neutral',
        toxicity: 0,
        shouldFlag: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('AI Message Analysis Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/analysis/end
 * Called when a chat session ends
 * 
 * Expected Request Body:
 * {
 *   sessionId: string,
 *   userId1: string,
 *   userId2: string,
 *   duration: number,
 *   messageCount: number,
 *   timestamp: number
 * }
 * 
 * Expected AI Response:
 * {
 *   sessionId: string,
 *   overallSentiment: 'positive' | 'neutral' | 'negative',
 *   conversationScore: number (0-100),
 *   topics: string[],
 *   summary: string
 * }
 */
router.post('/end', async (req, res) => {
  try {
    const { sessionId, userId1, userId2, duration, messageCount, timestamp, messages } = req.body;

    console.log('📊 [AI] Analysis session ended:', { sessionId, messageCount });

    // If messages are provided, perform full analysis
    let overallAnalysis = null;
    if (messages && messages.length > 0) {
      const combinedText = messages.join(' ');
      const result = await fullAnalysis(combinedText);
      if (result.success) {
        overallAnalysis = result.analysis;
      }
    }

    res.json({
      success: true,
      sessionId,
      results: {
        overallSentiment: overallAnalysis ? parseSentiment(overallAnalysis) : 'neutral',
        conversationScore: messageCount > 0 ? Math.min(100, messageCount * 5 + 50) : 0,
        rawAnalysis: overallAnalysis
      }
    });
  } catch (error) {
    console.error('AI Analysis End Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/analysis/moderation
 * Real-time content moderation check
 * 
 * Expected Request Body:
 * {
 *   message: string,
 *   userId: string
 * }
 * 
 * Expected AI Response:
 * {
 *   isAppropriate: boolean,
 *   reason: string | null
 * }
 */
router.post('/moderation', async (req, res) => {
  try {
    const { message, userId } = req.body;

    console.log('🛡️ [AI] Moderation check requested');

    // Call HuggingFace Spaces AI for analysis
    const result = await analyzeMessage(message);

    if (result.success) {
      const toxicity = parseToxicity(result.analysis);
      const flagged = shouldFlag(result.analysis);

      res.json({
        success: true,
        isAppropriate: !flagged,
        toxicity,
        reason: flagged ? 'Content flagged by AI moderation' : null
      });
    } else {
      // Allow content on API failure (fail open)
      res.json({
        success: true,
        isAppropriate: true,
        reason: null,
        error: result.error
      });
    }
  } catch (error) {
    console.error('AI Moderation Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/analysis/analyze
 * Direct text analysis endpoint (for testing)
 * 
 * Expected Request Body:
 * {
 *   text: string
 * }
 */
router.post('/analyze', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ success: false, error: 'Text is required' });
    }

    console.log('🤖 [AI] Direct analysis requested');

    const result = await analyzeMessage(text);

    if (result.success) {
      const sentiment = parseSentiment(result.analysis);
      const topics = parseTopics(result.analysis);
      const emotions = parseEmotions(result.analysis);
      const intent = parseIntent(result.analysis);
      const safety = parseSafety(result.analysis);

      res.json({
        success: true,
        analysis: result.analysis,
        // Parsed sentiment data
        sentiment: sentiment.sentiment,
        sentimentStrength: sentiment.strength,
        sentimentScore: sentiment.score,
        // Parsed topics
        mainTopic: topics.mainTopic,
        topics: topics.topics,
        // Parsed emotions
        emotions: emotions,
        // Intent & linguistics
        intent: intent,
        // Safety
        safety: safety,
        // Legacy compatibility
        toxicity: parseToxicity(result.analysis)
      });
    } else {
      res.json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('AI Direct Analysis Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
