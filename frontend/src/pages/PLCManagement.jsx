// ═══════════════════════════════════════════════════════════
// PLC Management — Professional UI (Emoji-Free)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import { plcAPI } from '../services/api';
import api from '../services/api';
import socketService from '../services/socket';
import { useToast } from '../context/ToastContext';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import {
  Plus, Edit2, Trash2, Play, Pause, Cpu, Wifi, WifiOff, Loader2, Sparkles,
  Download, Upload, FileText, Search, Radar, Signal, SignalHigh, SignalLow,
  CheckCircle2, ShieldCheck, Microscope, RefreshCw, ChevronDown, ChevronUp,
  Zap, Package, Hash, Tag, Server, Settings2, CheckCircle, Network, FolderArchive,
  Info, Key, MapPin, Monitor, Lightbulb, Hexagon, Box, Layers, Timer, AlertCircle
} from 'lucide-react';

const C = {
  bg: '#F8FAFC', card: '#FFFFFF', cardSubtle: '#F8FAFC', cardHover: '#EEF6FF',
  border: '#E5E7EB', heading: '#081B43', text: '#334155', muted: '#5F6B7A',
  subtle: '#94A3B8', brand: '#2563EB', brandDark: '#0F3D91', btnPrimary: '#2563EB',
  btnHover: '#1D4ED8', success: '#16A34A', warning: '#F59E0B', danger: '#DC2626',
  purple: '#9333EA', purpleDark: '#6B21A8', teal: '#0891B2', tealDark: '#0E7490', verified: '#059669',
};

const ActionButton = ({ variant = 'primary', icon: Icon, children, onClick, disabled, loading, title }) => {
  const variants = {
    primary: { bg: '#2563EB', bgHover: '#1D4ED8', color: '#FFFFFF', border: 'transparent', shadow: '0px 2px 8px rgba(37,99,235,0.25)' },
    secondary: { bg: '#FFFFFF', bgHover: '#EEF6FF', color: '#2563EB', border: '#2563EB', shadow: 'none' },
    purple: { bg: '#FFFFFF', bgHover: '#F5F3FF', color: '#7C3AED', border: '#9333EA', shadow: 'none' },
    amber: { bg: '#FFFFFF', bgHover: '#FEF3C7', color: '#D97706', border: '#F59E0B', shadow: 'none' },
    green: { bg: '#FFFFFF', bgHover: '#DCFCE7', color: '#16A34A', border: '#16A34A', shadow: 'none' },
    teal: { bg: '#FFFFFF', bgHover: '#CFFAFE', color: '#0E7490', border: '#0891B2', shadow: 'none' },
    emerald: { bg: '#10B981', bgHover: '#059669', color: '#FFFFFF', border: 'transparent', shadow: '0px 2px 8px rgba(16,185,129,0.30)' },
  };
  const v = variants[variant] || variants.primary;
  return (
    <button onClick={onClick} disabled={disabled || loading} title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        height: '40px', padding: '0 16px', borderRadius: '8px',
        background: v.bg, color: v.color, border: `1.5px solid ${v.border}`,
        fontSize: '13px', fontWeight: 600, cursor: (disabled || loading) ? 'not-allowed' : 'pointer',
        opacity: (disabled || loading) ? 0.5 : 1, boxShadow: v.shadow, transition: 'all 0.15s ease'
      }}>
      {loading ? <Loader2 size={16} className="animate-spin" /> : Icon && <Icon size={16} strokeWidth={2.2} />}
      {children}
    </button>
  );
};

const PHASE_LABELS = {
  idle: 'Idle', pinging: 'Phase 1: Preparing scan...', probing: 'Phase 2: Port checking across local subnet...',
  done: 'Scan complete', cancelled: 'Cancelled',
};

