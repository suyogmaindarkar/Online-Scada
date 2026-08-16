// ═══════════════════════════════════════════════════════════
// Image Lightbox — Fullscreen image viewer for screenshots
// Supports single image or step-by-step image sequences
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

const ImageLightbox = ({ images, caption, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const isSequence = Array.isArray(images);
  const current = isSequence ? images[currentIndex] : { src: images, caption };

  // Handle keyboard nav
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && isSequence && currentIndex < images.length - 1) {
        setCurrentIndex(i => i + 1);
      }
      if (e.key === 'ArrowLeft' && isSequence && currentIndex > 0) {
        setCurrentIndex(i => i - 1);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentIndex, isSequence, images, onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.9)',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        cursor: 'zoom-out',
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          background: 'rgba(255,255,255,0.15)',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: '50%',
          width: '44px',
          height: '44px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <X size={22} />
      </button>

      {/* Image */}
      <img
        src={current.src}
        alt={current.caption || 'Screenshot'}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '90%',
          maxHeight: '80vh',
          objectFit: 'contain',
          borderRadius: '8px',
          boxShadow: '0px 20px 60px rgba(0,0,0,0.6)',
          cursor: 'default',
        }}
      />

      {/* Caption */}
      {current.caption && (
        <p style={{
          marginTop: '16px',
          color: '#FFFFFF',
          fontSize: '14px',
          textAlign: 'center',
          maxWidth: '80%',
          fontFamily: "'Inter', sans-serif",
        }}>
          {current.caption}
        </p>
      )}

      {/* Sequence controls */}
      {isSequence && images.length > 1 && (
        <>
          {/* Prev */}
          {currentIndex > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setCurrentIndex(i => i - 1); }}
              style={{
                position: 'absolute',
                left: '20px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'rgba(255,255,255,0.15)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '50%',
                width: '50px',
                height: '50px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ChevronLeft size={26} />
            </button>
          )}

          {/* Next */}
          {currentIndex < images.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setCurrentIndex(i => i + 1); }}
              style={{
                position: 'absolute',
                right: '20px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'rgba(255,255,255,0.15)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '50%',
                width: '50px',
                height: '50px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ChevronRight size={26} />
            </button>
          )}

          {/* Step counter */}
          <div style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '6px 14px',
            background: 'rgba(255,255,255,0.15)',
            color: '#FFFFFF',
            borderRadius: '20px',
            fontSize: '13px',
            fontFamily: 'monospace',
          }}>
            Step {currentIndex + 1} of {images.length}
          </div>
        </>
      )}
    </div>
  );
};

export default ImageLightbox;