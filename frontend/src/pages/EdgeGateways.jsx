// ═══════════════════════════════════════════════════════════
// Edge Gateways Dashboard Page (With Dual Download Buttons)
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import {
    Network, CheckCircle, XCircle, RefreshCw, Key, Download, Trash2, Plus,
    HelpCircle, AlertTriangle, ShieldAlert, Cpu, HardDrive, Activity,
    Play, FileJson, Zap, FolderArchive, ArrowRight
} from 'lucide-react';
import api from '../services/api';

const C = {
    bg: '#F8FAFC',
    card: '#FFFFFF',
    cardSubtle: '#F8FAFC',
    border: '#E5E7EB',
    heading: '#081B43',
    text: '#334155',
    muted: '#5F6B7A',
    subtle: '#94A3B8',
    brand: '#2563EB',
    brandDark: '#0F3D91',
    btnPrimary: '#2563EB',
    btnHover: '#1D4ED8',
    success: '#16A34A',
    warning: '#F59E0B',
    danger: '#DC2626',
};

const Toast = ({ message, type, onClose }) => (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium min-w-[280px] bg-white border shadow-lg"
        style={{ borderColor: C.border }}>
        {type === 'success' ? <CheckCircle size={16} style={{ color: C.success }} /> :
            type === 'error' ? <XCircle size={16} style={{ color: C.danger }} /> :
                <AlertTriangle size={16} style={{ color: C.warning }} />}
        <span style={{ color: C.heading }}>{message}</span>
        <button onClick={onClose} className="ml-auto text-xs" style={{ color: C.subtle }}>×</button>
    </div>
);

