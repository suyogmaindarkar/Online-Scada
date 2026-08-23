// ═══════════════════════════════════════════════════════════
// PLC Management — Blue theme + CSV + Discovery Phase 3
// FIXED: Button styling — uniform size, visible text, clean hierarchy
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import { plcAPI, discoveryAPI } from '../services/api';
import socketService from '../services/socket';
import { useToast } from '../context/ToastContext';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { ImportResults } from './TagManagement';
import {
  Plus, Edit2, Trash2, Play, Pause, Cpu,
  Wifi, WifiOff, Loader2, Sparkles,
  Download, Upload, FileText, Search, Radar,
  Signal, SignalHigh, SignalLow, CheckCircle2,
  ShieldCheck, Microscope, RefreshCw, ChevronDown, ChevronUp,
  Zap, Package, Hash, Tag, Server, Settings2,
} from 'lucide-react';

const C = {
  bg:         '#F8FAFC', card:      '#FFFFFF', cardSubtle: '#F8FAFC',
  cardHover:  '#EEF6FF', border:    '#E5E7EB', heading:    '#081B43',
  text:       '#334155', muted:     '#5F6B7A', subtle:     '#94A3B8',
  brand:      '#2563EB', brandDark: '#0F3D91', btnPrimary: '#2563EB',
  btnHover:   '#1D4ED8', success:   '#16A34A', warning:    '#F59E0B',
  danger:     '#DC2626', purple:    '#9333EA', purpleDark: '#6B21A8',
  teal:       '#0891B2', tealDark:  '#0E7490',
  verified:   '#059669',
};

// ─── REUSABLE BUTTON COMPONENT ───
const ActionButton = ({ variant = 'primary', icon: Icon, children, onClick, disabled, loading, title }) => {
  const variants = {
    primary: {
      bg: '#2563EB',
      bgHover: '#1D4ED8',
      color: '#FFFFFF',
      border: 'transparent',
      shadow: '0px 2px 8px rgba(37,99,235,0.25)',
    },
    secondary: {
      bg: '#FFFFFF',
      bgHover: '#EEF6FF',
      color: '#2563EB',
      border: '#2563EB',
      shadow: 'none',
    },
    purple: {
      bg: '#FFFFFF',
      bgHover: '#F5F3FF',
      color: '#7C3AED',
      border: '#9333EA',
      shadow: 'none',
    },
    amber: {
      bg: '#FFFFFF',
      bgHover: '#FEF3C7',
      color: '#D97706',
      border: '#F59E0B',
      shadow: 'none',
    },
    green: {
      bg: '#FFFFFF',
      bgHover: '#DCFCE7',
      color: '#16A34A',
      border: '#16A34A',
      shadow: 'none',
    },
    teal: {
      bg: '#FFFFFF',
      bgHover: '#CFFAFE',
      color: '#0E7490',
      border: '#0891B2',
      shadow: 'none',
    },
  };

  const v = variants[variant] || variants.primary;

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        height: '40px',
        padding: '0 16px',
        borderRadius: '8px',
        background: v.bg,
        color: v.color,
        border: `1.5px solid ${v.border}`,
        fontSize: '13px',
        fontWeight: 600,
        fontFamily: "'Montserrat', sans-serif",
        cursor: (disabled || loading) ? 'not-allowed' : 'pointer',
        opacity: (disabled || loading) ? 0.5 : 1,
        boxShadow: v.shadow,
        transition: 'all 0.15s ease',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => {
        if (!disabled && !loading) {
          e.currentTarget.style.background = v.bgHover;
          e.currentTarget.style.transform = 'translateY(-1px)';
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !loading) {
          e.currentTarget.style.background = v.bg;
          e.currentTarget.style.transform = 'translateY(0)';
        }
      }}
    >
      {loading
        ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
        : Icon && <Icon size={16} strokeWidth={2.2} />
      }
      {children}
    </button>
  );
};

const CONF_MAP = {
  high:   { color: C.success, bg: '#DCFCE7', icon: SignalHigh, label: 'High Confidence'   },
  medium: { color: C.warning, bg: '#FEF3C7', icon: Signal,     label: 'Medium Confidence' },
  low:    { color: C.subtle,  bg: '#F1F5F9', icon: SignalLow,  label: 'Low Confidence'    },
};

const PHASE_LABELS = {
  idle:         'Idle',
  pinging:      'Phase 1: Pinging hosts…',
  probing:      'Phase 1: Probing ports…',
  identifying:  'Phase 1: Identifying…',
  deep_probing: 'Phase 2: Deep identification…',
  done:         'Scan complete',
  cancelled:    'Cancelled',
};

