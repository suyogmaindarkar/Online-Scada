// ═══════════════════════════════════════════════════════════
// Edge Gateways Dashboard Page
//
// Allows Admins & Engineers to manage Edge Gateway instances.
// Features: Gateway list, Online status badges, copy-to-clipboard raw API Key,
// dynamic configuration JSON downloading, and a guided Setup Wizard.
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import {
    Network, CheckCircle, XCircle, RefreshCw, Key, Download, Trash2, Plus,
    HelpCircle, Eye, AlertTriangle, ShieldAlert, Cpu, HardDrive, CpuIcon, Activity,
    Copy, Info, ArrowRight, Settings, ExternalLink, Terminal
} from 'lucide-react';
import api from '../services/api';

// ─── COLOR PALETTE (Blue Theme matched to Settings.jsx) ────
const C = {
    bg: '#F8FAFC',
    card: '#FFFFFF',
    cardSubtle: '#F8FAFC',
    cardHover: '#EEF6FF',
    border: '#E5E7EB',
    borderStrong: '#CBD5E1',
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
    info: '#2563EB',
};

// Local Toast System
const Toast = ({ message, type, onClose }) => (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium min-w-[280px] bg-white border shadow-lg"
        style={{ borderColor: C.border, boxShadow: '0px 8px 24px rgba(8, 27, 67, 0.12)' }}>
        {type === 'success' ? (
            <CheckCircle size={16} style={{ color: C.success }} />
        ) : type === 'error' ? (
            <XCircle size={16} style={{ color: C.danger }} />
        ) : (
            <AlertTriangle size={16} style={{ color: C.warning }} />
        )}
        <span style={{ color: C.heading }}>{message}</span>
        <button onClick={onClose} className="ml-auto text-xs" style={{ color: C.subtle }}>×</button>
    </div>
);

