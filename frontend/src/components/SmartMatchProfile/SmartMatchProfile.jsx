import React, { useState, useEffect, useRef } from 'react';
import './SmartMatchProfile.css';

const SmartMatchProfile = ({ onComplete, onClose }) => {
  const [formData, setFormData] = useState({
    college: '',
    city: '',
    interests: []
  });
  const modalRef = useRef(null);

  // Disable body scroll and pause Lenis when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    // Pause Lenis if it exists (on Landing page)
    if (window.pauseLenis) {
      window.pauseLenis();
    }

    // Prevent scroll propagation to parent
    const handleWheel = (e) => {
      if (modalRef.current) {
        e.stopPropagation();
      }
    };

    const handleTouchMove = (e) => {
      if (modalRef.current) {
        e.stopPropagation();
      }
    };

    if (modalRef.current) {
      modalRef.current.addEventListener('wheel', handleWheel, { passive: false });
      modalRef.current.addEventListener('touchmove', handleTouchMove, { passive: false });
    }

    return () => {
      document.body.style.overflow = 'auto';
      // Resume Lenis if it exists
      if (window.resumeLenis) {
        window.resumeLenis();
      }
      if (modalRef.current) {
        modalRef.current.removeEventListener('wheel', handleWheel);
        modalRef.current.removeEventListener('touchmove', handleTouchMove);
      }
    };
  }, []);

  const interestOptions = [
    'Tech',
    'Startups',
    'Movies',
    'Gaming',
    'Career',
    'College Life',
    'Music',
    'Fitness'
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const toggleInterest = (interest) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest]
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.city.trim() === '' || formData.interests.length === 0) {
      alert('Please enter your city and select at least one interest');
      return;
    }
    
    // Store the profile in sessionStorage for the Chat component
    onComplete(formData);
  };

  return (
    <div className="smart-match-overlay">
      <div className="smart-match-modal" ref={modalRef}>
        <div className="smart-match-header">
          <h2>Smart Match Profile</h2>
          <button className="close-btn" onClick={onClose}>
            <i className="ri-close-line"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="smart-match-form">
          {/* College / Organization */}
          <div className="form-group">
            <label htmlFor="college">
              College / Organization
              <span className="optional">(Optional)</span>
            </label>
            <p className="form-hint">Helps campus-based matching</p>
            <input
              type="text"
              id="college"
              name="college"
              value={formData.college}
              onChange={handleInputChange}
              placeholder="e.g., IIT Bhubaneshwar, Microsoft"
              className="form-input"
            />
          </div>

          {/* City */}
          <div className="form-group">
            <label htmlFor="city">
              City
              <span className="required">*</span>
            </label>
            <p className="form-hint">Only city name (no exact address or location)</p>
            <input
              type="text"
              id="city"
              name="city"
              value={formData.city}
              onChange={handleInputChange}
              placeholder="e.g., Delhi, Mumbai, Bangalore"
              className="form-input"
              required
            />
          </div>

          {/* Interests */}
          <div className="form-group">
            <label>
              Select Interests
              <span className="required">*</span>
            </label>
            <p className="form-hint">This improves matching quality significantly</p>
            <div className="interests-grid">
              {interestOptions.map(interest => (
                <button
                  key={interest}
                  type="button"
                  className={`interest-btn ${formData.interests.includes(interest) ? 'active' : ''}`}
                  onClick={() => toggleInterest(interest)}
                >
                  <span className="interest-label">{interest}</span>
                </button>
              ))}
            </div>
            {formData.interests.length > 0 && (
              <p className="selected-count">
                {formData.interests.length} interest{formData.interests.length !== 1 ? 's' : ''} selected
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-submit">
              Chat
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SmartMatchProfile;
