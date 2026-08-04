import { X } from 'lucide-react';

const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null;

  const sizes = {
    sm: '448px',
    md: '512px',
    lg: '672px',
    xl: '896px',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        background: 'rgba(8, 27, 67, 0.50)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => {
        // Close if clicked on backdrop
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: sizes[size],
          maxHeight: '90vh',
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '16px',
          boxShadow: '0px 24px 80px rgba(8, 27, 67, 0.20)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px',
            borderBottom: '1px solid #E5E7EB',
            background: '#FFFFFF',
          }}
        >
          <h2
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: '#081B43',
              margin: 0,
              fontFamily: "'Montserrat', sans-serif",
              letterSpacing: '-0.01em',
            }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            style={{
              padding: '6px',
              color: '#5F6B7A',
              background: 'transparent',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#EEF6FF';
              e.currentTarget.style.color = '#2563EB';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#5F6B7A';
            }}
            title="Close"
          >
            <X style={{ width: '20px', height: '20px' }} />
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            padding: '24px',
            overflowY: 'auto',
            flex: 1,
            color: '#334155',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;