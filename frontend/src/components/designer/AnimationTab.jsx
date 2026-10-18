import { Trash2 } from 'lucide-react';
import { normalizeColor } from '../../utils/colorUtils';

const AnimationTab = ({ element, tags, onUpdate }) => {
  if (!element) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF' }}>
        <p style={{ fontSize: '11px', color: '#94A3B8' }}>Select an element to configure animations</p>
      </div>
    );
  }

  const animation = element.animation || {};
  const boundTag = element.boundTag;
  const boundTagData = tags.find((t) => t.tagName === boundTag);
  const isBool = boundTagData?.dataType === 'BOOL';

  const handleAnimChange = (key, value) => {
    const newAnim = { ...animation, [key]: value };
    onUpdate(element.id, { animation: newAnim });
  };

  const clearAnimation = () => onUpdate(element.id, { animation: { enabled: false } });

  const inputStyle = {
    width: '100%',
    height: '24px',
    padding: '0 6px',
    fontSize: '11px',
    background: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '4px',
    outline: 'none',
    color: '#081B43',
  };

  const labelStyle = { display: 'block', fontSize: '10px', color: '#5F6B7A', marginBottom: '4px', fontWeight: 600 };

  const infoBoxStyle = (bg, border, color) => ({
    padding: '6px', background: bg, border: `1px solid ${border}`,
    borderRadius: '4px', fontSize: '10px', color,
  });

  const sectionStyle = {
    display: 'flex', flexDirection: 'column', gap: '8px',
    padding: '8px', background: '#F8FAFC', borderRadius: '4px', border: '1px solid #E5E7EB',
  };

  return (
    <div style={{ flex: 1, background: '#FFFFFF', overflow: 'auto' }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: '#F1F5F9', borderBottom: '1px solid #E5E7EB',
        padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <p style={{ fontSize: '10px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Animation Configuration
        </p>
        {animation.enabled && (
          <button
            onClick={clearAnimation}
            style={{ padding: '2px', color: '#DC2626', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '4px' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#FEE2E2'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            title="Clear animation"
          >
            <Trash2 size={10} />
          </button>
        )}
      </div>

      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {!boundTag && (
          <div style={infoBoxStyle('#FEF3C7', '#F59E0B', '#78350F')}>
            Bind a tag first in the Miscellaneous section before setting up animation.
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            id="anim-enabled"
            checked={animation.enabled || false}
            onChange={(e) => handleAnimChange('enabled', e.target.checked)}
            disabled={!boundTag}
            style={{ width: '14px', height: '14px', accentColor: '#2563EB' }}
          />
          <label htmlFor="anim-enabled" style={{ fontSize: '11px', fontWeight: 600, color: '#081B43' }}>
            Enable Animation
          </label>
          {boundTag && (
            <span style={{ fontSize: '10px', color: '#5F6B7A', marginLeft: 'auto' }}>
              Bound to: <span style={{ fontFamily: 'monospace', color: '#2563EB', fontWeight: 600 }}>{boundTag}</span>
            </span>
          )}
        </div>

        {animation.enabled && boundTag && (
          <>
            <div>
              <label style={labelStyle}>Animation Type</label>
              <select
                value={animation.type || 'color'}
                onChange={(e) => handleAnimChange('type', e.target.value)}
                style={inputStyle}
              >
                <option value="color">Color Change</option>
                <option value="visibility">Visibility</option>
                <option value="fill">Fill Level (for tanks)</option>
                <option value="flash">Flash (Alarm)</option>
                <option value="rotation">Rotation</option>
                <option value="scale">Scale (Size)</option>
              </select>
            </div>

            {animation.type === 'color' && (
              <div style={sectionStyle}>
                {isBool ? (
                  <div style={infoBoxStyle('#EEF6FF', '#2563EB', '#1E40AF')}>
                    Boolean tag: FALSE = Min Color, TRUE = Max Color
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                    <div>
                      <label style={labelStyle}>Min Value</label>
                      <input type="number" value={animation.minValue ?? 0}
                        onChange={(e) => handleAnimChange('minValue', parseFloat(e.target.value) || 0)}
                        style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Max Value</label>
                      <input type="number" value={animation.maxValue ?? 100}
                        onChange={(e) => handleAnimChange('maxValue', parseFloat(e.target.value) || 100)}
                        style={inputStyle} />
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  <div>
                    <label style={labelStyle}>{isBool ? 'FALSE Color' : 'Min Color'}</label>
                    <input type="color" value={normalizeColor(animation.minColor, '#ef4444')}
                      onChange={(e) => handleAnimChange('minColor', e.target.value)}
                      style={{ width: '100%', height: '24px', border: '1px solid #E5E7EB', borderRadius: '4px', cursor: 'pointer' }} />
                  </div>
                  <div>
                    <label style={labelStyle}>{isBool ? 'TRUE Color' : 'Max Color'}</label>
                    <input type="color" value={normalizeColor(animation.maxColor, '#10b981')}
                      onChange={(e) => handleAnimChange('maxColor', e.target.value)}
                      style={{ width: '100%', height: '24px', border: '1px solid #E5E7EB', borderRadius: '4px', cursor: 'pointer' }} />
                  </div>
                </div>
              </div>
            )}

            {animation.type === 'flash' && (
              <div style={sectionStyle}>
                <div style={infoBoxStyle('#FEF3C7', '#F59E0B', '#78350F')}>
                  Element will blink between two colors when condition is met
                </div>

                {!isBool && (
                  <div>
                    <label style={labelStyle}>Flash when value greater than</label>
                    <input type="number" value={animation.flashThreshold ?? 80}
                      onChange={(e) => handleAnimChange('flashThreshold', parseFloat(e.target.value) || 0)}
                      style={inputStyle} />
                  </div>
                )}

                {isBool && (
                  <div style={infoBoxStyle('#EEF6FF', '#2563EB', '#1E40AF')}>
                    Will flash when tag = TRUE
                  </div>
                )}

                <div>
                  <label style={labelStyle}>Flash Speed</label>
                  <select value={animation.flashSpeed || 500}
                    onChange={(e) => handleAnimChange('flashSpeed', parseInt(e.target.value))}
                    style={inputStyle}>
                    <option value="200">Very Fast (200ms)</option>
                    <option value="500">Fast (500ms)</option>
                    <option value="1000">Normal (1s)</option>
                    <option value="2000">Slow (2s)</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  <div>
                    <label style={labelStyle}>Flash Color 1</label>
                    <input type="color" value={normalizeColor(animation.flashColor1, '#ef4444')}
                      onChange={(e) => handleAnimChange('flashColor1', e.target.value)}
                      style={{ width: '100%', height: '24px', border: '1px solid #E5E7EB', borderRadius: '4px', cursor: 'pointer' }} />
                  </div>
                  <div>
                    <label style={labelStyle}>Flash Color 2</label>
                    <input type="color" value={normalizeColor(animation.flashColor2, '#fbbf24')}
                      onChange={(e) => handleAnimChange('flashColor2', e.target.value)}
                      style={{ width: '100%', height: '24px', border: '1px solid #E5E7EB', borderRadius: '4px', cursor: 'pointer' }} />
                  </div>
                </div>
              </div>
            )}

            {animation.type === 'visibility' && (
              <div style={sectionStyle}>
                <div style={infoBoxStyle('#EEF6FF', '#2563EB', '#1E40AF')}>
                    Element hides when value is FALSE or below threshold
                </div>
                <div>
                  <label style={labelStyle}>Show when value ≥</label>
                  <input type="number" value={animation.minValue ?? 1}
                    onChange={(e) => handleAnimChange('minValue', parseFloat(e.target.value) || 0)}
                    style={inputStyle} />
                </div>
              </div>
            )}

            {animation.type === 'fill' && (
              <div style={sectionStyle}>
                <div style={infoBoxStyle('#E0F2FE', '#0891B2', '#164E63')}>
                  Use this for Tank fill level animation
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  <div>
                    <label style={labelStyle}>Min Value (0%)</label>
                    <input type="number" value={animation.minValue ?? 0}
                      onChange={(e) => handleAnimChange('minValue', parseFloat(e.target.value) || 0)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Max Value (100%)</label>
                    <input type="number" value={animation.maxValue ?? 100}
                      onChange={(e) => handleAnimChange('maxValue', parseFloat(e.target.value) || 100)} style={inputStyle} />
                  </div>
                </div>
              </div>
            )}

            {animation.type === 'rotation' && (
              <div style={sectionStyle}>
                <div style={infoBoxStyle('#F3E8FF', '#9333EA', '#581C87')}>
                  Element rotates based on tag value (in degrees)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  <div>
                    <label style={labelStyle}>Min Value → 0°</label>
                    <input type="number" value={animation.minValue ?? 0}
                      onChange={(e) => handleAnimChange('minValue', parseFloat(e.target.value) || 0)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Max Value → 360°</label>
                    <input type="number" value={animation.maxValue ?? 100}
                      onChange={(e) => handleAnimChange('maxValue', parseFloat(e.target.value) || 100)} style={inputStyle} />
                  </div>
                </div>
              </div>
            )}

            {animation.type === 'scale' && (
              <div style={sectionStyle}>
                <div style={infoBoxStyle('#FFEDD5', '#EA580C', '#7C2D12')}>
                  Element scales in size based on tag value
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  <div>
                    <label style={labelStyle}>Min Scale (%)</label>
                    <input type="number" value={animation.minScale ?? 50}
                      onChange={(e) => handleAnimChange('minScale', parseFloat(e.target.value) || 50)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Max Scale (%)</label>
                    <input type="number" value={animation.maxScale ?? 150}
                      onChange={(e) => handleAnimChange('maxScale', parseFloat(e.target.value) || 150)} style={inputStyle} />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AnimationTab;
