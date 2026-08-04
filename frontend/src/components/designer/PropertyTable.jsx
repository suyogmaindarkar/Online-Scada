import { useState } from 'react';
import { Lightbulb, Plus, Trash2 } from 'lucide-react';
import { normalizeColor } from '../../utils/colorUtils';
import { getElementSpecificProperties } from '../../config/elementProperties';
import COLORS from '../../theme/colors';

// ═══════════════════════════════════════════════════════════
// Sprint D4: Options List Editor
// ═══════════════════════════════════════════════════════════
const OptionsListEditor = ({ value = [], onChange }) => {
  const [showEditor, setShowEditor] = useState(false);
  const options = Array.isArray(value) ? value : [];

  const addOption = () => onChange([...options, { label: '', value: '' }]);
  const updateOption = (index, field, newValue) => {
    const updated = [...options];
    updated[index] = { ...updated[index], [field]: newValue };
    onChange(updated);
  };
  const deleteOption = (index) => onChange(options.filter((_, i) => i !== index));

  const summary = options.length === 0
    ? 'No options'
    : options.length === 1
    ? '1 option'
    : `${options.length} options`;

  return (
    <div className="relative">
      <button
        onClick={() => setShowEditor(!showEditor)}
        className="w-full h-6 px-2 text-[11px] rounded text-left flex items-center justify-between transition-colors"
        style={{
          background: '#FFFFFF',
          border: `1px solid ${COLORS.lineDefault}`,
          color: COLORS.heading,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = COLORS.brandAccent; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = COLORS.lineDefault; }}
      >
        <span className="truncate">{summary}</span>
        <span className="text-[9px] font-semibold" style={{ color: COLORS.brandAccent }}>
          {showEditor ? '▲' : '▼'} Edit
        </span>
      </button>

      {showEditor && (
        <div
          className="absolute z-50 mt-1 right-0 w-64 p-2 rounded"
          style={{
            background: '#FFFFFF',
            border: `1px solid ${COLORS.brandAccent}`,
            boxShadow: '0px 8px 24px rgba(8, 27, 67, 0.15)',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span
              className="text-[10px] font-bold uppercase"
              style={{ color: COLORS.heading }}
            >
              Options ({options.length})
            </span>
            <button
              onClick={addOption}
              className="flex items-center gap-1 px-1.5 py-0.5 text-white text-[10px] rounded transition-colors"
              style={{ background: COLORS.brandAccent }}
              onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.brandPrimary; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = COLORS.brandAccent; }}
            >
              <Plus size={9} />
              Add
            </button>
          </div>

          {options.length === 0 && (
            <div
              className="text-center py-3 text-[10px] italic"
              style={{ color: COLORS.inkSubtle }}
            >
              No options yet. Click "Add" to create one.
            </div>
          )}

          <div className="space-y-1 max-h-48 overflow-y-auto">
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-1">
                <input
                  type="text"
                  value={opt.label || ''}
                  onChange={(e) => updateOption(i, 'label', e.target.value)}
                  placeholder="Label"
                  className="flex-1 h-5 px-1 text-[10px] rounded"
                  style={{
                    background: '#FFFFFF',
                    border: `1px solid ${COLORS.lineDefault}`,
                    color: COLORS.heading,
                  }}
                />
                <span className="text-[9px]" style={{ color: COLORS.inkSubtle }}>=</span>
                <input
                  type="text"
                  value={opt.value ?? ''}
                  onChange={(e) => updateOption(i, 'value', e.target.value)}
                  placeholder="Value"
                  className="flex-1 h-5 px-1 text-[10px] rounded font-mono"
                  style={{
                    background: '#FFFFFF',
                    border: `1px solid ${COLORS.lineDefault}`,
                    color: COLORS.heading,
                  }}
                />
                <button
                  onClick={() => deleteOption(i)}
                  className="p-0.5 rounded transition-colors"
                  style={{ color: COLORS.danger }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.dangerLight; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  title="Delete option"
                >
                  <Trash2 size={9} />
                </button>
              </div>
            ))}
          </div>

          <div
            className="mt-2 pt-2 flex justify-end"
            style={{ borderTop: `1px solid ${COLORS.lineDefault}` }}
          >
            <button
              onClick={() => setShowEditor(false)}
              className="px-2 py-0.5 text-[10px] rounded transition-colors"
              style={{
                background: '#F1F5F9',
                color: COLORS.heading,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.surfaceHover; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#F1F5F9'; }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const PropertyTable = ({
  element,
  activeCategory,
  tags,
  onUpdate,
  onOpenTagBinding,
}) => {
  if (!element) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        style={{ background: '#FFFFFF' }}
      >
        <p className="text-[11px]" style={{ color: COLORS.inkSubtle }}>
          Select an element to view properties
        </p>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // Property definitions per category
  // ─────────────────────────────────────────────────────────
  const getProperties = () => {
    const type = element.type;

    switch (activeCategory) {
      case 'geometry':
        return [
          { key: 'objectName', label: 'Object Name', type: 'text',
            value: element.objectName || generateDefaultName(type, element.id),
            readOnly: false, dynamic: false },
          { key: 'x', label: 'Position X', type: 'number',
            value: element.x ?? 0, dynamic: true, unit: 'px' },
          { key: 'y', label: 'Position Y', type: 'number',
            value: element.y ?? 0, dynamic: true, unit: 'px' },
          { key: 'width', label: 'Width', type: 'number',
            value: element.width ?? 100, dynamic: true, unit: 'px', min: 1 },
          { key: 'height', label: 'Height', type: 'number',
            value: element.height ?? 100, dynamic: true, unit: 'px', min: 1 },
          { key: 'rotation', label: 'Rotation', type: 'number',
            value: element.rotation ?? 0, dynamic: true, unit: '°', min: 0, max: 360 },
          { key: 'layer', label: 'Layer', type: 'number',
            value: element.layer ?? 0, dynamic: false, min: 0, max: 100 },
        ];

      case 'colors': {
        const colorProps = [
          { key: 'fill', label: 'Background Color', type: 'color',
            value: element.fill || '#2563EB', dynamic: true },
          { key: 'stroke', label: 'Border Color', type: 'color',
            value: element.stroke || '#000000', dynamic: true },
        ];
        if (['text', 'textDisplay', 'button', 'numericDisplay'].includes(type)) {
          colorProps.push({
            key: 'fontColor', label: 'Font Color', type: 'color',
            value: element.fontColor || '#ffffff', dynamic: true,
          });
        }
        return colorProps;
      }

      case 'styles':
        return [
          { key: 'strokeWidth', label: 'Border Width', type: 'number',
            value: element.strokeWidth ?? 1, min: 0, max: 20, dynamic: true, unit: 'px' },
          { key: 'opacity', label: 'Opacity', type: 'number',
            value: element.opacity ?? 1, min: 0, max: 1, step: 0.1, dynamic: true },
          { key: 'cornerRadius', label: 'Corner Radius', type: 'number',
            value: element.cornerRadius ?? 0, min: 0, max: 100, dynamic: false, unit: 'px' },
          { key: 'borderStyle', label: 'Border Style', type: 'select',
            value: element.borderStyle || 'solid',
            options: ['solid', 'dashed', 'dotted', 'none'], dynamic: false },
        ];

      case 'text':
        return [
          { key: 'text', label: 'Text Content', type: 'text',
            value: element.text || '', dynamic: true },
          { key: 'fontSize', label: 'Font Size', type: 'number',
            value: element.fontSize ?? 16, min: 6, max: 200, dynamic: true, unit: 'px' },
          { key: 'fontFamily', label: 'Font Family', type: 'select',
            value: element.fontFamily || 'Arial',
            options: ['Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Verdana', 'Georgia', 'monospace'],
            dynamic: false },
          { key: 'fontStyle', label: 'Font Style', type: 'select',
            value: element.fontStyle || 'normal',
            options: ['normal', 'bold', 'italic', 'bold italic'], dynamic: false },
          { key: 'textAlign', label: 'Alignment', type: 'select',
            value: element.textAlign || 'left',
            options: ['left', 'center', 'right'], dynamic: false },
          { key: 'fontColor', label: 'Font Color', type: 'color',
            value: element.fontColor || '#ffffff', dynamic: true },
        ];

      case 'miscellaneous':
        return [
          { key: 'boundTag', label: 'Bound Tag', type: 'tag',
            value: element.boundTag || '', dynamic: false },
          { key: 'isVisible', label: 'Display', type: 'select',
            value: element.isVisible !== false ? 'Yes' : 'No',
            options: ['Yes', 'No'], dynamic: true },
          { key: 'tooltip', label: 'Tooltip', type: 'text',
            value: element.tooltip || '', dynamic: false },
          { key: 'updateCycle', label: 'Update Cycle', type: 'select',
            value: element.updateCycle || 'Upon change',
            options: ['Upon change', '250ms', '500ms', '1s', '2s', '5s'], dynamic: false },
          { key: 'operatorControlEnable', label: 'Operator Control', type: 'select',
            value: element.operatorControlEnable !== false ? 'Yes' : 'No',
            options: ['Yes', 'No'], dynamic: false },
          { key: 'authorization', label: 'Authorization', type: 'select',
            value: element.authorization || 'No access protection',
            options: ['No access protection', 'Operator', 'Engineer', 'Admin'], dynamic: false },
        ];

      case 'effects':
        return [
          { key: 'shadowBlur', label: 'Shadow Blur', type: 'number',
            value: element.shadowBlur ?? 0, min: 0, max: 50, dynamic: true, unit: 'px' },
          { key: 'shadowColor', label: 'Shadow Color', type: 'color',
            value: element.shadowColor || '#000000', dynamic: false },
          { key: 'shadowOffsetX', label: 'Shadow Offset X', type: 'number',
            value: element.shadowOffsetX ?? 0, min: -50, max: 50, dynamic: false, unit: 'px' },
          { key: 'shadowOffsetY', label: 'Shadow Offset Y', type: 'number',
            value: element.shadowOffsetY ?? 0, min: -50, max: 50, dynamic: false, unit: 'px' },
          { key: 'shadowOpacity', label: 'Shadow Opacity', type: 'number',
            value: element.shadowOpacity ?? 0.3, min: 0, max: 1, step: 0.1, dynamic: false },
        ];

      case 'elementSpecific':
        return getElementSpecificProperties(element.type, element);

      default:
        return [];
    }
  };

  const properties = getProperties();

  const handleValueChange = (key, value) => {
    if (key.includes('.')) {
      const parts = key.split('.');
      const nested = { ...(element[parts[0]] || {}), [parts[1]]: value };
      onUpdate(element.id, { [parts[0]]: nested });
    } else {
      const boolFields = [
        'isVisible', 'operatorControlEnable', 'ioReadOnly',
        'checkBoxRequireConfirm', 'radioRequireConfirm',
        'comboRequireConfirm', 'listRequireConfirm', 'ioRequireConfirm',
      ];
      if (boolFields.includes(key)) {
        onUpdate(element.id, { [key]: value === 'Yes' });
      } else {
        onUpdate(element.id, { [key]: value });
      }
    }
  };

  const getDynamicBinding = (key) => element.dynamicBindings?.[key] || null;

  // ─────────────────────────────────────────────────────────
  // Render input based on type
  // ─────────────────────────────────────────────────────────
  const renderInput = (prop) => {
    const inputStyle = {
      background: '#FFFFFF',
      border: `1px solid ${COLORS.lineDefault}`,
      color: COLORS.heading,
    };
    const inputClass = 'w-full h-6 px-1.5 text-[11px] rounded outline-none transition-colors';

    const handleFocus = (e) => { e.target.style.borderColor = COLORS.brandAccent; };
    const handleBlur = (e) => { e.target.style.borderColor = COLORS.lineDefault; };

    switch (prop.type) {
      case 'number':
        return (
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={prop.value ?? ''}
              onChange={(e) => {
                const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                handleValueChange(prop.key, val);
              }}
              min={prop.min}
              max={prop.max}
              step={prop.step || 1}
              readOnly={prop.readOnly}
              className={inputClass}
              style={inputStyle}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
            {prop.unit && (
              <span className="text-[9px] w-6" style={{ color: COLORS.inkSubtle }}>
                {prop.unit}
              </span>
            )}
          </div>
        );

      case 'text':
        return (
          <input
            type="text"
            value={prop.value ?? ''}
            onChange={(e) => handleValueChange(prop.key, e.target.value)}
            readOnly={prop.readOnly}
            placeholder={prop.placeholder}
            className={inputClass}
            style={inputStyle}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
        );

      case 'color':
        return (
          <div className="flex items-center gap-1">
            <input
              type="color"
              value={normalizeColor(prop.value, '#000000')}
              onChange={(e) => handleValueChange(prop.key, e.target.value)}
              className="w-8 h-5 rounded cursor-pointer"
              style={{ border: `1px solid ${COLORS.lineDefault}` }}
            />
            <input
              type="text"
              value={prop.value || '#000000'}
              onChange={(e) => handleValueChange(prop.key, e.target.value)}
              onBlur={(e) => {
                handleBlur(e);
                handleValueChange(prop.key, normalizeColor(e.target.value, '#000000'));
              }}
              onFocus={handleFocus}
              className="flex-1 h-5 px-1 text-[10px] font-mono rounded outline-none transition-colors"
              style={inputStyle}
            />
          </div>
        );

      case 'select':
        return (
          <select
            value={prop.value}
            onChange={(e) => handleValueChange(prop.key, e.target.value)}
            className={inputClass}
            style={inputStyle}
            onFocus={handleFocus}
            onBlur={handleBlur}
          >
            {prop.options?.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );

      case 'tag':
        return (
          <select
            value={prop.value || ''}
            onChange={(e) => handleValueChange(prop.key, e.target.value || null)}
            className={inputClass}
            style={inputStyle}
            onFocus={handleFocus}
            onBlur={handleBlur}
          >
            <option value="">— none —</option>
            {tags && tags.map((tag) => (
              <option key={tag._id} value={tag.tagName}>
                {tag.tagName} ({tag.dataType})
              </option>
            ))}
          </select>
        );

      case 'optionsList':
        return (
          <OptionsListEditor
            value={Array.isArray(prop.value) ? prop.value : []}
            onChange={(v) => handleValueChange(prop.key, v)}
          />
        );

      default:
        return <span className="text-[11px]" style={{ color: COLORS.inkSubtle }}>-</span>;
    }
  };

  return (
    <div className="flex-1 overflow-auto" style={{ background: '#FFFFFF' }}>
      {/* Table Header */}
      <div
        className="sticky top-0 z-10"
        style={{
          background: '#F8FAFC',
          borderBottom: `1px solid ${COLORS.lineDefault}`,
          boxShadow: '0px 1px 2px rgba(8, 27, 67, 0.04)',
        }}
      >
        <div
          className="grid grid-cols-[minmax(160px,1.2fr)_minmax(140px,1fr)_32px_32px_32px] text-[10px] font-bold uppercase tracking-wide"
          style={{ color: COLORS.inkBody, fontFamily: COLORS.fonts.heading }}
        >
          <div
            className="px-3 py-1.5"
            style={{ borderRight: `1px solid ${COLORS.lineDefault}` }}
          >
            Attribute
          </div>
          <div
            className="px-2 py-1.5"
            style={{ borderRight: `1px solid ${COLORS.lineDefault}` }}
          >
            Static
          </div>
          <div
            className="px-1 py-1.5 text-center"
            style={{ borderRight: `1px solid ${COLORS.lineDefault}` }}
            title="Dynamic Tag Binding"
          >
            Dyn
          </div>
          <div
            className="px-1 py-1.5 text-center"
            style={{ borderRight: `1px solid ${COLORS.lineDefault}` }}
            title="Update Cycle"
          >
            Upd
          </div>
          <div
            className="px-1 py-1.5 text-center"
            title="Indirect Addressing"
          >
            Ind
          </div>
        </div>
      </div>

      {/* Table Body */}
      <div>
        {properties.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-[11px] italic" style={{ color: COLORS.inkSubtle }}>
              No properties in this category for {element.type}
            </p>
          </div>
        ) : (
          properties.map((prop) => {
            const binding = getDynamicBinding(prop.key);
            const hasDynamic = !!binding;

            return (
              <div
                key={prop.key}
                className="grid grid-cols-[minmax(160px,1.2fr)_minmax(140px,1fr)_32px_32px_32px] items-center group transition-colors"
                style={{
                  borderBottom: `1px solid ${COLORS.lineDefault}`,
                  background: '#FFFFFF',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#F8FAFC'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#FFFFFF'; }}
              >
                {/* Attribute Name */}
                <div
                  className="px-3 py-1 text-[11px] truncate"
                  style={{
                    color: COLORS.heading,
                    borderRight: `1px solid ${COLORS.lineDefault}`,
                  }}
                >
                  {prop.label}
                </div>

                {/* Static Value */}
                <div
                  className="px-1 py-0.5"
                  style={{ borderRight: `1px solid ${COLORS.lineDefault}` }}
                >
                  {renderInput(prop)}
                </div>

                {/* Dynamic 💡 */}
                <div
                  className="flex items-center justify-center"
                  style={{ borderRight: `1px solid ${COLORS.lineDefault}` }}
                >
                  {prop.dynamic ? (
                    <button
                      onClick={() => onOpenTagBinding?.(prop.key, prop.label)}
                      className="p-1 rounded transition-all"
                      style={{
                        color: hasDynamic ? COLORS.warning : COLORS.inkSubtle,
                        background: hasDynamic ? 'rgba(245, 158, 11, 0.10)' : 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        if (!hasDynamic) {
                          e.currentTarget.style.color = COLORS.brandAccent;
                          e.currentTarget.style.background = COLORS.surfaceHover;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!hasDynamic) {
                          e.currentTarget.style.color = COLORS.inkSubtle;
                          e.currentTarget.style.background = 'transparent';
                        }
                      }}
                      title={hasDynamic ? `Bound to: ${binding.tag}` : 'Click to bind tag'}
                    >
                      <Lightbulb size={12} fill={hasDynamic ? 'currentColor' : 'none'} />
                    </button>
                  ) : (
                    <span style={{ color: COLORS.lineDefault }}>—</span>
                  )}
                </div>

                {/* Update checkbox */}
                <div
                  className="flex items-center justify-center"
                  style={{ borderRight: `1px solid ${COLORS.lineDefault}` }}
                >
                  {prop.dynamic ? (
                    <input
                      type="checkbox"
                      checked={hasDynamic}
                      readOnly
                      className="w-3 h-3 cursor-pointer"
                      style={{ accentColor: COLORS.brandAccent }}
                      title="Update on change"
                    />
                  ) : (
                    <span style={{ color: COLORS.lineDefault }}>—</span>
                  )}
                </div>

                {/* Indirect checkbox */}
                <div className="flex items-center justify-center">
                  {prop.dynamic ? (
                    <input
                      type="checkbox"
                      checked={false}
                      readOnly
                      className="w-3 h-3 cursor-pointer"
                      style={{ accentColor: COLORS.brandAccent }}
                      title="Indirect addressing"
                    />
                  ) : (
                    <span style={{ color: COLORS.lineDefault }}>—</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// HELPER: Generate default name like "Rectangle_1"
// ═══════════════════════════════════════════════════════════
function generateDefaultName(type, id) {
  const shortId = id?.slice(-4) || '0';
  const typeLabels = {
    rectangle: 'Rectangle',
    circle: 'Circle',
    line: 'Line',
    text: 'Text',
    tank: 'Tank',
    pump: 'Pump',
    motor: 'Motor',
    valve: 'Valve',
    gauge: 'Gauge',
    indicator: 'Indicator',
    button: 'Button',
    numericDisplay: 'IOField',
    textDisplay: 'TextField',
  };
  return `${typeLabels[type] || 'Object'}_${shortId}`;
}

export default PropertyTable;