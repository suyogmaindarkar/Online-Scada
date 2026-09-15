// ═══════════════════════════════════════════════════════════
// Edge Gateways Dashboard Page (CRASH-PROOF VERSION)
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import {
    Network, CheckCircle, XCircle, RefreshCw, Key, Download, Trash2, Plus,
    HelpCircle, AlertTriangle, ShieldAlert, Cpu, HardDrive, Activity,
    Copy, Info, ExternalLink, Terminal, Zap
} from 'lucide-react';
import api from '../services/api';

// ─── COLOR PALETTE (Blue Theme) ────
const C = {
    bg: '#F8FAFC',
    card: '#FFFFFF',
    cardSubtle: '#F8FAFC',
    cardHover: '#EEF6FF',
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

    // 🛡️ SAFE LOCAL STORAGE PARSING (Prevents White Screen Crash)
    let isAdmin = false;
    try {
        const rawData = localStorage.getItem('userData') || localStorage.getItem('user');
        if (rawData && rawData !== 'undefined') {
            const currentUser = JSON.parse(rawData);
            isAdmin = currentUser?.role === 'admin';
        }
    } catch (e) {
        console.warn("Could not parse user data for Edge Gateways", e);
    }

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    };

    const fetchGateways = async (silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);
        try {
            // Safely call API
            const res = await api.get('/edge');
            setGateways(res?.data?.data || []);
        } catch (err) {
            console.error(err);
            showToast('Failed to fetch edge gateways', 'error');
            setGateways([]); // Fallback to empty array
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
            showToast('Gateway configuration profile generated successfully');
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
            a.download = `${gateway.name.toLowerCase().replace(/\s+/g, '_')}_config.json`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('config.json downloaded successfully');
        } catch (err) {
            showToast('Failed to compile configuration file', 'error');
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
                            <p className="text-xs" style={{ color: C.subtle }}>Connect physical PLCs securely to the cloud</p>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button onClick={() => fetchGateways(true)} disabled={refreshing}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-white border transition-all hover:bg-slate-50">
                            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                            {refreshing ? 'Refreshing...' : 'Refresh'}
                        </button>
                        {isAdmin && (
                            <button onClick={() => setShowCreateModal(true)}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90"
                                style={{ background: C.btnPrimary }}>
                                <Plus size={14} /> Create Gateway
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
                            <h4 className="text-sm font-bold" style={{ color: C.heading }}>Why do I need an Edge Gateway?</h4>
                            <p className="text-xs mt-1" style={{ color: C.text }}>
                                Our Edge Gateway is a lightweight app that runs inside your factory, connects securely to your PLCs, and pushes updates outward to OnlineSCADA using secure TLS WebSockets. No complex IT firewall edits needed!
                            </p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="py-20 text-center">
                            <RefreshCw size={40} className="animate-spin mx-auto mb-4" style={{ color: C.brand }} />
                            <p style={{ color: C.muted }}>Loading configurations...</p>
                        </div>
                    ) : (gateways || []).length === 0 ? (
                        <div className="py-20 text-center rounded-2xl bg-white border" style={{ borderColor: C.border }}>
                            <Network size={48} className="mx-auto mb-4" style={{ color: C.subtle }} />
                            <h3 className="font-bold text-lg" style={{ color: C.heading }}>No Edge Gateways</h3>
                            <p className="text-sm mt-1 mb-6 max-w-md mx-auto" style={{ color: C.muted }}>
                                Generate a profile to get your secure credentials and configuration.
                            </p>
                            {isAdmin && (
                                <button onClick={() => setShowCreateModal(true)}
                                    className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white transition-all"
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
                                            <div><p style={{ color: C.muted }}>Prefix:</p><p className="font-mono font-bold">{gw.apiKeyPrefix}</p></div>
                                            <div><p style={{ color: C.muted }}>Last Seen IP:</p><p className="font-mono font-bold">{gw.ipAddress || '—'}</p></div>
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
                                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border hover:bg-slate-50"
                                                style={{ color: C.brand, borderColor: 'rgba(37,99,235,0.30)' }}><HelpCircle size={14} /> Setup Guide</button>
                                            <button onClick={() => downloadConfig(gw)} className="p-2 rounded-xl border hover:bg-slate-50"><Download size={14} /></button>
                                            {isAdmin && (
                                                <>
                                                    <button onClick={() => setRotateConfirmId(gw._id)} className="p-2 rounded-xl border hover:bg-slate-50 text-amber-500"><Key size={14} /></button>
                                                    <button onClick={() => setDeleteConfirmId(gw._id)} className="p-2 rounded-xl border hover:bg-slate-50 text-red-600"><Trash2 size={14} /></button>
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

            {/* ─── MODALS ─── */}
            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <form onSubmit={handleCreateGateway} className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 border">
                        <h3 className="font-bold text-lg mb-2">Provision Gateway</h3>
                        <div className="mb-4">
                            <label className="block text-xs font-bold mb-1.5">Name</label>
                            <input type="text" required value={newGatewayName} onChange={(e) => setNewGatewayName(e.target.value)} className="w-full px-3 py-2 rounded-xl text-sm border" />
                        </div>
                        <div className="flex gap-3">
                            <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 py-2.5 rounded-xl text-xs border">Cancel</button>
                            <button type="submit" disabled={createLoading} className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white bg-blue-600">{createLoading ? 'Wait...' : 'Generate'}</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Key Reveal Modal */}
            {showKeyRevealModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-lg mx-4">
                        <div className="flex items-center gap-3 mb-4 text-amber-600"><ShieldAlert size={28} /><div><h3 className="font-bold text-lg">Secure Key Generated!</h3></div></div>
                        <div className="rounded-xl p-4 font-mono text-sm flex gap-3 mb-4 bg-amber-50 border border-amber-200 text-amber-700">
                            <span className="flex-1 break-all font-bold">{showKeyRevealModal.rawKey}</span>
                        </div>
                        <button onClick={() => setShowKeyRevealModal(null)} className="w-full py-2.5 rounded-xl text-xs font-semibold text-white bg-blue-600">I Have Saved the Key</button>
                    </div>
                </div>
            )}

            {/* Setup Wizard */}
            {showWizardModal && selectedGatewayForWizard && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl p-8 w-full max-w-2xl mx-4">
                        <h3 className="font-bold text-lg mb-6">Setup Guide</h3>
                        <div className="space-y-4 text-sm text-slate-700">
                            <p><strong>1. Download App:</strong> Ensure Node.js is installed on your factory PC.</p>
                            <p><strong>2. Configure:</strong> Download your <code>config.json</code> and place it in the gateway folder.</p>
                            <button onClick={() => downloadConfig(selectedGatewayForWizard)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs"><Download size={14} /> Download Config</button>
                            <p><strong>3. Run:</strong> Open terminal and run <code>npm install</code> followed by <code>npm start</code>.</p>
                        </div>
                        <button onClick={() => setShowWizardModal(false)} className="w-full mt-6 py-2.5 rounded-xl text-xs font-semibold text-white bg-blue-600">Close</button>
                    </div>
                </div>
            )}

            {/* Delete / Rotate Confirmations */}
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