import { useState, useEffect } from 'react';
import { Link2, Unlink, Plus, Trash2, Lightbulb, TrendingUp } from 'lucide-react';
import Modal from '../ui/Modal';
import {
  evaluateBinding,
  getBinding,
  getTagType,
  getSuggestedModes,
  createDefaultBinding,
} from '../../utils/bindingUtils';
import { normalizeColor } from '../../utils/colorUtils';

const BindingDialog = ({
  isOpen,
  onClose,
  propertyKey,
  propertyLabel,
  propertyType,
  element,
  tags = [],
  liveValues = {},
  onSave,
  onRemove,
}) => {
  const [binding, setBinding] = useState(null);
  const existingBinding = element ? getBinding(element, propertyKey) : null;

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const nextBinding = existingBinding ? { ...existingBinding } : { mode: 'direct', tag: '' };
    void Promise.resolve().then(() => {
      if (active) setBinding(nextBinding);
    });
    return () => { active = false; };
  }, [isOpen, propertyKey, element?.id, existingBinding]);

  if (!isOpen || !binding) return null;

  const tagType = getTagType(binding.tag, tags);
  const suggestedModes = getSuggestedModes(propertyType, tagType);
  const currentTagValue = binding.tag ? liveValues[binding.tag] : undefined;
  const resolvedValue = binding.tag ? evaluateBinding(binding, liveValues, tags) : undefined;

  const handleTagChange = (tagName) => {
    if (!tagName) {
      setBinding({ ...binding, tag: '' });
      return;
    }
    const newTagType = getTagType(tagName, tags);
    const defaultBinding = createDefaultBinding(propertyType, tagName, newTagType);
    setBinding(defaultBinding);
  };

  const handleModeChange = (mode) => setBinding({ ...binding, mode });

  const handleApply = () => {
    if (!binding.tag) {
      alert('Please select a tag first');
      return;
    }
    onSave(binding);
    onClose();
  };

  const handleRemove = () => {
    if (window.confirm('Remove this binding?')) {
      onRemove();
      onClose();
    }
  };

  const renderModeConfig = () => {
    switch (binding.mode) {
      case 'direct':
        return <DirectModeConfig binding={binding} setBinding={setBinding} propertyType={propertyType} />;
      case 'boolMap':
        return <BoolMapConfig binding={binding} setBinding={setBinding} propertyType={propertyType} />;
      case 'rangeMap':
        return <RangeMapConfig binding={binding} setBinding={setBinding} propertyType={propertyType} />;
      case 'expression':
        return (
          <div
            style={{
              padding: '12px',
              background: '#FEF3C7',
              border: '1px solid #F59E0B',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#78350F',
            }}
          >
            Expression mode will be available in <strong>Sprint D</strong>.
            <br />For now, the raw tag value will be used.
          </div>
        );
      default:
        return null;
    }
  };

  const labelStyle = {
    display: 'block',
    fontSize: '11px',
    fontWeight: 700,
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '8px',
  };

  const selectStyle = {
    width: '100%',
    padding: '8px 12px',
    background: '#F8FAFC',
    border: '1px solid #E5E7EB',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#081B43',
    outline: 'none',
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`🔗 Bind Property: ${propertyLabel}`} size="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Property Info */}
        <div
          style={{
            padding: '12px',
            background: '#F8FAFC',
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#5F6B7A' }}>
            <Lightbulb size={14} style={{ color: '#F59E0B' }} />
            <span>Property:</span>
            <span style={{ color: '#081B43', fontFamily: 'monospace', fontWeight: 600 }}>{propertyKey}</span>
            <span style={{ color: '#CBD5E1' }}>|</span>
            <span>Type:</span>
            <span style={{ color: '#2563EB', fontFamily: 'monospace', fontWeight: 600 }}>{propertyType}</span>
          </div>
        </div>

        {/* Tag Selector */}
        <div>
          <label style={labelStyle}>Tag</label>
          <select
            value={binding.tag || ''}
            onChange={(e) => handleTagChange(e.target.value)}
            style={selectStyle}
            onFocus={(e) => { e.target.style.borderColor = '#2563EB'; }}
            onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; }}
          >
            <option value="">-- Select a tag --</option>
            {tags.map((tag) => (
              <option key={tag._id} value={tag.tagName}>
                {tag.tagName} ({tag.dataType})
              </option>
            ))}
          </select>
          {binding.tag && (
            <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
              <span style={{ color: '#94A3B8' }}>Selected tag type:</span>
              <span
                style={{
                  padding: '2px 8px',
                  background: '#EEF6FF',
                  color: '#2563EB',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                  fontWeight: 600,
                }}
              >
                {tagType}
              </span>
            </div>
          )}
        </div>

        {/* Mode Selector */}
        {binding.tag && (
          <div>
            <label style={labelStyle}>Binding Mode</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {['direct', 'boolMap', 'rangeMap', 'expression'].map((mode) => {
                const isSuggested = suggestedModes.includes(mode);
                const isSelected = binding.mode === mode;
                const isExpression = mode === 'expression';
                return (
                  <button
                    key={mode}
                    onClick={() => handleModeChange(mode)}
                    style={{
                      padding: '8px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 600,
                      textAlign: 'left',
                      cursor: 'pointer',
                      background: isSelected ? '#EEF6FF' : '#FFFFFF',
                      border: `1px solid ${isSelected ? '#2563EB' : isSuggested ? '#CBD5E1' : '#E5E7EB'}`,
                      color: isSelected ? '#2563EB' : isSuggested ? '#334155' : '#94A3B8',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>{modeLabels[mode]}</span>
                      {isExpression && <span style={{ color: '#F59E0B', fontSize: '10px' }}>SOON</span>}
                      {isSuggested && !isExpression && <span style={{ color: '#16A34A', fontSize: '10px' }}>✓</span>}
                    </div>
                    <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px' }}>
                      {modeDescriptions[mode]}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Mode-Specific Config */}
        {binding.tag && (
          <div
            style={{
              padding: '12px',
              background: '#F8FAFC',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
            }}
          >
            {renderModeConfig()}
          </div>
        )}

        {/* Live Preview */}
        {binding.tag && (
          <div
            style={{
              padding: '12px',
              background: 'linear-gradient(135deg, rgba(22, 163, 74, 0.05) 0%, rgba(37, 99, 235, 0.05) 100%)',
              border: '1px solid rgba(22, 163, 74, 0.25)',
              borderRadius: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <TrendingUp size={14} style={{ color: '#16A34A' }} />
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#15803D',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Live Preview
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#5F6B7A', width: '128px' }}>Current tag value:</span>
                <span style={{ fontFamily: 'monospace', color: '#081B43', fontWeight: 600 }}>
                  {currentTagValue !== undefined && currentTagValue !== null
                    ? String(currentTagValue)
                    : <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>no data yet</span>}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#5F6B7A', width: '128px' }}>Property will be:</span>
                <span style={{ fontFamily: 'monospace', color: '#15803D', fontWeight: 600 }}>
                  {resolvedValue !== undefined
                    ? propertyType === 'color'
                      ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              width: '16px',
                              height: '16px',
                              borderRadius: '3px',
                              border: '1px solid #CBD5E1',
                              backgroundColor: normalizeColor(resolvedValue) || '#000',
                            }}
                          />
                          {String(resolvedValue)}
                        </span>
                      )
                      : String(resolvedValue)
                    : <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>— (fallback to static value)</span>}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          marginTop: '24px',
          paddingTop: '16px',
          borderTop: '1px solid #E5E7EB',
        }}
      >
        <div>
          {existingBinding && (
            <button
              onClick={handleRemove}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                background: '#FEE2E2',
                border: '1px solid rgba(220, 38, 38, 0.30)',
                color: '#B91C1C',
                borderRadius: '6px',
                fontSize: '13px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              <Unlink size={16} />
              Remove Binding
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              background: '#F1F5F9',
              color: '#334155',
              border: '1px solid #E5E7EB',
              borderRadius: '6px',
              fontSize: '13px',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!binding.tag}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              background: !binding.tag ? '#CBD5E1' : '#081B43',
              color: !binding.tag ? '#94A3B8' : '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              cursor: !binding.tag ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              boxShadow: !binding.tag ? 'none' : '0px 2px 6px rgba(8, 27, 67, 0.25)',
              fontFamily: "'Montserrat', sans-serif",
            }}
          >
            <Link2 size={16} />
            Apply Binding
          </button>
        </div>
      </div>
    </Modal>
  );
};

// ─── Mode config sub-components (blue theme) ───

const DirectModeConfig = ({ binding, setBinding, propertyType }) => {
  const format = binding.format || {};
  const updateFormat = (key, value) => setBinding({ ...binding, format: { ...format, [key]: value } });
  const showFormatting = propertyType === 'text' || propertyType === 'number';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <p style={{ fontSize: '12px', color: '#5F6B7A' }}>
        Tag value will be used <strong style={{ color: '#081B43' }}>directly</strong> as the property value.
      </p>
      {showFormatting && (
        <>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>
            Formatting (optional)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            <FormatInput label="Decimals" type="number" value={format.decimals ?? ''}
              onChange={(v) => updateFormat('decimals', v === '' ? undefined : parseInt(v))} placeholder="e.g. 2" />
            <div>
              <label style={{ display: 'block', fontSize: '10px', color: '#94A3B8', marginBottom: '4px' }}>Thousand sep.</label>
              <select
                value={format.thousandSep ? 'yes' : 'no'}
                onChange={(e) => updateFormat('thousandSep', e.target.value === 'yes')}
                style={{ width: '100%', padding: '6px 8px', background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '4px', fontSize: '11px', color: '#081B43' }}
              >
                <option value="no">No</option>
                <option value="yes">Yes (1,000)</option>
              </select>
            </div>
            <FormatInput label="Prefix" value={format.prefix || ''} onChange={(v) => updateFormat('prefix', v)} placeholder="$" />
            <FormatInput label="Suffix" value={format.suffix || ''} onChange={(v) => updateFormat('suffix', v)} placeholder="°C" />
          </div>
        </>
      )}
    </div>
  );
};

const BoolMapConfig = ({ binding, setBinding, propertyType }) => {
  const InputComponent = propertyType === 'color' ? ColorInput : TextInput;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <p style={{ fontSize: '12px', color: '#5F6B7A' }}>
        Map <strong style={{ color: '#081B43' }}>TRUE</strong> and <strong style={{ color: '#081B43' }}>FALSE</strong> to specific values.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#16A34A', textTransform: 'uppercase', marginBottom: '4px' }}>
            When TRUE
          </label>
          <InputComponent value={binding.trueValue ?? ''} onChange={(v) => setBinding({ ...binding, trueValue: v })} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#DC2626', textTransform: 'uppercase', marginBottom: '4px' }}>
            When FALSE
          </label>
          <InputComponent value={binding.falseValue ?? ''} onChange={(v) => setBinding({ ...binding, falseValue: v })} />
        </div>
      </div>
    </div>
  );
};

const RangeMapConfig = ({ binding, setBinding, propertyType }) => {
  const ranges = binding.ranges || [];
  const updateRange = (index, key, value) => {
    const newRanges = [...ranges];
    newRanges[index] = { ...newRanges[index], [key]: value };
    setBinding({ ...binding, ranges: newRanges });
  };
  const addRange = () => {
    const lastMax = ranges.length > 0 ? Number(ranges[ranges.length - 1].max) || 0 : 0;
    const newRange = { min: lastMax, max: lastMax + 20, value: propertyType === 'color' ? '#2563EB' : '' };
    setBinding({ ...binding, ranges: [...ranges, newRange] });
  };
  const removeRange = (index) => setBinding({ ...binding, ranges: ranges.filter((_, i) => i !== index) });
  const InputComponent = propertyType === 'color' ? ColorInput : TextInput;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <p style={{ fontSize: '12px', color: '#5F6B7A' }}>
        Map value <strong style={{ color: '#081B43' }}>ranges</strong> to different output values.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {ranges.length === 0 && (
          <div style={{ textAlign: 'center', padding: '12px', fontSize: '11px', color: '#94A3B8', fontStyle: 'italic' }}>
            No ranges yet. Click "Add Range" to start.
          </div>
        )}
        {ranges.map((range, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '4px' }}>
            <input type="number" value={range.min ?? ''} onChange={(e) => updateRange(i, 'min', parseFloat(e.target.value))} placeholder="min"
              style={{ width: '64px', padding: '4px 8px', background: '#F8FAFC', border: '1px solid #E5E7EB', borderRadius: '4px', fontSize: '11px', color: '#081B43' }} />
            <span style={{ color: '#94A3B8', fontSize: '11px' }}>to</span>
            <input type="number" value={range.max ?? ''} onChange={(e) => updateRange(i, 'max', parseFloat(e.target.value))} placeholder="max"
              style={{ width: '64px', padding: '4px 8px', background: '#F8FAFC', border: '1px solid #E5E7EB', borderRadius: '4px', fontSize: '11px', color: '#081B43' }} />
            <span style={{ color: '#94A3B8', fontSize: '11px' }}>→</span>
            <div style={{ flex: 1 }}>
              <InputComponent value={range.value ?? ''} onChange={(v) => updateRange(i, 'value', v)} />
            </div>
            <button onClick={() => removeRange(i)} style={{ padding: '4px', color: '#DC2626', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <button onClick={addRange}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '6px 12px', background: '#FFFFFF', border: '1px dashed #2563EB', borderRadius: '4px', fontSize: '11px', color: '#2563EB', cursor: 'pointer', fontWeight: 600 }}>
        <Plus size={14} />
        Add Range
      </button>
      <div>
        <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#5F6B7A', textTransform: 'uppercase', marginBottom: '4px' }}>
          Default (no range matches)
        </label>
        <InputComponent value={binding.defaultValue ?? ''} onChange={(v) => setBinding({ ...binding, defaultValue: v })} />
      </div>
    </div>
  );
};

const FormatInput = ({ label, value, onChange, type = 'text', placeholder }) => (
  <div>
    <label style={{ display: 'block', fontSize: '10px', color: '#94A3B8', marginBottom: '4px' }}>{label}</label>
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: '100%', padding: '6px 8px', background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '4px', fontSize: '11px', color: '#081B43' }} />
  </div>
);

