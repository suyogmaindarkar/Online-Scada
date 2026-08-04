import { useEffect } from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';

const Toast = ({ id, message, type = 'info', duration = 3000, onClose }) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => onClose(id), duration);
      return () => clearTimeout(timer);
    }
  }, [id, duration, onClose]);

  // ─── Blue theme color config ───
  const config = {
    success: {
      icon: CheckCircle,
      bg: '#F0FDF4',
      border: '#16A34A',
      text: '#15803D',
      iconColor: '#16A34A',
      shadow: '0px 8px 24px rgba(22, 163, 74, 0.15)',
    },
    error: {
      icon: XCircle,
      bg: '#FEF2F2',
      border: '#DC2626',
      text: '#B91C1C',
      iconColor: '#DC2626',
      shadow: '0px 8px 24px rgba(220, 38, 38, 0.15)',
    },
    warning: {
      icon: AlertTriangle,
      bg: '#FFFBEB',
      border: '#F59E0B',
      text: '#B45309',
      iconColor: '#F59E0B',
      shadow: '0px 8px 24px rgba(245, 158, 11, 0.15)',
    },
    info: {
      icon: Info,
      bg: '#EFF6FF',
      border: '#2563EB',
      text: '#1E40AF',
      iconColor: '#2563EB',
      shadow: '0px 8px 24px rgba(37, 99, 235, 0.15)',
    },
  };

  const style = config[type] || config.info;
  const Icon = style.icon;

  return (
    <div
      className="animate-slide-in"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        minWidth: '300px',
        maxWidth: '420px',
        padding: '12px 14px',
        borderRadius: '10px',
        border: `1px solid ${style.border}`,
        background: style.bg,
        boxShadow: style.shadow,
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <Icon
        style={{
          width: '20px',
          height: '20px',
          flexShrink: 0,
          marginTop: '2px',
          color: style.iconColor,
        }}
      />
      <div
        style={{
          flex: 1,
          fontSize: '13px',
          fontWeight: 500,
          color: style.text,
          lineHeight: '20px',
        }}
      >
        {message}
      </div>
      <button
        onClick={() => onClose(id)}
        style={{
          padding: '2px',
          borderRadius: '4px',
          color: style.text,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.15s ease',
          flexShrink: 0,
          opacity: 0.7,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(0, 0, 0, 0.06)';
          e.currentTarget.style.opacity = 1;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.opacity = 0.7;
        }}
        title="Dismiss"
      >
        <X style={{ width: '14px', height: '14px' }} />
      </button>
    </div>
  );
};

export default Toast;