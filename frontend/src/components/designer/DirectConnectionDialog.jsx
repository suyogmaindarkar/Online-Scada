import { useState, useEffect } from 'react';
import { Link2, Copy, Trash2, ArrowRight, Power, PowerOff, Plus, AlertTriangle } from 'lucide-react';
import Modal from '../ui/Modal';
import { createEmptyConnection, validateConnection } from '../../utils/directConnectionUtils';

const DirectConnectionDialog = ({ isOpen, onClose, connections = [], tags = [], onSave }) => {
  const [localConnections, setLocalConnections] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    if (isOpen) {
      const reset = setTimeout(() => {
        setLocalConnections([...connections]);
        setSelectedId(connections[0]?.id || null);
      }, 0);
      return () => clearTimeout(reset);
    }
  }, [isOpen, connections]);

  if (!isOpen) return null;

  const selected = localConnections.find((c) => c.id === selectedId);

  const handleAdd = () => {
    const newConn = createEmptyConnection();
    setLocalConnections([...localConnections, newConn]);
    setSelectedId(newConn.id);
  };

  const handleDelete = (id) => {
    if (!window.confirm('Delete this Direct Connection?')) return;
    const filtered = localConnections.filter((c) => c.id !== id);
    setLocalConnections(filtered);
    if (selectedId === id) setSelectedId(filtered[0]?.id || null);
  };

  const handleDuplicate = (id) => {
    const src = localConnections.find((c) => c.id === id);
    if (!src) return;
    const copy = {
      ...JSON.parse(JSON.stringify(src)),
      id: `dc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: `${src.name || 'Connection'} (copy)`,
    };
    setLocalConnections([...localConnections, copy]);
    setSelectedId(copy.id);
  };

  const handleToggle = (id) => {
    setLocalConnections(localConnections.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c)));
  };

  const updateSelected = (updates) => {
    setLocalConnections(localConnections.map((c) => (c.id === selectedId ? { ...c, ...updates } : c)));
  };

  const updateSourceOrTarget = (which, updates) => {
    updateSelected({ [which]: { ...(selected?.[which] || {}), ...updates } });
  };

  const handleSaveAll = () => {
    for (const conn of localConnections) {
      const err = validateConnection(conn);
      if (err) {
        alert(`Connection "${conn.name || conn.id}" is invalid: ${err}`);
        setSelectedId(conn.id);
        return;
      }
    }
    onSave(localConnections);
    onClose();
  };

  const selectStyle = {
    width: '100%',
    padding: '8px 12px',
    background: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#081B43',
    outline: 'none',
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🔗 Direct Connections" size="xl">
      <div style={{ display: 'flex', gap: '16px', height: '500px' }}>
        {/* LEFT: List */}
        <div style={{ width: '288px', borderRight: '1px solid #E5E7EB', paddingRight: '12px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#5F6B7A', textTransform: 'uppercase' }}>
              Connections ({localConnections.length})
            </span>
            <button
              onClick={handleAdd}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px',
                background: '#2563EB', color: '#FFFFFF', fontSize: '11px', border: 'none',
                borderRadius: '4px', cursor: 'pointer', fontWeight: 600,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#1D4ED8'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#2563EB'; }}
            >
              <Plus size={12} />
              Add
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {localConnections.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 0', fontSize: '11px', color: '#94A3B8', fontStyle: 'italic' }}>
                No connections yet. Click "Add" to create one.
              </div>
            )}
            {localConnections.map((conn) => {
              const isSelected = selectedId === conn.id;
              const invalid = !!validateConnection(conn);
              return (
                <div
                  key={conn.id}
                  onClick={() => setSelectedId(conn.id)}
                  style={{
                    padding: '8px', borderRadius: '4px', cursor: 'pointer',
                    background: isSelected ? '#EEF6FF' : '#FFFFFF',
                    border: `1px solid ${isSelected ? '#2563EB' : '#E5E7EB'}`,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggle(conn.id); }}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: conn.enabled ? '#16A34A' : '#94A3B8', display: 'flex' }}
                      title={conn.enabled ? 'Enabled' : 'Disabled'}
                    >
                      {conn.enabled ? <Power size={12} /> : <PowerOff size={12} />}
                    </button>
                    <span style={{ fontSize: '11px', color: '#081B43', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {conn.name || <span style={{ fontStyle: 'italic', color: '#94A3B8' }}>Untitled</span>}
                    </span>
                    {invalid && <AlertTriangle size={12} style={{ color: '#DC2626' }} title={validateConnection(conn)} />}
                  </div>
                  <div style={{ marginTop: '4px', fontSize: '10px', color: '#5F6B7A', display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
                    <span style={{ fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {conn.source?.type === 'static' ? `= ${conn.source?.value || '?'}` : conn.source?.tag || '?'}
                    </span>
                    <ArrowRight size={9} />
                    <span style={{ fontFamily: 'monospace', color: '#16A34A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {conn.target?.tag || '?'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: Edit */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {!selected ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <div style={{ textAlign: 'center' }}>
                <Link2 style={{ width: '48px', height: '48px', color: '#CBD5E1', margin: '0 auto 12px' }} />
                <p style={{ fontSize: '13px', color: '#5F6B7A' }}>
                  Select a connection to edit, or click "Add" to create one.
                </p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '12px', borderBottom: '1px solid #E5E7EB' }}>
                <Link2 style={{ width: '20px', height: '20px', color: '#2563EB' }} />
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#081B43', flex: 1, margin: 0, fontFamily: "'Montserrat', sans-serif" }}>Edit Connection</h3>
                <button onClick={() => handleDuplicate(selected.id)}
                  style={{ padding: '6px', background: '#F8FAFC', color: '#334155', border: '1px solid #E5E7EB', borderRadius: '4px', cursor: 'pointer' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#EEF6FF'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#F8FAFC'; }}
                  title="Duplicate">
                  <Copy size={14} />
                </button>
                <button onClick={() => handleDelete(selected.id)}
                  style={{ padding: '6px', background: '#FEE2E2', color: '#DC2626', border: '1px solid rgba(220, 38, 38, 0.20)', borderRadius: '4px', cursor: 'pointer' }}
                  title="Delete">
                  <Trash2 size={14} />
                </button>
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', color: '#5F6B7A', marginBottom: '4px', fontWeight: 700, textTransform: 'uppercase' }}>Name</label>
                  <input type="text" value={selected.name || ''} onChange={(e) => updateSelected({ name: e.target.value })}
                    placeholder="e.g. Motor Sync" style={selectStyle} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '8px' }}>
                  <input type="checkbox" checked={selected.enabled} onChange={(e) => updateSelected({ enabled: e.target.checked })}
                    style={{ width: '16px', height: '16px', accentColor: '#16A34A' }} />
                  <span style={{ fontSize: '11px', color: '#334155', fontWeight: 500 }}>Enabled</span>
                </label>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#5F6B7A', marginBottom: '4px', fontWeight: 700, textTransform: 'uppercase' }}>Trigger</label>
                <select value={selected.trigger || 'onChange'} onChange={(e) => updateSelected({ trigger: e.target.value })} style={selectStyle}>
                  <option value="onChange">On Source Change (real-time)</option>
                  <option value="onLoad">On Screen Load (once)</option>
                </select>
                <p style={{ marginTop: '4px', fontSize: '10px', color: '#94A3B8', fontStyle: 'italic' }}>
                  {selected.trigger === 'onLoad'
                    ? 'Fires exactly once when the runtime loads this screen.'
                    : 'Fires every time the source tag value changes.'}
                </p>
              </div>

              <div style={{ padding: '12px', background: '#F8FAFC', border: '1px solid #E5E7EB', borderRadius: '4px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: '#2563EB', marginBottom: '8px', fontWeight: 700, textTransform: 'uppercase' }}>
                  Source (From)
                </label>
                <div style={{ marginBottom: '8px' }}>
                  <select value={selected.source?.type || 'tag'} onChange={(e) => updateSourceOrTarget('source', { type: e.target.value })}
                    style={{ ...selectStyle, padding: '6px 12px', fontSize: '11px' }}>
                    <option value="tag">Tag Value</option>
                    <option value="static">Static Value (constant)</option>
                  </select>
                </div>
                {selected.source?.type === 'tag' && (
                  <select value={selected.source?.tag || ''} onChange={(e) => updateSourceOrTarget('source', { tag: e.target.value })} style={selectStyle}>
                    <option value="">— Select source tag —</option>
                    {tags.map((t) => <option key={t._id} value={t.tagName}>{t.tagName} ({t.dataType})</option>)}
                  </select>
                )}
                {selected.source?.type === 'static' && (
                  <input type="text" value={selected.source?.value ?? ''} onChange={(e) => updateSourceOrTarget('source', { value: e.target.value })}
                    placeholder="e.g. 100, true, 'hello'"
                    style={{ ...selectStyle, fontFamily: 'monospace' }} />
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <ArrowRight style={{ width: '24px', height: '24px', color: '#94A3B8' }} />
              </div>

              <div style={{ padding: '12px', background: '#F8FAFC', border: '1px solid rgba(22, 163, 74, 0.25)', borderRadius: '4px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: '#16A34A', marginBottom: '8px', fontWeight: 700, textTransform: 'uppercase' }}>
                  Target (To)
                </label>
                <select value={selected.target?.tag || ''} onChange={(e) => updateSourceOrTarget('target', { type: 'tag', tag: e.target.value })} style={selectStyle}>
                  <option value="">— Select target tag —</option>
                  {tags.map((t) => <option key={t._id} value={t.tagName}>{t.tagName} ({t.dataType})</option>)}
                </select>
                <p style={{ marginTop: '8px', fontSize: '10px', color: '#94A3B8', fontStyle: 'italic' }}>
                  Source value will be written to this tag.
                </p>
              </div>

              {validateConnection(selected) && (
                <div style={{ padding: '8px', background: '#FEE2E2', border: '1px solid rgba(220, 38, 38, 0.30)', borderRadius: '4px', fontSize: '11px', color: '#B91C1C', fontWeight: 500 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <AlertTriangle size={12} /> {validateConnection(selected)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #E5E7EB' }}>
        <div style={{ fontSize: '11px', color: '#94A3B8' }}>
          {localConnections.filter((c) => c.enabled).length} enabled ·{' '}
          {localConnections.filter((c) => !c.enabled).length} disabled
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onClose}
            style={{ padding: '8px 16px', background: '#F1F5F9', color: '#334155', border: '1px solid #E5E7EB', fontSize: '13px', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}>
            Cancel
          </button>
          <button onClick={handleSaveAll}
            style={{ padding: '8px 16px', background: '#081B43', color: '#FFFFFF', border: 'none', fontSize: '13px', fontWeight: 600, borderRadius: '6px', cursor: 'pointer', boxShadow: '0px 2px 6px rgba(8, 27, 67, 0.25)', fontFamily: "'Montserrat', sans-serif" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#123E8A'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#081B43'; }}>
            Apply
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default DirectConnectionDialog;