const getEquipmentStatus = (plc) => {
  const states = {
    streaming: ['STREAMING', 'Live tag data received', '#16A34A', '#F0FDF4', '#BBF7D0', Wifi],
    connected_no_tags: ['CONNECTED', 'No tags configured', '#2563EB', '#EFF6FF', '#BFDBFE', Wifi],
    connected_no_data: ['CONNECTED', 'No recent tag data', '#D97706', '#FFFBEB', '#FDE68A', SignalLow],
    connector_offline: ['CONNECTOR OFFLINE', 'Start the Factory Connector', '#DC2626', '#FEF2F2', '#FECACA', WifiOff],
    failed: ['CONNECTION ERROR', plc.connectionMessage || 'Equipment connection failed', '#DC2626', '#FEF2F2', '#FECACA', AlertCircle],
    connected_read_error: ['READ ERROR', plc.connectionMessage || 'Tag reading failed', '#DC2626', '#FEF2F2', '#FECACA', AlertCircle],
    stopped: ['STOPPED', 'Connection is disabled', '#64748B', '#F1F5F9', '#CBD5E1', Pause],
  };
  const value = states[plc.connectionState] || ['WAITING', plc.connectionMessage || 'Waiting for status', '#64748B', '#F8FAFC', '#E2E8F0', Signal];
  return { label: value[0], detail: value[1], color: value[2], background: value[3], border: value[4], Icon: value[5] };
};

