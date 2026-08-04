import { useState } from 'react';
import {
  FolderOpen, FileText, ChevronRight, ChevronDown,
  RefreshCw, Star,
} from 'lucide-react';

const ScreenExplorer = ({ screens, onLoadScreen, currentScreen, onRefresh }) => {
  const [expanded, setExpanded] = useState({ screens: true, templates: false });

  const toggle = (key) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div
      style={{
        width: '208px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        background: '#FFFFFF',
        borderLeft: '1px solid #E5E7EB',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: '#F8FAFC',
          borderBottom: '1px solid #E5E7EB',
        }}
      >
        <span
          style={{
            fontSize: '12px',
            fontWeight: 700,
            color: '#081B43',
            fontFamily: "'Montserrat', sans-serif",
          }}
        >
          Process Pictures
        </span>
        <button
          onClick={onRefresh}
          style={{
            padding: '4px',
            borderRadius: '4px',
            background: 'transparent',
            color: '#5F6B7A',
            border: 'none',
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
          title="Refresh screens"
        >
          <RefreshCw size={12} />
        </button>
      </div>

      {/* Search */}
      <div
        style={{
          padding: '6px 8px',
          borderBottom: '1px solid #E5E7EB',
        }}
      >
        <input
          type="text"
          placeholder="Filter screens..."
          style={{
            width: '100%',
            padding: '4px 8px',
            fontSize: '11px',
            background: '#F8FAFC',
            border: '1px solid #E5E7EB',
            borderRadius: '4px',
            outline: 'none',
            color: '#081B43',
            transition: 'border-color 0.15s ease',
          }}
          onFocus={(e) => { e.target.style.borderColor = '#2563EB'; }}
          onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; }}
        />
      </div>

      {/* Tree */}
      <div style={{ flex: 1, overflowY: 'auto', fontSize: '11px' }}>
        {/* My Screens */}
        <div>
          <button
            onClick={() => toggle('screens')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              width: '100%',
              padding: '6px 8px',
              background: 'transparent',
              border: 'none',
              color: '#081B43',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#F8FAFC'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            {expanded.screens ? (
              <ChevronDown size={12} style={{ color: '#2563EB' }} />
            ) : (
              <ChevronRight size={12} style={{ color: '#5F6B7A' }} />
            )}
            <FolderOpen size={12} style={{ color: '#2563EB' }} />
            <span>My Screens ({screens.length})</span>
          </button>

          {expanded.screens && (
            <div style={{ marginLeft: '8px' }}>
              {screens.length === 0 ? (
                <p
                  style={{
                    padding: '8px 16px',
                    fontSize: '10px',
                    color: '#94A3B8',
                    fontStyle: 'italic',
                  }}
                >
                  No screens yet
                </p>
              ) : (
                screens.map((screen) => {
                  const isActive = currentScreen?._id === screen._id;
                  return (
                    <button
                      key={screen._id}
                      onClick={() => onLoadScreen(screen)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        width: '100%',
                        padding: '4px 12px',
                        borderRadius: '4px',
                        marginRight: '8px',
                        background: isActive ? '#2563EB' : 'transparent',
                        color: isActive ? '#FFFFFF' : '#334155',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: isActive ? 600 : 500,
                        transition: 'all 0.15s ease',
                        textAlign: 'left',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = '#EEF6FF';
                          e.currentTarget.style.color = '#2563EB';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = '#334155';
                        }
                      }}
                      title={`${screen.screenName} (${screen.elements?.length || 0} elements)`}
                    >
                      <FileText size={11} style={{ flexShrink: 0 }} />
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {screen.screenName}
                      </span>
                      {screen.isStartupScreen && (
                        <Star
                          size={10}
                          style={{ flexShrink: 0, color: isActive ? '#FEF3C7' : '#F59E0B' }}
                          fill="currentColor"
                        />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom info */}
      <div
        style={{
          padding: '8px 12px',
          background: '#F8FAFC',
          borderTop: '1px solid #E5E7EB',
        }}
      >
        <p style={{ fontSize: '10px', color: '#5F6B7A', margin: 0 }}>
          {screens.length} screen{screens.length !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
};

export default ScreenExplorer;