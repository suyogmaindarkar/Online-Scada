// ═══════════════════════════════════════════════════════════
// PLC Management — Simplified Factory Connector UI
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import { plcAPI, discoveryAPI } from '../services/api';
import api from '../services/api';
import socketService from '../services/socket';
import { useToast } from '../context/ToastContext';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import {
  Plus, Edit2, Trash2, Play, Pause, Cpu, Wifi, WifiOff, Loader2, Sparkles,
  Download, Upload, FileText, Search, Radar, CheckCircle2,
  RefreshCw, Zap, Server, CheckCircle, Network, FolderArchive, Info
} from 'lucide-react';

const C = {
  bg: '#F8FAFC', card: '#FFFFFF', cardSubtle: '#F8FAFC', cardHover: '#EEF6FF',
  border: '#E5E7EB', heading: '#081B43', text: '#334155', muted: '#5F6B7A',
  subtle: '#94A3B8', brand: '#2563EB', brandDark: '#0F3D91', btnPrimary: '#2563EB',
  btnHover: '#1D4ED8', success: '#16A34A', warning: '#F59E0B', danger: '#DC2626',
  purple: '#9333EA', purpleDark: '#6B21A8', teal: '#0891B2',
};

const ActionButton = ({ variant = 'primary', icon: Icon, children, onClick, disabled, loading, title }) => {
  const v = {
    primary: { bg: '#2563EB', bgHover: '#1D4ED8', color: '#FFFFFF', border: 'transparent', shadow: '0px 2px 8px rgba(37,99,235,0.25)' },
    amber: { bg: '#FFFFFF', bgHover: '#FEF3C7', color: '#D97706', border: '#F59E0B', shadow: 'none' },
    green: { bg: '#FFFFFF', bgHover: '#DCFCE7', color: '#16A34A', border: '#16A34A', shadow: 'none' },
    teal: { bg: '#FFFFFF', bgHover: '#CFFAFE', color: '#0E7490', border: '#0891B2', shadow: 'none' },
    emerald: { bg: '#10B981', bgHover: '#059669', color: '#FFFFFF', border: 'transparent', shadow: '0px 2px 8px rgba(16,185,129,0.30)' },
  }[variant] || { bg: '#2563EB', color: '#FFF', border: 'transparent' };

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

const PLCManagement = () => {
  const { showToast } = useToast();
  const [plcs, setPlcs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPLC, setEditingPLC] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const [gateway, setGateway] = useState(null);
  const [downloadingPackage, setDownloadingPackage] = useState(false);

  const [formData, setFormData] = useState({
    name: '', description: '', protocol: 'SIMULATION', ipAddress: '192.168.1.100', port: 502,
    rack: 0, slot: 0, brand: 'OTHER', pollingRate: 1000, opcuaUsername: '', opcuaPassword: ''
  });

  useEffect(() => {
    loadPLCs(); loadGateway();
    const statusInterval = setInterval(() => { loadPLCs(); loadGateway(); }, 8000);
    return () => clearInterval(statusInterval);
  }, []);

  const loadPLCs = async () => { try { const res = await plcAPI.getAll(); setPlcs(res.data.data); } catch (err) { } finally { setLoading(false); } };
  const loadGateway = async () => { try { const res = await api.get('/edge'); setGateway(res?.data?.data?.[0] || null); } catch (err) { } };

  const handleDownloadCompletePackage = async () => {
    try {
      setDownloadingPackage(true);
      let targetGateway = gateway;
      if (!targetGateway) {
        try { const createRes = await api.post('/edge', { name: 'Factory Connector' }); targetGateway = createRes.data?.data; setGateway(targetGateway); } catch (e) { }
      }
      if (!targetGateway) {
        const fetchRes = await api.get('/edge'); targetGateway = fetchRes?.data?.data?.[0]; setGateway(targetGateway);
      }

      const res = await api.get(`/edge/${targetGateway._id}/download-package`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `OnlineSCADA-Connector.zip`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      showToast('✅ Connector downloaded! Extract and double-click Start.bat', 'success', 8000);
      loadGateway();
    } catch (err) { showToast('❌ Download failed', 'error'); } finally { setDownloadingPackage(false); }
  };

  const handleOpenAdd = () => { setEditingPLC(null); setFormData({ name: '', description: '', protocol: 'SIMULATION', ipAddress: '192.168.1.100', port: 502, rack: 0, slot: 0, brand: 'OTHER', pollingRate: 1000, opcuaUsername: '', opcuaPassword: '' }); setShowModal(true); };
  const handleOpenEdit = (plc) => { setEditingPLC(plc); setFormData({ ...plc }); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPLC) await plcAPI.update(editingPLC._id, formData);
      else await plcAPI.create(formData);
      showToast(`PLC saved`, 'success'); setShowModal(false); loadPLCs(); loadGateway();
    } catch (err) { showToast('Operation failed', 'error'); }
  };

  const handleDelete = async () => { try { await plcAPI.delete(deleteId); setDeleteId(null); loadPLCs(); showToast('PLC deleted', 'success'); } catch (err) { showToast('Delete failed', 'error'); } };

  const handleInputChange = (e) => { const { name, value, type } = e.target; setFormData({ ...formData, [name]: type === 'number' ? parseInt(value) : value }); };

  const isGatewayOnline = gateway?.status === 'online';
  const nonSimPlcCount = plcs.filter(p => !p.isSimulation).length;

  return (
    <div className="space-y-4 font-sans text-slate-800">

      <div className="p-5 rounded-2xl bg-white border shadow-sm flex items-center justify-between">
        <div><h1 className="text-2xl font-bold" style={{ color: C.heading }}>Equipment Connections</h1><p className="text-sm text-slate-500">Manage PLCs and link your factory to the cloud</p></div>
        <ActionButton variant="primary" icon={Plus} onClick={handleOpenAdd}>Add Equipment</ActionButton>
      </div>

      {/* ═══ FACTORY CONNECTOR ═══ */}
      <div className="p-5 rounded-2xl" style={{
        background: isGatewayOnline ? '#F0FDF4' : '#FEF9C3',
        border: `1.5px solid ${isGatewayOnline ? '#86EFAC' : '#FDE68A'}`,
      }}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-start gap-4 flex-1">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white" style={{ background: isGatewayOnline ? '#10B981' : '#F59E0B' }}><Server size={22} /></div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-base">Factory Connector Link</h3>
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold" style={{ background: isGatewayOnline ? '#DCFCE7' : '#FEF3C7', color: isGatewayOnline ? '#15803D' : '#B45309' }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: isGatewayOnline ? '#16A34A' : '#F59E0B' }} />
                  {isGatewayOnline ? 'System is Online & Connected' : nonSimPlcCount === 0 ? 'Waiting for Equipment' : 'Offline - Setup Required'}
                </span>
              </div>
              <p className="text-sm text-slate-600">
                {isGatewayOnline ? `✅ Secure bridge is active. Reading from ${nonSimPlcCount} machine(s).`
                  : nonSimPlcCount === 0 ? `Add your machine (PLC) below, then download the Connector to link it securely.`
                    : `Download the Connector to link your ${nonSimPlcCount} machine(s) securely to the cloud. No installation needed!`}
              </p>
            </div>
          </div>
          <ActionButton variant="emerald" icon={Download} onClick={handleDownloadCompletePackage} disabled={downloadingPackage || nonSimPlcCount === 0} loading={downloadingPackage}>
            {downloadingPackage ? 'Preparing...' : 'Download Connector'}
          </ActionButton>
        </div>
      </div>

      {/* ═══ PLC TABLE ═══ */}
      <div className="rounded-2xl bg-white border shadow-sm">
        {loading ? <div className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" /></div> : plcs.length === 0 ? (
          <div className="py-16 text-center">
            <Cpu className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <h3 className="text-xl font-bold text-slate-800">No Equipment Added</h3>
            <p className="text-sm text-slate-500 mb-6">Click "Add Equipment" to connect your first machine.</p>
            <ActionButton variant="primary" icon={Plus} onClick={handleOpenAdd}>Add Equipment</ActionButton>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b text-xs text-slate-500 uppercase">
              <tr><th className="p-4">Status</th><th className="p-4">Name</th><th className="p-4">Protocol</th><th className="p-4">IP Address</th><th className="p-4 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {plcs.map(plc => (
                <tr key={plc._id} className="border-b hover:bg-slate-50">
                  <td className="p-4">{plc.isConnected ? <span className="text-green-600 font-bold text-xs">ONLINE</span> : <span className="text-slate-400 font-bold text-xs">OFFLINE</span>}</td>
                  <td className="p-4 font-semibold text-slate-800">{plc.name}</td>
                  <td className="p-4 text-xs font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block mt-2">{plc.protocol}</td>
                  <td className="p-4 font-mono text-sm">{plc.ipAddress}:{plc.port}</td>
                  <td className="p-4 text-right">
                    <button onClick={() => handleOpenEdit(plc)} className="p-2 text-blue-600 hover:bg-blue-100 rounded mr-2"><Edit2 size={16} /></button>
                    <button onClick={() => setDeleteId(plc._id)} className="p-2 text-red-600 hover:bg-red-100 rounded"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingPLC ? 'Edit Equipment' : 'Add Equipment'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-semibold mb-1">Machine Name *</label><input required name="name" value={formData.name} onChange={handleInputChange} className="w-full p-2 border rounded bg-slate-50" /></div>
            <div>
              <label className="block text-sm font-semibold mb-1">Protocol *</label>
              <select name="protocol" value={formData.protocol} onChange={handleInputChange} className="w-full p-2 border rounded bg-slate-50">
                <option value="S7">Siemens S7</option>
                <option value="MODBUS_TCP">Modbus TCP</option>
                <option value="OPC_UA">OPC-UA</option>
                <option value="ETHERNET_IP">Allen-Bradley (Ethernet/IP)</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-semibold mb-1">IP Address</label><input name="ipAddress" value={formData.ipAddress} onChange={handleInputChange} className="w-full p-2 border rounded bg-slate-50" /></div>
            <div><label className="block text-sm font-semibold mb-1">Port</label><input type="number" name="port" value={formData.port} onChange={handleInputChange} className="w-full p-2 border rounded bg-slate-50" /></div>
          </div>
          <button type="submit" className="w-full p-3 bg-blue-600 text-white font-bold rounded-lg mt-4 hover:bg-blue-700">Save Equipment</button>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Remove Equipment?" message="Are you sure you want to delete this machine?" confirmText="Delete" confirmColor="red" icon="warning" />
    </div>
  );
};
export default PLCManagement;