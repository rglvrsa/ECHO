import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import './ChatBot.css';

const ChatBot = () => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Hi! I'm Echo, your AI assistant. How can I help you today?",
      sender: 'bot',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showChatBot, setShowChatBot] = useState(false);
  const messagesEndRef = useRef(null);
  const genAI = useRef(null);
  const chatSession = useRef(null);

  // Initialize Gemini AI
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

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!inputValue.trim()) return;

    // Add user message
    const userMessage = {
      id: messages.length + 1,
      text: inputValue,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Add a placeholder bot message immediately
    const botMessageId = messages.length + 2;
    const botMessage = {
      id: botMessageId,
      text: '',
      sender: 'bot',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, botMessage]);

    try {
      if (!chatSession.current) {
        throw new Error('Chat session not initialized');
      }

      const result = await chatSession.current.sendMessage(inputValue);
      const botResponse = result.response.text();

      // Update the placeholder message with actual response
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === botMessageId ? { ...msg, text: botResponse } : msg
        )
      );
    } catch (error) {
      console.error('Error sending message:', error);

      // Update the placeholder message with error
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === botMessageId
            ? { ...msg, text: 'Sorry, I encountered an error. Please try again.' }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: 1,
        text: "Hi! I'm Echo, your AI assistant. How can I help you today?",
        sender: 'bot',
        timestamp: new Date(),
      },
    ]);
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || 'AIzaSyCnuc1rMSx5--ZLbbmugnq_NkE36frKbOQ';
    const newGenAI = new GoogleGenerativeAI(apiKey);
    const model = newGenAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
    chatSession.current = model.startChat({
      history: [],
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.7,
      },
    });
  };

  return (
    <div className="chatbot-container">
      {/* Floating Button */}
      {!showChatBot && (
        <div className="chatbot-fab" onClick={() => setShowChatBot(true)}>
          <div className="fab-icon">
            <span className="echo-icon">✨</span>
          </div>
          <div className="fab-text">Echo AI</div>
        </div>
      )}

      {/* Chat Window */}
      {showChatBot && (
        <div className="chatbot-window">
          {/* Header */}
          <div className="chatbot-header">
            <div className="header-content">
              <div className="header-title">
                <h3>Echo AI</h3>
                <p>Intelligent Response</p>
              </div>
              <div className="header-icons">
                <button className="icon-btn" title="Clear chat" onClick={clearChat}>
                  🔄
                </button>
                <button
                  className="icon-btn"
                  title="Close"
                  onClick={() => setShowChatBot(false)}
                >
                  ✕
                </button>
              </div>
            </div>
          </div>

          {/* Messages Area */}
          <div className="chatbot-messages">
            {messages.map((msg) => (
              <div key={msg.id} className={`message ${msg.sender}`}>
                <div className="message-avatar">
                  {msg.sender === 'bot' ? '🤖' : '👤'}
                </div>
                <div className="message-content">
                  <div className="message-text">{msg.text}</div>
                  <div className="message-time">
                    {msg.timestamp.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="message bot">
                <div className="message-avatar">🤖</div>
                <div className="message-content">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="chatbot-input-area">
            <textarea
              className="chatbot-input"
              placeholder="Type your message..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              rows="2"
            />
            <button
              className="send-btn"
              onClick={sendMessage}
              disabled={isLoading || !inputValue.trim()}
              title="Send message"
            >
              {isLoading ? '...' : '➤'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatBot;
