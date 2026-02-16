import React, { useState, useEffect } from 'react';
import './ImageModal.css';

const ImageModal = ({ imageUrl, onClose }) => {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  const handleZoomIn = () => {
    setScale(prevScale => Math.min(prevScale + 0.5, 3));
  };

  const handleZoomOut = () => {
    setScale(prevScale => Math.max(prevScale - 0.5, 1));
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = 'image.jpg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="image-modal-overlay" onClick={onClose}>
      <div className="image-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="image-modal-header">
          <div className="image-modal-title">Image Preview</div>
          <button className="image-modal-close" onClick={onClose}>
            <i className="ri-close-line"></i>
          </button>
        </div>

        <div className="image-modal-content">
          <img
            src={imageUrl}
            alt="Preview"
            style={{
              transform: `scale(${scale})`,
            }}
            className="image-modal-img"
          />
        </div>

        <div className="image-modal-footer">
          <button className="image-modal-btn" onClick={handleZoomOut} title="Zoom Out">
            <i className="ri-zoom-out-line"></i>
          </button>
          <span className="image-modal-zoom-level">{Math.round(scale * 100)}%</span>
          <button className="image-modal-btn" onClick={handleZoomIn} title="Zoom In">
            <i className="ri-zoom-in-line"></i>
          </button>
          <div className="image-modal-divider"></div>
          <button className="image-modal-btn" onClick={handleDownload} title="Download">
            <i className="ri-download-line"></i>
          </button>
          <button className="image-modal-btn" onClick={onClose} title="Close">
            <i className="ri-arrow-right-line"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageModal;
