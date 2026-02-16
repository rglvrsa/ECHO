import React, { useState, useEffect } from 'react';
import './GifPicker.css';

const GifPicker = ({ onSelectGif, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('trending');

  // Using your original Giphy API key (works!)
  const GIPHY_API_KEY = 'qRr6pqRVztbJ8ztYA7qTHXRGo28xYmY0';

  // Debug: Log API key on mount
  useEffect(() => {
    console.log('GifPicker mounted');
    console.log('API Key:', GIPHY_API_KEY);
    if (GIPHY_API_KEY) {
      fetchTrendingGifs();
    }
  }, []);

  const fetchTrendingGifs = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=24&rating=g`;
      console.log('Fetching trending GIFs from:', url);
      
      const response = await fetch(url);
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Trending GIFs data received:', data);
      console.log('Number of GIFs:', data.data?.length);
      
      if (data.data && data.data.length > 0) {
        setGifs(data.data);
        setError(null);
      } else {
        setError('No GIFs found');
        setGifs([]);
      }
    } catch (error) {
      console.error('Error fetching trending GIFs:', error);
      setError(error.message);
      setGifs([]);
    }
    setLoading(false);
  };

  const searchGifs = async (query) => {
    if (!query.trim()) {
      fetchTrendingGifs();
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const url = `https://api.giphy.com/v1/gifs/search?q=${encodeURIComponent(query)}&api_key=${GIPHY_API_KEY}&limit=24&rating=g`;
      console.log('Searching GIFs:', url);
      
      const response = await fetch(url);
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Search results:', data.data?.length);
      
      if (data.data && data.data.length > 0) {
        setGifs(data.data);
        setError(null);
      } else {
        setError(`No GIFs found for "${query}"`);
        setGifs([]);
      }
    } catch (error) {
      console.error('Error searching GIFs:', error);
      setError(error.message);
      setGifs([]);
    }
    setLoading(false);
  };

  const handleSearch = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    searchGifs(query);
  };

  const handleGifSelect = (gif) => {
    // Use the animated_gif URL directly without converting to base64
    // This avoids CORS issues
    const gifUrl = gif.images.original.url || gif.images.fixed_height.url;
    
    console.log('Selected GIF URL:', gifUrl);
    
    // Send the URL directly (Socket.io can handle URLs)
    // If you need base64, use a proxy endpoint instead
    onSelectGif(gifUrl);
    onClose();
  };

  const categories = [
    { id: 'trending', label: '📈 Trending', icon: '📈' },
    { id: 'funny', label: '😂 Funny', icon: '😂' },
    { id: 'happy', label: '😊 Happy', icon: '😊' },
    { id: 'love', label: '❤️ Love', icon: '❤️' },
    { id: 'celebrate', label: '🎉 Celebrate', icon: '🎉' },
    { id: 'reaction', label: '😮 Reaction', icon: '😮' },
  ];

  return (
    <div className="gif-picker-overlay">
      <div className="gif-picker-modal">
        <div className="gif-picker-header">
          <h2>Select a GIF</h2>
          <button className="gif-picker-close" onClick={onClose}>
            <i className="ri-close-line"></i>
          </button>
        </div>

        <div className="gif-picker-search">
          <input
            type="text"
            placeholder="Search GIFs via Giphy"
            value={searchQuery}
            onChange={handleSearch}
            className="gif-search-input"
          />
        </div>

        <div className="gif-picker-categories">
          <button
            className={`category-btn ${selectedCategory === 'trending' ? 'active' : ''}`}
            onClick={() => {
              setSelectedCategory('trending');
              setSearchQuery('');
              fetchTrendingGifs();
            }}
          >
            <i className="ri-fire-line"></i>
            Trending
          </button>
          <button
            className={`category-btn ${selectedCategory === 'funny' ? 'active' : ''}`}
            onClick={() => {
              setSelectedCategory('funny');
              setSearchQuery('funny');
              searchGifs('funny');
            }}
          >
            😂
          </button>
          <button
            className={`category-btn ${selectedCategory === 'happy' ? 'active' : ''}`}
            onClick={() => {
              setSelectedCategory('happy');
              setSearchQuery('happy');
              searchGifs('happy');
            }}
          >
            😊
          </button>
          <button
            className={`category-btn ${selectedCategory === 'love' ? 'active' : ''}`}
            onClick={() => {
              setSelectedCategory('love');
              setSearchQuery('love');
              searchGifs('love');
            }}
          >
            ❤️
          </button>
          <button
            className={`category-btn ${selectedCategory === 'celebrate' ? 'active' : ''}`}
            onClick={() => {
              setSelectedCategory('celebrate');
              setSearchQuery('celebrate');
              searchGifs('celebrate');
            }}
          >
            🎉
          </button>
          <button
            className={`category-btn ${selectedCategory === 'reaction' ? 'active' : ''}`}
            onClick={() => {
              setSelectedCategory('reaction');
              setSearchQuery('reaction');
              searchGifs('reaction');
            }}
          >
            😮
          </button>
        </div>

        <div className="gif-picker-grid">
          {loading ? (
            <div className="gif-picker-loading">
              <div className="spinner"></div>
              <p>Loading GIFs...</p>
            </div>
          ) : error ? (
            <div className="gif-picker-empty">
              <p>❌ {error}</p>
              <p style={{ fontSize: '0.85rem', color: '#888' }}>Check browser console for details</p>
              <button 
                onClick={() => fetchTrendingGifs()}
                style={{
                  marginTop: '1rem',
                  padding: '0.5rem 1rem',
                  background: 'rgba(161, 255, 98, 0.2)',
                  border: '1px solid rgba(161, 255, 98, 0.5)',
                  color: '#fff',
                  borderRadius: '20px',
                  cursor: 'pointer'
                }}
              >
                Retry
              </button>
            </div>
          ) : gifs.length > 0 ? (
            gifs.map((gif) => (
              <div
                key={gif.id}
                className="gif-item"
                onClick={() => handleGifSelect(gif)}
              >
                <img
                  src={gif.images.fixed_height.url}
                  alt={gif.title}
                  title={gif.title}
                />
              </div>
            ))
          ) : (
            <div className="gif-picker-empty">
              <p>No GIFs found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GifPicker;
