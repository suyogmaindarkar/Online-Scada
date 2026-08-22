// ═══════════════════════════════════════════════════════════
// TagManagement — Blue theme + CSV Import/Export
//
// Task Bundle applied:
//   ✅ T060  — Bulk import from CSV (with preview + mode selector)
//   ✅ T061  — Bulk export to CSV
//   ✅ BONUS — Template download + import summary modal
//   ✅ UI FIX 1: Updated action button styles to match design specs.
//   ✅ UI FIX 3: Removed header icon container for clean left-alignment.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import { tagAPI, plcAPI } from '../services/api';
import socketService from '../services/socket';
import { useToast } from '../context/ToastContext';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import {
  Plus, Edit2, Trash2, Search, Filter, Tag as TagIcon,
  Loader2, Send, Database, Download, Upload, FileText,
  CheckCircle, XCircle, AlertTriangle, X,
} from 'lucide-react';

// ─── Theme ───
const C = {
  bg:         '#F8FAFC',
  card:       '#FFFFFF',
  cardSubtle: '#F8FAFC',
  cardHover:  '#EEF6FF',
  border:     '#E5E7EB',
  heading:    '#081B43',
  text:       '#334155',
  muted:      '#5F6B7A',
  subtle:     '#94A3B8',
  brand:      '#2563EB',
  brandDark:  '#0F3D91',
  btnPrimary: '#2563EB',
  btnHover:   '#1D4ED8',
  success:    '#16A34A',
  warning:    '#F59E0B',
  danger:     '#DC2626',
  purple:     '#9333EA',
};

