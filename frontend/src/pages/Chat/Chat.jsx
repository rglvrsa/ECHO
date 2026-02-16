import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Lenis from 'lenis';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getSocket } from '../../utils/socket';
import GifPicker from '../../components/GifPicker/GifPicker';
import ImageModal from '../../components/ImageModal/ImageModal';
import './Chat.css';

// Backend API URL
const API_URL = import.meta.env.VITE_BACKEND_URL;

const Chat = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [chatMode, setChatMode] = useState('user'); // 'user' or 'ai'
  const [videoHovered, setVideoHovered] = useState(false);
  const [skipHovered, setSkipHovered] = useState(false);
  const [sendHovered, setSendHovered] = useState(false);
  const [gifHovered, setGifHovered] = useState(false);
  const [cameraHovered, setCameraHovered] = useState(false);
  const [isWaiting, setIsWaiting] = useState(true);
  const [isMatched, setIsMatched] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [partnerId, setPartnerId] = useState(null);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [videoCallRequest, setVideoCallRequest] = useState(null);
  const [isInVideoCall, setIsInVideoCall] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isWaitingForVideoResponse, setIsWaitingForVideoResponse] = useState(false);
  const [matchInfo, setMatchInfo] = useState(null);
  const [isSmartMatch, setIsSmartMatch] = useState(false);
  const [showCommonInterests, setShowCommonInterests] = useState(true);

  // AI Analysis state
  const [aiAnalysis, setAiAnalysis] = useState({
    compatibilityScore: 0,
    sentiment: 'neutral',
    sentimentStrength: '',
    commonInterests: [],
    isAnalyzing: false,
    conversationFlow: 100,
    responseQuality: 100,
    energyBalance: 99,
    connectionStatus: 'Great Connection!'
  });
  const [messageAnalysis, setMessageAnalysis] = useState({}); // Per-message analysis
  const [showAiScore, setShowAiScore] = useState(true);
  const conversationMessages = useRef([]);

  const messagesEndRef = useRef(null);
  const messagesAreaRef = useRef(null);
  const socketRef = useRef(null);
  const genAI = useRef(null);
  const chatSession = useRef(null);
  const handleWaitingRef = useRef(null);
  const handleMatchFoundRef = useRef(null);
  const handleReceiveRef = useRef(null);
  const handleTypingRef = useRef(null);
  const handleDisconnectRef = useRef(null);
  const handleSessionEndRef = useRef(null);
  const skipClickedRef = useRef(false);
  const handleReconnectSuccessRef = useRef(null);
  const handleReconnectFailedRef = useRef(null);
  const photoInputRef = useRef(null);
  const gifInputRef = useRef(null);

  // Initialize Gemini AI for AI chat mode
  useEffect(() => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || 'AIzaSyCnuc1rMSx5--ZLbbmugnq_NkE36frKbOQ';

    try {
      genAI.current = new GoogleGenerativeAI(apiKey);
      const model = genAI.current.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });

      const chat = model.startChat({
        history: [],
        generationConfig: {
          maxOutputTokens: 1024,
          temperature: 0.7,
        },
      });

      chatSession.current = chat;
    } catch (error) {
      console.error('Error initializing Gemini AI:', error);
    }
  }, []);

  // Initialize socket and start chat
  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    // Check if we have user profile from smart match or AI chat mode
    const userProfileStr = sessionStorage.getItem('userProfile');
    const chatModeFromStorage = sessionStorage.getItem('chatMode');

    if (chatModeFromStorage === 'ai') {
      // Start AI chat mode
      setChatMode('ai');
      sessionStorage.removeItem('chatMode');
    } else if (userProfileStr && chatModeFromStorage === 'smart-match') {
      const userProfile = JSON.parse(userProfileStr);
      console.log('Starting smart match with profile:', userProfile);

      // Start smart match with profile
      socket.emit('start-smart-match', { userProfile });
      setIsSmartMatch(true);

      // Clear from session storage
      sessionStorage.removeItem('userProfile');
      sessionStorage.removeItem('chatMode');
    } else {
      // Start anonymous chat
      socket.emit('start-chat');
      setIsSmartMatch(false);
    }

    // Listen for waiting response (no match yet)
    handleWaitingRef.current = (data) => {
      console.log('Waiting for match...', data);
      setIsWaiting(true);
      setIsMatched(false);
    };

    // Listen for smart match waiting response
    socket.on('smart-match-waiting', (data) => {
      console.log('Smart match waiting...', data);
      setIsWaiting(true);
      setIsMatched(false);
    });

    // Listen for smart match fallback waiting response
    socket.on('smart-match-fallback-waiting', (data) => {
      console.log('Smart match fallback - now waiting for anonymous match...', data);
      setIsWaiting(true);
      setIsMatched(false);
    });

    // Listen for smart match still waiting response
    socket.on('smart-match-still-waiting', (data) => {
      console.log('Smart match still waiting...', data);
      setIsWaiting(true);
      setIsMatched(false);
    });

    // Listen for no match found - smart match user should not wait
    socket.on('smart-match-no-match', (data) => {
      console.log('No smart match found:', data);
      alert('No suitable match found with your interests and location. Try again later or try anonymous chat!');
      navigate('/');
    });

    // Listen for match found - ONCE
    handleMatchFoundRef.current = (data) => {
      console.log('🎉 Match found! Raw data:', data);
      console.log('   data.matchInfo:', data.matchInfo);
      console.log('   data.matchInfo type:', typeof data.matchInfo);
      console.log('   data.matchInfo keys:', data.matchInfo ? Object.keys(data.matchInfo) : 'NULL');
      console.log('   data.isSmartMatch:', data.isSmartMatch);
      console.log('   data.sessionId:', data.sessionId);

      setIsWaiting(false);
      setIsMatched(true);
      setSessionId(data.sessionId);
      setPartnerId(data.partnerId);

      // Log before setting
      console.log('About to set matchInfo to:', data.matchInfo);
      setMatchInfo(data.matchInfo || null);

      console.log('Setting isSmartMatch to:', Boolean(data.isSmartMatch));
      setIsSmartMatch(Boolean(data.isSmartMatch));

      // Remove waiting listener once matched
      socket.off('waiting', handleWaitingRef.current);
    };

    socket.on('waiting', handleWaitingRef.current);
    socket.once('match-found', handleMatchFoundRef.current);

    // Listen for incoming messages
    handleReceiveRef.current = (data) => {
      const newMessage = {
        id: Date.now(),
        text: data.message,
        sender: 'other',
        time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        hasReaction: false,
        imageData: data.imageData,
        gifData: data.gifData,
        fileName: data.fileName
      };
      setMessages(prev => [...prev, newMessage]);
    };

    // Listen for video call request
    socket.on('video-call-request', (data) => {
      console.log('Incoming video call request!', data);
      setVideoCallRequest(data);
    });

    // Listen for video call acceptance
    socket.on('video-call-accepted', (data) => {
      console.log('Video call accepted!', data);
      setIsWaitingForVideoResponse(false);
      setIsInVideoCall(true);
      // Save to sessionStorage for persistence
      const finalSessionId = data.sessionId || sessionId;
      const finalPartnerId = data.partnerId || partnerId;
      sessionStorage.setItem('videoCallSessionId', finalSessionId);
      sessionStorage.setItem('videoCallPartnerId', finalPartnerId);
      navigate('/videocall', { state: { sessionId: finalSessionId, partnerId: finalPartnerId } });
    });

    // Listen for video call rejection
    socket.on('video-call-rejected', () => {
      alert('Your call was rejected');
      setIsWaitingForVideoResponse(false);
      setVideoCallRequest(null);
    });

    // Listen for typing indicator
    handleTypingRef.current = () => {
      setIsTyping(true);
      setTimeout(() => setIsTyping(false), 2000);
    };

    // Listen for partner disconnect
    handleDisconnectRef.current = () => {
      // Only proceed if skip wasn't clicked
      if (!skipClickedRef.current) {
        alert('Your chat partner has disconnected. Waiting for reconnection...');
        setIsMatched(false);
        setIsWaiting(true);
        // Wait 5 seconds for partner to reconnect before looking for new match
        setTimeout(() => {
          if (skipClickedRef.current === false && !isMatched) {
            // Partner didn't reconnect, look for new match
            socketRef.current.emit('start-chat');
          }
        }, 5000);
      } else {
        // Skip was clicked, so navigate away
        navigate('/');
      }
    };

    // Listen for session end
    handleSessionEndRef.current = () => {
      alert('Chat session ended');
      navigate('/');
    };

    // Listen for successful reconnection
    handleReconnectSuccessRef.current = (data) => {
      console.log('Reconnected to previous session!', data);
      setIsMatched(true);
      setIsWaiting(false);
      setSessionId(data.sessionId);
      setPartnerId(data.partnerId);
      skipClickedRef.current = false;
    };

    // Listen for failed reconnection
    handleReconnectFailedRef.current = (data) => {
      console.log('Reconnection failed:', data.reason);
      alert('Previous chat session expired. Looking for new match...');
      setIsWaiting(true);
      setIsMatched(false);
      skipClickedRef.current = false;
      // Start looking for new match
      socketRef.current.emit('start-chat');
    };

    socket.on('receive-message', handleReceiveRef.current);
    socket.on('user-typing', handleTypingRef.current);
    socket.on('partner-disconnected', handleDisconnectRef.current);
    socket.on('session-ended', handleSessionEndRef.current);
    socket.on('reconnect-success', handleReconnectSuccessRef.current);
    socket.on('reconnect-failed', handleReconnectFailedRef.current);

    // Cleanup on unmount
    return () => {
      if (handleWaitingRef.current) socket.off('waiting', handleWaitingRef.current);
      if (handleMatchFoundRef.current) socket.off('match-found', handleMatchFoundRef.current);
      if (handleReceiveRef.current) socket.off('receive-message', handleReceiveRef.current);
      if (handleTypingRef.current) socket.off('user-typing', handleTypingRef.current);
      if (handleDisconnectRef.current) socket.off('partner-disconnected', handleDisconnectRef.current);
      if (handleSessionEndRef.current) socket.off('session-ended', handleSessionEndRef.current);
    };
  }, [navigate]);

  // Initialize Lenis for smooth scrolling in the messages area
  useEffect(() => {
    if (messagesAreaRef.current) {
      const lenis = new Lenis({
        wrapper: messagesAreaRef.current,
        content: messagesAreaRef.current.querySelector('.messages-container'),
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smooth: true,
        direction: 'vertical',
        smoothTouch: false,
        smoothWheel: true,
      });

      function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
      }

      requestAnimationFrame(raf);

      return () => {
        lenis.destroy();
      };
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Log matchInfo changes
  useEffect(() => {
    console.log('🔍 matchInfo changed:', matchInfo);
    console.log('   isMatched:', isMatched);
    console.log('   showCommonInterests:', showCommonInterests);
    if (matchInfo) {
      console.log('   sameCityMessage:', matchInfo.sameCityMessage);
      console.log('   sameCollegeMessage:', matchInfo.sameCollegeMessage);
      console.log('   commonInterestsMessage:', matchInfo.commonInterestsMessage);
    }
  }, [matchInfo]);

  // AI Analysis function - analyzes conversation and updates compatibility score
  const analyzeConversation = async (newMessage, sender, messageId) => {
    try {
      // Add message to conversation history
      conversationMessages.current.push({ text: newMessage, sender });

      // Only analyze text messages (not photos/gifs)
      if (newMessage === '[Photo]' || newMessage === '[GIF]') return;

      setAiAnalysis(prev => ({ ...prev, isAnalyzing: true }));

      // Call backend AI analysis endpoint
      const response = await fetch(`${API_URL}/api/analysis/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: newMessage })
      });

      if (!response.ok) {
        throw new Error('AI analysis failed');
      }

      const result = await response.json();
      console.log('🤖 AI Analysis result:', result);

      if (result.success) {
        // Store per-message analysis
        if (messageId) {
          setMessageAnalysis(prev => ({
            ...prev,
            [messageId]: {
              emotion: result.emotions?.emoji || '😐',
              emotionName: result.emotions?.dominant || 'neutral',
              sentiment: result.sentiment || 'neutral',
              sentimentStrength: result.sentimentStrength || '',
              mainTopic: result.mainTopic || '',
              engagementScore: result.intent?.engagementScore || 0
            }
          }));
        }

        // Update compatibility score based on conversation analysis
        setAiAnalysis(prev => {
          const messageCount = conversationMessages.current.length;
          let newScore = prev.compatibilityScore;

          // Get sentiment from API response
          const sentiment = result.sentiment || 'neutral';
          const sentimentStrength = result.sentimentStrength || '';

          // Base score adjustments based on sentiment and strength
          if (sentiment === 'positive') {
            const boost = sentimentStrength === 'strong' ? 18 : 12;
            newScore = Math.min(100, newScore + (messageCount < 5 ? boost : boost / 2));
          } else if (sentiment === 'neutral') {
            newScore = Math.min(100, newScore + (messageCount < 5 ? 8 : 3));
          } else if (sentiment === 'negative') {
            const penalty = sentimentStrength === 'moderate' ? 8 : 5;
            newScore = Math.max(0, newScore - penalty);
          }

          // Get topics from API response
          let interests = prev.commonInterests;
          if (result.topics && Array.isArray(result.topics)) {
            const topicNames = result.topics.map(t => t.name || t);
            interests = [...new Set([...interests, ...topicNames])].slice(0, 5);
          }

          // Calculate conversation flow metrics
          const engagementScore = result.intent?.engagementScore || 60;
          const newConversationFlow = Math.min(100, prev.conversationFlow + (engagementScore > 50 ? 2 : -1));
          const newResponseQuality = Math.min(100, prev.responseQuality + (sentiment !== 'negative' ? 1 : -2));
          const newEnergyBalance = Math.min(100, Math.max(0, prev.energyBalance + (sentiment === 'positive' ? 1 : sentiment === 'negative' ? -2 : 0)));

          // Determine connection status
          let connectionStatus = prev.connectionStatus;
          if (newScore >= 70) connectionStatus = '🌊 Great Connection!';
          else if (newScore >= 50) connectionStatus = '👍 Good Vibe';
          else if (newScore >= 30) connectionStatus = '💬 Getting There';
          else connectionStatus = '🌱 Just Started';

          return {
            ...prev,
            compatibilityScore: Math.round(newScore),
            sentiment: sentiment,
            sentimentStrength: sentimentStrength,
            commonInterests: interests,
            emotions: result.emotions || prev.emotions,
            conversationFlow: Math.round(newConversationFlow),
            responseQuality: Math.round(newResponseQuality),
            energyBalance: Math.round(newEnergyBalance),
            connectionStatus: connectionStatus,
            isAnalyzing: false,
            rawAnalysis: result.analysis
          };
        });
      } else {
        setAiAnalysis(prev => ({ ...prev, isAnalyzing: false }));
      }
    } catch (error) {
      console.error('AI analysis error:', error);
      setAiAnalysis(prev => ({ ...prev, isAnalyzing: false }));
    }
  };

  // Analyze incoming messages from partner
  const lastAnalyzedMessageRef = useRef(null);
  useEffect(() => {
    if (messages.length > 0 && chatMode !== 'ai') {
      const lastMessage = messages[messages.length - 1];
      // Only analyze messages from partner, and avoid re-analyzing
      if (lastMessage.sender === 'other' && lastMessage.id !== lastAnalyzedMessageRef.current) {
        lastAnalyzedMessageRef.current = lastMessage.id;
        // Delay analysis slightly to avoid UI jank
        setTimeout(() => {
          analyzeConversation(lastMessage.text, 'other', lastMessage.id);
        }, 500);
      }
    }
  }, [messages, chatMode]);

  const handleSendMessage = async () => {
    if (inputMessage.trim() === '') return;

    // If in AI mode, handle AI chat
    if (chatMode === 'ai') {
      const userMessage = {
        id: Date.now(),
        text: inputMessage,
        sender: 'self',
        time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, userMessage]);
      setInputMessage('');
      setIsTyping(true);

      try {
        if (!chatSession.current) {
          throw new Error('Chat session not initialized');
        }

        const result = await chatSession.current.sendMessage(inputMessage);
        const botResponse = result.response.text();

        const botMessage = {
          id: Date.now() + 1,
          text: botResponse,
          sender: 'other',
          time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        };

        setMessages(prev => [...prev, botMessage]);
      } catch (error) {
        console.error('Error sending AI message:', error);
        const errorMessage = {
          id: Date.now() + 1,
          text: 'Sorry, I encountered an error. Please try again.',
          sender: 'other',
          time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        };
        setMessages(prev => [...prev, errorMessage]);
      } finally {
        setIsTyping(false);
      }
    } else {
      // Original user-to-user chat logic
      if (!isMatched) return;

      const messageId = Date.now();
      const newMessage = {
        id: messageId,
        text: inputMessage,
        sender: 'self',
        time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        hasReaction: false
      };

      setMessages([...messages, newMessage]);

      // Send message to partner via socket
      socketRef.current.emit('send-message', {
        sessionId,
        message: inputMessage
      });

      // Analyze message with AI
      analyzeConversation(inputMessage, 'self', messageId);

      setInputMessage('');
    }
  };

  const handleTyping = () => {
    if (isMatched && socketRef.current) {
      socketRef.current.emit('typing', { sessionId });
    }
  };

  const handleSkip = () => {
    if (socketRef.current && sessionId) {
      skipClickedRef.current = true;
      socketRef.current.emit('end-session', { sessionId });
      setMessages([]);
      setIsWaiting(true);
      setIsMatched(false);
      // Start looking for new match
      socketRef.current.emit('start-chat');
    }
  };

  const handleVideoCall = () => {
    if (isMatched && socketRef.current) {
      // Send video call request instead of directly navigating
      socketRef.current.emit('request-video', { sessionId });
      setIsWaitingForVideoResponse(true);
      console.log('Sent video call request to partner');
    }
  };

  const handleAcceptVideoCall = () => {
    if (socketRef.current) {
      socketRef.current.emit('accept-video', { sessionId });
      setVideoCallRequest(null);
      setIsWaitingForVideoResponse(false);
      setIsInVideoCall(true);
      // Save to sessionStorage for persistence
      sessionStorage.setItem('videoCallSessionId', sessionId);
      sessionStorage.setItem('videoCallPartnerId', partnerId);
      navigate('/videocall', { state: { sessionId, partnerId } });
    }
  };

  const handleRejectVideoCall = () => {
    if (socketRef.current) {
      socketRef.current.emit('reject-video', { sessionId });
      setVideoCallRequest(null);
      setIsWaitingForVideoResponse(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
    // Emit typing event
    handleTyping();
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file && isMatched) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageData = event.target?.result;
        const newMessage = {
          id: Date.now(),
          text: '[Photo]',
          sender: 'self',
          time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          hasReaction: false,
          imageData,
          fileName: file.name
        };
        setMessages([...messages, newMessage]);
        // Send photo to partner via socket
        socketRef.current.emit('send-message', {
          sessionId,
          message: '[Photo]',
          imageData,
          fileName: file.name
        });
      };
      reader.readAsDataURL(file);
    }
    // Reset input
    if (photoInputRef.current) {
      photoInputRef.current.value = '';
    }
  };

  const handleGifUpload = (e) => {
    const file = e.target.files?.[0];
    if (file && isMatched) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const gifData = event.target?.result;
        const newMessage = {
          id: Date.now(),
          text: '[GIF]',
          sender: 'self',
          time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          hasReaction: false,
          gifData,
          fileName: file.name
        };
        setMessages([...messages, newMessage]);
        // Send GIF to partner via socket
        socketRef.current.emit('send-message', {
          sessionId,
          message: '[GIF]',
          gifData,
          fileName: file.name
        });
      };
      reader.readAsDataURL(file);
    }
    // Reset input
    if (gifInputRef.current) {
      gifInputRef.current.value = '';
    }
  };

  const handleSelectGifFromPicker = (gifData) => {
    if (isMatched) {
      const newMessage = {
        id: Date.now(),
        text: '[GIF]',
        sender: 'self',
        time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        hasReaction: false,
        gifData
      };
      setMessages([...messages, newMessage]);
      // Send GIF to partner via socket
      socketRef.current.emit('send-message', {
        sessionId,
        message: '[GIF]',
        gifData
      });
    }
  };

  return (
    <div className="chat-container">
      {/* AI Compatibility Score Panel */}
      {isMatched && showAiScore && chatMode !== 'ai' && (
        <div className="ai-score-panel">
          <div className="ai-score-header">
            <span className="ai-score-title">
              <i className="ri-bar-chart-box-line"></i>
              Compatibility
            </span>
            <button
              className="ai-score-close"
              onClick={() => setShowAiScore(false)}
              title="Hide"
            >
              <i className="ri-close-line"></i>
            </button>
          </div>
          <div className="ai-score-content">
            {/* Compatibility Percentage */}
            <div className="compatibility-score-box">
              {aiAnalysis.isAnalyzing ? (
                <i className="ri-loader-4-line ai-analyzing-icon"></i>
              ) : (
                <span className="big-score">{aiAnalysis.compatibilityScore}%</span>
              )}
            </div>

            {/* Status Section */}
            <div className="status-section">
              <span className="status-label">Status</span>
              <div className="status-content">
                <div className="status-row connection">
                  {aiAnalysis.connectionStatus}
                </div>
                {aiAnalysis.commonInterests.length > 0 && (
                  <div className="status-row shared">
                    🤝 Shared: {aiAnalysis.commonInterests.join(', ')}
                  </div>
                )}
                <div className="status-row metrics">
                  📊 Top: Conversation Flow: {aiAnalysis.conversationFlow}% | Response Quality: {aiAnalysis.responseQuality}% | Energy Balance: {aiAnalysis.energyBalance}%
                </div>
              </div>
            </div>

            {/* Reset Chat Button */}
            <button className="reset-chat-btn" onClick={handleSkip}>
              <i className="ri-refresh-line"></i>
              Reset Chat
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-left">
          <div className="user-avatar">A</div>
          <div className="user-info">
            <h3>Anonymous</h3>
            <p>anonymous_user</p>
          </div>
        </div>
        <div className="chat-header-right">
          <button
            className="header-icon-btn video-call-btn"
            onMouseEnter={() => setVideoHovered(true)}
            onMouseLeave={() => setVideoHovered(false)}
            onClick={handleVideoCall}
            disabled={!isMatched}
            style={{ opacity: isMatched ? 1 : 0.5, cursor: isMatched ? 'pointer' : 'not-allowed' }}
          >
            <i className={videoHovered ? "ri-video-on-fill" : "ri-video-on-line"}></i>
            <span>Video Call</span>
          </button>
          <button
            className="header-icon-btn skip-btn"
            onMouseEnter={() => setSkipHovered(true)}
            onMouseLeave={() => setSkipHovered(false)}
            onClick={handleSkip}
            disabled={!isMatched}
            style={{ opacity: isMatched ? 1 : 0.5, cursor: isMatched ? 'pointer' : 'not-allowed' }}
          >
            <i className={skipHovered ? "ri-skip-forward-fill" : "ri-skip-forward-line"}></i>
            <span>Skip</span>
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="messages-area" ref={messagesAreaRef}>
        <div className="messages-container">
          {/* Match Info Banner */}
          {isMatched && isSmartMatch && matchInfo && showCommonInterests && (
            Object.keys(matchInfo).length > 0 ? (
              <div className="match-info-banner">
                <div className="match-info-content">
                  {matchInfo.sameCityMessage && (
                    <div className="match-info-item city-match">
                      <span className="match-icon">🌍</span>
                      <span>{matchInfo.sameCityMessage}</span>
                    </div>
                  )}
                  {matchInfo.sameCollegeMessage && (
                    <div className="match-info-item college-match">
                      <span className="match-icon">🎓</span>
                      <span>{matchInfo.sameCollegeMessage}</span>
                    </div>
                  )}
                  {matchInfo.commonInterestsMessage && (
                    <div className="match-info-item interests-match">
                      <span className="match-icon">🎯</span>
                      <span>{matchInfo.commonInterestsMessage}</span>
                    </div>
                  )}
                </div>
                <button
                  className="close-match-info-btn"
                  onClick={() => setShowCommonInterests(false)}
                  title="Close"
                >
                  <i className="ri-close-line"></i>
                </button>
              </div>
            ) : null
          )}

          {isWaiting && (
            <div className="waiting-message">
              <div className="waiting-spinner"></div>
              <p>Looking for someone to chat with...</p>
              <p className="waiting-subtext">
                {isSmartMatch ? 'Finding best match based on interests...' : 'Please wait while we find you a match'}
              </p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`message-wrapper ${message.sender === 'self' ? 'self' : 'other'}`}
            >
              {message.sender === 'other' && (
                <div className="message-avatar"></div>
              )}
              <div className="message-bubble-wrapper">
                <div className={`message-bubble ${message.sender}`}>
                  {message.imageData ? (
                    <img
                      src={message.imageData}
                      alt="shared"
                      style={{ maxWidth: '100%', borderRadius: '8px', maxHeight: '300px', cursor: 'pointer' }}
                      onClick={() => setSelectedImage(message.imageData)}
                    />
                  ) : message.gifData ? (
                    <img
                      src={message.gifData}
                      alt="shared GIF"
                      style={{ maxWidth: '100%', borderRadius: '8px', maxHeight: '300px', cursor: 'pointer' }}
                      onClick={() => setSelectedImage(message.gifData)}
                    />
                  ) : (
                    <p>{message.text}</p>
                  )}
                </div>
                {message.hasReaction && (
                  <span className={`message-reaction ${message.sender === 'self' ? 'reaction-self' : 'reaction-other'}`}>
                    {message.reaction}
                  </span>
                )}
                {/* AI Analysis inline display */}
                {messageAnalysis[message.id] && (
                  <div className="message-analysis">
                    <span className="analysis-emotion">{messageAnalysis[message.id].emotion} {messageAnalysis[message.id].emotionName}</span>
                    <span className="analysis-separator">|</span>
                    <span className={`analysis-sentiment ${messageAnalysis[message.id].sentiment}`}>
                      💬 {messageAnalysis[message.id].sentiment}{messageAnalysis[message.id].sentimentStrength && ` (${messageAnalysis[message.id].sentimentStrength})`}
                    </span>
                    {messageAnalysis[message.id].mainTopic && (
                      <>
                        <span className="analysis-separator">|</span>
                        <span className="analysis-topic">📌 {messageAnalysis[message.id].mainTopic}</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="message-wrapper other">
              <div className="message-avatar"></div>
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="chat-input-area">
        <div className="input-wrapper">
          <textarea
            placeholder="Type a message..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            className="message-input"
            rows="1"
          />
          <div className="input-actions">
            <button
              className="input-action-btn"
              onMouseEnter={() => setCameraHovered(true)}
              onMouseLeave={() => setCameraHovered(false)}
              onClick={() => photoInputRef.current?.click()}
              title="Photos"
            >
              <i className={cameraHovered ? "ri-image-fill" : "ri-image-line"}></i>
            </button>
            <button
              className="input-action-btn"
              onMouseEnter={() => setGifHovered(true)}
              onMouseLeave={() => setGifHovered(false)}
              onClick={() => setShowGifPicker(true)}
              title="GIF"
            >
              <i className={gifHovered ? "ri-file-gif-fill" : "ri-file-gif-line"}></i>
            </button>
            <button
              className="input-action-btn send-btn"
              onClick={handleSendMessage}
              onMouseEnter={() => setSendHovered(true)}
              onMouseLeave={() => setSendHovered(false)}
              title="Send"
            >
              <i className={sendHovered ? "ri-send-plane-2-fill" : "ri-send-plane-2-line"}></i>
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              style={{ display: 'none' }}
            />
            <input
              ref={gifInputRef}
              type="file"
              accept=".gif"
              onChange={handleGifUpload}
              style={{ display: 'none' }}
            />
          </div>
        </div>
      </div>

      {showGifPicker && (
        <GifPicker
          onSelectGif={handleSelectGifFromPicker}
          onClose={() => setShowGifPicker(false)}
        />
      )}

      {isWaitingForVideoResponse && (
        <div className="video-call-modal-overlay">
          <div className="video-call-modal waiting-call-modal">
            <div className="waiting-call-content">
              <h2 className="waiting-call-title">Calling...</h2>
              <div className="waiting-call-animation">
                <div className="pulse-ring"></div>
                <div className="pulse-ring pulse-ring-2"></div>
                <div className="pulse-ring pulse-ring-3"></div>
                <i className="ri-phone-fill waiting-call-icon"></i>
              </div>
              <p className="waiting-call-status">Waiting for partner to respond</p>
              <div className="waiting-call-timer">
                <span className="timer-dot"></span>
                <span className="timer-dot"></span>
                <span className="timer-dot"></span>
              </div>
            </div>
            <div className="video-call-actions">
              <button
                className="video-call-reject-btn cancel-call-btn"
                onClick={() => setIsWaitingForVideoResponse(false)}
              >
                Cancel Call
              </button>
            </div>
          </div>
        </div>
      )}

      {videoCallRequest && (
        <div className="video-call-modal-overlay">
          <div className="video-call-modal">
            <div className="video-call-header">
              <h2>Incoming Video Call</h2>
            </div>
            <div className="video-call-actions">
              <button
                className="video-call-reject-btn"
                onClick={handleRejectVideoCall}
              >
                Decline
              </button>
              <button
                className="video-call-accept-btn"
                onClick={handleAcceptVideoCall}
              >
                <i className="ri-phone-fill"></i>
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedImage && (
        <ImageModal
          imageUrl={selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </div>
  );
};

export default Chat;