const PLCManagement = () => {
  const { showToast } = useToast();
  const [plcs, setPlcs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPLC, setEditingPLC] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [creatingSim, setCreatingSim] = useState(false);

  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanPhase, setScanPhase] = useState('idle');
  const [scanResults, setScanResults] = useState(null);
  const [customRange, setCustomRange] = useState({ startIP: '', endIP: '' });
  const [useDeepProbe, setUseDeepProbe] = useState(true);

  const [gateway, setGateway] = useState(null);
  const [downloadingPackage, setDownloadingPackage] = useState(false);
  const [testingPLC, setTestingPLC] = useState(null);

  const [formData, setFormData] = useState({
    name: '', description: '', protocol: 'SIMULATION', ipAddress: '192.168.1.100', port: 502,
    rack: 0, slot: 0, unitId: 1, brand: 'OTHER', pollingRate: 1000, opcuaUsername: '', opcuaPassword: ''
  });

  useEffect(() => {
    loadPLCs(); loadGateway();
    const handlePlcStatus = (data) => {
      setPlcs(prev => prev.map(p => p._id === data.plcId ? {
        ...p,
        isConnected: data.isConnected,
        connectionState: data.state,
        connectionMessage: data.message,
        lastDataAt: data.lastDataAt,
      } : p));
    };
    socketService.on('plcStatus', handlePlcStatus);
    const statusInterval = setInterval(() => { loadPLCs(); loadGateway(); }, 8000);
    return () => { socketService.off('plcStatus', handlePlcStatus); clearInterval(statusInterval); };
  }, []);

  // Poll for Discovery Progress via HTTP to circumvent complex socket namespace routing
  useEffect(() => {
    if (!scanning) return;
    const interval = setInterval(async () => {
      try {
        const res = await api.get('/discovery/status');
        if (res.data) {
          setScanPhase(res.data.phase);
          if (res.data.devices) {
            setScanResults({
              scannedIPs: res.data.scannedIPs,
              aliveHosts: res.data.aliveHosts,
              devices: res.data.devices
            });
          }
          if (res.data.phase === 'done') {
            setScanning(false);
            showToast('Network scan complete', 'success');
          }
        }
      } catch { }
    }, 1500);
    return () => clearInterval(interval);
  }, [scanning]);

  const loadPLCs = async () => { try { const res = await plcAPI.getAll(); setPlcs(res.data.data); } catch (err) { } finally { setLoading(false); } };
  const loadGateway = async () => { try { const res = await api.get('/edge'); setGateway(res?.data?.data?.[0] || null); } catch (err) { } };

  const handleDownloadCompletePackage = async () => {
    try {
      setDownloadingPackage(true);
      let targetGateway = gateway;
      if (!targetGateway) {
        try { const createRes = await api.post('/edge', { name: 'Factory Connector' }); targetGateway = createRes.data?.data; setGateway(targetGateway); } catch (e) { }
      }
      if (!targetGateway) { const fetchRes = await api.get('/edge'); targetGateway = fetchRes?.data?.data?.[0]; setGateway(targetGateway); }
      if (!targetGateway) { showToast('Profile error. Try again.', 'error'); return; }

      const res = await api.get(`/edge/${targetGateway._id}/download-package`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `OnlineSCADA-Connector.zip`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);

      showToast('Connector downloaded successfully! Extract and run Start.bat', 'success', 8000);
      loadGateway();
    } catch (err) {
      let msg = 'Package download failed';
      try { if (err.response?.data?.message) msg = err.response.data.message; } catch (e) { }
      showToast(`Error: ${msg}`, 'error', 6000);
    } finally { setDownloadingPackage(false); }
  };

  const handleQuickSimulation = async () => {
    try {
      setCreatingSim(true);
      const res = await plcAPI.quickSimulation();
      showToast(`${res.data?.data?.name || 'Simulation PLC'} created with demo tags`, 'success', 5000);
      await loadPLCs();
    } catch (err) { showToast('Creation failed', 'error'); } finally { setCreatingSim(false); }
  };

  const handleOpenAdd = () => { setEditingPLC(null); setFormData({ name: '', description: '', protocol: 'SIMULATION', ipAddress: '192.168.1.100', port: 502, rack: 0, slot: 0, unitId: 1, brand: 'OTHER', pollingRate: 1000, opcuaUsername: '', opcuaPassword: '' }); setShowModal(true); };
  const handleOpenEdit = (plc) => { setEditingPLC(plc); setFormData({ ...plc }); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPLC) await plcAPI.update(editingPLC._id, formData);
      else await plcAPI.create(formData);
      showToast('Equipment saved', 'success'); setShowModal(false); loadPLCs(); loadGateway();
    } catch (err) { showToast('Operation failed', 'error'); }
  };

  const handleDelete = async () => { try { await plcAPI.delete(deleteId); setDeleteId(null); loadPLCs(); showToast('Deleted successfully', 'success'); } catch (err) { showToast('Delete failed', 'error'); } };

  const handleStartStop = async (plc) => {
    try {
      if (plc.isConnected) { await plcAPI.stop(plc._id); showToast(`Stopped`, 'info'); }
      else { await plcAPI.start(plc._id); showToast(`Started`, 'success'); }
      setTimeout(loadPLCs, 1000);
    } catch (err) { showToast('Operation failed', 'error'); }
  };

  const handleTestConnection = async (plc) => {
    try {
      setTestingPLC(plc._id);
      const res = await plcAPI.testConnection(plc._id);
      if (res.data.success && res.data?.data?.connected) { showToast(`Connection test successful`, 'success', 5000); setTimeout(loadPLCs, 500); }
      else { showToast(`Test failed: ${res.data?.data?.error || 'Error'}`, 'error', 5000); }
    } catch (err) { showToast(`Error: ${err.message}`, 'error'); } finally { setTestingPLC(null); }
  };

  const handleInputChange = (e) => { const { name, value, type } = e.target; setFormData({ ...formData, [name]: type === 'number' ? parseInt(value) : value }); };

  const handleStartScan = async () => {
    setScanning(true);
    setScanPhase('pinging');
    setScanResults(null);
    try {
      await api.post('/discovery/start', {
        startIP: customRange.startIP,
        endIP: customRange.endIP,
        deepProbe: useDeepProbe
      });
      showToast('Scan instruction pushed to Factory Connector', 'info');
    } catch (err) {
      setScanning(false);
      setScanPhase('idle');
      showToast('Failed to initiate scan', 'error');
    }
  };

  const handleAddDiscovered = (dev) => {
    setShowDiscoveryModal(false);
    setEditingPLC(null);
    setFormData({
      name: `${dev.vendorName} - ${dev.ip}`,
      description: 'Auto-discovered equipment',
      protocol: dev.protocol,
      ipAddress: dev.ip,
      port: dev.port,
      rack: 0,
      slot: 0,
      brand: 'OTHER',
      pollingRate: 1000,
      opcuaUsername: '',
      opcuaPassword: ''
    });
    setShowModal(true);
  };

  const isGatewayOnline = gateway?.status === 'online';
  const nonSimPlcCount = plcs.filter(p => !p.isSimulation).length;

  return (
    <div className="space-y-4 font-sans text-slate-800 pb-10">
      {/* ═══ HEADER ═══ */}
      <div className="p-5 rounded-2xl bg-white border shadow-sm flex items-center justify-between flex-wrap gap-4">
        <div><h1 className="text-2xl font-bold text-slate-900">Equipment Connections</h1><p className="text-sm text-slate-500 mt-1">Manage PLCs and link your factory to the cloud</p></div>
        <div className="flex items-center gap-2 flex-wrap">
          <ActionButton variant="teal" icon={Radar} onClick={() => setShowDiscoveryModal(true)} disabled={!isGatewayOnline} title={!isGatewayOnline ? "Connector must be online to scan local network" : ""}>Discover</ActionButton>
          <ActionButton variant="purple" icon={Sparkles} onClick={handleQuickSimulation} disabled={creatingSim} loading={creatingSim}>Simulate</ActionButton>
          <ActionButton variant="primary" icon={Plus} onClick={handleOpenAdd}>Add Equipment</ActionButton>
        </div>
      </div>

      {/* ═══ FACTORY CONNECTOR ═══ */}
      <div className="p-5 rounded-2xl transition-colors duration-300" style={{ background: isGatewayOnline ? '#F0FDF4' : '#FEF9C3', border: `1.5px solid ${isGatewayOnline ? '#86EFAC' : '#FDE68A'}`, }}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-start gap-4 flex-1">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: isGatewayOnline ? '#10B981' : '#F59E0B' }}><Server size={22} /></div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-base text-slate-900">Factory Connector Link</h3>
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold" style={{ background: isGatewayOnline ? '#DCFCE7' : '#FEF3C7', color: isGatewayOnline ? '#15803D' : '#B45309' }}>
                  {isGatewayOnline ? <CheckCircle size={12} strokeWidth={3} /> : <AlertCircle size={12} strokeWidth={3} />}
                  {isGatewayOnline ? 'System is Online & Connected' : nonSimPlcCount === 0 ? 'Ready for Download' : 'Offline - Setup Required'}
                </span>
              </div>
              <p className="text-sm text-slate-700">
                {isGatewayOnline ? (
                  <span className="flex items-center gap-1"><CheckCircle2 size={14} className="text-emerald-600" /> Secure bridge active. Streaming from <strong>{nonSimPlcCount} machine(s)</strong>.</span>
                ) : nonSimPlcCount === 0 ? (
                  `Download the Connector to enable Network Discovery, or add your machine manually below.`
                ) : (
                  `Download the Connector to link your ${nonSimPlcCount} machine(s) securely to the cloud. No installation needed!`
                )}
              </p>
              {gateway && isGatewayOnline && (
                <div className="flex items-center gap-4 mt-2.5 text-[11px] text-slate-500 bg-white/50 px-3 py-1.5 rounded-lg border border-slate-200/50 w-fit">
                  <span className="flex items-center gap-1"><Key size={12} /> Prefix: <span className="font-mono font-bold text-slate-700">{gateway.apiKeyPrefix}</span></span>
                  {gateway.ipAddress && <span className="flex items-center gap-1"><MapPin size={12} /> IP: <span className="font-mono text-slate-700">{gateway.ipAddress}</span></span>}
                  {gateway.hostname && <span className="flex items-center gap-1"><Monitor size={12} /> Host: <span className="font-mono text-slate-700">{gateway.hostname}</span></span>}
                </div>
              )}
            </div>
          </div>

          {/* REMOVED: disabled rule blocking download when PLC count is 0 */}
          <ActionButton variant="emerald" icon={FolderArchive} onClick={handleDownloadCompletePackage} disabled={downloadingPackage} loading={downloadingPackage}>
            {downloadingPackage ? 'Preparing...' : 'Download Connector'}
          </ActionButton>
        </div>
      </div>

      {/* ═══ PLC TABLE ═══ */}
      <div className="rounded-2xl bg-white border shadow-sm overflow-hidden">
        {loading ? <div className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" /></div> : plcs.length === 0 ? (
          <div className="py-16 text-center">
            <Cpu className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <h3 className="text-xl font-bold text-slate-800">No Equipment Added</h3>
            <p className="text-sm text-slate-500 mb-6">Click "Discover" above to scan your network, or add manually.</p>
            <ActionButton variant="primary" icon={Plus} onClick={handleOpenAdd}>Add Equipment Manually</ActionButton>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b text-xs text-slate-500 uppercase tracking-wide">
              <tr><th className="p-4">Status</th><th className="p-4">Name</th><th className="p-4">Protocol</th><th className="p-4">IP Address</th><th className="p-4">Tags</th><th className="p-4 text-right">Actions</th></tr>
            </thead>
            <tbody className="text-sm">
              {plcs.map(plc => (
                <tr key={plc._id} className="border-b hover:bg-slate-50 transition-colors">
                   <td className="p-4">
                     {(() => { const status = getEquipmentStatus(plc); const StatusIcon = status.Icon; return (
                       <div className="inline-flex flex-col gap-0.5 px-2.5 py-1.5 rounded-md border" style={{ color: status.color, background: status.background, borderColor: status.border }}>
                         <span className="inline-flex items-center gap-1 font-bold text-xs"><StatusIcon size={12} />{status.label}</span>
                         <span className="text-[10px] font-medium">{status.detail}</span>
                       </div>
                     ); })()}
                   </td>
                  <td className="p-4">
                    <p className="font-semibold text-slate-800">{plc.name}</p>
                    {plc.isSimulation && <span className="text-[10px] font-bold text-purple-600 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded mt-1 inline-flex items-center gap-1"><Sparkles size={10} /> SIM</span>}
                  </td>
                  <td className="p-4"><span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-1 rounded">{plc.protocol}</span></td>
                  <td className="p-4 font-mono text-slate-600">{plc.ipAddress}:{plc.port}</td>
                  <td className="p-4"><span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded-md">{plc.tagCount || 0}</span></td>
                  <td className="p-4 text-right flex items-center justify-end gap-1.5">
                    <TableActionButton variant={plc.isConnected ? 'orange' : 'green'} icon={plc.isConnected ? Pause : Play} onClick={() => handleStartStop(plc)} title={plc.isConnected ? 'Stop' : 'Start'} />
                    <TableActionButton variant="teal" icon={testingPLC === plc._id ? Loader2 : CheckCircle} onClick={() => handleTestConnection(plc)} title="Test Connection" disabled={testingPLC === plc._id} loading={testingPLC === plc._id} />
                    <TableActionButton variant="blue" icon={Edit2} onClick={() => handleOpenEdit(plc)} title="Edit" />
                    <TableActionButton variant="red" icon={Trash2} onClick={() => setDeleteId(plc._id)} title="Delete" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ═══════════ EQUIPMENT MODAL ═══════════ */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingPLC ? 'Edit Equipment' : 'Add Equipment'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-semibold mb-1">Machine Name *</label><input required name="name" value={formData.name} onChange={handleInputChange} className="w-full p-2 border rounded bg-slate-50 outline-none focus:border-blue-500" /></div>
            <div>
              <label className="block text-sm font-semibold mb-1">Protocol *</label>
              <select name="protocol" value={formData.protocol} onChange={handleInputChange} className="w-full p-2 border rounded bg-slate-50 outline-none focus:border-blue-500">
                <option value="S7">Siemens S7</option>
                <option value="MODBUS_TCP">Modbus TCP</option>
                <option value="OPC_UA">OPC-UA</option>
                <option value="ETHERNET_IP">Allen-Bradley (Ethernet/IP)</option>
                <option value="SIMULATION">Simulation Mode</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-semibold mb-1">IP Address</label><input name="ipAddress" value={formData.ipAddress} onChange={handleInputChange} className="w-full p-2 border rounded bg-slate-50 outline-none focus:border-blue-500" /></div>
            <div><label className="block text-sm font-semibold mb-1">Port</label><input type="number" name="port" value={formData.port} onChange={handleInputChange} className="w-full p-2 border rounded bg-slate-50 outline-none focus:border-blue-500" /></div>
          </div>
       <div className="grid grid-cols-4 gap-4">
             <div><label className="block text-sm font-semibold mb-1 text-slate-500">Rack (S7)</label><input type="number" name="rack" value={formData.rack} onChange={handleInputChange} className="w-full p-2 border rounded bg-slate-50 outline-none focus:border-blue-500" /></div>
              <div><label className="block text-sm font-semibold mb-1 text-slate-500">Slot (S7 / Allen-Bradley)</label><input type="number" min="0" name="slot" value={formData.slot} onChange={handleInputChange} className="w-full p-2 border rounded bg-slate-50 outline-none focus:border-blue-500" /></div>
             <div><label className="block text-sm font-semibold mb-1 text-slate-500">Unit ID (Modbus)</label><input type="number" min="0" max="255" name="unitId" value={formData.unitId ?? 1} onChange={handleInputChange} className="w-full p-2 border rounded bg-slate-50 outline-none focus:border-blue-500" /></div>
             <div><label className="block text-sm font-semibold mb-1 text-slate-500">Poll (ms)</label><input type="number" name="pollingRate" value={formData.pollingRate} onChange={handleInputChange} className="w-full p-2 border rounded bg-slate-50 outline-none focus:border-blue-500" /></div>
          </div>
          <button type="submit" className="w-full p-3 bg-blue-600 text-white font-bold rounded-lg mt-4 hover:bg-blue-700 transition-colors shadow-md">Save Equipment</button>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Remove Equipment?" message="Are you sure you want to delete this machine?" confirmText="Delete" confirmColor="red" icon="warning" />

      {/* ═══════════ DISCOVERY MODAL ═══════════ */}
      <Modal isOpen={showDiscoveryModal} onClose={() => { setShowDiscoveryModal(false); setScanning(false); setScanResults(null); }} title="Discover Equipment on Network" size="xl">
        <div className="space-y-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
            <p className="text-sm text-slate-600">The Factory Connector will rapidly probe local IPs for active industrial machines (Siemens, Modbus, OPC-UA, Ethernet/IP).</p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Start IP (Optional)</label>
                <input placeholder="e.g. 192.168.1.1" value={customRange.startIP} onChange={e => setCustomRange({ ...customRange, startIP: e.target.value })} disabled={scanning} className="w-full p-2 text-sm border rounded bg-white outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">End IP (Optional)</label>
                <input placeholder="e.g. 192.168.1.254" value={customRange.endIP} onChange={e => setCustomRange({ ...customRange, endIP: e.target.value })} disabled={scanning} className="w-full p-2 text-sm border rounded bg-white outline-none focus:border-blue-500" />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer pt-2">
              <input type="checkbox" checked={useDeepProbe} onChange={e => setUseDeepProbe(e.target.checked)} disabled={scanning} className="accent-teal-600 w-4 h-4" />
              <span className="text-sm font-bold text-slate-800">Use Deep Hardware Identification</span>
            </label>
          </div>

          {!scanResults && (
            <button onClick={handleStartScan} disabled={scanning} className={`w-full py-3 rounded-xl text-sm font-bold text-white shadow-md transition-all flex justify-center items-center gap-2 ${scanning ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
              {scanning ? <><Loader2 size={18} className="animate-spin" /> {PHASE_LABELS[scanPhase] || 'Scanning...'}</> : <><Radar size={18} /> Start Network Scan</>}
            </button>
          )}

          {scanResults && (
            <div className="space-y-4 animate-in fade-in zoom-in duration-300">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 border rounded-lg p-3 text-center"><p className="text-xl font-bold text-slate-800">{scanResults.scannedIPs}</p><p className="text-xs text-slate-500 font-semibold uppercase mt-1">IPs Scanned</p></div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center"><p className="text-xl font-bold text-emerald-700">{scanResults.devices?.length || 0}</p><p className="text-xs text-emerald-600 font-semibold uppercase mt-1">Machines Found</p></div>
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-center flex flex-col items-center justify-center">
                  {scanning ? <Loader2 size={24} className="animate-spin text-blue-500" /> : <CheckCircle size={24} className="text-blue-500" />}
                  <p className="text-xs text-blue-600 font-semibold uppercase mt-1">{scanning ? 'Scanning...' : 'Complete'}</p>
                </div>
              </div>

              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {scanResults.devices?.map((dev, i) => (
                  <div key={i} className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm hover:shadow-md transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{dev.ip}</span>
                          <span className="font-bold text-slate-800">{dev.vendorName}</span>
                          {dev.verified && <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full"><CheckCircle2 size={12} /> PORT: {dev.port}</span>}
                        </div>
                        {dev.deepInfo && (
                          <div className="text-xs text-slate-500 mt-2">
                            <p className="flex items-center gap-1"><Info size={12} /> {dev.deepInfo.model}</p>
                          </div>
                        )}
                      </div>
                      <ActionButton variant="primary" icon={Plus} onClick={() => handleAddDiscovered(dev)}>Add Device</ActionButton>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

    </div>
  );
};

const TableActionButton = ({ variant, icon: Icon, onClick, title, disabled, loading }) => {
  const v = {
    green: { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0', hover: '#DCFCE7' },
    orange: { bg: '#FFF7ED', color: '#EA580C', border: '#FED7AA', hover: '#FFEDD5' },
    blue: { bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE', hover: '#DBEAFE' },
    red: { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA', hover: '#FEE2E2' },
    teal: { bg: '#ECFEFF', color: '#0891B2', border: '#A5F3FC', hover: '#CFFAFE' },
  }[variant] || { bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE', hover: '#DBEAFE' };

  return (
    <button onClick={onClick} disabled={disabled} title={title} className="w-8 h-8 rounded-lg border flex items-center justify-center transition-colors"
      style={{ background: v.bg, color: v.color, borderColor: v.border, opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = v.hover; }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.background = v.bg; }}>
      <Icon size={14} className={loading ? 'animate-spin' : ''} />
    </button>
  );
};

export default PLCManagement;