const TagManagement = () => {
  const { showToast } = useToast();

  const [tags, setTags] = useState([]);
  const [plcs, setPlcs] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [liveValues, setLiveValues] = useState({});
  const [writeTag, setWriteTag] = useState(null);
  const [writeValue, setWriteValue] = useState('');

  // Import/Export state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importCsvText, setImportCsvText] = useState('');
  const [importMode, setImportMode] = useState('create');
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState(initialFormData());

  function initialFormData() {
    return {
      tagName: '',
      description: '',
      group: 'Default',
      dataType: 'INT',
      plcConnection: '',
      plcAddress: '',
      accessType: 'READ_WRITE',
      unit: '',
      minValue: 0,
      maxValue: 100,
      enableLogging: false,
      enableAlarm: false,
    };
  }

  useEffect(() => {
    loadData();

    const handleTagsUpdate = (updates) => {
      if (!Array.isArray(updates)) return;
      setLiveValues((prev) => {
        const updated = { ...prev };
        updates.forEach((u) => {
          if (u && u.tagName !== undefined) updated[u.tagName] = u.value;
        });
        return updated;
      });
    };

    const handleInitialTags = (initialTags) => {
      if (!Array.isArray(initialTags)) return;
      const values = {};
      initialTags.forEach((t) => {
        if (t && t.tagName !== undefined) values[t.tagName] = t.value;
      });
      setLiveValues(values);
    };

    socketService.on('tagsUpdate', handleTagsUpdate);
    socketService.on('initialTags', handleInitialTags);

    return () => {
      socketService.off('tagsUpdate', handleTagsUpdate);
      socketService.off('initialTags', handleInitialTags);
    };
  }, []);

  useEffect(() => { loadTags(); }, [searchTerm, selectedGroup]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tagRes, plcRes, groupRes] = await Promise.all([
        tagAPI.getAll(),
        plcAPI.getAll(),
        tagAPI.getGroups(),
      ]);
      setTags(tagRes.data.data);
      setPlcs(plcRes.data.data);
      setGroups(groupRes.data.data);
    } catch (err) {
      console.error('Failed to load:', err);
      showToast('Failed to load tag data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadTags = async () => {
    try {
      const filters = {};
      if (searchTerm) filters.search = searchTerm;
      if (selectedGroup) filters.group = selectedGroup;
      const res = await tagAPI.getAll(filters);
      setTags(res.data.data);
    } catch (err) {
      console.error('Failed to load tags:', err);
    }
  };

  const handleOpenAdd = () => {
    setEditingTag(null);
    setFormData(initialFormData());
    setShowModal(true);
  };

  const handleOpenEdit = (tag) => {
    setEditingTag(tag);
    setFormData({
      tagName: tag.tagName,
      description: tag.description || '',
      group: tag.group,
      dataType: tag.dataType,
      plcConnection: tag.plcConnection?._id || tag.plcConnection || '',
      plcAddress: tag.plcAddress || '',
      accessType: tag.accessType,
      unit: tag.unit || '',
      minValue: tag.minValue,
      maxValue: tag.maxValue,
      enableLogging: tag.enableLogging,
      enableAlarm: tag.enableAlarm,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = { ...formData };
      if (!data.plcConnection) delete data.plcConnection;

      if (editingTag) {
        await tagAPI.update(editingTag._id, data);
        showToast(`Tag "${data.tagName}" updated successfully`, 'success');
      } else {
        await tagAPI.create(data);
        showToast(`Tag "${data.tagName}" created successfully`, 'success');
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Operation failed', 'error');
    }
  };

  const handleDelete = async () => {
    try {
      await tagAPI.delete(deleteId);
      setDeleteId(null);
      loadData();
      showToast('Tag deleted successfully', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Delete failed', 'error');
    }
  };

  const handleWriteValue = async () => {
    try {
      let value = writeValue;
      if (writeTag.dataType === 'BOOL') {
        value = value === 'true' || value === '1';
      } else if (['INT', 'DINT', 'REAL', 'WORD', 'DWORD', 'BYTE'].includes(writeTag.dataType)) {
        value = parseFloat(value);
      }
      await tagAPI.writeValue(writeTag.tagName, value);
      setWriteTag(null);
      setWriteValue('');
      showToast(`Value written to ${writeTag.tagName}`, 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Write failed', 'error');
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : type === 'number' ? parseFloat(value) : value,
    });
  };

  const handleExportCSV = async () => {
    try {
      setExporting(true);
      const res = await tagAPI.exportCSV();
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tags_export_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`Exported ${tags.length} tags to CSV`, 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Export failed', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await tagAPI.downloadTemplate();
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tags_import_template.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Template downloaded', 'success');
    } catch (err) {
      showToast('Failed to download template', 'error');
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      showToast('Please select a .csv file', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      setImportCsvText(evt.target.result);
      showToast(`Loaded ${file.name} (${(file.size / 1024).toFixed(1)} KB)`, 'success');
    };
    reader.onerror = () => showToast('Failed to read file', 'error');
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleOpenImport = () => {
    setImportCsvText('');
    setImportResults(null);
    setImportMode('create');
    setShowImportModal(true);
  };

  const handleImportSubmit = async () => {
    if (!importCsvText.trim()) {
      showToast('No CSV content to import', 'warning');
      return;
    }
    try {
      setImporting(true);
      const res = await tagAPI.importCSV(importCsvText, importMode);
      setImportResults(res.data.data);
      showToast(res.data.message, 'success', 5000);
      loadData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Import failed', 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleCloseImport = () => {
    setShowImportModal(false);
    setImportCsvText('');
    setImportResults(null);
  };

  const getDataTypeColor = (type) => {
    const colors = {
      BOOL:   { bg: '#F3E8FF', text: '#7E22CE' },
      INT:    { bg: C.cardHover, text: C.brand },
      DINT:   { bg: C.cardHover, text: C.brand },
      REAL:   { bg: '#DCFCE7', text: C.success },
      STRING: { bg: '#FEF3C7', text: '#78350F' },
      WORD:   { bg: C.cardSubtle, text: C.text },
      DWORD:  { bg: C.cardSubtle, text: C.text },
      BYTE:   { bg: C.cardSubtle, text: C.text },
    };
    return colors[type] || { bg: C.cardSubtle, text: C.text };
  };

  const csvLineCount = importCsvText
    .split('\n')
    .filter(l => l.trim() && !l.trim().startsWith('#')).length - 1;

  return (
    <div className="space-y-4" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* ═══════════ HEADER ═══════════ */}
      <div
        className="p-5 rounded-2xl"
        style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.06)' }}
      >
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: C.heading, fontFamily: "'Montserrat', sans-serif" }}>
              Tag Management
            </h1>
            <p className="text-sm mt-0.5" style={{ color: C.muted }}>
              Manage PLC tags and variables
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* ✅ Import CSV button */}
            <button
              onClick={handleOpenImport}
              className="border border-amber-500 text-amber-600 bg-white hover:bg-amber-50 font-medium px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
              title="Import tags from a CSV file"
            >
              <Upload className="w-5 h-5" />
              Import CSV
            </button>

            {/* ✅ Export CSV button */}
            <button
              onClick={handleExportCSV}
              disabled={exporting || tags.length === 0}
              className="border border-emerald-500 text-emerald-600 bg-white hover:bg-emerald-50 font-medium px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm disabled:opacity-50"
              title="Export all tags to a CSV file"
            >
              {exporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
              Export CSV
            </button>

            {/* ✅ + Add Tag button */}
            <button
              onClick={handleOpenAdd}
              className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-medium px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
              title="Add a new tag"
            >
              <Plus className="w-5 h-5 text-white" />
              <span className="text-white">+ Add Tag</span>
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════ STATS ═══════════ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard label="Total Tags" value={tags.length} icon={TagIcon} color={C.brand} />
        <StatCard label="Tag Groups" value={groups.length} icon={Database} color={C.purple} />
        <StatCard label="Live Updates" value={Object.keys(liveValues).length} icon={Send} color={C.success} />
      </div>

      {/* ═══════════ FILTERS ═══════════ */}
      <div
        className="p-4 rounded-xl"
        style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.04)' }}
      >
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.subtle }} />
            <input
              type="text"
              placeholder="Search tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg outline-none text-sm"
              style={{ background: C.cardSubtle, border: `1px solid ${C.border}`, color: C.heading }}
              onFocus={(e) => e.target.style.borderColor = C.brand}
              onBlur={(e) => e.target.style.borderColor = C.border}
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 z-10" style={{ color: C.subtle }} />
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="pl-10 pr-8 py-2 rounded-lg outline-none min-w-[200px] text-sm"
              style={{ background: C.cardSubtle, border: `1px solid ${C.border}`, color: C.heading }}
            >
              <option value="">All Groups</option>
              {groups.map((g) => (
                <option key={g.name} value={g.name}>{g.name} ({g.count})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ═══════════ TAGS TABLE ═══════════ */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.06)' }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: C.brand }} />
          </div>
        ) : tags.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: C.cardHover }}
            >
              <TagIcon className="w-10 h-10" style={{ color: C.brand }} />
            </div>
            <h3 className="text-xl font-bold mb-2" style={{ color: C.heading, fontFamily: "'Montserrat', sans-serif" }}>
              No Tags Found
            </h3>
            <p className="text-sm max-w-md mx-auto mb-6" style={{ color: C.muted }}>
              {searchTerm || selectedGroup
                ? 'No tags match your current filter. Try clearing the search or importing from CSV.'
                : 'Add tags manually, import them from CSV, or start a Simulation PLC to get demo tags.'}
            </p>
            {!searchTerm && !selectedGroup && (
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <button
                  onClick={handleOpenAdd}
                  className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-medium px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                >
                  <Plus className="w-5 h-5 text-white" />
                  <span className="text-white">+ Add Tag</span>
                </button>
                <button
                  onClick={handleOpenImport}
                  className="border border-amber-500 text-amber-600 bg-white hover:bg-amber-50 font-medium px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                >
                  <Upload className="w-5 h-5" />
                  Import CSV
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead style={{ background: C.cardSubtle, borderBottom: `1px solid ${C.border}` }}>
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: C.muted }}>Tag Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: C.muted }}>Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: C.muted }}>Group</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: C.muted }}>Address</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: C.muted }}>Live Value</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: C.muted }}>Unit</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase" style={{ color: C.muted }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tags.map((tag, idx) => {
                  const liveValue = liveValues[tag.tagName] ?? tag.currentValue;
                  const dtColor = getDataTypeColor(tag.dataType);
                  return (
                    <tr
                      key={tag._id}
                      style={{
                        borderBottom: idx < tags.length - 1 ? `1px solid ${C.border}` : 'none',
                        background: C.card,
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = C.cardSubtle}
                      onMouseLeave={(e) => e.currentTarget.style.background = C.card}
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-mono font-semibold" style={{ color: C.heading }}>{tag.tagName}</p>
                          {tag.description && (
                            <p className="text-xs mt-0.5" style={{ color: C.muted }}>{tag.description}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="px-2 py-0.5 text-xs rounded font-mono font-semibold"
                          style={{ background: dtColor.bg, color: dtColor.text }}
                        >
                          {tag.dataType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: C.text }}>{tag.group}</td>
                      <td className="px-4 py-3 text-sm font-mono" style={{ color: C.text }}>
                        {tag.plcAddress || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ background: tag.quality === 'GOOD' ? C.success : C.danger }}
                          />
                          <span className="font-mono font-bold" style={{ color: C.brand }}>
                            {typeof liveValue === 'boolean'
                              ? liveValue ? 'TRUE' : 'FALSE'
                              : typeof liveValue === 'number'
                              ? Number.isInteger(liveValue) ? liveValue : liveValue.toFixed(2)
                              : String(liveValue)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: C.muted }}>{tag.unit || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {tag.accessType !== 'READ' && (
                            <TableActionButton
                              variant="green"
                              icon={Send}
                              onClick={() => setWriteTag(tag)}
                              title={`Write value to ${tag.tagName}`}
                            />
                          )}
                          <TableActionButton
                            variant="blue"
                            icon={Edit2}
                            onClick={() => handleOpenEdit(tag)}
                            title={`Edit ${tag.tagName}`}
                          />
                          <TableActionButton
                            variant="red"
                            icon={Trash2}
                            onClick={() => setDeleteId(tag._id)}
                            title={`Delete ${tag.tagName}`}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══════════ ADD/EDIT MODAL ═══════════ */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingTag ? 'Edit Tag' : 'Add New Tag'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <TagField label="Tag Name *" name="tagName" value={formData.tagName} onChange={handleInputChange} required />
            <TagField label="Description" name="description" value={formData.description} onChange={handleInputChange} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: C.heading }}>Data Type *</label>
              <select
                name="dataType" value={formData.dataType} onChange={handleInputChange}
                className="w-full px-3 py-2 rounded-lg outline-none"
                style={{ background: C.cardSubtle, border: `1px solid ${C.border}`, color: C.heading }}
              >
                <option value="BOOL">BOOL</option>
                <option value="INT">INT</option>
                <option value="DINT">DINT</option>
                <option value="REAL">REAL</option>
                <option value="STRING">STRING</option>
                <option value="WORD">WORD</option>
                <option value="DWORD">DWORD</option>
                <option value="BYTE">BYTE</option>
              </select>
            </div>
            <TagField label="Group" name="group" value={formData.group} onChange={handleInputChange} />
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: C.heading }}>Access</label>
              <select
                name="accessType" value={formData.accessType} onChange={handleInputChange}
                className="w-full px-3 py-2 rounded-lg outline-none"
                style={{ background: C.cardSubtle, border: `1px solid ${C.border}`, color: C.heading }}
              >
                <option value="READ">Read Only</option>
                <option value="WRITE">Write Only</option>
                <option value="READ_WRITE">Read/Write</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: C.heading }}>PLC Connection</label>
              <select
                name="plcConnection" value={formData.plcConnection} onChange={handleInputChange}
                className="w-full px-3 py-2 rounded-lg outline-none"
                style={{ background: C.cardSubtle, border: `1px solid ${C.border}`, color: C.heading }}
              >
                <option value="">None (Memory Tag)</option>
                {plcs.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </div>
            <TagField label="PLC Address" name="plcAddress" value={formData.plcAddress} onChange={handleInputChange} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <TagField label="Unit" name="unit" value={formData.unit} onChange={handleInputChange} />
            <TagField label="Min Value" name="minValue" type="number" value={formData.minValue} onChange={handleInputChange} />
            <TagField label="Max Value" name="maxValue" type="number" value={formData.maxValue} onChange={handleInputChange} />
          </div>

          <div className="flex gap-6 pt-2">
            <label className="flex items-center gap-2 cursor-pointer" style={{ color: C.text }}>
              <input
                type="checkbox" name="enableLogging" checked={formData.enableLogging}
                onChange={handleInputChange} className="w-4 h-4"
                style={{ accentColor: C.brand }}
              />
              Enable Logging
            </label>
            <label className="flex items-center gap-2 cursor-pointer" style={{ color: C.text }}>
              <input
                type="checkbox" name="enableAlarm" checked={formData.enableAlarm}
                onChange={handleInputChange} className="w-4 h-4"
                style={{ accentColor: C.brand }}
              />
              Enable Alarm
            </label>
          </div>

          <div className="flex gap-3 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="flex-1 px-4 py-2.5 rounded-lg font-semibold transition-colors"
              style={{
                background: '#FFFFFF',
                color: C.heading,
                border: `1.5px solid ${C.border}`,
                fontFamily: "'Montserrat', sans-serif",
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#FFFFFF'}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 rounded-lg font-semibold text-white transition-colors"
              style={{
                background: C.btnPrimary,
                boxShadow: '0px 4px 12px rgba(37, 99, 235, 0.25)',
                fontFamily: "'Montserrat', sans-serif",
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = C.btnHover}
              onMouseLeave={(e) => e.currentTarget.style.background = C.btnPrimary}
            >
              {editingTag ? 'Update Tag' : 'Create Tag'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ═══════════ WRITE VALUE MODAL ═══════════ */}
      <Modal
        isOpen={!!writeTag}
        onClose={() => { setWriteTag(null); setWriteValue(''); }}
        title="Write Tag Value"
        size="sm"
      >
        {writeTag && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg" style={{ background: C.cardSubtle, border: `1px solid ${C.border}` }}>
              <p className="text-sm" style={{ color: C.muted }}>Tag</p>
              <p className="font-mono font-bold" style={{ color: C.heading }}>{writeTag.tagName}</p>
              <p className="text-xs mt-1" style={{ color: C.subtle }}>Type: {writeTag.dataType}</p>
            </div>

            {writeTag.dataType === 'BOOL' ? (
              <select
                value={writeValue}
                onChange={(e) => setWriteValue(e.target.value)}
                className="w-full px-3 py-2 rounded-lg outline-none"
                style={{ background: C.cardSubtle, border: `1px solid ${C.border}`, color: C.heading }}
              >
                <option value="">Select value</option>
                <option value="true">TRUE</option>
                <option value="false">FALSE</option>
              </select>
            ) : (
              <input
                type={writeTag.dataType === 'STRING' ? 'text' : 'number'}
                value={writeValue}
                onChange={(e) => setWriteValue(e.target.value)}
                placeholder="Enter value"
                className="w-full px-3 py-2 rounded-lg outline-none"
                style={{ background: C.cardSubtle, border: `1px solid ${C.border}`, color: C.heading }}
                autoFocus
              />
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setWriteTag(null); setWriteValue(''); }}
                className="flex-1 px-4 py-2.5 rounded-lg font-semibold"
                style={{ background: C.cardSubtle, color: C.heading, border: `1px solid ${C.border}` }}
              >
                Cancel
              </button>
              <button
                onClick={handleWriteValue}
                disabled={writeValue === ''}
                className="flex-1 px-4 py-2.5 rounded-lg font-semibold text-white disabled:opacity-50"
                style={{ background: C.success, fontFamily: "'Montserrat', sans-serif" }}
              >
                Write
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ═══════════ IMPORT CSV MODAL ═══════════ */}
      <Modal
        isOpen={showImportModal}
        onClose={handleCloseImport}
        title="Import Tags from CSV"
        size="lg"
      >
        {!importResults ? (
          <div className="space-y-4">
            <div
              className="p-3 rounded-lg flex items-start gap-3"
              style={{ background: C.cardHover, border: `1px solid ${C.brand}40` }}
            >
              <FileText className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: C.brand }} />
              <div className="flex-1 text-sm">
                <p className="font-semibold" style={{ color: C.heading }}>Need a template?</p>
                <p className="mt-0.5" style={{ color: C.text }}>
                  Download a CSV template with example rows to see the correct format.
                </p>
              </div>
              <button
                onClick={handleDownloadTemplate}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                style={{ background: C.brand }}
              >
                <Download className="w-3 h-3 inline mr-1" />
                Template
              </button>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: C.heading }}>
                Select CSV File
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileSelect}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: C.cardSubtle, border: `1px solid ${C.border}`, color: C.text }}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: C.heading }}>
                CSV Preview {csvLineCount > 0 && (
                  <span className="text-xs font-normal ml-2" style={{ color: C.brand }}>
                    ({csvLineCount} data row{csvLineCount !== 1 ? 's' : ''} detected)
                  </span>
                )}
              </label>
              <textarea
                value={importCsvText}
                onChange={(e) => setImportCsvText(e.target.value)}
                placeholder="Paste CSV text here or select a file above..."
                rows={10}
                className="w-full px-3 py-2 rounded-lg font-mono text-xs outline-none"
                style={{ background: C.cardSubtle, border: `1px solid ${C.border}`, color: C.heading }}
                onFocus={(e) => e.target.style.borderColor = C.brand}
                onBlur={(e) => e.target.style.borderColor = C.border}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: C.heading }}>
                Import Mode
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'create', label: 'Create Only', hint: 'Skip existing tags' },
                  { value: 'update', label: 'Update Only', hint: 'Skip new tags' },
                  { value: 'upsert', label: 'Create + Update', hint: 'Both' },
                ].map(m => (
                  <button
                    key={m.value}
                    onClick={() => setImportMode(m.value)}
                    className="p-3 rounded-lg text-left transition-all"
                    style={{
                      background: importMode === m.value ? C.cardHover : C.cardSubtle,
                      border: `1px solid ${importMode === m.value ? C.brand : C.border}`,
                      color: importMode === m.value ? C.brand : C.text,
                    }}
                  >
                    <p className="text-sm font-semibold">{m.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: C.muted }}>{m.hint}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
              <button
                onClick={handleCloseImport}
                className="flex-1 px-4 py-2.5 rounded-lg font-semibold transition-colors"
                style={{
                  background: '#FFFFFF',
                  color: C.heading,
                  border: `1.5px solid ${C.border}`,
                  fontFamily: "'Montserrat', sans-serif",
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#FFFFFF'}
              >
                Cancel
              </button>
              <button
                onClick={handleImportSubmit}
                disabled={importing || !importCsvText.trim()}
                className="flex-1 px-4 py-2.5 rounded-lg font-semibold text-white flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                style={{
                  background: C.btnPrimary,
                  boxShadow: '0px 4px 12px rgba(37, 99, 235, 0.25)',
                  fontFamily: "'Montserrat', sans-serif",
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = C.btnHover}
                onMouseLeave={(e) => e.currentTarget.style.background = C.btnPrimary}
              >
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {importing ? 'Importing...' : 'Import Tags'}
              </button>
            </div>
          </div>
        ) : (
          <ImportResults
            results={importResults}
            entityLabel="tags"
            onClose={handleCloseImport}
            onImportAgain={() => { setImportResults(null); setImportCsvText(''); }}
          />
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Tag?"
        message="Are you sure? This will permanently delete this tag and all its bindings. This action cannot be undone."
        confirmText="Delete Tag"
        confirmColor="red"
        icon="warning"
      />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════

const TagField = ({ label, name, type = 'text', value, onChange, required }) => (
  <div>
    <label className="block text-sm font-semibold mb-1.5" style={{ color: C.heading }}>{label}</label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      required={required}
      className="w-full px-3 py-2 rounded-lg outline-none"
      style={{ background: C.cardSubtle, border: `1px solid ${C.border}`, color: C.heading }}
      onFocus={(e) => e.target.style.borderColor = C.brand}
      onBlur={(e) => e.target.style.borderColor = C.border}
    />
  </div>
);

const StatCard = ({ label, value, icon: Icon, color }) => (
  <div
    className="p-4 rounded-xl flex items-center gap-4"
    style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.04)' }}
  >
    <div
      className="w-12 h-12 rounded-lg flex items-center justify-center"
      style={{ background: `${color}15` }}
    >
      <Icon className="w-6 h-6" style={{ color }} />
    </div>
    <div>
      <p className="text-sm font-medium" style={{ color: C.muted }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color: C.heading, fontFamily: "'Montserrat', sans-serif" }}>
        {value}
      </p>
    </div>
  </div>
);

