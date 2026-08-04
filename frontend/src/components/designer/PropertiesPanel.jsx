import { useState, useEffect } from 'react';
import { Settings, Link2, Palette, Move, Trash2, Lightbulb, AlertTriangle } from 'lucide-react';
import { normalizeColor } from '../../utils/colorUtils';
import BindingDialog from './BindingDialog';
import { isPropertyBound, getBinding, setBinding, removeBinding } from '../../utils/bindingUtils';

const PropertiesPanel = ({ element, onUpdate, onDelete, tags, liveValues = {} }) => {
  const [props, setProps] = useState(element || {});

  // Binding dialog state
  const [bindingDialogOpen, setBindingDialogOpen] = useState(false);
  const [bindingContext, setBindingContext] = useState({
    propertyKey: '',
    propertyLabel: '',
    propertyType: 'text',
  });

  useEffect(() => {
    setProps(element || {});
  }, [element]);

  if (!element) {
    return (
      <div className="w-72 bg-slate-900 border-l border-slate-800 h-full p-4">
        <div className="text-center py-12">
          <Settings className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Select an element to edit its properties</p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────────────
  const handleChange = (key, value) => {
    const updated = { ...props, [key]: value };
    setProps(updated);
    onUpdate(element.id, { [key]: value });
  };

  const handleAnimationChange = (key, value) => {
    const animation = { ...(props.animation || {}), [key]: value };
    setProps({ ...props, animation });
    onUpdate(element.id, { animation });
  };

  // ─── Open binding dialog for a property ─────────────
  const openBindingDialog = (propertyKey, propertyLabel, propertyType) => {
    setBindingContext({ propertyKey, propertyLabel, propertyType });
    setBindingDialogOpen(true);
  };

  // ─── Save binding for current property ──────────────
  const handleSaveBinding = (binding) => {
    const updated = setBinding(props, bindingContext.propertyKey, binding);
    setProps(updated);
    onUpdate(element.id, { bindings: updated.bindings });
  };

  // ─── Remove binding for current property ────────────
  const handleRemoveBinding = () => {
    const updated = removeBinding(props, bindingContext.propertyKey);
    setProps(updated);
    onUpdate(element.id, { bindings: updated.bindings });
  };

  // ─── Quick unbind via right-click on 💡 ─────────────
  const handleQuickUnbind = (propertyKey, e) => {
    e.preventDefault();
    if (!isPropertyBound(props, propertyKey)) return;
    if (window.confirm(`Remove binding from "${propertyKey}"?`)) {
      const updated = removeBinding(props, propertyKey);
      setProps(updated);
      onUpdate(element.id, { bindings: updated.bindings });
    }
  };

  return (
    <>
      <div className="w-72 bg-slate-900 border-l border-slate-800 h-full overflow-y-auto">
        {/* ─── HEADER ─────────────────────────────────── */}
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-white uppercase">{props.type}</h3>
            <button
              onClick={() => onDelete(element.id)}
              className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-slate-500">ID: {element.id.slice(0, 8)}...</p>

          {/* Bindings summary */}
          {props.bindings && Object.keys(props.bindings).length > 0 && (
            <div className="mt-2 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded text-xs text-emerald-300">
              🔗 {Object.keys(props.bindings).length} dynamic binding(s)
            </div>
          )}
        </div>

        <div className="p-4 space-y-4">
          {/* ─── POSITION & SIZE ───────────────────────── */}
          <Section title="Position & Size" icon={Move}>
            <div className="grid grid-cols-2 gap-2">
              <BindableInput
                label="X" value={props.x} type="number"
                propertyKey="x" propertyType="number"
                element={props} onChange={(v) => handleChange('x', parseInt(v))}
                onOpenBinding={openBindingDialog} onQuickUnbind={handleQuickUnbind}
              />
              <BindableInput
                label="Y" value={props.y} type="number"
                propertyKey="y" propertyType="number"
                element={props} onChange={(v) => handleChange('y', parseInt(v))}
                onOpenBinding={openBindingDialog} onQuickUnbind={handleQuickUnbind}
              />
              <BindableInput
                label="Width" value={props.width} type="number"
                propertyKey="width" propertyType="number"
                element={props} onChange={(v) => handleChange('width', parseInt(v))}
                onOpenBinding={openBindingDialog} onQuickUnbind={handleQuickUnbind}
              />
              <BindableInput
                label="Height" value={props.height} type="number"
                propertyKey="height" propertyType="number"
                element={props} onChange={(v) => handleChange('height', parseInt(v))}
                onOpenBinding={openBindingDialog} onQuickUnbind={handleQuickUnbind}
              />
            </div>
            <BindableInput
              label="Rotation" value={props.rotation || 0} type="number"
              propertyKey="rotation" propertyType="number"
              element={props} onChange={(v) => handleChange('rotation', parseInt(v))}
              onOpenBinding={openBindingDialog} onQuickUnbind={handleQuickUnbind}
            />
            <BindableInput
              label="Visible" value={props.visible !== false ? 'true' : 'false'} type="text"
              propertyKey="visible" propertyType="boolean"
              element={props} onChange={(v) => handleChange('visible', v === 'true')}
              onOpenBinding={openBindingDialog} onQuickUnbind={handleQuickUnbind}
              readOnly
            />
          </Section>

          {/* ─── STYLE ─────────────────────────────────── */}
          <Section title="Style" icon={Palette}>
            <BindableColor
              label="Fill Color" value={props.fill || '#3b82f6'}
              propertyKey="fill" element={props}
              onChange={(v) => handleChange('fill', v)}
              onOpenBinding={openBindingDialog} onQuickUnbind={handleQuickUnbind}
            />
            <BindableColor
              label="Border Color" value={props.stroke || '#000000'}
              propertyKey="stroke" element={props}
              onChange={(v) => handleChange('stroke', v)}
              onOpenBinding={openBindingDialog} onQuickUnbind={handleQuickUnbind}
            />
            <BindableInput
              label="Border Width" value={props.strokeWidth || 1} type="number"
              propertyKey="strokeWidth" propertyType="number"
              element={props} onChange={(v) => handleChange('strokeWidth', parseInt(v))}
              onOpenBinding={openBindingDialog} onQuickUnbind={handleQuickUnbind}
            />
            <BindableInput
              label="Opacity" value={props.opacity ?? 1} type="number"
              propertyKey="opacity" propertyType="number"
              element={props} onChange={(v) => handleChange('opacity', parseFloat(v))}
              onOpenBinding={openBindingDialog} onQuickUnbind={handleQuickUnbind}
              step="0.1" min="0" max="1"
            />
          </Section>

          {/* ─── TEXT ──────────────────────────────────── */}
          {['text', 'textDisplay', 'button'].includes(props.type) && (
            <Section title="Text">
              <BindableInput
                label="Text" value={props.text || ''} type="text"
                propertyKey="text" propertyType="text"
                element={props} onChange={(v) => handleChange('text', v)}
                onOpenBinding={openBindingDialog} onQuickUnbind={handleQuickUnbind}
              />
              <BindableInput
                label="Font Size" value={props.fontSize || 16} type="number"
                propertyKey="fontSize" propertyType="number"
                element={props} onChange={(v) => handleChange('fontSize', parseInt(v))}
                onOpenBinding={openBindingDialog} onQuickUnbind={handleQuickUnbind}
              />
              <BindableColor
                label="Font Color" value={props.fontColor || '#ffffff'}
                propertyKey="fontColor" element={props}
                onChange={(v) => handleChange('fontColor', v)}
                onOpenBinding={openBindingDialog} onQuickUnbind={handleQuickUnbind}
              />
            </Section>
          )}

          {/* ─── LEGACY TAG BINDING (BACKWARD COMPAT) ─── */}
          <Section title="Legacy Tag Binding" icon={Link2}>
            <div className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-xs text-yellow-300 mb-2 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>Legacy field. Prefer using 💡 icon next to each property for per-property bindings.</span>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Bound Tag (whole element)</label>
              <select
                value={props.boundTag || ''}
                onChange={(e) => handleChange('boundTag', e.target.value || null)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">No tag bound</option>
                {tags.map((tag) => (
                  <option key={tag._id} value={tag.tagName}>
                    {tag.tagName} ({tag.dataType})
                  </option>
                ))}
              </select>
            </div>

            {props.boundTag && (
              <div className="mt-3 p-2 bg-slate-800 rounded">
                <p className="text-xs text-blue-400 font-mono">
                  ✓ Bound to: {props.boundTag}
                </p>
              </div>
            )}
          </Section>

          {/* ─── BUTTON ACTION ─────────────────────────── */}
          {props.type === 'button' && (
            <Section title="Button Action">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Target Tag (to write)</label>
                <select
                  value={props.action?.targetTag || ''}
                  onChange={(e) => {
                    const action = { ...(props.action || {}), targetTag: e.target.value, type: 'writeTag' };
                    setProps({ ...props, action });
                    onUpdate(element.id, { action });
                  }}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">No action</option>
                  {tags.map((tag) => (
                    <option key={tag._id} value={tag.tagName}>
                      {tag.tagName} ({tag.dataType})
                    </option>
                  ))}
                </select>
              </div>

              {props.action?.targetTag && (
                <>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Write Value</label>
                    <input
                      type="text"
                      value={props.action?.targetValue ?? ''}
                      placeholder="Leave empty to toggle"
                      onChange={(e) => {
                        let val = e.target.value;
                        if (val === 'true') val = true;
                        else if (val === 'false') val = false;
                        else if (!isNaN(parseFloat(val)) && val !== '') val = parseFloat(val);

                        const action = { ...(props.action || {}), targetValue: val };
                        setProps({ ...props, action });
                        onUpdate(element.id, { action });
                      }}
                      className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="p-2 bg-green-500/10 border border-green-500/20 rounded text-xs text-green-300">
                    💡 Click button → Writes value to {props.action.targetTag}
                  </div>
                </>
              )}
            </Section>
          )}

          {/* ─── LEGACY ANIMATION (BACKWARD COMPAT) ────── */}
          {props.boundTag && (
            <Section title="Legacy Animation">
              <div className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-xs text-yellow-300 mb-2 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>Legacy animation. Prefer 💡 → Range Map / Bool Map on Fill Color.</span>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-300 mb-2">
                <input
                  type="checkbox"
                  checked={props.animation?.enabled || false}
                  onChange={(e) => handleAnimationChange('enabled', e.target.checked)}
                  className="w-4 h-4"
                />
                Enable Animation
              </label>

              {props.animation?.enabled && (
                <>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Animation Type</label>
                    <select
                      value={props.animation?.type || 'color'}
                      onChange={(e) => handleAnimationChange('type', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white"
                    >
                      <option value="color">Color Change</option>
                      <option value="visibility">Visibility</option>
                      <option value="fill">Fill Level</option>
                      <option value="flash">⚡ Flash (Alarm)</option>
                    </select>
                  </div>

                  {/* COLOR ANIMATION */}
                  {props.animation?.type === 'color' && (
                    <div className="space-y-2 mt-2">
                      {(() => {
                        const boundTagData = tags.find(t => t.tagName === props.boundTag);
                        const isBool = boundTagData?.dataType === 'BOOL';
                        return (
                          <>
                            {!isBool && (
                              <div className="grid grid-cols-2 gap-2">
                                <InputField label="Min Value" value={props.animation?.minValue ?? 0} onChange={(v) => handleAnimationChange('minValue', parseFloat(v) || 0)} type="number" />
                                <InputField label="Max Value" value={props.animation?.maxValue ?? 100} onChange={(v) => handleAnimationChange('maxValue', parseFloat(v) || 100)} type="number" />
                              </div>
                            )}
                            {isBool && (
                              <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded text-xs text-blue-300">
                                💡 Boolean tag: FALSE = Min Color, TRUE = Max Color
                              </div>
                            )}
                            <ColorField label={isBool ? "FALSE Color" : "Min Color"} value={props.animation?.minColor || '#ef4444'} onChange={(v) => handleAnimationChange('minColor', v)} />
                            <ColorField label={isBool ? "TRUE Color" : "Max Color"} value={props.animation?.maxColor || '#10b981'} onChange={(v) => handleAnimationChange('maxColor', v)} />
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {/* FLASH ANIMATION */}
                  {props.animation?.type === 'flash' && (
                    <div className="space-y-2 mt-2">
                      <div className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-xs text-yellow-300">
                        ⚡ Element will blink when condition is met
                      </div>
                      {(() => {
                        const boundTagData = tags.find(t => t.tagName === props.boundTag);
                        const isBool = boundTagData?.dataType === 'BOOL';
                        return (
                          <>
                            {!isBool && (
                              <div>
                                <label className="block text-xs text-slate-400 mb-1">Flash when value greater than</label>
                                <input type="number" value={props.animation?.flashThreshold ?? 80} onChange={(e) => handleAnimationChange('flashThreshold', parseFloat(e.target.value) || 0)} className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-white" />
                              </div>
                            )}
                            {isBool && (
                              <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded text-xs text-blue-300">
                                💡 Will flash when tag = TRUE
                              </div>
                            )}
                            <div>
                              <label className="block text-xs text-slate-400 mb-1">Flash Speed (ms)</label>
                              <select value={props.animation?.flashSpeed || 500} onChange={(e) => handleAnimationChange('flashSpeed', parseInt(e.target.value))} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-white">
                                <option value="200">Very Fast (200ms)</option>
                                <option value="500">Fast (500ms)</option>
                                <option value="1000">Normal (1s)</option>
                                <option value="2000">Slow (2s)</option>
                              </select>
                            </div>
                            <ColorField label="Flash Color 1" value={props.animation?.flashColor1 || '#ef4444'} onChange={(v) => handleAnimationChange('flashColor1', v)} />
                            <ColorField label="Flash Color 2" value={props.animation?.flashColor2 || '#fbbf24'} onChange={(v) => handleAnimationChange('flashColor2', v)} />
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {/* VISIBILITY ANIMATION */}
                  {props.animation?.type === 'visibility' && (
                    <div className="space-y-2 mt-2">
                      <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded text-xs text-blue-300">
                        💡 Element hides when value is FALSE or below threshold
                      </div>
                      <InputField label="Show when value ≥" value={props.animation?.minValue ?? 1} onChange={(v) => handleAnimationChange('minValue', parseFloat(v) || 0)} type="number" />
                    </div>
                  )}

                  {/* FILL LEVEL ANIMATION */}
                  {props.animation?.type === 'fill' && (
                    <div className="space-y-2 mt-2">
                      <div className="p-2 bg-cyan-500/10 border border-cyan-500/20 rounded text-xs text-cyan-300">
                        💧 Use this for Tank fill level
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <InputField label="Min Value (0%)" value={props.animation?.minValue ?? 0} onChange={(v) => handleAnimationChange('minValue', parseFloat(v) || 0)} type="number" />
                        <InputField label="Max Value (100%)" value={props.animation?.maxValue ?? 100} onChange={(v) => handleAnimationChange('maxValue', parseFloat(v) || 100)} type="number" />
                      </div>
                    </div>
                  )}
                </>
              )}
            </Section>
          )}
        </div>
      </div>

      {/* ─── BINDING DIALOG ──────────────────────────── */}
      <BindingDialog
        isOpen={bindingDialogOpen}
        onClose={() => setBindingDialogOpen(false)}
        propertyKey={bindingContext.propertyKey}
        propertyLabel={bindingContext.propertyLabel}
        propertyType={bindingContext.propertyType}
        element={props}
        tags={tags}
        liveValues={liveValues}
        onSave={handleSaveBinding}
        onRemove={handleRemoveBinding}
      />
    </>
  );
};

// ═══════════════════════════════════════════════════════════
// SECTION WRAPPER
// ═══════════════════════════════════════════════════════════
const Section = ({ title, icon: Icon, children }) => (
  <div>
    <div className="flex items-center gap-2 mb-2">
      {Icon && <Icon className="w-3.5 h-3.5 text-slate-500" />}
      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</h4>
    </div>
    <div className="space-y-2">{children}</div>
  </div>
);

// ═══════════════════════════════════════════════════════════
// BINDABLE INPUT — Standard input with 💡 icon
// ═══════════════════════════════════════════════════════════
const BindableInput = ({
  label, value, onChange, type = 'text',
  propertyKey, propertyType, element,
  onOpenBinding, onQuickUnbind,
  ...rest
}) => {
  const bound = isPropertyBound(element, propertyKey);
  const binding = getBinding(element, propertyKey);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs text-slate-400">{label}</label>
        <BindingIcon
          bound={bound}
          binding={binding}
          onClick={() => onOpenBinding(propertyKey, label, propertyType)}
          onContextMenu={(e) => onQuickUnbind(propertyKey, e)}
        />
      </div>
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={bound}
        className={`w-full px-3 py-1.5 border rounded text-sm text-white focus:outline-none ${
          bound
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 cursor-not-allowed'
            : 'bg-slate-800 border-slate-700 focus:border-blue-500'
        }`}
        {...rest}
      />
      {bound && (
        <div className="mt-1 text-[10px] text-emerald-400 font-mono">
          🔗 {binding.mode}: {binding.tag}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// BINDABLE COLOR — Color picker with 💡 icon
// ═══════════════════════════════════════════════════════════
const BindableColor = ({
  label, value, onChange,
  propertyKey, element,
  onOpenBinding, onQuickUnbind,
}) => {
  const bound = isPropertyBound(element, propertyKey);
  const binding = getBinding(element, propertyKey);
  const normalizedValue = normalizeColor(value, '#000000');

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs text-slate-400">{label}</label>
        <BindingIcon
          bound={bound}
          binding={binding}
          onClick={() => onOpenBinding(propertyKey, label, 'color')}
          onContextMenu={(e) => onQuickUnbind(propertyKey, e)}
        />
      </div>
      <div className="flex gap-2">
        <input
          type="color"
          value={normalizedValue}
          onChange={(e) => onChange(e.target.value)}
          disabled={bound}
          className={`w-10 h-9 border rounded cursor-pointer ${
            bound
              ? 'bg-emerald-500/10 border-emerald-500/30 opacity-50 cursor-not-allowed'
              : 'bg-slate-800 border-slate-700'
          }`}
        />
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onChange(normalizeColor(e.target.value, '#000000'))}
          placeholder="#000000"
          disabled={bound}
          className={`flex-1 px-3 py-1.5 border rounded text-sm text-white font-mono focus:outline-none ${
            bound
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 cursor-not-allowed'
              : 'bg-slate-800 border-slate-700 focus:border-blue-500'
          }`}
        />
      </div>
      {bound && (
        <div className="mt-1 text-[10px] text-emerald-400 font-mono">
          🔗 {binding.mode}: {binding.tag}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// BINDING ICON — The 💡 button
// ═══════════════════════════════════════════════════════════
const BindingIcon = ({ bound, binding, onClick, onContextMenu }) => (
  <button
    onClick={onClick}
    onContextMenu={onContextMenu}
    title={
      bound
        ? `Bound to: ${binding?.tag} (right-click to unbind)`
        : 'Click to bind this property to a tag'
    }
    className={`p-1 rounded transition-all ${
      bound
        ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
        : 'text-slate-500 hover:text-yellow-400 hover:bg-slate-800'
    }`}
  >
    <Lightbulb className="w-3.5 h-3.5" />
  </button>
);

// ═══════════════════════════════════════════════════════════
// LEGACY HELPERS (used by legacy animation section)
// ═══════════════════════════════════════════════════════════
const InputField = ({ label, value, onChange, type = 'text', ...rest }) => (
  <div>
    <label className="block text-xs text-slate-400 mb-1">{label}</label>
    <input
      type={type}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
      {...rest}
    />
  </div>
);

const ColorField = ({ label, value, onChange }) => {
  const normalizedValue = normalizeColor(value, '#000000');
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <div className="flex gap-2">
        <input
          type="color"
          value={normalizedValue}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-9 bg-slate-800 border border-slate-700 rounded cursor-pointer"
        />
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onChange(normalizeColor(e.target.value, '#000000'))}
          placeholder="#000000"
          className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-white font-mono"
        />
      </div>
    </div>
  );
};

export default PropertiesPanel;