const PLCManagement = () => {
  const { showToast } = useToast();

  const [plcs,        setPlcs]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showModal,   setShowModal]   = useState(false);
  const [editingPLC,  setEditingPLC]  = useState(null);
  const [deleteId,    setDeleteId]    = useState(null);
  const [creatingSim, setCreatingSim] = useState(false);
  const [formData,    setFormData]    = useState(initialFormData());

  const [showImportModal, setShowImportModal] = useState(false);
  const [importCsvText,   setImportCsvText]   = useState('');
  const [importMode,      setImportMode]      = useState('create');
  const [importing,       setImporting]       = useState(false);
  const [importResults,   setImportResults]   = useState(null);
  const [exporting,       setExporting]       = useState(false);
  const fileInputRef = useRef(null);

  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false);
  const [scanning,           setScanning]           = useState(false);
  const [scanPhase,          setScanPhase]          = useState('idle');
  const [scanResults,        setScanResults]        = useState(null);
  const [networks,           setNetworks]           = useState([]);
  const [selectedNetwork,    setSelectedNetwork]    = useState(0);
  const [customRange,        setCustomRange]        = useState({ startIP: '', endIP: '' });
  const [useCustomRange,     setUseCustomRange]     = useState(false);
  const [useDeepProbe,       setUseDeepProbe]       = useState(true);
  const [probingIP,          setProbingIP]          = useState(null);
  const [expandedDevices,    setExpandedDevices]    = useState({});

  function initialFormData() {
    return {
      name: '', description: '', protocol: 'SIMULATION',
      ipAddress: '192.168.1.100', port: 502, rack: 0,
      slot: 0, brand: 'OTHER', model: '', pollingRate: 1000,
    };
  }

  useEffect(() => {
    loadPLCs();
    const handlePlcStatus = (data) => {
      setPlcs(prev => prev.map(p =>
        p._id === data.plcId ? { ...p, isConnected: data.isConnected } : p
      ));
    };
    socketService.on('plcStatus', handlePlcStatus);
    return () => socketService.off('plcStatus', handlePlcStatus);
  }, []);

  useEffect(() => {
    if (!scanning) return;
    const interval = setInterval(async () => {
      try {
        const res = await discoveryAPI.getProgress();
        if (res.data?.phase) setScanPhase(res.data.phase);
      } catch {}
    }, 1000);
    return () => clearInterval(interval);
  }, [scanning]);

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
      showToast(`✨ ${created?.name || 'Simulation PLC'} created with 5 demo tags!`, 'success', 5000);
      await loadPLCs();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to create simulation PLC', 'error');
    } finally { setCreatingSim(false); }
  };

  const handleOpenAdd  = () => { setEditingPLC(null); setFormData(initialFormData()); setShowModal(true); };
  const handleOpenEdit = (plc) => {
    setEditingPLC(plc);
    setFormData({
      name: plc.name, description: plc.description || '', protocol: plc.protocol,
      ipAddress: plc.ipAddress, port: plc.port, rack: plc.rack, slot: plc.slot,
      brand: plc.brand, model: plc.model || '', pollingRate: plc.pollingRate,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPLC) {
        await plcAPI.update(editingPLC._id, formData);
        showToast(`PLC "${formData.name}" updated`, 'success');
      } else {
        await plcAPI.create(formData);
        showToast(`PLC "${formData.name}" created`, 'success');
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
      showToast('PLC deleted', 'success');
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
    setFormData({ ...formData, [name]: type === 'number' ? parseInt(value) : value });
  };

  const handleExportCSV = async () => {
    try {
      setExporting(true);
      const res  = await plcAPI.exportCSV();
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `plcs_export_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`Exported ${plcs.filter(p => !p.isSimulation).length} PLC(s) to CSV`, 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Export failed', 'error');
    } finally { setExporting(false); }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res  = await plcAPI.downloadTemplate();
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = 'plcs_import_template.csv';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Template downloaded', 'success');
    } catch { showToast('Failed to download template', 'error'); }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) { showToast('Please select a .csv file', 'warning'); return; }
    const reader = new FileReader();
    reader.onload  = (evt) => { setImportCsvText(evt.target.result); showToast(`Loaded ${file.name}`, 'success'); };
    reader.onerror = () => showToast('Failed to read file', 'error');
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleOpenImport  = () => { setImportCsvText(''); setImportResults(null); setImportMode('create'); setShowImportModal(true); };
  const handleCloseImport = () => { setShowImportModal(false); setImportCsvText(''); setImportResults(null); };

  const handleImportSubmit = async () => {
    if (!importCsvText.trim()) { showToast('No CSV content to import', 'warning'); return; }
    try {
      setImporting(true);
      const res = await plcAPI.importCSV(importCsvText, importMode);
      setImportResults(res.data.data);
      showToast(res.data.message, 'success', 5000);
      loadPLCs();
    } catch (err) {
      showToast(err.response?.data?.message || 'Import failed', 'error');
    } finally { setImporting(false); }
  };

  const handleOpenDiscovery = async () => {
    setShowDiscoveryModal(true);
    setScanResults(null);
    setScanning(false);
    setScanPhase('idle');
    setExpandedDevices({});
    try {
      const res = await discoveryAPI.getNetworks();
      setNetworks(res.data?.networks || []);
      if (res.data?.networks?.length > 0) {
        setCustomRange({ startIP: res.data.networks[0].startIP, endIP: res.data.networks[0].endIP });
      }
    } catch {}
  };

  const handleStartScan = async () => {
    try {
      setScanning(true);
      setScanResults(null);
      setScanPhase('pinging');
      const options = useCustomRange
        ? { startIP: customRange.startIP, endIP: customRange.endIP, deepProbe: useDeepProbe }
        : { networkIndex: selectedNetwork, deepProbe: useDeepProbe };
      const res = await discoveryAPI.startScan(options);
      setScanResults(res.data);
      setScanPhase('done');
    } catch (err) {
      showToast(err.response?.data?.message || 'Scan failed', 'error');
      setScanPhase('idle');
    } finally { setScanning(false); }
  };

  const handleReprobe = async (device) => {
    try {
      setProbingIP(device.ip);
      const res     = await discoveryAPI.probeDevice(device.ip, device.ports);
      const updated = res.data?.device;
      if (updated) {
        setScanResults(prev => ({
          ...prev,
          devices: prev.devices.map(d => d.ip === device.ip ? updated : d),
        }));
        if (updated.verified) {
          showToast(`✅ ${device.ip} verified via ${updated.deepInfo?.probeMethod || 'deep probe'}`, 'success', 4000);
        } else {
          showToast(`Re-probe complete for ${device.ip} — no additional info found`, 'info');
        }
      }
    } catch { showToast(`Re-probe failed for ${device.ip}`, 'error'); }
    finally   { setProbingIP(null); }
  };

  const handleAddDiscovered = (device) => {
    const rec = device.recommended;
    setFormData({
      name:        rec.name,
      description: rec.description,
      protocol:    rec.protocol,
      ipAddress:   rec.ipAddress,
      port:        rec.port,
      rack:        rec.rack,
      slot:        rec.slot,
      brand:       rec.brand,
      model:       device.deepInfo?.model || rec.model || '',
      pollingRate: rec.pollingRate,
    });
    setEditingPLC(null);
    setShowDiscoveryModal(false);
    setShowModal(true);
    showToast(`Pre-filled from discovery: ${rec.name}`, 'success');
  };

  const toggleExpanded = (ip) => {
    setExpandedDevices(prev => ({ ...prev, [ip]: !prev[ip] }));
  };

  const deletingPLC   = plcs.find(p => p._id === deleteId);
  const deletingIsSim = deletingPLC?.isSimulation;
  const csvLineCount  = importCsvText.split('\n').filter(l => l.trim() && !l.trim().startsWith('#')).length - 1;

  return (
    <div className="space-y-4" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ═══ HEADER ═══ */}
      <div className="p-5 rounded-2xl"
        style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0px 4px 20px rgba(8,27,67,0.06)' }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: C.heading, fontFamily: "'Montserrat', sans-serif" }}>
              PLC Management
            </h1>
            <p className="text-sm mt-0.5" style={{ color: C.muted }}>Configure & manage PLC connections</p>
          </div>

          {/* ✅ CLEAN BUTTON BAR */}
          <div className="flex items-center gap-2 flex-wrap">
            <ActionButton variant="teal" icon={Radar} onClick={handleOpenDiscovery} title="Scan network for PLCs">
              Discover PLCs
            </ActionButton>
            <ActionButton variant="purple" icon={Sparkles} onClick={handleQuickSimulation}
              disabled={creatingSim} loading={creatingSim}
              title="Create simulation PLC with demo tags">
              {creatingSim ? 'Creating…' : 'Quick Simulation'}
            </ActionButton>
            <ActionButton variant="amber" icon={Upload} onClick={handleOpenImport} title="Import PLCs from CSV">
              Import CSV
            </ActionButton>
            <ActionButton variant="green" icon={Download} onClick={handleExportCSV}
              disabled={exporting || plcs.filter(p => !p.isSimulation).length === 0}
              loading={exporting} title="Export PLCs to CSV">
              Export CSV
            </ActionButton>
            <ActionButton variant="primary" icon={Plus} onClick={handleOpenAdd} title="Add new PLC">
              Add PLC
            </ActionButton>
          </div>
        </div>
      </div>


      {/* ═══ PLC TABLE ═══ */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0px 4px 20px rgba(8,27,67,0.06)' }}>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: C.brand }} />
          </div>
        ) : plcs.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: C.cardHover }}>
              <Cpu className="w-10 h-10" style={{ color: C.brand }} />
            </div>
            <h3 className="text-xl font-bold mb-2" style={{ color: C.heading, fontFamily: "'Montserrat', sans-serif" }}>No PLCs Configured</h3>
            <p className="text-sm max-w-md mx-auto mb-6" style={{ color: C.muted }}>Discover PLCs on your network, add a real PLC, or try a Simulation PLC.</p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <ActionButton variant="teal" icon={Radar} onClick={handleOpenDiscovery}>
                Discover PLCs
              </ActionButton>
              <ActionButton variant="purple" icon={Sparkles} onClick={handleQuickSimulation}
                disabled={creatingSim} loading={creatingSim}>
                {creatingSim ? 'Creating…' : 'Try Simulation'}
              </ActionButton>
              <ActionButton variant="primary" icon={Plus} onClick={handleOpenAdd}>
                Add PLC
              </ActionButton>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead style={{ background: C.cardSubtle, borderBottom: `1px solid ${C.border}` }}>
                <tr>
                  {['Status', 'Name', 'Protocol', 'IP Address', 'Brand / Model', 'Tags', 'Actions'].map(h => (
                    <th key={h} className={`px-4 py-3 text-xs font-semibold uppercase text-left ${h === 'Actions' ? 'text-right' : ''}`}
                      style={{ color: C.muted }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plcs.map((plc, idx) => (
                  <tr key={plc._id}
                    style={{ borderBottom: idx < plcs.length - 1 ? `1px solid ${C.border}` : 'none', background: C.card }}
                    onMouseEnter={e => e.currentTarget.style.background = C.cardSubtle}
                    onMouseLeave={e => e.currentTarget.style.background = C.card}>
                    <td className="px-4 py-3">
                      {plc.isConnected
                        ? <div className="flex items-center gap-1.5"><Wifi className="w-4 h-4" style={{ color: C.success }} /><span className="text-xs font-bold" style={{ color: C.success }}>ONLINE</span></div>
                        : <div className="flex items-center gap-1.5"><WifiOff className="w-4 h-4" style={{ color: C.subtle }} /><span className="text-xs font-bold" style={{ color: C.subtle }}>OFFLINE</span></div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold" style={{ color: C.heading }}>{plc.name}</p>
                        {plc.isSimulation && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded"
                            style={{ background: `${C.purple}20`, color: C.purpleDark, border: `1px solid ${C.purple}40` }}>
                            <Sparkles className="w-2.5 h-2.5" /> SIM
                          </span>
                        )}
                      </div>
                      {plc.description && <p className="text-xs mt-0.5" style={{ color: C.muted }}>{plc.description}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 text-xs rounded font-mono font-semibold"
                        style={{ background: plc.isSimulation ? `${C.purple}15` : C.cardHover, color: plc.isSimulation ? C.purple : C.brand }}>
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
                      <span className="px-2 py-0.5 text-xs rounded font-semibold"
                        style={{ background: (plc.tagCount || 0) > 0 ? `${C.brand}15` : C.cardSubtle, color: (plc.tagCount || 0) > 0 ? C.brand : C.subtle }}>
                        {plc.tagCount || 0} tag{plc.tagCount !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <TableActionButton
                          variant={plc.isConnected ? 'orange' : 'green'}
                          icon={plc.isConnected ? Pause : Play}
                          onClick={() => handleStartStop(plc)}
                          title={plc.isConnected ? `Stop ${plc.name}` : `Start ${plc.name}`}
                        />
                        <TableActionButton
                          variant="blue"
                          icon={Edit2}
                          onClick={() => handleOpenEdit(plc)}
                          title={`Edit ${plc.name}`}
                        />
                        <TableActionButton
                          variant="red"
                          icon={Trash2}
                          onClick={() => setDeleteId(plc._id)}
                          title={`Delete ${plc.name}`}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══ ADD/EDIT MODAL ═══ */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)}
        title={editingPLC ? 'Edit PLC' : 'Add New PLC'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="PLC Name *" name="name" value={formData.name} onChange={handleInputChange} required />
            <FormField label="Description" name="description" value={formData.description} onChange={handleInputChange} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: C.heading }}>Protocol *</label>
              <select name="protocol" value={formData.protocol} onChange={handleInputChange}
                className="w-full px-3 py-2 rounded-lg outline-none"
                style={{ background: C.cardSubtle, border: `1px solid ${C.border}`, color: C.heading }}>
                <option value="SIMULATION">Simulation Mode</option>
                <option value="MODBUS_TCP">Modbus TCP</option>
                <option value="S7">Siemens S7</option>
                <option value="OPC_UA">OPC-UA</option>
                <option value="ETHERNET_IP">Ethernet/IP</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: C.heading }}>Brand</label>
              <select name="brand" value={formData.brand} onChange={handleInputChange}
                className="w-full px-3 py-2 rounded-lg outline-none"
                style={{ background: C.cardSubtle, border: `1px solid ${C.border}`, color: C.heading }}>
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
            <button type="button" onClick={() => setShowModal(false)}
              className="flex-1"
              style={{
                height: '40px', padding: '0 16px',
                borderRadius: '8px', background: '#FFFFFF',
                border: `1.5px solid ${C.border}`, color: C.heading,
                fontSize: '13px', fontWeight: 600,
                fontFamily: "'Montserrat', sans-serif", cursor: 'pointer',
              }}>Cancel</button>
            <button type="submit" className="flex-1"
              style={{
                height: '40px', padding: '0 16px',
                borderRadius: '8px', background: C.brand,
                color: '#FFFFFF', border: 'none',
                fontSize: '13px', fontWeight: 600,
                fontFamily: "'Montserrat', sans-serif", cursor: 'pointer',
                boxShadow: '0px 2px 8px rgba(37,99,235,0.25)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = C.btnHover}
              onMouseLeave={e => e.currentTarget.style.background = C.brand}>
              {editingPLC ? 'Update PLC' : 'Create PLC'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ═══ DELETE CONFIRM ═══ */}
      <ConfirmDialog
        isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title={deletingIsSim ? 'Delete Simulation PLC?' : 'Delete PLC?'}
        message={deletingIsSim ? `Delete "${deletingPLC?.name}" and its demo tags?` : `Delete "${deletingPLC?.name}"?`}
        confirmText={deletingIsSim ? 'Delete Sim PLC & Tags' : 'Delete PLC'}
        confirmColor="red" icon="warning"
      />

      {/* ═══ IMPORT CSV MODAL ═══ */}
      <Modal isOpen={showImportModal} onClose={handleCloseImport} title="Import PLCs from CSV" size="lg">
        {!importResults ? (
          <div className="space-y-4">
            <div className="p-3 rounded-lg flex items-start gap-3"
              style={{ background: C.cardHover, border: `1px solid ${C.brand}40` }}>
              <FileText className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: C.brand }} />
              <div className="flex-1 text-sm">
                <p className="font-semibold" style={{ color: C.heading }}>Need a template?</p>
                <p className="mt-0.5" style={{ color: C.text }}>Download a CSV template with example rows.</p>
              </div>
              <ActionButton variant="secondary" icon={Download} onClick={handleDownloadTemplate}>
                Template
              </ActionButton>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: C.heading }}>Select CSV File</label>
              <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFileSelect}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: C.cardSubtle, border: `1px solid ${C.border}`, color: C.text }} />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: C.heading }}>
                CSV Preview {csvLineCount > 0 && <span className="text-xs font-normal ml-2" style={{ color: C.brand }}>({csvLineCount} rows)</span>}
              </label>
              <textarea value={importCsvText} onChange={e => setImportCsvText(e.target.value)}
                placeholder="Paste CSV text here or select a file above…" rows={10}
                className="w-full px-3 py-2 rounded-lg font-mono text-xs outline-none"
                style={{ background: C.cardSubtle, border: `1px solid ${C.border}`, color: C.heading }}
                onFocus={e => e.target.style.borderColor = C.brand}
                onBlur={e => e.target.style.borderColor = C.border} />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: C.heading }}>Import Mode</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'create', label: 'Create Only',     hint: 'Skip existing' },
                  { value: 'update', label: 'Update Only',     hint: 'Skip new'      },
                  { value: 'upsert', label: 'Create + Update', hint: 'Both'          },
                ].map(m => (
                  <button key={m.value} onClick={() => setImportMode(m.value)}
                    className="p-3 rounded-lg text-left transition-all"
                    style={{ background: importMode === m.value ? C.cardHover : C.cardSubtle,
                      border: `1px solid ${importMode === m.value ? C.brand : C.border}`,
                      color: importMode === m.value ? C.brand : C.text }}>
                    <p className="text-sm font-semibold">{m.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: C.muted }}>{m.hint}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
              <button onClick={handleCloseImport} className="flex-1"
                style={{
                  height: '40px', padding: '0 16px',
                  borderRadius: '8px', background: '#FFFFFF',
                  border: `1.5px solid ${C.border}`, color: C.heading,
                  fontSize: '13px', fontWeight: 600,
                  fontFamily: "'Montserrat', sans-serif", cursor: 'pointer',
                }}>Cancel</button>
              <button onClick={handleImportSubmit} disabled={importing || !importCsvText.trim()}
                className="flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
                style={{
                  height: '40px', padding: '0 16px',
                  borderRadius: '8px', background: C.brand,
                  color: '#FFFFFF', border: 'none',
                  fontSize: '13px', fontWeight: 600,
                  fontFamily: "'Montserrat', sans-serif", cursor: 'pointer',
                  boxShadow: '0px 2px 8px rgba(37,99,235,0.25)',
                }}>
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {importing ? 'Importing…' : 'Import PLCs'}
              </button>
            </div>
          </div>
        ) : (
          <ImportResults results={importResults} entityLabel="PLCs" onClose={handleCloseImport}
            onImportAgain={() => { setImportResults(null); setImportCsvText(''); }} />
        )}
      </Modal>

      {/* ═══════════ PLC DISCOVERY MODAL — Phase 3 ═══════════ */}
      <Modal
        isOpen={showDiscoveryModal}
        onClose={() => { setShowDiscoveryModal(false); setScanning(false); setScanResults(null); }}
        title="🔍 Discover PLCs on Network"
        size="xl"
      >
        <div className="space-y-4">

          {/* Network interfaces */}
          {networks.length > 0 && (
            <div className="p-3 rounded-lg" style={{ background: C.cardHover, border: `1px solid ${C.brand}30` }}>
              <div className="flex items-center gap-2 mb-2">
                <Signal className="w-4 h-4" style={{ color: C.brand }} />
                <span className="text-sm font-bold" style={{ color: C.heading }}>
                  Detected Network{networks.length > 1 ? 's' : ''}
                </span>
                <span className="text-xs ml-auto" style={{ color: C.subtle }}>
                  🔒 Your PC IP is automatically excluded from results
                </span>
              </div>
              <div className="space-y-1">
                {networks.map((net, idx) => (
                  <div key={idx} className="text-xs font-mono" style={{ color: C.text }}>
                    <span style={{ color: C.brand, fontWeight: 700 }}>{net.interface}</span>
                    {' — '}{net.address}
                    {' ('}<span style={{ color: C.muted }}>{net.cidr}</span>
                    {' — '}{net.totalHosts} hosts)
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Options row */}
          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={useCustomRange}
                onChange={e => setUseCustomRange(e.target.checked)}
                style={{ accentColor: C.brand, width: 16, height: 16 }} />
              <span className="text-sm font-semibold" style={{ color: C.heading }}>Custom IP Range</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={useDeepProbe}
                onChange={e => setUseDeepProbe(e.target.checked)}
                style={{ accentColor: C.teal, width: 16, height: 16 }} />
              <span className="text-sm font-semibold" style={{ color: C.heading }}>Deep Identification</span>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded"
                style={{ background: useDeepProbe ? `${C.teal}20` : C.cardSubtle,
                  color: useDeepProbe ? C.teal : C.muted,
                  border: `1px solid ${useDeepProbe ? C.teal + '60' : C.border}` }}>
                {useDeepProbe ? 'ON — thorough' : 'OFF — fast'}
              </span>
            </label>
          </div>

          {/* Deep probe info */}
          {useDeepProbe && (
            <div className="p-3 rounded-lg flex items-start gap-3"
              style={{ background: `${C.teal}10`, border: `1px solid ${C.teal}40` }}>
              <Microscope className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: C.teal }} />
              <div className="text-xs" style={{ color: C.text }}>
                <p className="font-semibold mb-1" style={{ color: C.tealDark }}>
                  Phase 3 Deep Identification — all probes run in parallel:
                </p>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { icon: '🔶', label: 'OPC UA (PRIMARY)',  desc: 'ProductName, SoftwareVersion (=firmware), Manufacturer — best for S7-1500' },
                    { icon: '🔷', label: 'S7 Protocol',       desc: 'Order#, model variant, PLC name — tries 5 TSAP combinations automatically' },
                    { icon: '🔸', label: 'Modbus FC43',       desc: 'Vendor, product, firmware — fallback for Modbus-only devices' },
                  ].map(p => (
                    <div key={p.label} className="p-2 rounded" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                      <p className="font-semibold text-[11px]" style={{ color: C.tealDark }}>{p.icon} {p.label}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: C.muted }}>{p.desc}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-1.5" style={{ color: C.muted }}>
                  ⏱ 15–60 seconds depending on network size. PC own-IP always excluded.
                </p>
              </div>
            </div>
          )}

          {/* Custom range inputs */}
          {useCustomRange && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1 uppercase" style={{ color: C.muted }}>Start IP</label>
                <input type="text" value={customRange.startIP}
                  onChange={e => setCustomRange(prev => ({ ...prev, startIP: e.target.value }))}
                  placeholder="192.168.1.1"
                  className="w-full px-3 py-2 rounded-lg outline-none text-sm font-mono"
                  style={{ background: C.cardSubtle, border: `1px solid ${C.border}`, color: C.heading }}
                  onFocus={e => e.target.style.borderColor = C.brand}
                  onBlur={e => e.target.style.borderColor = C.border} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 uppercase" style={{ color: C.muted }}>End IP</label>
                <input type="text" value={customRange.endIP}
                  onChange={e => setCustomRange(prev => ({ ...prev, endIP: e.target.value }))}
                  placeholder="192.168.1.254"
                  className="w-full px-3 py-2 rounded-lg outline-none text-sm font-mono"
                  style={{ background: C.cardSubtle, border: `1px solid ${C.border}`, color: C.heading }}
                  onFocus={e => e.target.style.borderColor = C.brand}
                  onBlur={e => e.target.style.borderColor = C.border} />
              </div>
            </div>
          )}

          {/* Scan button */}
          {!scanResults && (
            <div className="space-y-2">
              <button onClick={handleStartScan} disabled={scanning}
                className="w-full flex items-center justify-center gap-2"
                style={{
                  height: '48px', padding: '0 16px',
                  borderRadius: '8px',
                  background: scanning ? C.subtle : C.brand,
                  color: '#FFFFFF', border: 'none',
                  fontSize: '14px', fontWeight: 700,
                  fontFamily: "'Montserrat', sans-serif",
                  cursor: scanning ? 'not-allowed' : 'pointer',
                  opacity: scanning ? 0.7 : 1,
                  boxShadow: scanning ? 'none' : '0px 4px 12px rgba(37,99,235,0.30)',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => { if (!scanning) e.currentTarget.style.background = C.btnHover; }}
                onMouseLeave={e => { if (!scanning) e.currentTarget.style.background = C.brand; }}>
                {scanning
                  ? <><Loader2 className="w-5 h-5 animate-spin" />Scanning… (may take 15–60 seconds)</>
                  : <><Radar className="w-5 h-5" />Start Network Scan</>}
              </button>

              {scanning && (
                <div className="p-3 rounded-lg flex items-center gap-3"
                  style={{ background: `${C.teal}10`, border: `1px solid ${C.teal}40` }}>
                  <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" style={{ color: C.teal }} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: C.tealDark }}>
                      {PHASE_LABELS[scanPhase] || 'Scanning…'}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      {[
                        { key: 'pinging',      label: 'Ping'  },
                        { key: 'probing',      label: 'Ports' },
                        { key: 'deep_probing', label: 'Deep'  },
                        { key: 'done',         label: 'Done'  },
                      ].map((step, i) => {
                        const phases    = ['pinging', 'probing', 'deep_probing', 'done'];
                        const current   = phases.indexOf(scanPhase);
                        const stepIndex = phases.indexOf(step.key);
                        const isDone    = stepIndex < current;
                        const isActive  = stepIndex === current;
                        return (
                          <div key={step.key} className="flex items-center gap-1">
                            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                              style={{ background: isDone ? C.success : isActive ? C.teal : C.border, color: (isDone || isActive) ? '#FFF' : C.muted }}>
                              {isDone ? '✓' : i + 1}
                            </div>
                            <span className="text-[10px] font-semibold"
                              style={{ color: isDone ? C.success : isActive ? C.teal : C.muted }}>
                              {step.label}
                            </span>
                            {i < 3 && <div className="w-4 h-px" style={{ background: isDone ? C.success : C.border }} />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ SCAN RESULTS ═══ */}
          {scanResults && (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'IPs Scanned', value: scanResults.scannedIPs  || 0, color: C.heading  },
                  { label: 'Hosts Alive', value: scanResults.aliveHosts  || 0, color: C.brand    },
                  { label: 'PLCs Found',  value: scanResults.devices?.length || 0, color: C.success  },
                  { label: 'Verified',
                    value: scanResults.devices?.filter(d => d.verified).length || 0,
                    color: C.verified },
                ].map(s => (
                  <div key={s.label} className="p-3 rounded-lg text-center"
                    style={{ background: C.cardSubtle, border: `1px solid ${C.border}` }}>
                    <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-xs" style={{ color: C.muted }}>{s.label}</p>
                  </div>
                ))}
              </div>

              {scanResults.deepProbeUsed && (
                <div className="flex items-center gap-2 text-xs" style={{ color: C.teal }}>
                  <Microscope className="w-3.5 h-3.5" />
                  <span className="font-semibold">
                    Phase 3 deep identification used (OPC UA + S7 multi-TSAP + Modbus FC43)
                  </span>
                </div>
              )}

              {(!scanResults.devices || scanResults.devices.length === 0) ? (
                <div className="text-center py-8">
                  <Search className="w-12 h-12 mx-auto mb-3" style={{ color: C.subtle }} />
                  <p className="font-semibold" style={{ color: C.heading }}>No PLCs Found</p>
                  <p className="text-sm mt-1" style={{ color: C.muted }}>
                    Ensure PLCs are powered on and connected to the same network.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                  {scanResults.devices.map((device, idx) => {
                    const conf        = CONF_MAP[device.confidence] || CONF_MAP.low;
                    const ConfIcon    = conf.icon;
                    const isAdded     = plcs.some(p => p.ipAddress === device.ip);
                    const isExpanded  = expandedDevices[device.ip];
                    const isReprobing = probingIP === device.ip;
                    const hasDeepInfo = device.deepInfo && (
                      device.deepInfo.model || device.deepInfo.firmware ||
                      device.deepInfo.orderNumber || device.deepInfo.plcName ||
                      device.deepInfo.manufacturer || device.deepInfo.softwareVersion
                    );

                    return (
                      <div key={idx} className="rounded-xl transition-all"
                        style={{
                          background: C.card,
                          border: `1px solid ${device.verified ? C.verified + '60' : isAdded ? C.success + '60' : C.border}`,
                          boxShadow: device.verified ? `0px 2px 12px ${C.verified}20` : '0px 2px 8px rgba(8,27,67,0.04)',
                        }}>
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-2">
                                {device.verified && (
                                  <span className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full"
                                    style={{ background: `${C.verified}15`, color: C.verified, border: `1px solid ${C.verified}60` }}>
                                    <ShieldCheck className="w-3.5 h-3.5" /> Verified ✅
                                  </span>
                                )}
                                <span className="px-2 py-0.5 text-xs font-bold rounded"
                                  style={{ background: conf.bg, color: conf.color }}>
                                  <ConfIcon className="w-3 h-3 inline mr-1" />{conf.label}
                                </span>
                                {device.deepInfo?.probeMethod && (
                                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded"
                                    style={{ background: `${C.teal}15`, color: C.teal, border: `1px solid ${C.teal}40` }}>
                                    🔬 {device.deepInfo.probeMethod}
                                  </span>
                                )}
                                {isAdded && (
                                  <span className="px-2 py-0.5 text-[10px] font-bold rounded"
                                    style={{ background: '#DCFCE7', color: C.success }}>
                                    <CheckCircle2 className="w-3 h-3 inline mr-0.5" />Already Added
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-3 flex-wrap">
                                <span className="font-mono font-bold text-sm" style={{ color: C.brand }}>📍 {device.ip}</span>
                                <span className="font-semibold text-sm" style={{ color: C.heading }}>{device.vendorName}</span>
                                {device.hostname && (
                                  <span className="text-xs font-mono" style={{ color: C.teal }}>
                                    🌐 {device.hostname}
                                  </span>
                                )}
                                {device.mac !== 'Unknown' && (
                                  <span className="text-xs font-mono" style={{ color: C.muted }}>
                                    MAC: {device.mac}
                                  </span>
                                )}
                              </div>

                              {hasDeepInfo && (
                                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                                  {device.deepInfo.model && (
                                    <DeepInfoRow icon={<Cpu className="w-3 h-3" />} label="Model" value={device.deepInfo.model} />
                                  )}
                                  {(device.deepInfo.softwareVersion || device.deepInfo.firmware) && (
                                    <DeepInfoRow icon={<Zap className="w-3 h-3" />} label="Firmware"
                                      value={device.deepInfo.softwareVersion || device.deepInfo.firmware}
                                      valueColor={C.success} />
                                  )}
                                  {device.deepInfo.orderNumber && (
                                    <DeepInfoRow icon={<Hash className="w-3 h-3" />} label="Order#" value={device.deepInfo.orderNumber} />
                                  )}
                                  {device.deepInfo.plcName && (
                                    <DeepInfoRow icon={<Tag className="w-3 h-3" />} label="PLC Name" value={device.deepInfo.plcName} />
                                  )}
                                  {device.deepInfo.opcuaAppName && (
                                    <DeepInfoRow icon={<Server className="w-3 h-3" />} label="OPC UA App" value={device.deepInfo.opcuaAppName} />
                                  )}
                                  {device.deepInfo.opcuaServerState && (
                                    <DeepInfoRow icon={<Settings2 className="w-3 h-3" />} label="Server State"
                                      value={device.deepInfo.opcuaServerState}
                                      valueColor={device.deepInfo.opcuaServerState === 'Running' ? C.success : C.warning} />
                                  )}
                                  {device.deepInfo.manufacturer && (
                                    <DeepInfoRow icon={<Package className="w-3 h-3" />} label="Manufacturer" value={device.deepInfo.manufacturer} />
                                  )}
                                </div>
                              )}

                              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                <span className="text-[10px] font-semibold uppercase" style={{ color: C.muted }}>Protocols:</span>
                                {device.protocols.map(p => (
                                  <span key={p.protocol} className="px-2 py-0.5 text-[10px] font-bold rounded font-mono"
                                    style={{
                                      background: p.protocol === device.recommended.recommendedProtocol ? `${C.brand}15` : C.cardSubtle,
                                      color: p.protocol === device.recommended.recommendedProtocol ? C.brand : C.text,
                                      border: `1px solid ${p.protocol === device.recommended.recommendedProtocol ? C.brand + '40' : C.border}`,
                                    }}>
                                    {p.label} :{p.port}{p.protocol === device.recommended.recommendedProtocol && ' ⭐'}
                                  </span>
                                ))}
                              </div>

                              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                <p className="text-[11px] italic" style={{ color: C.muted }}>
                                  💡 {device.recommended.reasonForRecommendation}
                                </p>
                                <span className="text-[10px] font-mono" style={{ color: C.subtle }}>
                                  Rack:{device.recommended.rack} Slot:{device.recommended.slot}
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-col gap-2 flex-shrink-0">
                              <ActionButton
                                variant={isAdded ? "secondary" : "primary"}
                                icon={isAdded ? CheckCircle2 : Plus}
                                onClick={() => handleAddDiscovered(device)}
                                disabled={isAdded}
                              >
                                {isAdded ? 'Added' : 'Add PLC'}
                              </ActionButton>
                              <ActionButton
                                variant="teal"
                                icon={isReprobing ? Loader2 : Microscope}
                                onClick={() => handleReprobe(device)}
                                disabled={!!probingIP}
                                loading={isReprobing}
                              >
                                {isReprobing ? 'Probing…' : 'Re-probe'}
                              </ActionButton>
                              {device.probeResults && (
                                <button onClick={() => toggleExpanded(device.ip)}
                                  className="text-xs font-semibold flex items-center justify-center gap-1"
                                  style={{
                                    height: '32px', padding: '0 12px',
                                    borderRadius: '6px', background: C.cardSubtle,
                                    color: C.muted, border: `1px solid ${C.border}`,
                                    cursor: 'pointer', fontFamily: "'Montserrat', sans-serif",
                                  }}>
                                  {isExpanded
                                    ? <><ChevronUp className="w-3 h-3" />Less</>
                                    : <><ChevronDown className="w-3 h-3" />Details</>}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {isExpanded && device.probeResults && (
                          <div className="px-4 pb-4">
                            <div className="pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
                              <p className="text-xs font-bold mb-2 uppercase" style={{ color: C.muted }}>Raw Probe Results</p>
                              <div className="grid grid-cols-3 gap-2">
                                <ProbeResultCard title="OPC UA (Primary)" icon="🔶" data={device.probeResults.opcua}
                                  fields={[
                                    { key: 'productName',    label: 'Product'      },
                                    { key: 'softwareVersion',label: 'SW Version'   },
                                    { key: 'manufacturer',   label: 'Manufacturer' },
                                    { key: 'serverState',    label: 'State'        },
                                    { key: 'buildNumber',    label: 'Build'        },
                                  ]} />
                                <ProbeResultCard title="S7 Protocol" icon="🔷" data={device.probeResults.s7}
                                  fields={[
                                    { key: 'orderNumber', label: 'Order #'  },
                                    { key: 'model',       label: 'Model'    },
                                    { key: 'firmware',    label: 'Firmware' },
                                    { key: 'plcName',     label: 'PLC Name' },
                                    { key: 'tsapUsed',    label: 'TSAP'     },
                                  ]} />
                                <ProbeResultCard title="Modbus FC43" icon="🔸" data={device.probeResults.modbus}
                                  fields={[
                                    { key: 'vendorName',  label: 'Vendor'   },
                                    { key: 'productCode', label: 'Product'  },
                                    { key: 'firmware',    label: 'Firmware' },
                                    { key: 'modelName',   label: 'Model'    },
                                  ]} />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-3 pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
                <ActionButton variant="secondary" icon={RefreshCw}
                  onClick={() => { setScanResults(null); setScanPhase('idle'); }}>
                  Scan Again
                </ActionButton>
                <ActionButton variant="primary"
                  onClick={() => { setShowDiscoveryModal(false); setScanResults(null); }}>
                  Close
                </ActionButton>
              </div>
            </div>
          )}
        </div>
      </Modal>

    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// SUB-COMPONENTS (outside PLCManagement — no access to state)
// ═══════════════════════════════════════════════════════════

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

const FormField = ({ label, name, type = 'text', value, onChange, required }) => (
  <div>
    <label className="block text-sm font-semibold mb-1.5" style={{ color: '#081B43' }}>{label}</label>
    <input type={type} name={name} value={value} onChange={onChange} required={required}
      className="w-full px-3 py-2 rounded-lg outline-none"
      style={{ background: '#F8FAFC', border: '1px solid #E5E7EB', color: '#081B43' }}
      onFocus={e => e.target.style.borderColor = '#2563EB'}
      onBlur={e => e.target.style.borderColor = '#E5E7EB'} />
  </div>
);

const DeepInfoRow = ({ icon, label, value, valueColor }) => (
  <div className="flex items-center gap-1.5 text-xs">
    <span style={{ color: '#94A3B8' }}>{icon}</span>
    <span className="font-semibold" style={{ color: '#5F6B7A', minWidth: '72px' }}>{label}:</span>
    <span className="font-mono font-semibold truncate" style={{ color: valueColor || '#081B43' }}>{value}</span>
  </div>
);

const ProbeResultCard = ({ title, icon, data, fields }) => {
  const success = data?.success;
  return (
    <div className="p-2.5 rounded-lg"
      style={{ background: success ? '#F0FDF4' : '#F8FAFC', border: `1px solid ${success ? '#86EFAC' : '#E5E7EB'}` }}>
      <div className="flex items-center gap-1.5 mb-2">
        <span>{icon}</span>
        <span className="text-xs font-bold" style={{ color: success ? '#15803D' : '#94A3B8' }}>{title}</span>
        <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded"
          style={{ background: success ? '#DCFCE7' : '#F1F5F9', color: success ? '#15803D' : '#94A3B8' }}>
          {success ? '✅ OK' : '— N/A'}
        </span>
      </div>
      {success && fields.map(f => data[f.key] ? (
        <div key={f.key} className="flex items-start gap-1 text-[11px] mb-0.5">
          <span className="font-semibold flex-shrink-0" style={{ color: '#5F6B7A', minWidth: '60px' }}>{f.label}:</span>
          <span className="font-mono break-all" style={{ color: '#081B43' }}>{data[f.key]}</span>
        </div>
      ) : null)}
      {!success && (
        <p className="text-[11px]" style={{ color: '#94A3B8' }}>
          Port not open or protocol not supported.
        </p>
      )}
    </div>
  );
};

export default PLCManagement;