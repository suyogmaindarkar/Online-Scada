// ═══════════════════════════════════════════════════════════
// PLC Management — Blue theme + CSV Import/Export
//
// Task Bundle applied:
//   ✅ SIM   — Quick simulation PLC (previous round — kept)
//   ✅ T062  — Bulk PLC import from CSV
//   ✅ BONUS — PLC CSV export + template download
//   ✅ BONUS — Import preview modal + summary
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import { plcAPI } from '../services/api';
import socketService from '../services/socket';
import { useToast } from '../context/ToastContext';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { ImportResults } from './TagManagement'; // Re-use the ImportResults component
import {
  Plus, Edit2, Trash2, Play, Pause, Cpu,
  Wifi, WifiOff, Loader2, Zap, Sparkles, Info,
  Download, Upload, FileText,
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
  btnPrimary: '#081B43',
  btnHover:   '#123E8A',
  success:    '#16A34A',
  warning:    '#F59E0B',
  danger:     '#DC2626',
  purple:     '#9333EA',
  purpleDark: '#6B21A8',
};

const PLCManagement = () => {
  const { showToast } = useToast();

  const [plcs, setPlcs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPLC, setEditingPLC] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [creatingSim, setCreatingSim] = useState(false);
  const [formData, setFormData] = useState(initialFormData());

  // ✅ T062: Import/Export state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importCsvText, setImportCsvText] = useState('');
  const [importMode, setImportMode] = useState('create');
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef(null);

  function initialFormData() {
    return {
      name: '',
      description: '',
      protocol: 'SIMULATION',
      ipAddress: '192.168.1.100',
      port: 502,
      rack: 0,
      slot: 1,
      brand: 'OTHER',
      model: '',
      pollingRate: 1000,
    };
  }

  useEffect(() => {
    loadPLCs();

    const handlePlcStatus = (data) => {
      setPlcs((prev) =>
        prev.map((p) =>
          p._id === data.plcId ? { ...p, isConnected: data.isConnected } : p
        )
      );
    };

    socketService.on('plcStatus', handlePlcStatus);
    return () => socketService.off('plcStatus', handlePlcStatus);
  }, []);

  const loadPLCs = async () => {
    try {
      setLoading(true);
      const res = await plcAPI.getAll();
      setPlcs(res.data.data);
    } catch (err) {
      console.error('Failed to load PLCs:', err);
      showToast('Failed to load PLCs', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSimulation = async () => {
    try {
      setCreatingSim(true);
      const res = await plcAPI.quickSimulation();
      const created = res.data?.data;
      showToast(
        `✨ ${created?.name || 'Simulation PLC'} created with 5 demo tags — check Tag Management!`,
        'success', 5000
      );
      await loadPLCs();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to create simulation PLC', 'error');
    } finally {
      setCreatingSim(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingPLC(null);
    setFormData(initialFormData());
    setShowModal(true);
  };

  const handleOpenEdit = (plc) => {
    setEditingPLC(plc);
    setFormData({
      name: plc.name,
      description: plc.description || '',
      protocol: plc.protocol,
      ipAddress: plc.ipAddress,
      port: plc.port,
      rack: plc.rack,
      slot: plc.slot,
      brand: plc.brand,
      model: plc.model || '',
      pollingRate: plc.pollingRate,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPLC) {
        await plcAPI.update(editingPLC._id, formData);
        showToast(`PLC "${formData.name}" updated successfully`, 'success');
      } else {
        await plcAPI.create(formData);
        showToast(`PLC "${formData.name}" created successfully`, 'success');
      }
      setShowModal(false);
      loadPLCs();
    } catch (err) {
      showToast(err.response?.data?.message || 'Operation failed', 'error');
    }
  };

  const handleDelete = async () => {
    try {
      await plcAPI.delete(deleteId);
      setDeleteId(null);
      loadPLCs();
      showToast('PLC deleted successfully', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Delete failed', 'error');
    }
  };

  const handleStartStop = async (plc) => {
    try {
      if (plc.isConnected) {
        await plcAPI.stop(plc._id);
        showToast(`PLC "${plc.name}" stopped`, 'info');
      } else {
        await plcAPI.start(plc._id);
        showToast(`PLC "${plc.name}" started`, 'success');
      }
      setTimeout(loadPLCs, 500);
    } catch (err) {
      showToast(err.response?.data?.message || 'Operation failed', 'error');
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'number' ? parseInt(value) : value,
    });
  };

  // ═══════════════════════════════════════════════════════════
  // ✅ Export CSV
  // ═══════════════════════════════════════════════════════════
  const handleExportCSV = async () => {
    try {
      setExporting(true);
      const res = await plcAPI.exportCSV();
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `plcs_export_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      const realCount = plcs.filter(p => !p.isSimulation).length;
      showToast(`Exported ${realCount} PLC(s) to CSV (simulation PLCs excluded)`, 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Export failed', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await plcAPI.downloadTemplate();
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'plcs_import_template.csv';
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
      const res = await plcAPI.importCSV(importCsvText, importMode);
      setImportResults(res.data.data);
      showToast(res.data.message, 'success', 5000);
      loadPLCs();
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

  const deletingPLC = plcs.find(p => p._id === deleteId);
  const deletingIsSim = deletingPLC?.isSimulation;
  const csvLineCount = importCsvText.split('\n').filter(l => l.trim() && !l.trim().startsWith('#')).length - 1;

  return (
    <div className="space-y-4" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* ═══════════ HEADER ═══════════ */}
      <div
        className="p-5 rounded-2xl"
        style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.06)' }}
      >
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${C.brand} 0%, ${C.brandDark} 100%)`,
                boxShadow: '0px 4px 12px rgba(37, 99, 235, 0.30)',
              }}
            >
              <Cpu className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: C.heading, fontFamily: "'Montserrat', sans-serif" }}>
                PLC Management
              </h1>
              <p className="text-sm mt-0.5" style={{ color: C.muted }}>
                Configure & manage PLC connections
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* ✅ Quick Simulation */}
            <button
              onClick={handleQuickSimulation}
              disabled={creatingSim}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white font-semibold transition-all disabled:opacity-50"
              style={{
                background: `linear-gradient(135deg, ${C.purple} 0%, ${C.purpleDark} 100%)`,
                boxShadow: '0px 4px 12px rgba(147, 51, 234, 0.30)',
                fontFamily: "'Montserrat', sans-serif",
              }}
              onMouseEnter={(e) => { if (!creatingSim) e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { if (!creatingSim) e.currentTarget.style.transform = 'translateY(0)'; }}
              title="One-click create a simulation PLC with 5 demo tags"
            >
              {creatingSim ? (
                <><Loader2 className="w-5 h-5 animate-spin" />Creating...</>
              ) : (
                <><Sparkles className="w-5 h-5" />Quick Simulation PLC</>
              )}
            </button>

            {/* ✅ Import CSV */}
            <button
              onClick={handleOpenImport}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: C.warning,
                color: '#FFFFFF',
                boxShadow: '0px 2px 8px rgba(245, 158, 11, 0.30)',
                fontFamily: "'Montserrat', sans-serif",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#D97706'}
              onMouseLeave={(e) => e.currentTarget.style.background = C.warning}
              title="Import PLCs from a CSV file"
            >
              <Upload className="w-4 h-4" />
              Import CSV
            </button>

            {/* ✅ Export CSV */}
            <button
              onClick={handleExportCSV}
              disabled={exporting || plcs.filter(p => !p.isSimulation).length === 0}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
              style={{
                background: C.success,
                color: '#FFFFFF',
                boxShadow: '0px 2px 8px rgba(22, 163, 74, 0.30)',
                fontFamily: "'Montserrat', sans-serif",
              }}
              title="Export real PLCs to a CSV file (simulation PLCs excluded)"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Export CSV
            </button>

            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white font-semibold transition-all"
              style={{
                background: C.btnPrimary,
                boxShadow: '0px 2px 8px rgba(8, 27, 67, 0.25)',
                fontFamily: "'Montserrat', sans-serif",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = C.btnHover}
              onMouseLeave={(e) => e.currentTarget.style.background = C.btnPrimary}
              title="Add a new PLC"
            >
              <Plus className="w-5 h-5" />
              Add PLC
            </button>
          </div>
        </div>
      </div>

      {/* Info banner */}
      {!loading && plcs.length > 0 && !plcs.some(p => p.isSimulation) && (
        <div
          className="p-3 rounded-lg flex items-start gap-3"
          style={{ background: 'rgba(147, 51, 234, 0.08)', border: `1px solid ${C.purple}40` }}
        >
          <Info className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: C.purple }} />
          <div className="flex-1 text-sm">
            <p className="font-semibold" style={{ color: C.purpleDark }}>
              Try the Quick Simulation PLC!
            </p>
            <p className="mt-0.5" style={{ color: C.text }}>
              Click <strong>"Quick Simulation PLC"</strong> above to instantly create a virtual PLC with 5 realistic demo tags.
            </p>
          </div>
        </div>
      )}

      {/* PLC Table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.06)' }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: C.brand }} />
          </div>
        ) : plcs.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: C.cardHover }}
            >
              <Cpu className="w-10 h-10" style={{ color: C.brand }} />
            </div>
            <h3 className="text-xl font-bold mb-2" style={{ color: C.heading, fontFamily: "'Montserrat', sans-serif" }}>
              No PLCs Configured
            </h3>
            <p className="text-sm max-w-md mx-auto mb-6" style={{ color: C.muted }}>
              Add a real PLC, try a Simulation PLC, or import multiple PLCs from a CSV file.
            </p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <button
                onClick={handleQuickSimulation}
                disabled={creatingSim}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-white font-semibold disabled:opacity-50"
                style={{
                  background: `linear-gradient(135deg, ${C.purple} 0%, ${C.purpleDark} 100%)`,
                  fontFamily: "'Montserrat', sans-serif",
                }}
              >
                {creatingSim ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {creatingSim ? 'Creating...' : 'Try Simulation'}
              </button>
              <button
                onClick={handleOpenImport}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-white font-semibold"
                style={{ background: C.warning, fontFamily: "'Montserrat', sans-serif" }}
              >
                <Upload className="w-4 h-4" />
                Import CSV
              </button>
              <button
                onClick={handleOpenAdd}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold"
                style={{ background: C.card, color: C.heading, border: `1px solid ${C.border}` }}
              >
                <Plus className="w-4 h-4" />
                Add PLC
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead style={{ background: C.cardSubtle, borderBottom: `1px solid ${C.border}` }}>
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: C.muted }}>Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: C.muted }}>Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: C.muted }}>Protocol</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: C.muted }}>IP Address</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: C.muted }}>Brand / Model</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: C.muted }}>Tags</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase" style={{ color: C.muted }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {plcs.map((plc, idx) => (
                  <tr
                    key={plc._id}
                    style={{
                      borderBottom: idx < plcs.length - 1 ? `1px solid ${C.border}` : 'none',
                      background: C.card,
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = C.cardSubtle}
                    onMouseLeave={(e) => e.currentTarget.style.background = C.card}
                  >
                    <td className="px-4 py-3">
                      {plc.isConnected ? (
                        <div className="flex items-center gap-1.5">
                          <Wifi className="w-4 h-4" style={{ color: C.success }} />
                          <span className="text-xs font-bold" style={{ color: C.success }}>ONLINE</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <WifiOff className="w-4 h-4" style={{ color: C.subtle }} />
                          <span className="text-xs font-bold" style={{ color: C.subtle }}>OFFLINE</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold" style={{ color: C.heading }}>{plc.name}</p>
                        {plc.isSimulation && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded"
                            style={{
                              background: `linear-gradient(135deg, ${C.purple}20 0%, ${C.purpleDark}20 100%)`,
                              color: C.purpleDark,
                              border: `1px solid ${C.purple}40`,
                            }}
                            title="Auto-generated simulation PLC"
                          >
                            <Sparkles className="w-2.5 h-2.5" />
                            SIM
                          </span>
                        )}
                      </div>
                      {plc.description && (
                        <p className="text-xs mt-0.5" style={{ color: C.muted }}>{plc.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="px-2 py-0.5 text-xs rounded font-mono font-semibold"
                        style={{
                          background: plc.isSimulation ? `${C.purple}15` : C.cardHover,
                          color: plc.isSimulation ? C.purple : C.brand,
                        }}
                      >
                        {plc.protocol}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm" style={{ color: C.text }}>
                      {plc.ipAddress}<span style={{ color: C.subtle }}>:{plc.port}</span>
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: C.text }}>
                      {plc.brand}{plc.model && <span style={{ color: C.subtle }}> / {plc.model}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="px-2 py-0.5 text-xs rounded font-semibold"
                        style={{
                          background: (plc.tagCount || 0) > 0 ? `${C.brand}15` : C.cardSubtle,
                          color: (plc.tagCount || 0) > 0 ? C.brand : C.subtle,
                        }}
                      >
                        {plc.tagCount || 0} tag{plc.tagCount !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <IconButton
                          onClick={() => handleStartStop(plc)}
                          bg={plc.isConnected ? C.danger : C.success}
                          title={plc.isConnected ? `Stop ${plc.name}` : `Start ${plc.name}`}
                        >
                          {plc.isConnected ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        </IconButton>
                        <IconButton onClick={() => handleOpenEdit(plc)} bg={C.brand} title={`Edit ${plc.name}`}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </IconButton>
                        <IconButton
                          onClick={() => setDeleteId(plc._id)}
                          bg={C.danger}
                          title={`Delete ${plc.name}${plc.isSimulation ? ' (will also delete demo tags)' : ''}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingPLC ? 'Edit PLC' : 'Add New PLC'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="PLC Name *" name="name" value={formData.name} onChange={handleInputChange} required />
            <FormField label="Description" name="description" value={formData.description} onChange={handleInputChange} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: C.heading }}>Protocol *</label>
              <select
                name="protocol" value={formData.protocol} onChange={handleInputChange}
                className="w-full px-3 py-2 rounded-lg outline-none"
                style={{ background: C.cardSubtle, border: `1px solid ${C.border}`, color: C.heading }}
              >
                <option value="SIMULATION">Simulation Mode</option>
                <option value="MODBUS_TCP">Modbus TCP</option>
                <option value="S7">Siemens S7</option>
                <option value="OPC_UA">OPC-UA</option>
                <option value="ETHERNET_IP">Ethernet/IP</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: C.heading }}>Brand</label>
              <select
                name="brand" value={formData.brand} onChange={handleInputChange}
                className="w-full px-3 py-2 rounded-lg outline-none"
                style={{ background: C.cardSubtle, border: `1px solid ${C.border}`, color: C.heading }}
              >
                <option value="OTHER">Other</option>
                <option value="SIEMENS">Siemens</option>
                <option value="ALLEN_BRADLEY">Allen Bradley</option>
                <option value="SCHNEIDER">Schneider</option>
                <option value="DELTA">Delta</option>
                <option value="MITSUBISHI">Mitsubishi</option>
                <option value="OMRON">Omron</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="IP Address" name="ipAddress" value={formData.ipAddress} onChange={handleInputChange} />
            <FormField label="Port" name="port" type="number" value={formData.port} onChange={handleInputChange} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <FormField label="Rack (S7)" name="rack" type="number" value={formData.rack} onChange={handleInputChange} />
            <FormField label="Slot (S7)" name="slot" type="number" value={formData.slot} onChange={handleInputChange} />
            <FormField label="Polling Rate (ms)" name="pollingRate" type="number" value={formData.pollingRate} onChange={handleInputChange} />
          </div>

          <FormField label="Model" name="model" value={formData.model} onChange={handleInputChange} />

          <div className="flex gap-3 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="flex-1 px-4 py-2.5 rounded-lg font-semibold"
              style={{ background: C.cardSubtle, color: C.heading, border: `1px solid ${C.border}` }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 rounded-lg font-semibold text-white"
              style={{ background: C.btnPrimary, fontFamily: "'Montserrat', sans-serif" }}
              onMouseEnter={(e) => e.currentTarget.style.background = C.btnHover}
              onMouseLeave={(e) => e.currentTarget.style.background = C.btnPrimary}
            >
              {editingPLC ? 'Update PLC' : 'Create PLC'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title={deletingIsSim ? 'Delete Simulation PLC?' : 'Delete PLC?'}
        message={
          deletingIsSim
            ? `Delete "${deletingPLC?.name}" and its 5 auto-generated demo tags? Any graphic bindings using these tags will break.`
            : `Are you sure you want to delete "${deletingPLC?.name}"? This cannot be undone.`
        }
        confirmText={deletingIsSim ? 'Delete Sim PLC & Tags' : 'Delete PLC'}
        confirmColor="red"
        icon="warning"
      />

      {/* ═══════════ ✅ T062: IMPORT CSV MODAL ═══════════ */}
      <Modal
        isOpen={showImportModal}
        onClose={handleCloseImport}
        title="Import PLCs from CSV"
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
              <label className="block text-sm font-semibold mb-2" style={{ color: C.heading }}>Import Mode</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'create', label: 'Create Only', hint: 'Skip existing PLCs' },
                  { value: 'update', label: 'Update Only', hint: 'Skip new PLCs' },
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
                className="flex-1 px-4 py-2.5 rounded-lg font-semibold"
                style={{ background: C.cardSubtle, color: C.heading, border: `1px solid ${C.border}` }}
              >
                Cancel
              </button>
              <button
                onClick={handleImportSubmit}
                disabled={importing || !importCsvText.trim()}
                className="flex-1 px-4 py-2.5 rounded-lg font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: C.btnPrimary, fontFamily: "'Montserrat', sans-serif" }}
              >
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {importing ? 'Importing...' : 'Import PLCs'}
              </button>
            </div>
          </div>
        ) : (
          <ImportResults
            results={importResults}
            entityLabel="PLCs"
            onClose={handleCloseImport}
            onImportAgain={() => { setImportResults(null); setImportCsvText(''); }}
          />
        )}
      </Modal>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════

const IconButton = ({ children, onClick, bg, title }) => (
  <button
    onClick={onClick}
    title={title}
    className="p-1.5 rounded transition-all text-white"
    style={{ background: bg }}
    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
  >
    {children}
  </button>
);

const FormField = ({ label, name, type = 'text', value, onChange, required }) => (
  <div>
    <label className="block text-sm font-semibold mb-1.5" style={{ color: C.heading }}>
      {label}
    </label>
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

export default PLCManagement;