const EdgeGateways = () => {
    const [gateways, setGateways] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [toast, setToast] = useState(null);

    // Modals / Wizard State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showWizardModal, setShowWizardModal] = useState(false);
    const [selectedGatewayForWizard, setSelectedGatewayForWizard] = useState(null);
    const [showKeyRevealModal, setShowKeyRevealModal] = useState(null); // stores { name, rawKey }
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [rotateConfirmId, setRotateConfirmId] = useState(null);

    // Form states
    const [newGatewayName, setNewGatewayName] = useState('');
    const [createLoading, setCreateLoading] = useState(false);

    const currentUser = JSON.parse(localStorage.getItem('userData') || localStorage.getItem('user') || '{}');
    const isAdmin = currentUser.role === 'admin';

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    };

    const fetchGateways = async (silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);
        try {
            const res = await api.get('/edge');
            setGateways(res.data.data || []);
        } catch (err) {
            showToast('Failed to fetch edge gateways', 'error');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchGateways();
        const interval = setInterval(() => fetchGateways(true), 15000); // refresh list statuses every 15s
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

            // Open raw key reveal modal immediately
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
            showToast('API Key rotated successfully. Old key is terminated.');
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

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        showToast('Copied to clipboard');
    };

    const openWizard = (gateway) => {
        setSelectedGatewayForWizard(gateway);
        setShowWizardModal(true);
    };

    return (
        <div className="h-full flex flex-col overflow-hidden" style={{ background: C.bg }}>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* ─── HEADER ─── */}
            <div className="px-6 py-5 flex-shrink-0"
                style={{ background: C.card, borderBottom: `1px solid ${C.border}`, boxShadow: '0px 1px 3px rgba(8, 27, 67, 0.03)' }}>
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ background: `linear-gradient(135deg, ${C.brand} 0%, ${C.brandDark} 100%)` }}>
                            <Network size={20} color="#FFFFFF" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold" style={{ color: C.heading, fontFamily: "'Montserrat', sans-serif" }}>Edge Gateways</h1>
                            <p className="text-xs" style={{ color: C.subtle }}>
                                Connect physical factory PLCs securely to the OnlineSCADA cloud
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button onClick={() => fetchGateways(true)} disabled={refreshing}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-white border cursor-pointer transition-all hover:bg-slate-50"
                            style={{ color: C.muted, borderColor: C.border }}>
                            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                            {refreshing ? 'Refreshing...' : 'Refresh'}
                        </button>
                        {isAdmin && (
                            <button onClick={() => setShowCreateModal(true)}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer transition-all"
                                style={{ background: C.btnPrimary, boxShadow: '0px 4px 12px rgba(37, 99, 235, 0.25)' }}
                                onMouseEnter={(e) => e.currentTarget.style.background = C.btnHover}
                                onMouseLeave={(e) => e.currentTarget.style.background = C.btnPrimary}>
                                <Plus size={14} />
                                Create Gateway
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ─── MAIN CONTENT ─── */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-7xl mx-auto">

                    {/* Intro Callout Info */}
                    <div className="rounded-2xl p-5 mb-6 flex gap-4 border"
                        style={{ background: '#EFF6FF', borderColor: 'rgba(37, 99, 235, 0.20)' }}>
                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm shrink-0">
                            <Zap size={20} style={{ color: C.brand }} />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold" style={{ color: C.heading }}>Why do I need an Edge Gateway?</h4>
                            <p className="text-xs mt-1 leading-relaxed" style={{ color: C.text }}>
                                Because PLCs run on your local factory network, they are blocked by router firewalls from direct connection to the cloud.
                                Our <strong>Edge Gateway</strong> is a tiny lightweight app that runs inside your factory, connects securely to your PLCs, and pushes updates
                                outward to OnlineSCADA using secure TLS WebSockets (port 443). <strong>No complex IT firewall edits needed!</strong>
                            </p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="py-20 text-center">
                            <RefreshCw size={40} className="animate-spin mx-auto mb-4" style={{ color: C.brand }} />
                            <p style={{ color: C.muted }}>Loading gateway configurations...</p>
                        </div>
                    ) : gateways.length === 0 ? (
                        <div className="py-20 text-center rounded-2xl bg-white border" style={{ borderColor: C.border }}>
                            <Network size={48} className="mx-auto mb-4" style={{ color: C.subtle }} />
                            <h3 className="font-bold text-lg" style={{ color: C.heading }}>No Edge Gateways Provisioned</h3>
                            <p className="text-sm mt-1 mb-6 max-w-md mx-auto" style={{ color: C.muted }}>
                                Generate a gateway profile, retrieve your secure access credentials, and download the software configuration.
                            </p>
                            {isAdmin && (
                                <button onClick={() => setShowCreateModal(true)}
                                    className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white cursor-pointer transition-all"
                                    style={{ background: C.btnPrimary }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = C.btnHover}
                                    onMouseLeave={(e) => e.currentTarget.style.background = C.btnPrimary}>
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
                                    <div key={gw._id} className="rounded-2xl bg-white border p-6 flex flex-col relative transition-all"
                                        style={{ borderColor: C.border, boxShadow: '0px 4px 12px rgba(8, 27, 67, 0.02)' }}>

                                        {/* Header line */}
                                        <div className="flex items-start justify-between mb-4">
                                            <div>
                                                <h3 className="font-bold text-base" style={{ color: C.heading }}>{gw.name}</h3>
                                                <p className="text-xs font-mono mt-0.5" style={{ color: C.subtle }}>ID: {gw._id}</p>
                                            </div>

                                            {/* Connection status badge */}
                                            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
                                                style={{
                                                    backgroundColor: isOnline ? '#DCFCE7' : isNever ? '#F1F5F9' : '#FEE2E2',
                                                    color: isOnline ? C.success : isNever ? C.subtle : C.danger
                                                }}>
                                                <span className="w-2 h-2 rounded-full"
                                                    style={{ backgroundColor: isOnline ? C.success : isNever ? C.subtle : C.danger }} />
                                                {isOnline ? 'ONLINE' : isNever ? 'NEVER CONNECTED' : 'OFFLINE'}
                                            </span>
                                        </div>

                                        {/* Metadata summary */}
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 py-3 border-t border-b text-xs mb-4"
                                            style={{ borderColor: C.border, backgroundColor: C.cardSubtle }}>
                                            <div>
                                                <p style={{ color: C.muted }}>Prefix:</p>
                                                <p className="font-mono font-bold mt-0.5" style={{ color: C.heading }}>{gw.apiKeyPrefix}</p>
                                            </div>
                                            <div>
                                                <p style={{ color: C.muted }}>Last Seen IP:</p>
                                                <p className="font-mono font-bold mt-0.5" style={{ color: C.heading }}>{gw.ipAddress || '—'}</p>
                                            </div>
                                            <div>
                                                <p style={{ color: C.muted }}>OS Hostname:</p>
                                                <p className="font-mono font-bold mt-0.5" style={{ color: C.heading }}>{gw.hostname || '—'}</p>
                                            </div>
                                            <div>
                                                <p style={{ color: C.muted }}>Version Running:</p>
                                                <p className="font-mono font-bold mt-0.5" style={{ color: C.heading }}>{gw.version || '—'}</p>
                                            </div>
                                        </div>

                                        {/* Active monitoring stats if online */}
                                        {isOnline && gw.stats && (
                                            <div className="p-4 rounded-xl mb-4 border" style={{ borderColor: C.border, backgroundColor: C.cardSubtle }}>
                                                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: C.muted }}>Live Telemetry</p>
                                                <div className="grid grid-cols-3 gap-3 text-center">
                                                    <div>
                                                        <Activity size={14} className="mx-auto mb-1" style={{ color: C.brand }} />
                                                        <p className="font-bold text-sm" style={{ color: C.heading }}>{gw.stats.tagsReadPerSecond}/s</p>
                                                        <p className="text-[10px]" style={{ color: C.subtle }}>Read Rate</p>
                                                    </div>
                                                    <div>
                                                        <Cpu size={14} className="mx-auto mb-1" style={{ color: C.brand }} />
                                                        <p className="font-bold text-sm" style={{ color: C.heading }}>{gw.stats.cpuPercent}%</p>
                                                        <p className="text-[10px]" style={{ color: C.subtle }}>CPU Load</p>
                                                    </div>
                                                    <div>
                                                        <HardDrive size={14} className="mx-auto mb-1" style={{ color: C.brand }} />
                                                        <p className="font-bold text-sm" style={{ color: C.heading }}>{gw.stats.memoryUsageMB}MB</p>
                                                        <p className="text-[10px]" style={{ color: C.subtle }}>Mem Heap</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Action panel footer */}
                                        <div className="flex gap-2 mt-auto pt-4 border-t" style={{ borderColor: C.border }}>
                                            <button onClick={() => openWizard(gw)}
                                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white border cursor-pointer hover:bg-slate-50"
                                                style={{ color: C.brand, borderColor: 'rgba(37,99,235,0.30)' }}>
                                                <HelpCircle size={14} />
                                                Setup Guide
                                            </button>

                                            <button onClick={() => downloadConfig(gw)}
                                                className="flex items-center justify-center p-2 rounded-xl border cursor-pointer bg-white hover:bg-slate-50"
                                                style={{ color: C.muted, borderColor: C.border }}
                                                title="Download config.json for this gateway">
                                                <Download size={14} />
                                            </button>

                                            {isAdmin && (
                                                <>
                                                    <button onClick={() => setRotateConfirmId(gw._id)}
                                                        className="flex items-center justify-center p-2 rounded-xl border cursor-pointer bg-white hover:bg-slate-50"
                                                        style={{ color: C.warning, borderColor: C.border }}
                                                        title="Rotate/Regenerate API Key">
                                                        <Key size={14} />
                                                    </button>

                                                    <button onClick={() => setDeleteConfirmId(gw._id)}
                                                        className="flex items-center justify-center p-2 rounded-xl border cursor-pointer bg-white hover:bg-slate-50"
                                                        style={{ color: C.danger, borderColor: C.border }}
                                                        title="Delete gateway profile">
                                                        <Trash2 size={14} />
                                                    </button>
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

            {/* ─── MODAL: CREATE GATEWAY ─── */}
            {showCreateModal && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <form onSubmit={handleCreateGateway} className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 border"
                        style={{ borderColor: C.border, boxShadow: '0px 24px 80px rgba(8, 27, 67, 0.20)' }}>
                        <h3 className="font-bold text-lg mb-2" style={{ color: C.heading }}>Provision Edge Gateway</h3>
                        <p className="text-xs mb-4" style={{ color: C.muted }}>
                            Enter a name for this gateway. Each profile generates an isolated API token used for telemetry streaming.
                        </p>

                        <div className="mb-4">
                            <label className="block text-xs font-bold mb-1.5" style={{ color: C.heading }}>Gateway Name</label>
                            <input type="text" required value={newGatewayName} onChange={(e) => setNewGatewayName(e.target.value)}
                                placeholder="e.g. Factory Floor Gateway 1"
                                className="w-full px-3 py-2 rounded-xl text-sm border outline-none"
                                style={{ borderColor: C.border }} />
                        </div>

                        <div className="flex gap-3">
                            <button type="button" onClick={() => setShowCreateModal(false)}
                                className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-white border cursor-pointer"
                                style={{ borderColor: C.border, color: C.text }}>
                                Cancel
                            </button>
                            <button type="submit" disabled={createLoading}
                                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white cursor-pointer"
                                style={{ background: C.btnPrimary }}>
                                {createLoading ? 'Generating...' : 'Generate Profile'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ─── MODAL: RAW KEY REVEAL (CRITICAL) ─── */}
            {showKeyRevealModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-lg mx-4 border"
                        style={{ borderColor: C.border, boxShadow: '0px 24px 80px rgba(8, 27, 67, 0.20)' }}>
                        <div className="flex items-center gap-3 mb-4 text-amber-600">
                            <ShieldAlert size={28} />
                            <div>
                                <h3 className="font-bold text-lg" style={{ color: C.heading }}>Secure Key Generated!</h3>
                                <p className="text-xs" style={{ color: C.danger }}>Write this down. It will not be shown again.</p>
                            </div>
                        </div>

                        <p className="text-xs leading-relaxed mb-4" style={{ color: C.text }}>
                            Here is your secure access token for <strong>{showKeyRevealModal.name}</strong>. The server does not store the raw key (only a cryptographic hash), so it is physically impossible to retrieve it later.
                        </p>

                        {/* Display Box */}
                        <div className="rounded-xl p-4 font-mono text-sm break-all flex items-start gap-3 mb-4"
                            style={{ backgroundColor: '#FFFBEB', border: '1px solid #FEF3C7', color: '#B45309' }}>
                            <span className="flex-1 select-all font-bold">{showKeyRevealModal.rawKey}</span>
                            <button onClick={() => copyToClipboard(showKeyRevealModal.rawKey)}
                                className="p-1.5 rounded-lg bg-white border hover:bg-slate-50 shrink-0 cursor-pointer"
                                style={{ borderColor: '#F59E0B' }}>
                                <Copy size={14} />
                            </button>
                        </div>

                        <p className="text-xs mb-6 p-3 rounded-lg border flex gap-2 items-start"
                            style={{ background: C.cardSubtle, borderColor: C.border, color: C.muted }}>
                            <Info size={14} className="shrink-0 mt-0.5" />
                            This key configures the Edge Gateway code running in your factory to sign in securely. Do not share it.
                        </p>

                        <button onClick={() => setShowKeyRevealModal(null)}
                            className="w-full py-2.5 rounded-xl text-xs font-semibold text-white cursor-pointer"
                            style={{ background: C.btnPrimary }}>
                            I Have Saved the Key
                        </button>
                    </div>
                </div>
            )}

            {/* ─── MODAL: SETUP WIZARD (Phase E core helper) ─── */}
            {showWizardModal && selectedGatewayForWizard && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-2xl mx-4 border flex flex-col max-h-[85vh] overflow-hidden"
                        style={{ borderColor: C.border, boxShadow: '0px 24px 80px rgba(8, 27, 67, 0.20)' }}>

                        <div className="flex items-center justify-between mb-4 shrink-0">
                            <div className="flex items-center gap-2">
                                <Network size={22} style={{ color: C.brand }} />
                                <h3 className="font-bold text-lg" style={{ color: C.heading }}>Edge Gateway Setup Guide</h3>
                            </div>
                            <button onClick={() => setShowWizardModal(false)} className="text-lg hover:text-slate-600" style={{ color: C.subtle }}>×</button>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 space-y-6">

                            {/* Step 1 */}
                            <div className="flex gap-4">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                                    style={{ backgroundColor: C.cardHover, color: C.brand, border: `1px solid rgba(37,99,235,0.20)` }}>
                                    1
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold" style={{ color: C.heading }}>Download &amp; Extract</h4>
                                    <p className="text-xs mt-1 leading-relaxed" style={{ color: C.muted }}>
                                        To run the gateway, download the lightweight source files. It runs on any machine inside your factory network with Node.js installed (v18+).
                                    </p>
                                    <div className="flex gap-2 mt-3">
                                        <a href="https://github.com/onlinescada/edge-gateway" target="_blank" rel="noreferrer"
                                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border cursor-pointer hover:bg-slate-50"
                                            style={{ color: C.text, borderColor: C.border }}>
                                            <Terminal size={14} />
                                            View Source code
                                            <ExternalLink size={10} />
                                        </a>
                                    </div>
                                </div>
                            </div>

                            {/* Step 2 */}
                            <div className="flex gap-4">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                                    style={{ backgroundColor: C.cardHover, color: C.brand, border: `1px solid rgba(37,99,235,0.20)` }}>
                                    2
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-sm font-bold" style={{ color: C.heading }}>Place Configuration File</h4>
                                    <p className="text-xs mt-1 leading-relaxed" style={{ color: C.muted }}>
                                        Download the pre-compiled profile containing your server URL, workspace ID, active PLC map, and device configurations. Place this <strong>config.json</strong> in the root of your extracted edge-gateway app folder.
                                    </p>
                                    <button onClick={() => downloadConfig(selectedGatewayForWizard)}
                                        className="flex items-center gap-1.5 mt-3 px-3.5 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer"
                                        style={{ background: C.btnPrimary }}>
                                        <Download size={14} />
                                        Download config.json
                                    </button>
                                </div>
                            </div>

                            {/* Step 3 */}
                            <div className="flex gap-4">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                                    style={{ backgroundColor: C.cardHover, color: C.brand, border: `1px solid rgba(37,99,235,0.20)` }}>
                                    3
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold" style={{ color: C.heading }}>Start Gateway App</h4>
                                    <p className="text-xs mt-1 leading-relaxed" style={{ color: C.muted }}>
                                        Open your command line in the folder directory and run the initialization script. The gateway will establish automatic tunnels.
                                    </p>

                                    {/* Commands preview */}
                                    <div className="rounded-xl p-3 font-mono text-xs mt-3 leading-relaxed border"
                                        style={{ background: '#0F172A', color: '#F8FAFC', borderColor: '#334155' }}>
                                        <p style={{ color: '#64748B' }}># Install dependencies</p>
                                        <p className="font-bold text-sky-400">npm install</p>
                                        <p className="mt-2" style={{ color: '#64748B' }}># Start connection bridge</p>
                                        <p className="font-bold text-emerald-400">npm start</p>
                                    </div>
                                </div>
                            </div>

                        </div>

                        <button onClick={() => setShowWizardModal(false)}
                            className="w-full mt-6 py-2.5 rounded-xl text-xs font-semibold text-white cursor-pointer shrink-0"
                            style={{ background: C.btnPrimary }}>
                            Got it, Close Guide
                        </button>
                    </div>
                </div>
            )}

            {/* ─── MODAL: ROTATE CONFIRMATION ─── */}
            {rotateConfirmId && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 border"
                        style={{ borderColor: C.border, boxShadow: '0px 24px 80px rgba(8, 27, 67, 0.20)' }}>
                        <div className="flex items-center gap-3 mb-4 text-amber-500">
                            <Key size={24} />
                            <h3 className="font-bold" style={{ color: C.heading }}>Rotate API Key?</h3>
                        </div>
                        <p className="text-xs leading-relaxed mb-6" style={{ color: C.text }}>
                            This will instantly kill active tunnels using the current key. You must place the new key in the gateway configuration file. Proceed?
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setRotateConfirmId(null)}
                                className="flex-1 py-2 rounded-xl text-xs font-semibold bg-white border cursor-pointer"
                                style={{ borderColor: C.border, color: C.text }}>
                                Cancel
                            </button>
                            <button onClick={() => handleRegenerateKey(rotateConfirmId)}
                                className="flex-1 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer bg-amber-500 hover:bg-amber-600">
                                Rotate Key
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── MODAL: DELETE CONFIRMATION ─── */}
            {deleteConfirmId && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 border"
                        style={{ borderColor: C.border, boxShadow: '0px 24px 80px rgba(8, 27, 67, 0.20)' }}>
                        <div className="flex items-center gap-3 mb-4 text-red-600">
                            <Trash2 size={24} />
                            <h3 className="font-bold" style={{ color: C.heading }}>Delete Gateway?</h3>
                        </div>
                        <p className="text-xs leading-relaxed mb-6" style={{ color: C.text }}>
                            Deleting this gateway configuration profile is permanent. Any machine relying on this key will be disconnected.
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteConfirmId(null)}
                                className="flex-1 py-2 rounded-xl text-xs font-semibold bg-white border cursor-pointer"
                                style={{ borderColor: C.border, color: C.text }}>
                                Cancel
                            </button>
                            <button onClick={() => handleDeleteGateway(deleteConfirmId)}
                                className="flex-1 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer bg-red-600 hover:bg-red-700">
                                Delete Profile
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default EdgeGateways;