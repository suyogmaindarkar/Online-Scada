import Modal from './Modal';
import { AlertTriangle, Info, CheckCircle, HelpCircle } from 'lucide-react';

const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm',
  message = 'Are you sure?',
  confirmText = 'Delete',
  cancelText = 'Cancel',
  confirmColor = 'red', // 'red' | 'blue' | 'green' | 'yellow' | 'navy'
  icon = 'warning',     // 'warning' | 'info' | 'success' | 'question'
}) => {
  // Icon config — blue theme
  const iconConfig = {
    warning: {
      Icon: AlertTriangle,
      bg: '#FEE2E2',
      color: '#DC2626',
    },
    info: {
      Icon: Info,
      bg: '#EFF6FF',
      color: '#2563EB',
    },
    success: {
      Icon: CheckCircle,
      bg: '#DCFCE7',
      color: '#16A34A',
    },
    question: {
      Icon: HelpCircle,
      bg: '#FEF3C7',
      color: '#F59E0B',
    },
  };

  // Button color config — matches new theme
  const buttonColors = {
    red:    { bg: '#DC2626', hover: '#B91C1C' },
    blue:   { bg: '#2563EB', hover: '#1D4ED8' },
    green:  { bg: '#16A34A', hover: '#15803D' },
    yellow: { bg: '#F59E0B', hover: '#D97706' },
    navy:   { bg: '#2563EB', hover: '#1D4ED8' },
  };

  const { Icon, bg, color } = iconConfig[icon] || iconConfig.warning;
  const btnColor = buttonColors[confirmColor] || buttonColors.red;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div style={{ textAlign: 'center' }}>
        {/* Icon circle */}
        <div
          style={{
            display: 'inline-flex',
            padding: '12px',
            borderRadius: '9999px',
            marginBottom: '16px',
            background: bg,
          }}
        >
          <Icon style={{ width: '32px', height: '32px', color }} />
        </div>

        {/* Message */}
        <p
          style={{
            color: '#334155',
            marginBottom: '24px',
            fontSize: '14px',
            lineHeight: '20px',
          }}
        >
          {message}
        </p>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '12px' }}>
          {/* Cancel button */}
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '10px 16px',
              background: '#F1F5F9',
              color: '#334155',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              fontWeight: 500,
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              fontFamily: "'Inter', sans-serif",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#E5E7EB';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#F1F5F9';
            }}
          >
            {cancelText}
          </button>

          {/* Confirm button */}
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            style={{
              flex: 1,
              padding: '10px 16px',
              background: btnColor.bg,
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
              fontFamily: "'Montserrat', sans-serif",
              boxShadow: `0px 4px 12px ${btnColor.bg}40`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = btnColor.hover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = btnColor.bg;
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;