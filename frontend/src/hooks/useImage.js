import { useState, useEffect } from 'react';

// ═══════════════════════════════════════════════════════════
// useImage — Load image URL as HTML Image object for Konva
// Sprint F: SVG symbol rendering
// ═══════════════════════════════════════════════════════════

const useImage = (url) => {
  const [image, setImage] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | loaded | error

  useEffect(() => {
    if (!url) {
      setImage(null);
      setStatus('error');
      return;
    }

    const img = new window.Image();
    img.crossOrigin = 'Anonymous';

    const handleLoad = () => {
      setImage(img);
      setStatus('loaded');
    };
    const handleError = () => {
      console.error('Failed to load SVG:', url);
      setStatus('error');
    };

    img.addEventListener('load', handleLoad);
    img.addEventListener('error', handleError);
    img.src = url;

    return () => {
      img.removeEventListener('load', handleLoad);
      img.removeEventListener('error', handleError);
    };
  }, [url]);

  return [image, status];
};

export default useImage;