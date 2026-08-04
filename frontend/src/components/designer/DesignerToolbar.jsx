import {
  FileText, FolderOpen, Save, Undo2, Redo2,
  Scissors, Copy, Clipboard, ZoomIn, ZoomOut,
  Grid3X3, Play, Link2, Magnet,
} from 'lucide-react';

const DesignerToolbar = ({
  onNew, onOpen, onSave, onRun,
  onUndo, onRedo, canUndo, canRedo,
  onCut, onCopy, onPaste,
  onZoomIn, onZoomOut, zoom,
  onToggleGrid, showGrid,
  onToggleSnap, snapEnabled,
  gridSize = 10,
  canvasWidth, canvasHeight, canvasBg,
  onCanvasWidthChange, onCanvasHeightChange, onCanvasBgChange,
  saving,
  onOpenConnections,
  connectionsCount = 0,
}) => {
  const ToolBtn = ({ icon: Icon, onClick, disabled, active, title }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        padding: '6px',
        borderRadius: '4px',
        background: active ? '#2563EB' : 'transparent',
        color: active ? '#FFFFFF' : disabled ? '#94A3B8' : '#334155',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        border: 'none',
        transition: 'all 0.15s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onMouseEnter={(e) => {
        if (!disabled && !active) {
          e.currentTarget.style.background = '#EEF6FF';
          e.currentTarget.style.color = '#2563EB';
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !active) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = '#334155';
        }
      }}
    >
      <Icon size={16} />
    </button>
  );

  const Separator = () => (
    <div style={{ width: '1px', height: '24px', background: '#E5E7EB', margin: '0 4px' }} />
  );

  const numberInputStyle = {
    width: '56px',
    height: '24px',
    padding: '0 4px',
    fontSize: '11px',
    textAlign: 'center',
    outline: 'none',
    borderRadius: '4px',
    background: '#FFFFFF',
    border: '1px solid #E5E7EB',
    color: '#081B43',
    transition: 'border-color 0.15s ease',
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '40px',
        minHeight: '40px',
        padding: '0 8px',
        gap: '2px',
        userSelect: 'none',
        background: '#FFFFFF',
        borderBottom: '1px solid #E5E7EB',
        boxShadow: '0px 1px 2px rgba(8, 27, 67, 0.03)',
        flexShrink: 0,
      }}
    >
      {/* File operations */}
      <ToolBtn icon={FileText} onClick={onNew} title="New Screen (Ctrl+N)" />
      <ToolBtn icon={FolderOpen} onClick={onOpen} title="Open Screen (Ctrl+O)" />
      <ToolBtn icon={Save} onClick={onSave} disabled={saving} title="Save (Ctrl+S)" />

      <Separator />

      {/* Edit operations */}
      <ToolBtn icon={Undo2} onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)" />
      <ToolBtn icon={Redo2} onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)" />

      <Separator />

      {/* Clipboard */}
      <ToolBtn icon={Scissors} onClick={onCut} title="Cut (Ctrl+X)" />
      <ToolBtn icon={Copy} onClick={onCopy} title="Copy (Ctrl+C)" />
      <ToolBtn icon={Clipboard} onClick={onPaste} title="Paste (Ctrl+V)" />

      <Separator />

      {/* Zoom */}
      <ToolBtn icon={ZoomOut} onClick={onZoomOut} title="Zoom Out" />
      <span
        style={{
          fontSize: '10px',
          fontFamily: 'monospace',
          width: '40px',
          textAlign: 'center',
          fontWeight: 600,
          color: '#334155',
        }}
      >
        {zoom}%
      </span>
      <ToolBtn icon={ZoomIn} onClick={onZoomIn} title="Zoom In" />

      <Separator />

      {/* Grid + Snap */}
      <ToolBtn
        icon={Grid3X3}
        onClick={onToggleGrid}
        active={showGrid}
        title="Toggle Grid Visibility"
      />
      <ToolBtn
        icon={Magnet}
        onClick={onToggleSnap}
        active={snapEnabled}
        title={
          snapEnabled
            ? `Snap to Grid: ON (${gridSize}px) — Hold Ctrl to bypass`
            : 'Snap to Grid: OFF (free positioning)'
        }
      />
      {snapEnabled && (
        <span
          style={{
            fontSize: '9px',
            fontFamily: 'monospace',
            color: '#2563EB',
            marginLeft: '2px',
            fontWeight: 700,
          }}
        >
          {gridSize}px
        </span>
      )}

      <Separator />

      {/* Connections */}
      <button
        onClick={onOpenConnections}
        title="Manage Direct Connections"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 8px',
          borderRadius: '4px',
          color: '#334155',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#EEF6FF';
          e.currentTarget.style.color = '#2563EB';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = '#334155';
        }}
      >
        <Link2 size={14} />
        <span style={{ fontSize: '11px', fontWeight: 600 }}>Connections</span>
        {connectionsCount > 0 && (
          <span
            style={{
              marginLeft: '4px',
              padding: '2px 6px',
              background: '#2563EB',
              color: '#FFFFFF',
              fontSize: '9px',
              borderRadius: '9999px',
              fontFamily: 'monospace',
              fontWeight: 700,
            }}
          >
            {connectionsCount}
          </span>
        )}
      </button>

      <Separator />

      {/* Canvas size */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '4px' }}>
        <span style={{ fontSize: '10px', fontWeight: 600, color: '#5F6B7A' }}>Size:</span>
        <input
          type="number"
          value={canvasWidth}
          onChange={(e) => onCanvasWidthChange(parseInt(e.target.value) || 800)}
          style={numberInputStyle}
          onFocus={(e) => { e.target.style.borderColor = '#2563EB'; }}
          onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; }}
        />
        <span style={{ fontSize: '10px', color: '#94A3B8' }}>×</span>
        <input
          type="number"
          value={canvasHeight}
          onChange={(e) => onCanvasHeightChange(parseInt(e.target.value) || 600)}
          style={numberInputStyle}
          onFocus={(e) => { e.target.style.borderColor = '#2563EB'; }}
          onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; }}
        />
        <input
          type="color"
          value={canvasBg || '#ffffff'}
          onChange={(e) => onCanvasBgChange(e.target.value)}
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '4px',
            cursor: 'pointer',
            border: '1px solid #E5E7EB',
          }}
          title="Canvas Background"
        />
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Run button */}
      <button
        onClick={onRun}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 12px',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: 600,
          color: '#FFFFFF',
          background: '#16A34A',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0px 2px 6px rgba(22, 163, 74, 0.30)',
          fontFamily: "'Montserrat', sans-serif",
          transition: 'background 0.15s ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#15803D'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = '#16A34A'; }}
        title="Run screen in Runtime mode (F5)"
      >
        <Play size={12} />
        Run
      </button>
    </div>
  );
};

export default DesignerToolbar;