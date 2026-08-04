import { useState, useEffect, useRef } from 'react';
import { parseOptions, valuesEqual } from '../../utils/interactiveUtils';

// ═══════════════════════════════════════════════════════════
// InteractiveOverlay — Sprint D4 Phase 3
// HTML overlay for IoField editing + ComboBox dropdown
// Absolutely positioned on top of the canvas
// ═══════════════════════════════════════════════════════════

const InteractiveOverlay = ({
  overlay,        // { type, element, screenX, screenY, currentValue } | null
  tags = [],
  onSave,         // (value) => void
  onCancel,       // () => void
}) => {
  if (!overlay) return null;

  if (overlay.type === 'ioField') {
    return <IoFieldOverlay overlay={overlay} tags={tags} onSave={onSave} onCancel={onCancel} />;
  }

  if (overlay.type === 'comboBox') {
    return <ComboBoxOverlay overlay={overlay} onSave={onSave} onCancel={onCancel} />;
  }

  return null;
};

// ─────────────────────────────────────────────────────────────
// IO FIELD OVERLAY — HTML input positioned over the ioField
// ─────────────────────────────────────────────────────────────

const IoFieldOverlay = ({ overlay, tags, onSave, onCancel }) => {
  const { element, screenX, screenY, currentValue } = overlay;
  const inputRef = useRef(null);
  const [value, setValue] = useState(
    currentValue !== null && currentValue !== undefined ? String(currentValue) : ''
  );
  const [error, setError] = useState('');

  // Detect tag type for correct input type
  const tagInfo = tags.find((t) => t.tagName === element.ioTargetTag);
  const tagType = tagInfo?.dataType || 'REAL';
  const isBool = tagType === 'BOOL';
  const isNumeric = ['INT', 'DINT', 'REAL', 'WORD', 'DWORD', 'BYTE'].includes(tagType);
  const isString = tagType === 'STRING';

  // Focus + select input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current.select) inputRef.current.select();
    }
  }, []);

  // ─── Validation ───
  const validate = (val) => {
    if (val === '' || val === null || val === undefined) {
      return 'Value is required';
    }
    if (isNumeric) {
      const num = parseFloat(val);
      if (isNaN(num)) return 'Must be a number';
      if (element.ioMinValue !== undefined && element.ioMinValue !== '' && num < Number(element.ioMinValue)) {
        return `Value must be ≥ ${element.ioMinValue}`;
      }
      if (element.ioMaxValue !== undefined && element.ioMaxValue !== '' && num > Number(element.ioMaxValue)) {
        return `Value must be ≤ ${element.ioMaxValue}`;
      }
    }
    return null;
  };

  // ─── Save ───
  const handleSave = () => {
    const err = validate(value);
    if (err) {
      setError(err);
      return;
    }

    // Coerce to correct type
    let finalValue = value;
    if (isBool) {
      finalValue = value === 'true' || value === '1' || value === true;
    } else if (isNumeric) {
      finalValue = parseFloat(value);
    }

    onSave(finalValue);
  };

  // ─── Key handlers ───
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  // ─── Position + size (match the ioField) ───
  const style = {
    position: 'absolute',
    left: `${screenX}px`,
    top: `${screenY}px`,
    width: `${element.width}px`,
    height: `${element.height}px`,
    zIndex: 100,
    pointerEvents: 'auto',
  };

  const inputStyle = {
    width: '100%',
    height: '100%',
    padding: '4px 8px',
    fontSize: `${element.fontSize || 14}px`,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    color: '#1a1612',
    backgroundColor: '#ffffff',
    border: '2px solid #3b82f6',
    borderRadius: '2px',
    outline: 'none',
    textAlign: element.ioTextAlign || 'right',
    boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.2)',
  };

  return (
    <div style={style}>
      {isBool ? (
        <select
          ref={inputRef}
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(''); }}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          style={inputStyle}
        >
          <option value="">— select —</option>
          <option value="true">TRUE</option>
          <option value="false">FALSE</option>
        </select>
      ) : (
        <input
          ref={inputRef}
          type={isNumeric ? 'number' : 'text'}
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(''); }}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          step={isNumeric ? 'any' : undefined}
          min={element.ioMinValue !== '' ? element.ioMinValue : undefined}
          max={element.ioMaxValue !== '' ? element.ioMaxValue : undefined}
          placeholder={isString ? 'Enter text' : 'Enter value'}
          style={inputStyle}
        />
      )}

      {/* Error tooltip */}
      {error && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '4px',
            padding: '4px 8px',
            backgroundColor: '#dc2626',
            color: '#ffffff',
            fontSize: '11px',
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            whiteSpace: 'nowrap',
            zIndex: 101,
          }}
        >
          ⚠ {error}
        </div>
      )}

      {/* Small hint */}
      {!error && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '4px',
            padding: '2px 6px',
            backgroundColor: 'rgba(30, 41, 59, 0.9)',
            color: '#94a3b8',
            fontSize: '10px',
            borderRadius: '4px',
            whiteSpace: 'nowrap',
            zIndex: 101,
          }}
        >
          Enter to save · Esc to cancel
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// COMBO BOX OVERLAY — Custom dropdown positioned below combobox
// ─────────────────────────────────────────────────────────────

const ComboBoxOverlay = ({ overlay, onSave, onCancel }) => {
  const { element, screenX, screenY, currentValue } = overlay;
  const containerRef = useRef(null);
  const options = parseOptions(element.comboOptions);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        onCancel();
      }
    };
    // Delay to avoid triggering on the click that opened this
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onCancel]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  // Position dropdown BELOW the comboBox
  const style = {
    position: 'absolute',
    left: `${screenX}px`,
    top: `${screenY + element.height + 2}px`,
    width: `${Math.max(element.width, 150)}px`,
    zIndex: 100,
    pointerEvents: 'auto',
    background: '#ffffff',
    border: '1px solid #3b82f6',
    borderRadius: '4px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
    maxHeight: '300px',
    overflowY: 'auto',
  };

  return (
    <div ref={containerRef} style={style}>
      {options.length === 0 ? (
        <div style={{
          padding: '12px',
          textAlign: 'center',
          color: '#7a6f60',
          fontSize: '12px',
          fontStyle: 'italic',
        }}>
          No options configured
        </div>
      ) : (
        options.map((opt, i) => {
          const isSelected = valuesEqual(opt.value, currentValue);
          return (
            <div
              key={i}
              onClick={() => onSave(opt.value)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f0f9ff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = isSelected ? '#eff6ff' : '#ffffff';
              }}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                fontSize: '13px',
                color: isSelected ? '#3b82f6' : '#1a1612',
                fontWeight: isSelected ? 'bold' : 'normal',
                backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                borderBottom: i < options.length - 1 ? '1px solid #f0ece4' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>{opt.label || '(no label)'}</span>
              <span style={{ fontSize: '11px', color: '#a89c8a', fontFamily: 'monospace' }}>
                {String(opt.value)}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
};

export default InteractiveOverlay;