const EdgeGateways = () => {
    const [gateways, setGateways] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [toast, setToast] = useState(null);

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showWizardModal, setShowWizardModal] = useState(false);
    const [selectedGatewayForWizard, setSelectedGatewayForWizard] = useState(null);
    const [showKeyRevealModal, setShowKeyRevealModal] = useState(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [rotateConfirmId, setRotateConfirmId] = useState(null);
    const [newGatewayName, setNewGatewayName] = useState('');
    const [createLoading, setCreateLoading] = useState(false);

    let isAdmin = false;
    try {
        const rawData = localStorage.getItem('userData') || localStorage.getItem('user');
        if (rawData && rawData !== 'undefined') {
            const currentUser = JSON.parse(rawData);
            isAdmin = currentUser?.role === 'admin';
        }
    } catch (e) {
        console.warn("User data parse error", e);
    }

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    };

    const fetchGateways = async (silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);
        try {
            const res = await api.get('/edge');
            setGateways(res?.data?.data || []);
        } catch (err) {
            console.error(err);
            showToast('Failed to fetch edge gateways', 'error');
            setGateways([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchGateways();
        const interval = setInterval(() => fetchGateways(true), 15000);
        return () => clearInterval(interval);
    }, []);

    const handleCreateGateway = async (e) => {
        e.preventDefault();
        if (!newGatewayName.trim()) return;

        setCreateLoading(true);
        try {
            const res = await api.post('/edge', { name: newGatewayName.trim() });
            const created = res.data.data;

            setShowCreateModal(false);
            setNewGatewayName('');
            setShowKeyRevealModal({ name: created.name, rawKey: created.apiKey });

            fetchGateways();
            showToast('Gateway profile generated successfully');
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to create gateway profile';
            showToast(msg, 'error');
        } finally {
            setCreateLoading(false);
        }
    };

    const handleRegenerateKey = async (id) => {
        try {
            const res = await api.post(`/edge/${id}/regenerate-key`);
            const updated = res.data.data;
            setRotateConfirmId(null);
            setShowKeyRevealModal({ name: updated.name, rawKey: updated.apiKey });
            fetchGateways();
            showToast('API Key rotated successfully.');
        } catch (err) {
            showToast('Failed to rotate API Key', 'error');
        }
    };

    const handleDeleteGateway = async (id) => {
        try {
            await api.delete(`/edge/${id}`);
            setDeleteConfirmId(null);
            fetchGateways();
            showToast('Gateway profile deleted');
        } catch (err) {
            showToast('Failed to delete gateway profile', 'error');
        }
    };

    const downloadConfig = async (gateway, rawKey = null) => {
        try {
            const query = rawKey ? `?apiKey=${rawKey}` : '';
            const res = await api.get(`/edge/${gateway._id}/config${query}`);
            const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `config.json`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('config.json downloaded');
        } catch (err) {
            showToast('Failed to download config file', 'error');
        }
    };

    return (
        <div className="h-full flex flex-col overflow-hidden" style={{ background: C.bg }}>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* ─── HEADER ─── */}
            <div className="px-6 py-5 flex-shrink-0 bg-white border-b" style={{ borderColor: C.border }}>
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                            style={{ background: `linear-gradient(135deg, ${C.brand} 0%, ${C.brandDark} 100%)` }}>
                            <Network size={20} />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold" style={{ color: C.heading }}>Edge Gateways</h1>
                            <p className="text-xs" style={{ color: C.subtle }}>Connect physical factory PLCs securely to OnlineSCADA</p>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button onClick={() => fetchGateways(true)} disabled={refreshing}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-white border transition-all hover:bg-slate-50 cursor-pointer">
                            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                            {refreshing ? 'Refreshing...' : 'Refresh'}
                        </button>
                        {isAdmin && (
                            <button onClick={() => setShowCreateModal(true)}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90 cursor-pointer"
                                style={{ background: C.btnPrimary }}>
                                <Plus size={14} /> Create Gateway Profile
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ─── MAIN CONTENT ─── */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-7xl mx-auto">

                    <div className="rounded-2xl p-5 mb-6 flex gap-4 border bg-blue-50/50" style={{ borderColor: '#BFDBFE' }}>
                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm shrink-0">
                            <Zap size={20} style={{ color: C.brand }} />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold" style={{ color: C.heading }}>How Factory PLC Tunnels Work</h4>
                            <p className="text-xs mt-1 leading-relaxed" style={{ color: C.text }}>
                                The <strong>OnlineSCADA Edge Gateway</strong> runs silently on any PC inside your factory network. It reads data from your PLCs (Siemens S7, Modbus, OPC-UA) and streams live tag updates to this website. <strong>Zero router or firewall changes required!</strong>
                            </p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="py-20 text-center">
                            <RefreshCw size={40} className="animate-spin mx-auto mb-4" style={{ color: C.brand }} />
                            <p style={{ color: C.muted }}>Loading gateway profiles...</p>
                        </div>
                    ) : (gateways || []).length === 0 ? (
                        <div className="py-20 text-center rounded-2xl bg-white border" style={{ borderColor: C.border }}>
                            <Network size={48} className="mx-auto mb-4" style={{ color: C.subtle }} />
                            <h3 className="font-bold text-lg" style={{ color: C.heading }}>No Edge Gateways Configured</h3>
                            <p className="text-sm mt-1 mb-6 max-w-md mx-auto" style={{ color: C.muted }}>
                                Create a gateway profile to connect physical factory PLCs to your OnlineSCADA account.
                            </p>
                            {isAdmin && (
                                <button onClick={() => setShowCreateModal(true)}
                                    className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white transition-all cursor-pointer"
                                    style={{ background: C.btnPrimary }}>
                                    Create Gateway Profile
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {gateways.map((gw) => {
                                const isOnline = gw.status === 'online';
                                const isNever = gw.status === 'never_connected';

                                return (
                                    <div key={gw._id} className="rounded-2xl bg-white border p-6 flex flex-col" style={{ borderColor: C.border }}>
                                        <div className="flex items-start justify-between mb-4">
                                            <div>
                                                <h3 className="font-bold text-base">{gw.name}</h3>
                                                <p className="text-xs font-mono mt-0.5" style={{ color: C.subtle }}>ID: {gw._id}</p>
                                            </div>
                                            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
                                                style={{
                                                    backgroundColor: isOnline ? '#DCFCE7' : isNever ? '#F1F5F9' : '#FEE2E2',
                                                    color: isOnline ? C.success : isNever ? C.subtle : C.danger
                                                }}>
                                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: isOnline ? C.success : isNever ? C.subtle : C.danger }} />
                                                {isOnline ? 'ONLINE' : isNever ? 'NEVER CONNECTED' : 'OFFLINE'}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 py-3 border-t border-b text-xs mb-4 bg-slate-50" style={{ borderColor: C.border }}>
                                            <div><p style={{ color: C.muted }}>API Key Prefix:</p><p className="font-mono font-bold">{gw.apiKeyPrefix}</p></div>
                                            <div><p style={{ color: C.muted }}>Factory IP:</p><p className="font-mono font-bold">{gw.ipAddress || '—'}</p></div>
                                        </div>

                                        {isOnline && gw.stats && (
                                            <div className="p-4 rounded-xl mb-4 border bg-slate-50" style={{ borderColor: C.border }}>
                                                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: C.muted }}>Live Telemetry</p>
                                                <div className="grid grid-cols-3 gap-3 text-center">
                                                    <div><Activity size={14} className="mx-auto mb-1" style={{ color: C.brand }} /><p className="font-bold text-sm">{gw.stats.tagsReadPerSecond}/s</p><p className="text-[10px]">Read Rate</p></div>
                                                    <div><Cpu size={14} className="mx-auto mb-1" style={{ color: C.brand }} /><p className="font-bold text-sm">{gw.stats.cpuPercent}%</p><p className="text-[10px]">CPU Load</p></div>
                                                    <div><HardDrive size={14} className="mx-auto mb-1" style={{ color: C.brand }} /><p className="font-bold text-sm">{gw.stats.memoryUsageMB}MB</p><p className="text-[10px]">Mem Heap</p></div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex gap-2 mt-auto pt-4 border-t" style={{ borderColor: C.border }}>
                                            <button onClick={() => { setSelectedGatewayForWizard(gw); setShowWizardModal(true); }}
                                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold text-white transition-all cursor-pointer shadow-sm"
                                                style={{ background: C.btnPrimary }}>
                                                <HelpCircle size={15} /> Easy Setup Guide
                                            </button>
                                            <button onClick={() => downloadConfig(gw)} className="p-2.5 rounded-xl border hover:bg-slate-50 cursor-pointer flex items-center gap-1 text-xs font-medium" style={{ color: C.text }} title="Download config.json">
                                                <FileJson size={15} /> Config
                                            </button>
                                            {isAdmin && (
                                                <>
                                                    <button onClick={() => setRotateConfirmId(gw._id)} className="p-2.5 rounded-xl border hover:bg-slate-50 text-amber-500 cursor-pointer" title="Rotate Key"><Key size={15} /></button>
                                                    <button onClick={() => setDeleteConfirmId(gw._id)} className="p-2.5 rounded-xl border hover:bg-slate-50 text-red-600 cursor-pointer" title="Delete"><Trash2 size={15} /></button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ─── MODAL: EASY SETUP GUIDE (WITH BOTH DOWNLOAD BUTTONS) ─── */}
            {showWizardModal && selectedGatewayForWizard && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-2xl mx-4 border flex flex-col max-h-[85vh] overflow-hidden shadow-2xl" style={{ borderColor: C.border }}>

                        <div className="flex items-center justify-between mb-4 shrink-0">
                            <div className="flex items-center gap-2">
                                <Network size={22} style={{ color: C.brand }} />
                                <h3 className="font-bold text-lg" style={{ color: C.heading }}>Connect Factory PLCs (3 Easy Steps)</h3>
                            </div>
                            <button onClick={() => setShowWizardModal(false)} className="text-xl font-bold hover:text-slate-600 cursor-pointer" style={{ color: C.subtle }}>×</button>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 space-y-4">

                            {/* STEP 1: DOWNLOAD GATEWAY APP ZIP */}
                            <div className="flex gap-4 p-4 rounded-2xl bg-blue-50/60 border border-blue-200">
                                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
                                    1
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-sm font-bold" style={{ color: C.heading }}>Download Gateway Application (.zip)</h4>
                                    <p className="text-xs mt-1 leading-relaxed" style={{ color: C.muted }}>
                                        Download the pre-packaged Gateway app ZIP file to the computer on your factory network.
                                    </p>
                                    <a href="/OnlineSCADA-Gateway.zip" download
                                        className="inline-flex items-center gap-2 mt-3 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-sm">
                                        <FolderArchive size={16} /> Download Gateway App (.zip)
                                    </a>
                                </div>
                            </div>

                            {/* STEP 2: DOWNLOAD CONFIG.JSON */}
                            <div className="flex gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
                                    2
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-sm font-bold" style={{ color: C.heading }}>Download Configuration File (config.json)</h4>
                                    <p className="text-xs mt-1 leading-relaxed" style={{ color: C.muted }}>
                                        Download your personalized configuration file and place it inside the extracted Gateway folder.
                                    </p>
                                    <button onClick={() => downloadConfig(selectedGatewayForWizard)}
                                        className="flex items-center gap-2 mt-3 px-4 py-2.5 rounded-xl text-xs font-bold text-blue-600 bg-white border border-blue-300 hover:bg-blue-50 transition-all cursor-pointer shadow-sm">
                                        <FileJson size={16} /> Download config.json
                                    </button>
                                </div>
                            </div>

                            {/* STEP 3: RUN THE GATEWAY */}
                            <div className="flex gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
                                    3
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-sm font-bold" style={{ color: C.heading }}>Double-Click "Start-Gateway.bat"</h4>
                                    <p className="text-xs mt-1 leading-relaxed" style={{ color: C.muted }}>
                                        Extract <code>OnlineSCADA-Gateway.zip</code>, move <code>config.json</code> into that folder, and double-click <strong>Start-Gateway.bat</strong>. It connects to your PLCs automatically!
                                    </p>
                                    <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                                        <Play size={14} /> Zero setup required!
                                    </div>
                                </div>
                            </div>

                        </div>

                        <button onClick={() => setShowWizardModal(false)}
                            className="w-full mt-6 py-2.5 rounded-xl text-xs font-bold text-white cursor-pointer shrink-0"
                            style={{ background: C.btnPrimary }}>
                            Got It, Close Guide
                        </button>
                    </div>
                </div>
            )}

            {/* ─── OTHER MODALS ─── */}
            {showCreateModal && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <form onSubmit={handleCreateGateway} className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 border">
                        <h3 className="font-bold text-lg mb-2">Create Gateway Profile</h3>
                        <div className="mb-4">
                            <label className="block text-xs font-bold mb-1.5">Gateway Name</label>
                            <input type="text" required value={newGatewayName} onChange={(e) => setNewGatewayName(e.target.value)} placeholder="e.g. Plant 1 Gateway" className="w-full px-3 py-2 rounded-xl text-sm border" />
                        </div>
                        <div className="flex gap-3">
                            <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 py-2.5 rounded-xl text-xs border">Cancel</button>
                            <button type="submit" disabled={createLoading} className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white bg-blue-600">{createLoading ? 'Generating...' : 'Create'}</button>
                        </div>
                    </form>
                </div>
            )}

            {showKeyRevealModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-lg mx-4">
                        <div className="flex items-center gap-3 mb-4 text-amber-600"><ShieldAlert size={28} /><div><h3 className="font-bold text-lg">Secure Gateway Key</h3></div></div>
                        <p className="text-xs mb-3 text-slate-600">Save this secret key securely. It connects your gateway to the cloud:</p>
                        <div className="rounded-xl p-4 font-mono text-sm flex gap-3 mb-4 bg-amber-50 border border-amber-200 text-amber-700">
                            <span className="flex-1 break-all font-bold">{showKeyRevealModal.rawKey}</span>
                        </div>
                        <button onClick={() => setShowKeyRevealModal(null)} className="w-full py-2.5 rounded-xl text-xs font-semibold text-white bg-blue-600">I Have Saved the Key</button>
                    </div>
                </div>
            )}

            {rotateConfirmId && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4"><h3 className="font-bold mb-4">Rotate API Key?</h3><button onClick={() => handleRegenerateKey(rotateConfirmId)} className="w-full py-2 bg-amber-500 text-white rounded-xl">Confirm Rotate</button><button onClick={() => setRotateConfirmId(null)} className="w-full py-2 mt-2 border rounded-xl">Cancel</button></div>
                </div>
            )}
            {deleteConfirmId && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4"><h3 className="font-bold mb-4 text-red-600">Delete Gateway?</h3><button onClick={() => handleDeleteGateway(deleteConfirmId)} className="w-full py-2 bg-red-600 text-white rounded-xl">Confirm Delete</button><button onClick={() => setDeleteConfirmId(null)} className="w-full py-2 mt-2 border rounded-xl">Cancel</button></div>
                </div>
            )}
        </div>
    );
};

export default EdgeGateways;