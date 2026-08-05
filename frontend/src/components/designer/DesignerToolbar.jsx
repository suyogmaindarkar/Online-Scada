import {
  FileText, FolderOpen, Save, Undo2, Redo2,
  Scissors, Copy, Clipboard, ZoomIn, ZoomOut,
  Grid3X3, Play, Link2, Magnet,
  CopyPlus, Group as GroupIcon, Ungroup,
  AlignLeft, AlignCenter, AlignRight,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  AlignHorizontalSpaceBetween, AlignVerticalSpaceBetween,
  MoveUp, MoveDown, ChevronsUp, ChevronsDown,
} from 'lucide-react';
import { useState } from 'react';

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
  // ✅ Round 7 additions
  selectedCount = 0,
  onDuplicate,
  onGroup,
  onUngroup,
  onAlign,
  onDistribute,
  onZOrder,
}) => {
  const [showAlignMenu, setShowAlignMenu] = useState(false);
  const [showZOrderMenu, setShowZOrderMenu] = useState(false);

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

  const hasSelection = selectedCount > 0;
  const has2Plus = selectedCount >= 2;
  const has3Plus = selectedCount >= 3;

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
      <ToolBtn icon={Scissors} onClick={onCut} disabled={!hasSelection} title="Cut (Ctrl+X)" />
      <ToolBtn icon={Copy} onClick={onCopy} disabled={!hasSelection} title="Copy (Ctrl+C)" />
      <ToolBtn icon={Clipboard} onClick={onPaste} title="Paste (Ctrl+V)" />

      {/* ✅ T033: Duplicate */}
      <ToolBtn
        icon={CopyPlus}
        onClick={onDuplicate}
        disabled={!hasSelection}
        title="Duplicate (Ctrl+D)"
      />

      <Separator />

      {/* ✅ T036: Group / Ungroup */}
      <ToolBtn
        icon={GroupIcon}
        onClick={onGroup}
        disabled={!has2Plus}
        title="Group (Ctrl+G) — 2+ elements needed"
      />
      <ToolBtn
        icon={Ungroup}
        onClick={onUngroup}
        disabled={!hasSelection}
        title="Ungroup (Ctrl+Shift+G)"
      />

      <Separator />

      {/* ✅ T037: Align dropdown */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setShowAlignMenu(!showAlignMenu)}
          disabled={!hasSelection}
          title={hasSelection ? (has2Plus ? 'Align (relative to first selected)' : 'Align (relative to canvas)') : 'Select element(s) first'}
          style={{
            padding: '6px 8px',
            borderRadius: '4px',
            background: showAlignMenu ? '#EEF6FF' : 'transparent',
            color: hasSelection ? (showAlignMenu ? '#2563EB' : '#334155') : '#94A3B8',
            cursor: hasSelection ? 'pointer' : 'not-allowed',
            opacity: hasSelection ? 1 : 0.5,
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            fontSize: '11px',
            fontWeight: 500,
          }}
        >
          <AlignCenter size={16} />
          <span>Align</span>
        </button>

        {showAlignMenu && (
          <>
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 40 }}
              onClick={() => setShowAlignMenu(false)}
            />
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '2px',
                background: '#FFFFFF',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                padding: '6px',
                boxShadow: '0px 8px 24px rgba(8, 27, 67, 0.15)',
                zIndex: 50,
                minWidth: '180px',
              }}
            >
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#5F6B7A', textTransform: 'uppercase', padding: '4px 8px' }}>
                Horizontal
              </div>
              <AlignMenuItem icon={AlignLeft} label="Align Left" onClick={() => { onAlign('left'); setShowAlignMenu(false); }} />
              <AlignMenuItem icon={AlignCenter} label="Align Center" onClick={() => { onAlign('centerH'); setShowAlignMenu(false); }} />
              <AlignMenuItem icon={AlignRight} label="Align Right" onClick={() => { onAlign('right'); setShowAlignMenu(false); }} />

              <div style={{ borderTop: '1px solid #E5E7EB', margin: '4px 0' }} />

              <div style={{ fontSize: '10px', fontWeight: 700, color: '#5F6B7A', textTransform: 'uppercase', padding: '4px 8px' }}>
                Vertical
              </div>
              <AlignMenuItem icon={AlignStartVertical} label="Align Top" onClick={() => { onAlign('top'); setShowAlignMenu(false); }} />
              <AlignMenuItem icon={AlignCenterVertical} label="Align Middle" onClick={() => { onAlign('centerV'); setShowAlignMenu(false); }} />
              <AlignMenuItem icon={AlignEndVertical} label="Align Bottom" onClick={() => { onAlign('bottom'); setShowAlignMenu(false); }} />

              <div style={{ borderTop: '1px solid #E5E7EB', margin: '4px 0' }} />

              <div style={{ fontSize: '10px', fontWeight: 700, color: '#5F6B7A', textTransform: 'uppercase', padding: '4px 8px' }}>
                Distribute {!has3Plus && <span style={{ color: '#94A3B8', fontWeight: 400, textTransform: 'none' }}>(3+ needed)</span>}
              </div>
              <AlignMenuItem
                icon={AlignHorizontalSpaceBetween}
                label="Distribute Horizontal"
                onClick={() => { onDistribute('horizontal'); setShowAlignMenu(false); }}
                disabled={!has3Plus}
              />
              <AlignMenuItem
                icon={AlignVerticalSpaceBetween}
                label="Distribute Vertical"
                onClick={() => { onDistribute('vertical'); setShowAlignMenu(false); }}
                disabled={!has3Plus}
              />
            </div>
          </>
        )}
      </div>

      <Separator />

      {/* ✅ T038: Z-Order dropdown */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setShowZOrderMenu(!showZOrderMenu)}
          disabled={!hasSelection}
          title="Arrange (Z-order)"
          style={{
            padding: '6px 8px',
            borderRadius: '4px',
            background: showZOrderMenu ? '#EEF6FF' : 'transparent',
            color: hasSelection ? (showZOrderMenu ? '#2563EB' : '#334155') : '#94A3B8',
            cursor: hasSelection ? 'pointer' : 'not-allowed',
            opacity: hasSelection ? 1 : 0.5,
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            fontSize: '11px',
            fontWeight: 500,
          }}
        >
          <ChevronsUp size={16} />
          <span>Arrange</span>
        </button>

        {showZOrderMenu && (
          <>
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 40 }}
              onClick={() => setShowZOrderMenu(false)}
            />
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '2px',
                background: '#FFFFFF',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                padding: '6px',
                boxShadow: '0px 8px 24px rgba(8, 27, 67, 0.15)',
                zIndex: 50,
                minWidth: '200px',
              }}
            >
              <AlignMenuItem
                icon={ChevronsUp}
                label="Bring to Front"
                shortcut="Ctrl+Shift+↑"
                onClick={() => { onZOrder('front'); setShowZOrderMenu(false); }}
              />
              <AlignMenuItem
                icon={MoveUp}
                label="Bring Forward"
                shortcut="Page Up"
                onClick={() => { onZOrder('forward'); setShowZOrderMenu(false); }}
              />
              <AlignMenuItem
                icon={MoveDown}
                label="Send Backward"
                shortcut="Page Down"
                onClick={() => { onZOrder('backward'); setShowZOrderMenu(false); }}
              />
              <AlignMenuItem
                icon={ChevronsDown}
                label="Send to Back"
                shortcut="Ctrl+Shift+↓"
                onClick={() => { onZOrder('back'); setShowZOrderMenu(false); }}
              />
            </div>
          </>
        )}
      </div>

      <Separator />

      {/* Zoom */}
      <ToolBtn icon={ZoomOut} onClick={onZoomOut} title="Zoom Out" />
      <span style={{ fontSize: '10px', fontFamily: 'monospace', width: '40px', textAlign: 'center', fontWeight: 600, color: '#334155' }}>
        {zoom}%
      </span>
      <ToolBtn icon={ZoomIn} onClick={onZoomIn} title="Zoom In" />

      <Separator />

      {/* Grid + Snap */}
      <ToolBtn icon={Grid3X3} onClick={onToggleGrid} active={showGrid} title="Toggle Grid Visibility" />
      <ToolBtn
        icon={Magnet}
        onClick={onToggleSnap}
        active={snapEnabled}
        title={snapEnabled ? `Snap to Grid: ON (${gridSize}px) — Hold Ctrl to bypass` : 'Snap to Grid: OFF'}
      />
      {snapEnabled && (
        <span style={{ fontSize: '9px', fontFamily: 'monospace', color: '#2563EB', marginLeft: '2px', fontWeight: 700 }}>
          {gridSize}px
        </span>
      )}

      <Separator />

      {/* Connections */}
      <button
        onClick={onOpenConnections}
        title="Manage Direct Connections"
        style={{
          display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px',
          borderRadius: '4px', color: '#334155', background: 'transparent',
          border: 'none', cursor: 'pointer', transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#EEF6FF'; e.currentTarget.style.color = '#2563EB'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#334155'; }}
      >
        <Link2 size={14} />
        <span style={{ fontSize: '11px', fontWeight: 600 }}>Connections</span>
        {connectionsCount > 0 && (
          <span
            style={{
              marginLeft: '4px', padding: '2px 6px', background: '#2563EB', color: '#FFFFFF',
              fontSize: '9px', borderRadius: '9999px', fontFamily: 'monospace', fontWeight: 700,
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
          style={{ width: '24px', height: '24px', borderRadius: '4px', cursor: 'pointer', border: '1px solid #E5E7EB' }}
          title="Canvas Background"
        />
      </div>

      {/* ✅ Selection indicator */}
      {selectedCount > 0 && (
        <>
          <Separator />
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: '4px',
              background: selectedCount > 1 ? 'rgba(147, 51, 234, 0.10)' : 'rgba(37, 99, 235, 0.10)',
              color: selectedCount > 1 ? '#9333EA' : '#2563EB',
              fontFamily: 'monospace',
            }}
          >
            {selectedCount} selected
          </span>
        </>
      )}

      <div style={{ flex: 1 }} />

      {/* Run button */}
      <button
        onClick={onRun}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px',
          borderRadius: '4px', fontSize: '12px', fontWeight: 600, color: '#FFFFFF',
          background: '#16A34A', border: 'none', cursor: 'pointer',
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

// ─── Menu Item helper ───
const AlignMenuItem = ({ icon: Icon, label, shortcut, onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      width: '100%',
      padding: '6px 10px',
      background: 'transparent',
      border: 'none',
      borderRadius: '4px',
      cursor: disabled ? 'not-allowed' : 'pointer',
      color: disabled ? '#94A3B8' : '#334155',
      fontSize: '12px',
      textAlign: 'left',
      opacity: disabled ? 0.5 : 1,
    }}
    onMouseEnter={(e) => {
      if (!disabled) {
        e.currentTarget.style.background = '#EEF6FF';
        e.currentTarget.style.color = '#2563EB';
      }
    }}
    onMouseLeave={(e) => {
      if (!disabled) {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = '#334155';
      }
    }}
  >
    <Icon size={14} />
    <span style={{ flex: 1 }}>{label}</span>
    {shortcut && (
      <span style={{ fontSize: '10px', color: '#94A3B8', fontFamily: 'monospace' }}>{shortcut}</span>
    )}
  </button>
);

export default DesignerToolbar;