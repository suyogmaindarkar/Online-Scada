import { useState } from 'react';
import {
  Zap, Trash2, ChevronRight, ChevronDown, Plus,
  ArrowUp, ArrowDown, Settings2, AlertTriangle,
} from 'lucide-react';
import { normalizeActions } from '../../utils/eventUtils';

const EventsTab = ({ element, tags, onUpdate }) => {
  const [expandedCategories, setExpandedCategories] = useState({
    mouse: true, keyboard: false, focus: false, misc: true,
  });
  const [selectedEvent, setSelectedEvent] = useState('onClick');
  const [expandedActions, setExpandedActions] = useState({});

  if (!element) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF' }}>
        <p style={{ fontSize: '11px', color: '#94A3B8' }}>Select an element to configure events</p>
      </div>
    );
  }

  const events = element.events || {};
  const currentActions = normalizeActions(events[selectedEvent]);

  const eventCategories = [
    {
      id: 'mouse', label: 'Mouse',
      events: [
        { id: 'onClick', label: 'Mouse Click', supported: true },
        { id: 'onDoubleClick', label: 'Double Click', supported: true },
        { id: 'onPressLeft', label: 'Press Left', supported: true },
        { id: 'onReleaseLeft', label: 'Release Left', supported: true },
        { id: 'onPressRight', label: 'Press Right', supported: true },
        { id: 'onReleaseRight', label: 'Release Right', supported: true },
        { id: 'onMouseEnter', label: 'Mouse Enter', supported: true },
        { id: 'onMouseLeave', label: 'Mouse Leave', supported: true },
      ],
    },
    {
      id: 'keyboard', label: 'Keyboard',
      events: [
        { id: 'onKeyDown', label: 'Press Key', supported: false },
        { id: 'onKeyUp', label: 'Release Key', supported: false },
      ],
    },
    {
      id: 'focus', label: 'Focus',
      events: [
        { id: 'onFocus', label: 'Got Focus', supported: false },
        { id: 'onBlur', label: 'Lost Focus', supported: false },
      ],
    },
    {
      id: 'misc', label: 'Miscellaneous',
      events: [
        { id: 'onValueChange', label: 'Value Change', supported: true },
        { id: 'onLoad', label: 'On Load', supported: false },
      ],
    },
  ];

  const toggleCategory = (id) => setExpandedCategories((prev) => ({ ...prev, [id]: !prev[id] }));

  const saveActions = (newActions) => {
    const newEvents = { ...events };
    if (newActions.length === 0) delete newEvents[selectedEvent];
    else newEvents[selectedEvent] = newActions;
    onUpdate(element.id, { events: newEvents });
  };

  const addAction = () => {
    const newAction = {
      type: 'writeTag', targetTag: '', value: '',
      _id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    };
    saveActions([...currentActions, newAction]);
    setExpandedActions((prev) => ({ ...prev, [newAction._id]: false }));
  };

  const updateAction = (index, updates) => {
    const newActions = [...currentActions];
    newActions[index] = { ...newActions[index], ...updates };
    saveActions(newActions);
  };

  const deleteAction = (index) => saveActions(currentActions.filter((_, i) => i !== index));

  const moveAction = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= currentActions.length) return;
    const newActions = [...currentActions];
    [newActions[index], newActions[newIndex]] = [newActions[newIndex], newActions[index]];
    saveActions(newActions);
  };

  const toggleAdvanced = (actionId) => setExpandedActions((prev) => ({ ...prev, [actionId]: !prev[actionId] }));

  const currentEventLabel = eventCategories.flatMap((c) => c.events).find((e) => e.id === selectedEvent)?.label || selectedEvent;

  return (
    <div style={{ flex: 1, display: 'flex', background: '#FFFFFF', overflow: 'hidden' }}>
      {/* LEFT: Event Tree */}
      <div style={{ width: '192px', borderRight: '1px solid #E5E7EB', background: '#F8FAFC', overflowY: 'auto' }}>
        <div style={{ padding: '8px 12px', borderBottom: '1px solid #E5E7EB', background: '#F1F5F9' }}>
          <p style={{ fontSize: '10px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Event Types
          </p>
        </div>

        {eventCategories.map((cat) => (
          <div key={cat.id}>
            <button
              onClick={() => toggleCategory(cat.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '4px',
                padding: '6px 8px', fontSize: '11px', fontWeight: 600, color: '#081B43',
                background: 'transparent', border: 'none', cursor: 'pointer', transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#EEF6FF'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              {expandedCategories[cat.id] ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              <span>{cat.label}</span>
            </button>

            {expandedCategories[cat.id] && (
              <div style={{ paddingLeft: '8px' }}>
                {cat.events.map((event) => {
                  const configured = normalizeActions(events[event.id]).length > 0;
                  const isSelected = selectedEvent === event.id;
                  return (
                    <button
                      key={event.id}
                      onClick={() => setSelectedEvent(event.id)}
                      disabled={!event.supported}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '4px 8px 4px 24px', fontSize: '11px', textAlign: 'left',
                        background: isSelected ? '#2563EB' : 'transparent',
                        color: isSelected ? '#FFFFFF' : event.supported ? '#334155' : '#CBD5E1',
                        border: 'none', cursor: event.supported ? 'pointer' : 'not-allowed',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (event.supported && !isSelected) e.currentTarget.style.background = '#EEF6FF';
                      }}
                      onMouseLeave={(e) => {
                        if (event.supported && !isSelected) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      {configured && (
                        <Zap size={9} style={{ color: isSelected ? '#FEF3C7' : '#F59E0B' }} />
                      )}
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {event.label}
                      </span>
                      {configured && (
                        <span style={{ fontSize: '9px', fontFamily: 'monospace', color: isSelected ? '#FEF3C7' : '#F59E0B' }}>
                          {normalizeActions(events[event.id]).length}
                        </span>
                      )}
                      {!event.supported && <span style={{ fontSize: '8px', fontStyle: 'italic' }}>soon</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* RIGHT: Actions Configuration */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '8px 12px', borderBottom: '1px solid #E5E7EB', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: '10px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Configure: <span style={{ color: '#2563EB' }}>{currentEventLabel}</span>
            {currentActions.length > 0 && (
              <span style={{ marginLeft: '8px', color: '#5F6B7A', textTransform: 'none', fontWeight: 400 }}>
                ({currentActions.length} action{currentActions.length !== 1 ? 's' : ''})
              </span>
            )}
          </p>
          {currentActions.length > 0 && (
            <button
              onClick={() => saveActions([])}
              style={{ padding: '2px 8px', fontSize: '10px', color: '#DC2626', background: 'transparent', border: 'none', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#FEE2E2'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              title="Remove all actions"
            >
              <Trash2 size={10} />
              Clear All
            </button>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {currentActions.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ display: 'inline-flex', padding: '12px', background: '#EEF6FF', borderRadius: '9999px', marginBottom: '12px' }}>
                <Zap size={20} style={{ color: '#2563EB' }} />
              </div>
              <p style={{ fontSize: '11px', color: '#5F6B7A', fontStyle: 'italic', marginBottom: '12px' }}>
                No actions configured for this event
              </p>
              <button
                onClick={addAction}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px', background: '#2563EB', color: '#FFFFFF', fontSize: '11px', fontWeight: 500, border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#1D4ED8'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#2563EB'; }}
              >
                <Plus size={12} />
                Add First Action
              </button>
            </div>
          )}

          {currentActions.map((action, index) => (
            <ActionCard
              key={action._id || index}
              action={action} index={index} total={currentActions.length} tags={tags}
              isAdvancedOpen={expandedActions[action._id]}
              onUpdate={(updates) => updateAction(index, updates)}
              onDelete={() => deleteAction(index)}
              onMoveUp={() => moveAction(index, -1)}
              onMoveDown={() => moveAction(index, 1)}
              onToggleAdvanced={() => toggleAdvanced(action._id)}
            />
          ))}

          {currentActions.length > 0 && (
            <button
              onClick={addAction}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                padding: '8px 12px', background: '#F8FAFC', border: '1px dashed #2563EB',
                color: '#2563EB', fontSize: '11px', fontWeight: 500, borderRadius: '4px', cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#EEF6FF'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#F8FAFC'; }}
            >
              <Plus size={12} />
              Add Another Action
            </button>
          )}

          <div style={{ marginTop: '24px', padding: '8px', background: '#F8FAFC', border: '1px solid #E5E7EB', borderRadius: '4px', fontSize: '10px', color: '#5F6B7A' }}>
            <strong>💡 Tip:</strong> Actions execute in order. Use ↑↓ to reorder.
            {selectedEvent === 'onValueChange' && (
              <div style={{ marginTop: '4px', color: '#2563EB' }}>
                <strong>⚡ Value Change:</strong> Triggers when the element's bound tag value changes.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ActionCard = ({ action, index, total, tags, isAdvancedOpen, onUpdate, onDelete, onMoveUp, onMoveDown, onToggleAdvanced }) => {
  const actionInfo = actionTypeConfig[action.type] || actionTypeConfig.writeTag;

  return (
    <div style={{ border: '1px solid #E5E7EB', borderRadius: '4px', background: '#FFFFFF', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', background: '#F8FAFC', borderBottom: '1px solid #E5E7EB' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: '#334155', width: '24px' }}>#{index + 1}</span>
        <span style={{ fontSize: '10px', fontWeight: 600, color: actionInfo.color }}>
          {actionInfo.icon} {actionInfo.label}
        </span>
        <div style={{ flex: 1 }} />

        <button onClick={onMoveUp} disabled={index === 0}
          style={{ padding: '2px', color: '#5F6B7A', background: 'transparent', border: 'none', cursor: index === 0 ? 'not-allowed' : 'pointer', opacity: index === 0 ? 0.3 : 1 }}
          title="Move up">
          <ArrowUp size={11} />
        </button>
        <button onClick={onMoveDown} disabled={index === total - 1}
          style={{ padding: '2px', color: '#5F6B7A', background: 'transparent', border: 'none', cursor: index === total - 1 ? 'not-allowed' : 'pointer', opacity: index === total - 1 ? 0.3 : 1 }}
          title="Move down">
          <ArrowDown size={11} />
        </button>
        <button onClick={onDelete}
          style={{ padding: '2px', color: '#DC2626', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '4px' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#FEE2E2'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          title="Delete action">
          <Trash2 size={11} />
        </button>
      </div>

      <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div>
          <label style={fieldLabelStyle}>Action Type</label>
          <select
            value={action.type}
            onChange={(e) => onUpdate({ type: e.target.value })}
            style={fieldSelectStyle}
          >
            <optgroup label="Tag Actions">
              <option value="writeTag">Write Value to Tag</option>
              <option value="toggleTag">Toggle Tag (BOOL)</option>
              <option value="incrementTag">Increment Tag</option>
              <option value="decrementTag">Decrement Tag</option>
              <option value="copyTag">Copy Tag Value</option>
            </optgroup>
            <optgroup label="Screen Actions">
              <option value="changeScreen">Change Screen</option>
              <option value="showPopup">Show Popup (stub)</option>
              <option value="closePopup">Close Popup (stub)</option>
            </optgroup>
            <optgroup label="UI Actions">
              <option value="showMessage">Show Message (Toast)</option>
              <option value="alert">Alert Box</option>
            </optgroup>
            <optgroup label="Advanced (Coming Later)">
              <option value="runScript" disabled>Custom Script</option>
              <option value="playSound" disabled>Play Sound</option>
            </optgroup>
          </select>
        </div>

        <ActionFields action={action} tags={tags} onUpdate={onUpdate} />

        <button
          onClick={onToggleAdvanced}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '4px',
            padding: '4px 8px', fontSize: '10px', color: '#5F6B7A',
            background: 'transparent', border: '1px solid #E5E7EB', borderRadius: '4px', cursor: 'pointer',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#EEF6FF'; e.currentTarget.style.color = '#2563EB'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#5F6B7A'; }}
        >
          <Settings2 size={10} />
          {isAdvancedOpen ? 'Hide Advanced' : 'Show Advanced'}
          {(action.confirmMessage || action.delay || action.condition) && (
            <span style={{ marginLeft: 'auto', color: '#2563EB', fontFamily: 'monospace', fontSize: '9px' }}>●</span>
          )}
        </button>

        {isAdvancedOpen && <AdvancedFields action={action} tags={tags} onUpdate={onUpdate} />}
      </div>
    </div>
  );
};

const ActionFields = ({ action, tags, onUpdate }) => {
  if (['writeTag', 'toggleTag', 'incrementTag', 'decrementTag'].includes(action.type)) {
    return (
      <>
        <FieldSelect label="Target Tag" value={action.targetTag || ''} onChange={(v) => onUpdate({ targetTag: v })}
          options={[{ value: '', label: '— Select tag —' }, ...tags.map((t) => ({ value: t.tagName, label: `${t.tagName} (${t.dataType})` }))]} />
        {action.type === 'writeTag' && (
          <FieldInput label="Value to Write" value={action.value ?? ''} onChange={(v) => onUpdate({ value: v })} placeholder="e.g. 100 or true" />
        )}
        {['incrementTag', 'decrementTag'].includes(action.type) && (
          <FieldInput label="Step Size" type="number" value={action.step ?? 1} onChange={(v) => onUpdate({ step: parseFloat(v) || 1 })} />
        )}
      </>
    );
  }
  if (action.type === 'copyTag') {
    return (
      <>
        <FieldSelect label="Source Tag (from)" value={action.sourceTag || ''} onChange={(v) => onUpdate({ sourceTag: v })}
          options={[{ value: '', label: '— Select source —' }, ...tags.map((t) => ({ value: t.tagName, label: `${t.tagName} (${t.dataType})` }))]} />
        <FieldSelect label="Target Tag (to)" value={action.targetTag || ''} onChange={(v) => onUpdate({ targetTag: v })}
          options={[{ value: '', label: '— Select target —' }, ...tags.map((t) => ({ value: t.tagName, label: `${t.tagName} (${t.dataType})` }))]} />
      </>
    );
  }
  if (action.type === 'changeScreen') {
    return <FieldInput label="Target Screen Name" value={action.screenName || ''} onChange={(v) => onUpdate({ screenName: v })} placeholder="e.g. Dashboard" />;
  }
  if (['showMessage', 'alert'].includes(action.type)) {
    return (
      <>
        <FieldInput label="Message Text" value={action.text || ''} onChange={(v) => onUpdate({ text: v })} placeholder="Enter message" />
        {action.type === 'showMessage' && (
          <FieldSelect label="Style" value={action.style || 'info'} onChange={(v) => onUpdate({ style: v })}
            options={[
              { value: 'info', label: 'ℹ Info (Blue)' },
              { value: 'success', label: '✓ Success (Green)' },
              { value: 'warning', label: '⚠ Warning (Yellow)' },
              { value: 'error', label: '✗ Error (Red)' },
            ]} />
        )}
      </>
    );
  }
  return <p style={{ fontSize: '10px', color: '#94A3B8', fontStyle: 'italic' }}>No configuration needed for this action.</p>;
};

const AdvancedFields = ({ action, tags, onUpdate }) => (
  <div style={{ padding: '8px', background: '#F8FAFC', border: '1px solid #E5E7EB', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
    <FieldInput label="Confirmation Message" value={action.confirmMessage || ''} onChange={(v) => onUpdate({ confirmMessage: v || undefined })}
      placeholder="e.g. Are you sure?" />
    <FieldInput label="Delay (ms)" type="number" value={action.delay ?? ''} onChange={(v) => onUpdate({ delay: v ? parseInt(v) : undefined })}
      placeholder="e.g. 500" />
    <div>
      <label style={{ ...fieldLabelStyle, display: 'flex', alignItems: 'center', gap: '4px' }}>
        <AlertTriangle size={10} />
        Execute Only If (Condition)
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
        <select
          value={action.condition?.tag || ''}
          onChange={(e) => {
            const tag = e.target.value;
            if (!tag) onUpdate({ condition: undefined });
            else onUpdate({ condition: { ...(action.condition || {}), tag, operator: '==', value: '' } });
          }}
          style={{ height: '24px', padding: '0 4px', fontSize: '10px', background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '4px', color: '#081B43' }}
        >
          <option value="">— No condition —</option>
          {tags.map((t) => <option key={t._id} value={t.tagName}>{t.tagName}</option>)}
        </select>
        {action.condition?.tag && (
          <>
            <select value={action.condition?.operator || '=='} onChange={(e) => onUpdate({ condition: { ...action.condition, operator: e.target.value } })}
              style={{ height: '24px', padding: '0 4px', fontSize: '10px', background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '4px', color: '#081B43' }}>
              <option value="==">==</option>
              <option value="!=">!=</option>
              <option value=">">&gt;</option>
              <option value="<">&lt;</option>
              <option value=">=">&gt;=</option>
              <option value="<=">&lt;=</option>
            </select>
            <input type="text" value={action.condition?.value ?? ''} onChange={(e) => onUpdate({ condition: { ...action.condition, value: e.target.value } })}
              placeholder="value"
              style={{ height: '24px', padding: '0 4px', fontSize: '10px', background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '4px', color: '#081B43' }} />
          </>
        )}
      </div>
    </div>
  </div>
);

const fieldLabelStyle = {
  display: 'block',
  fontSize: '10px',
  fontWeight: 600,
  color: '#5F6B7A',
  marginBottom: '4px',
  textTransform: 'uppercase',
};

const fieldInputStyle = {
  width: '100%',
  height: '28px',
  padding: '0 8px',
  fontSize: '11px',
  background: '#FFFFFF',
  border: '1px solid #E5E7EB',
  borderRadius: '4px',
  outline: 'none',
  color: '#081B43',
};

const fieldSelectStyle = { ...fieldInputStyle };

const FieldInput = ({ label, value, onChange, type = 'text', placeholder }) => (
  <div>
    <label style={fieldLabelStyle}>{label}</label>
    <input
      type={type}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={fieldInputStyle}
      onFocus={(e) => { e.target.style.borderColor = '#2563EB'; }}
      onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; }}
    />
  </div>
);

const FieldSelect = ({ label, value, onChange, options }) => (
  <div>
    <label style={fieldLabelStyle}>{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={fieldSelectStyle}
      onFocus={(e) => { e.target.style.borderColor = '#2563EB'; }}
      onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

const actionTypeConfig = {
  writeTag: { icon: '✏️', label: 'Write Tag', color: '#2563EB' },
  toggleTag: { icon: '🔄', label: 'Toggle Tag', color: '#9333EA' },
  incrementTag: { icon: '⬆', label: 'Increment', color: '#16A34A' },
  decrementTag: { icon: '⬇', label: 'Decrement', color: '#EA580C' },
  copyTag: { icon: '📋', label: 'Copy Tag', color: '#0891B2' },
  changeScreen: { icon: '🖥', label: 'Change Screen', color: '#4F46E5' },
  showMessage: { icon: '💬', label: 'Show Message', color: '#0D9488' },
  alert: { icon: '⚠️', label: 'Alert Box', color: '#DC2626' },
  showPopup: { icon: '🪟', label: 'Show Popup', color: '#64748B' },
  closePopup: { icon: '✖', label: 'Close Popup', color: '#64748B' },
  runScript: { icon: '⚙', label: 'Run Script', color: '#94A3B8' },
  playSound: { icon: '🔊', label: 'Play Sound', color: '#94A3B8' },
};

export default EventsTab;