const TextInput = ({ value, onChange }) => (
  <input type="text" value={value ?? ''} onChange={(e) => onChange(e.target.value)}
    style={{ width: '100%', padding: '4px 8px', background: '#F8FAFC', border: '1px solid #E5E7EB', borderRadius: '4px', fontSize: '11px', color: '#081B43' }} />
);

const ColorInput = ({ value, onChange }) => (
  <div style={{ display: 'flex', gap: '4px' }}>
    <input type="color" value={normalizeColor(value, '#000000')} onChange={(e) => onChange(e.target.value)}
      style={{ width: '32px', height: '28px', background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '4px', cursor: 'pointer' }} />
    <input type="text" value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="#000000"
      style={{ flex: 1, padding: '4px 8px', background: '#F8FAFC', border: '1px solid #E5E7EB', borderRadius: '4px', fontSize: '11px', color: '#081B43', fontFamily: 'monospace' }} />
  </div>
);

const modeLabels = {
  direct: 'Direct',
  boolMap: 'Boolean Map',
  rangeMap: 'Range Map',
  expression: 'Expression',
};

const modeDescriptions = {
  direct: 'Use tag value as-is',
  boolMap: 'true → X, false → Y',
  rangeMap: 'Multi-range mapping',
  expression: 'Math formula',
};

export default BindingDialog;