const TableActionButton = ({ variant = 'blue', icon: Icon, onClick, title, disabled }) => {
  const styles = {
    green: {
      bg: '#F0FDF4',
      bgHover: '#DCFCE7',
      color: '#16A34A',
      border: '#BBF7D0',
    },
    orange: {
      bg: '#FFF7ED',
      bgHover: '#FFEDD5',
      color: '#EA580C',
      border: '#FED7AA',
    },
    blue: {
      bg: '#EFF6FF',
      bgHover: '#DBEAFE',
      color: '#2563EB',
      border: '#BFDBFE',
    },
    red: {
      bg: '#FEF2F2',
      bgHover: '#FEE2E2',
      color: '#DC2626',
      border: '#FECACA',
    },
    amber: {
      bg: '#FFFBEB',
      bgHover: '#FEF3C7',
      color: '#D97706',
      border: '#FDE68A',
    },
  };

  const s = styles[variant] || styles.blue;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '32px',
        height: '32px',
        borderRadius: '8px',
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = s.bgHover;
          e.currentTarget.style.transform = 'translateY(-1px)';
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = s.bg;
          e.currentTarget.style.transform = 'translateY(0)';
        }
      }}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
};

export const ImportResults = ({ results, entityLabel = 'items', onClose, onImportAgain }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-4 gap-2">
      <ResultStat label="Total" value={results.total} color={C.brand} icon={FileText} />
      <ResultStat label="Created" value={results.created?.length || 0} color={C.success} icon={CheckCircle} />
      <ResultStat label="Updated" value={results.updated?.length || 0} color={C.warning} icon={CheckCircle} />
      <ResultStat label="Failed" value={results.failed?.length || 0} color={C.danger} icon={XCircle} />
    </div>

    {results.skipped?.length > 0 && (
      <div
        className="p-3 rounded-lg text-sm"
        style={{ background: '#FEF3C7', border: `1px solid ${C.warning}`, color: '#78350F' }}
      >
        <AlertTriangle className="w-4 h-4 inline mr-1" />
        <strong>{results.skipped.length} {entityLabel} skipped</strong> — see details below
      </div>
    )}

    <div className="max-h-64 overflow-y-auto space-y-3">
      {results.created?.length > 0 && (
        <ResultSection
          title={`Created (${results.created.length})`}
          color={C.success}
          items={results.created.map(name => ({ label: name }))}
        />
      )}
      {results.updated?.length > 0 && (
        <ResultSection
          title={`Updated (${results.updated.length})`}
          color={C.warning}
          items={results.updated.map(name => ({ label: name }))}
        />
      )}
      {results.skipped?.length > 0 && (
        <ResultSection
          title={`Skipped (${results.skipped.length})`}
          color={C.muted}
          items={results.skipped.map(s => ({
            label: s.tagName || s.name || `Row ${s.row}`,
            detail: s.reason,
          }))}
        />
      )}
      {results.failed?.length > 0 && (
        <ResultSection
          title={`Failed (${results.failed.length})`}
          color={C.danger}
          items={results.failed.map(f => ({
            label: f.tagName || f.name || `Row ${f.row}`,
            detail: f.error,
          }))}
        />
      )}
    </div>

    <div className="flex gap-3 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
      <button
        onClick={onImportAgain}
        className="flex-1 px-4 py-2.5 rounded-lg font-semibold"
        style={{ background: C.cardSubtle, color: C.heading, border: `1px solid ${C.border}` }}
      >
        Import More
      </button>
      <button
        onClick={onClose}
        className="flex-1 px-4 py-2.5 rounded-lg font-semibold text-white"
        style={{ background: C.btnPrimary, fontFamily: "'Montserrat', sans-serif" }}
      >
        Done
      </button>
    </div>
  </div>
);

