// ═══════════════════════════════════════════════════════════
// PLC Management — Professional UI (Emoji-Free)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';
import { plcAPI, equipmentAPI, discoveryAPI } from '../services/api';
import { isEquipmentEnabled, mergeEquipmentStatus, selectConnector, isTerminalScan, matchesCommand } from '../utils/equipmentState.mjs';
import api from '../services/api';
import socketService from '../services/socket';
import { useToast } from '../context/ToastContext';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import FactoryConnectorSetup from '../components/FactoryConnectorSetup';
import {
  Plus, Edit2, Trash2, Play, Pause, Cpu, Wifi, WifiOff, Loader2, Sparkles,
  Download, Radar, Signal, SignalLow, CheckCircle2, Server, CheckCircle,
  Info, Key, MapPin, Monitor, AlertCircle
} from 'lucide-react';

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
  idle: 'Idle', queued: 'Waiting for connector...', pinging: 'Preparing scan...', probing: 'Checking equipment protocols...',
  done: 'Scan complete', cancelled: 'Scan cancelled', failed: 'Scan failed',
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

  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanPhase, setScanPhase] = useState('idle');
  const [scanResults, setScanResults] = useState(null);
  const [scanMessage, setScanMessage] = useState('');
  const [cancellingScan, setCancellingScan] = useState(false);
  const scanIdRef = useRef(null);
  const scanStartedRef = useRef(0);
  const scanPollErrorsRef = useRef(0);
  const [customRange, setCustomRange] = useState({ startIP: '', endIP: '' });
  const [useDeepProbe, setUseDeepProbe] = useState(true);

  const [gateway, setGateway] = useState(null);
  const [testingPLC, setTestingPLC] = useState(null);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [commandingId, setCommandingId] = useState(null);
  const pendingCommandRef = useRef(null);
  const commandTimerRef = useRef(null);
  const liveStatusesRef = useRef(new Map());

  const [formData, setFormData] = useState({
    name: '', description: '', protocol: 'OPC_UA', transportProtocol: 'OPC_UA', gatewayDeviceAddress: '', ipAddress: '192.168.1.100', port: 4840,
    rack: 0, slot: 0, unitId: 1, brand: 'OTHER', pollingRate: 1000, opcuaUsername: '', opcuaPassword: ''
  });

  const loadPLCs = useCallback(async () => {
    try {
      const res = await plcAPI.getAll();
      const incoming = res.data.data || [];
      setPlcs(incoming.map((plc) => mergeEquipmentStatus(plc, liveStatusesRef.current.get(plc._id))));
    } catch { /* Keep the last confirmed list during transient failures. */ }
    finally { setLoading(false); }
  }, []);
  const loadGateway = useCallback(async () => {
    try { const res = await api.get('/edge'); setGateway(selectConnector(res?.data?.data || [])); }
    catch { /* Retry on the next status refresh. */ }
  }, []);

  useEffect(() => {
    const initialLoad = setTimeout(() => { loadPLCs(); loadGateway(); }, 0);
    const handlePlcStatus = (data) => {
      if (!data?.plcId) return;
      const live = { ...data, receivedAt: Date.now() };
      liveStatusesRef.current.set(data.plcId, live);
      setPlcs(prev => prev.map(p => p._id === data.plcId ? mergeEquipmentStatus({ ...p, connectionState: data.state }, live) : p));
    };
    socketService.on('plcStatus', handlePlcStatus);
    const handleCommandResult = (data) => {
      if (!matchesCommand(pendingCommandRef.current, data)) return;
      const label = data.action === 'start' ? 'Start' : data.action === 'stop' ? 'Stop' : 'Restart';
      if (data.success) showToast(`${label} confirmed: ${data.message || 'equipment OK'}`, 'success', 5000);
      else showToast(`${label} failed: ${data.error || data.message || 'unknown error'}`, 'error', 7000);
      clearTimeout(commandTimerRef.current);
      pendingCommandRef.current = null;
      setCommandingId(null);
      loadPLCs();
    };
    socketService.on('equipmentCommandResult', handleCommandResult);
    const statusInterval = setInterval(() => { loadPLCs(); loadGateway(); }, 8000);
    return () => {
      socketService.off('plcStatus', handlePlcStatus);
      socketService.off('equipmentCommandResult', handleCommandResult);
      clearInterval(statusInterval);
      clearTimeout(initialLoad);
      clearTimeout(commandTimerRef.current);
    };
  }, [loadPLCs, loadGateway, showToast]);

  // Poll for Discovery Progress via HTTP to circumvent complex socket namespace routing
  useEffect(() => {
    if (!scanning) return;
    const interval = setInterval(async () => {
      try {
        if (Date.now() - scanStartedRef.current > 130000) {
          setScanning(false); setScanPhase('failed'); setScanMessage('Discovery timed out. Check that the connector is online.'); return;
        }
        if (!scanIdRef.current) return;
        const res = await discoveryAPI.getProgress();
        if (res.data) {
          if (scanIdRef.current && res.data.scanId !== scanIdRef.current) return;
          setScanPhase(res.data.phase);
          setScanMessage(res.data.message || '');
          scanPollErrorsRef.current = 0;
          if (res.data.devices) {
            setScanResults({
              scannedIPs: res.data.scannedIPs,
              aliveHosts: res.data.aliveHosts,
              devices: res.data.devices
            });
          }
          if (isTerminalScan(res.data.phase)) {
            setScanning(false);
            showToast(res.data.message || PHASE_LABELS[res.data.phase], res.data.phase === 'failed' ? 'error' : 'info');
          }
        }
      } catch {
        if (++scanPollErrorsRef.current >= 3) {
          setScanning(false); setScanPhase('failed'); setScanMessage('Unable to read discovery progress. Check your connection and try again.');
        }
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [scanning, showToast]);

  const handleDownloadInstaller = () => {
    const link = document.createElement('a');
    link.href = import.meta.env.VITE_CONNECTOR_INSTALLER_URL || '/OnlineSCADA-Factory-Connector-Setup.exe';
    link.download = 'OnlineSCADA-Factory-Connector-Setup.exe';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link); link.click(); link.remove();
  };

  const handleOpenAdd = () => { setEditingPLC(null); setFormData({ name: '', description: '', protocol: 'OPC_UA', transportProtocol: 'OPC_UA', gatewayDeviceAddress: '', ipAddress: '192.168.1.100', port: 4840, rack: 0, slot: 0, unitId: 1, brand: 'OTHER', pollingRate: 1000, opcuaUsername: '', opcuaPassword: '' }); setShowModal(true); };
  const handleOpenEdit = (plc) => { setEditingPLC(plc); setFormData({ ...plc }); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPLC) await plcAPI.update(editingPLC._id, formData);
      else await plcAPI.create(formData);
      showToast('Equipment saved', 'success'); setShowModal(false); loadPLCs(); loadGateway();
    } catch { showToast('Operation failed', 'error'); }
  };

  const handleDelete = async () => { try { await plcAPI.delete(deleteId); setDeleteId(null); loadPLCs(); showToast('Deleted successfully', 'success'); } catch { showToast('Delete failed', 'error'); } };

  const handleStartStop = async (plc) => {
    if (pendingCommandRef.current) return;
    const action = isEquipmentEnabled(plc) ? 'stop' : 'start';
    const pending = { equipmentId: plc._id, action, requestId: null };
    pendingCommandRef.current = pending;
    liveStatusesRef.current.delete(plc._id);
    try {
      setCommandingId(plc._id);
      const res = await equipmentAPI[action](plc._id);
      const d = res?.data;
      if (d?.code === 'CONNECTOR_OFFLINE') {
        showToast(d.message || 'Factory Connector is offline. Start it first.', 'warning', 7000);
        setShowSetupModal(true);
      } else if (d?.success) {
        showToast(d.message || 'Command sent to connector', 'info', 5000);
        if (typeof d.data?.isActive === 'boolean') {
          setPlcs(current => current.map(p => p._id === plc._id ? { ...p, isActive: d.data.isActive, isConnected: false, connectionState: d.data.isActive ? 'pending' : 'stopped' } : p));
        }
        if (d.data?.requestId && pendingCommandRef.current === pending) {
          pending.requestId = d.data.requestId;
          commandTimerRef.current = setTimeout(() => {
            pendingCommandRef.current = null; setCommandingId(null);
            showToast('Command confirmation timed out. Refreshing equipment status.', 'warning'); loadPLCs();
          }, 18000);
        } else if (!d.data?.requestId) pendingCommandRef.current = null;
      } else {
        showToast(d?.message || 'Command could not be delivered', 'error', 6000);
      }
      setTimeout(loadPLCs, 1200);
      if (!d?.success) pendingCommandRef.current = null;
    } catch (err) { pendingCommandRef.current = null; showToast(err.response?.data?.message || 'Operation failed', 'error'); }
    finally { if (!pendingCommandRef.current?.requestId) { pendingCommandRef.current = null; setCommandingId(null); } }
  };

  const handleTestConnection = async (plc) => {
    try {
      setTestingPLC(plc._id);
      const res = await plcAPI.testConnection(plc._id);
      if (res.data.success && res.data?.data?.connected) { showToast(`Connection test successful`, 'success', 5000); setTimeout(loadPLCs, 500); }
      else { showToast(`Test failed: ${res.data?.data?.error || 'Error'}`, 'error', 5000); }
    } catch (err) { showToast(err.response?.data?.message || 'Could not test the equipment connection', 'error'); } finally { setTestingPLC(null); }
  };

  const handleInputChange = (e) => { const { name, value, type } = e.target; setFormData({ ...formData, [name]: type === 'number' ? parseInt(value) : value }); };

  const handleStartScan = async () => {
    setScanning(true);
    setScanPhase('queued');
    setScanResults(null);
    setScanMessage('');
    scanIdRef.current = null;
    scanStartedRef.current = Date.now();
    scanPollErrorsRef.current = 0;
    try {
      const res = await discoveryAPI.startScan({
        startIP: customRange.startIP,
        endIP: customRange.endIP,
        deepProbe: useDeepProbe,
        gatewayId: gateway?._id,
      });
      scanIdRef.current = res.data.scanId;
      setScanPhase(res.data.phase);
      setScanResults(res.data);
      showToast('Scan instruction pushed to Factory Connector', 'info');
    } catch (err) {
      setScanning(false);
      setScanPhase('failed');
      setScanMessage(err.response?.data?.message || 'Failed to initiate scan');
      showToast(err.response?.data?.message || 'Failed to initiate scan', 'error');
    }
  };

  const handleCancelScan = async () => {
    setCancellingScan(true);
    try {
      const res = await discoveryAPI.cancelScan();
      setScanPhase(res.data.phase); setScanMessage(res.data.message || 'Scan cancelled'); setScanning(false);
    } catch (err) { showToast(err.response?.data?.message || 'Could not cancel discovery', 'error'); }
    finally { setCancellingScan(false); }
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
        <div><h1 className="text-2xl font-bold text-slate-900">Equipment Connections</h1><p className="text-sm text-slate-500 mt-1">Manage equipment and link your factory to the cloud</p></div>
        <div className="flex items-center gap-2 flex-wrap">
          <ActionButton variant="teal" icon={Radar} onClick={() => setShowDiscoveryModal(true)} disabled={!isGatewayOnline} title={!isGatewayOnline ? "Connector must be online to scan local network" : ""}>Discover</ActionButton>
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
                <h3 className="font-bold text-base text-slate-900">PLC Connector Link</h3>
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold" style={{ background: isGatewayOnline ? '#DCFCE7' : '#FEF3C7', color: isGatewayOnline ? '#15803D' : '#B45309' }}>
                  {isGatewayOnline ? <CheckCircle size={12} strokeWidth={3} /> : <AlertCircle size={12} strokeWidth={3} />}
                  {isGatewayOnline ? 'System is Online & Connected' : nonSimPlcCount === 0 ? 'Ready for Download' : 'Offline - Setup Required'}
                </span>
              </div>
              <p className="text-sm text-slate-700">
                {isGatewayOnline ? (
                  <span className="flex items-center gap-1"><CheckCircle2 size={14} className="text-emerald-600" /> Secure bridge active. <strong>{nonSimPlcCount} equipment connection(s)</strong> configured.</span>
                ) : nonSimPlcCount === 0 ? (
                  `Download the Connector to enable Network Discovery, or add your machine manually below.`
                ) : (
                  `Install the connector on your factory computer to link your ${nonSimPlcCount} equipment connection(s) securely to the cloud.`
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
          <div className="flex items-center gap-2 flex-wrap">
            <ActionButton variant="emerald" icon={Download} onClick={handleDownloadInstaller}>
              Download Connector
            </ActionButton>
          </div>
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
                    <TableActionButton variant={isEquipmentEnabled(plc) ? 'orange' : 'green'} icon={commandingId === plc._id ? Loader2 : isEquipmentEnabled(plc) ? Pause : Play} onClick={() => handleStartStop(plc)} title={isEquipmentEnabled(plc) ? 'Stop equipment polling' : 'Start equipment polling'} disabled={commandingId !== null || testingPLC === plc._id} loading={commandingId === plc._id} />
                    <TableActionButton variant="teal" icon={testingPLC === plc._id ? Loader2 : CheckCircle} onClick={() => handleTestConnection(plc)} title="Test connection from factory computer" disabled={testingPLC !== null || commandingId === plc._id} loading={testingPLC === plc._id} />
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
                 <option value="PROFIBUS_GATEWAY">Profibus via Gateway</option>
                  {editingPLC?.isSimulation && <option value="SIMULATION">Existing simulation</option>}
              </select>
            </div>
          </div>
          {formData.protocol === 'PROFIBUS_GATEWAY' && <div className="p-3 rounded-lg border border-blue-200 bg-blue-50 space-y-3">
            <p className="text-xs text-blue-800">Profibus requires an industrial gateway that exposes data through OPC UA, Modbus TCP, or Ethernet/IP.</p>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-semibold mb-1">Gateway Transport *</label><select required name="transportProtocol" value={formData.transportProtocol || 'OPC_UA'} onChange={handleInputChange} className="w-full p-2 border rounded bg-white"><option value="OPC_UA">OPC UA</option><option value="MODBUS_TCP">Modbus TCP</option><option value="ETHERNET_IP">Ethernet/IP</option></select></div>
              <div><label className="block text-sm font-semibold mb-1">Profibus Device Address</label><input name="gatewayDeviceAddress" value={formData.gatewayDeviceAddress || ''} onChange={handleInputChange} placeholder="Device or mapped tag prefix" className="w-full p-2 border rounded bg-white" /></div>
            </div>
          </div>}
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

      <FactoryConnectorSetup open={showSetupModal} onClose={() => setShowSetupModal(false)} gateway={gateway} onRefresh={loadGateway} />

      {/* ═══════════ DISCOVERY MODAL ═══════════ */}
      <Modal isOpen={showDiscoveryModal} onClose={() => setShowDiscoveryModal(false)} title="Discover Equipment on Network" size="xl">
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
              <span className="text-sm font-bold text-slate-800">Verify industrial protocol responses</span>
            </label>
          </div>

          {!scanning && (
            <button onClick={handleStartScan} disabled={scanning} className={`w-full py-3 rounded-xl text-sm font-bold text-white shadow-md transition-all flex justify-center items-center gap-2 ${scanning ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
              {scanning ? <><Loader2 size={18} className="animate-spin" /> {PHASE_LABELS[scanPhase] || 'Scanning...'}</> : <><Radar size={18} /> Start Network Scan</>}
            </button>
          )}

          {scanning && <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800"><span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" />{PHASE_LABELS[scanPhase] || 'Scanning...'}</span><button type="button" onClick={handleCancelScan} disabled={cancellingScan} className="font-semibold underline disabled:opacity-50">{cancellingScan ? 'Cancelling...' : 'Cancel scan'}</button></div>}
          {scanMessage && <p role="status" className={`rounded-lg border p-3 text-sm ${scanPhase === 'failed' ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>{scanMessage}</p>}

          {scanResults && (
            <div className="space-y-4 animate-in fade-in zoom-in duration-300">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 border rounded-lg p-3 text-center"><p className="text-xl font-bold text-slate-800">{scanResults.scannedIPs}</p><p className="text-xs text-slate-500 font-semibold uppercase mt-1">IPs Scanned</p></div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center"><p className="text-xl font-bold text-emerald-700">{scanResults.devices?.length || 0}</p><p className="text-xs text-emerald-600 font-semibold uppercase mt-1">Machines Found</p></div>
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-center flex flex-col items-center justify-center">
                  {scanning ? <Loader2 size={24} className="animate-spin text-blue-500" /> : <CheckCircle size={24} className="text-blue-500" />}
                  <p className="text-xs text-blue-600 font-semibold uppercase mt-1">{PHASE_LABELS[scanPhase] || scanPhase}</p>
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
                          <span className="flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">{dev.confirmed ? 'Protocol verified' : 'Open port candidate'} · {dev.port}</span>
                        </div>
                        {dev.deepInfo && (
                          <div className="text-xs text-slate-500 mt-2">
                            <p className="flex items-center gap-1"><Info size={12} /> {dev.deepInfo.model}</p>
                          </div>
                        )}
                      </div>
                      <ActionButton variant="primary" icon={Plus} onClick={() => handleAddDiscovered(dev)} disabled={scanning}>Add Equipment</ActionButton>
                    </div>
                  </div>
                ))}
              </div>
              {!scanning && scanPhase === 'done' && scanResults.devices?.length === 0 && <p className="text-sm text-slate-600">No industrial protocols found. Check the factory computer's network adapter, equipment IP range and firewall, or add equipment manually.</p>}
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