const ResultStat = ({ label, value, color, icon: Icon }) => (
  <div
    className="p-3 rounded-lg text-center"
    style={{ background: `${color}15`, border: `1px solid ${color}40` }}
  >
    <Icon className="w-4 h-4 mx-auto mb-1" style={{ color }} />
    <p className="text-2xl font-bold" style={{ color }}>{value}</p>
    <p className="text-xs font-semibold" style={{ color }}>{label}</p>
  </div>
);

const ResultSection = ({ title, color, items }) => (
  <div>
    <p className="text-xs font-bold mb-2 uppercase" style={{ color }}>{title}</p>
    <div
      className="rounded-lg overflow-hidden text-xs"
      style={{ background: C.cardSubtle, border: `1px solid ${C.border}` }}
    >
      {items.slice(0, 20).map((item, i) => (
        <div
          key={i}
          className="px-3 py-1.5"
          style={{ borderTop: i > 0 ? `1px solid ${C.border}` : 'none' }}
        >
          <span className="font-mono font-semibold" style={{ color: C.heading }}>{item.label}</span>
          {item.detail && (
            <span className="ml-2" style={{ color }}>— {item.detail}</span>
          )}
        </div>
      ))}
      {items.length > 20 && (
        <div className="px-3 py-1.5 text-center italic" style={{ color: C.muted }}>
          ... and {items.length - 20} more
        </div>
      )}
    </div>
  </div>
);

export default TagManagement;