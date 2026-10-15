// ═══════════════════════════════════════════════════════════
// FactoryConnectorSetup — Install + Pairing Modal
//
// Guides a customer from "Download installer" through "Enter pairing
// code in the installer" to "Connector online + paired". Emoji-free,
// blue theme, lucide icons. Uses pairingAPI + existing edge download.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { pairingAPI, equipmentAPI } from '../services/api';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import Modal from './ui/Modal';
import {
  Download, KeyRound, Copy, CheckCircle2, Loader2, RefreshCw, ShieldCheck,
  Monitor, Server, AlertCircle, Link2, Wifi, Clock
} from 'lucide-react';

const C = {
  brand: '#2563EB', brandDark: '#0F3D91', success: '#16A34A',
  warning: '#F59E0B', danger: '#DC2626', muted: '#5F6B7A',
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  a.remove(); URL.revokeObjectURL(url);
};

export default function FactoryConnectorSetup({ open, onClose, gateway, onRefresh }) {
  const { showToast } = useToast();
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [creatingCode, setCreatingCode] = useState(false);
  const [downloading, setDownloading] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [copied, setCopied] = useState(false);
  const [state, setState] = useState({
    code: null,
    expiresAt: null,
    paired: false,
    connectorOnline: false,
    loading: true,
  });

  const isCodeExpired = Boolean(state.expiresAt && new Date(state.expiresAt).getTime() <= Date.now() && !state.paired);

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const [pairRes, connRes] = await Promise.all([
        pairingAPI.status().catch(() => null),
        equipmentAPI.connectorStatus().catch(() => null),
      ]);
      const pairData = pairRes?.data?.data;
      const connData = connRes?.data?.data;
       const nextCode = pairData?.activeCode?.code || null;
       const nextExpiresAt = pairData?.activeCode?.expiresAt || null;
       setState((previous) => ({
         code: nextCode || (previous.code && previous.expiresAt && new Date(previous.expiresAt).getTime() <= Date.now() ? previous.code : null),
         expiresAt: nextExpiresAt || previous.expiresAt || null,
         paired: Boolean(pairData?.paired),
         connectorOnline: Boolean(connData?.connectorOnline),
         loading: false,
       }));
    } catch (e) {
      setState((s) => ({ ...s, loading: false }));
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    if (open) loadStatus();
  }, [open, loadStatus]);

  // Pairing is completed by the Factory Connector installer, so keep the
  // admin view current without requiring a manual refresh.
  useEffect(() => {
    if (!open) return undefined;
    const interval = setInterval(loadStatus, 2500);
    return () => clearInterval(interval);
  }, [open, loadStatus]);

  const handleGenerateCode = async () => {
    setCreatingCode(true);
    try {
      const res = await pairingAPI.create();
      const d = res.data?.data;
      setState((s) => ({ ...s, code: d.code, expiresAt: d.expiresAt, paired: false, connectorOnline: false }));
      showToast('Pairing code generated. It expires in 10 minutes.', 'success', 6000);
    } catch (err) {
      showToast('Could not create pairing code', 'error');
    } finally {
      setCreatingCode(false);
    }
  };

  const handleDownload = async () => {
    if (!gateway?._id) { showToast('Connector profile not ready. Wait a moment and retry.', 'warning'); return; }
    setDownloading(true);
    try {
      // Same endpoint as "Download Connector" — generates a fresh API key once.
      const res = await api.get(`/edge/${gateway._id}/download-package`, { responseType: 'blob' });
      const filename = 'OnlineSCADA-Factory-Connector.zip';
      const cd = res.headers?.['content-disposition'];
      const match = cd && cd.match(/filename="?([^"]+)"?/);
      downloadBlob(res.data, match ? match[1] : filename);
      showToast('Installer (ZIP) downloaded. Extract, then run Start.bat once.', 'success', 9000);
      if (onRefresh) { try { onRefresh(); } catch (e) { /* ignore */ } }
    } catch (err) {
      showToast('Download failed. Try again.', 'error');
    } finally {
      setDownloading(false);
    }
  };

  // Friendly status text for the current step
  let statusKey;
  if (state.loading) statusKey = 'loading';
  else if (state.connectorOnline) statusKey = 'online';
  else if (state.paired) statusKey = 'paired_offline';
  else if (isCodeExpired) statusKey = 'expired';
  else if (state.code) statusKey = 'code_active';
  else statusKey = 'not_started';

  const steps =
    statusKey === 'online' ? [] :
    statusKey === 'paired_offline' ? ['Connector is paired', 'Start the Factory Connector service on the PC', 'Wait for the cloud link to establish'] :
    statusKey === 'code_active' ? ['Install the connector on the PC', 'Enter this pairing code in the installer', 'The connector will connect automatically'] :
    statusKey === 'expired' ? ['Request a new pairing code', 'Enter it in the Factory Connector installer', 'Wait for the cloud link to establish'] :
    ['Download the Factory Connector installer', 'Run it once on the factory PC', 'Enter the pairing code shown here', 'Equipment links to this workspace automatically'];

  return (
    <Modal isOpen={open} onClose={onClose} title="Factory Connector Setup" size="lg">
      <div className="space-y-4 font-sans text-slate-800">
        {/* Step indicator */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800 mb-2">
            <ShieldCheck size={16} className="text-blue-600" /> Installation status
          </div>
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-slate-600">
              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
              {s}
            </div>
          ))}
        </div>

        {/* Status banner */}
        <div className="p-3 rounded-xl border text-sm flex items-center gap-2"
          style={
            statusKey === 'online' ? { background: '#F0FDF4', borderColor: '#86EFAC', color: C.success } :
            statusKey === 'code_active' || statusKey === 'expired' ? { background: '#FEF9C3', borderColor: '#FDE68A', color: '#B45309' } :
            { background: '#F1F5F9', borderColor: '#E2E8F0', color: C.muted }
          }
        >
           {statusKey === 'online' ? <Wifi size={16} /> :
            statusKey === 'code_active' || statusKey === 'expired' ? <Clock size={16} /> :
           statusKey === 'loading' ? <Loader2 size={16} className="animate-spin" /> :
           <Monitor size={16} />}
          <span className="font-semibold">
             {statusKey === 'online' ? 'Factory Connector online and connected' :
              statusKey === 'paired_offline' ? 'Connector paired. Waiting for it to connect.' :
              statusKey === 'code_active' ? 'Pairing code active' :
              statusKey === 'expired' ? 'Pairing code expired. Request a new code to continue.' :
             statusKey === 'loading' ? 'Checking installation status...' :
             'Beginning setup. Download the installer to start.'}
          </span>
        </div>

        {/* Pairing code display */}
         {(statusKey === 'code_active' || statusKey === 'expired') && state.code && (
          <div className="p-4 rounded-xl border border-blue-200 bg-blue-50 text-center space-y-2">
            <p className="text-xs font-bold text-blue-800 uppercase tracking-wide">Enter this code in the installer</p>
            <p className="text-2xl font-mono font-bold tracking-[0.3em] text-blue-900 select-all">{state.code}</p>
             <p className={`text-[11px] flex items-center justify-center gap-1 ${statusKey === 'expired' ? 'text-red-700' : 'text-blue-700'}`}>
               <Clock size={12} /> {statusKey === 'expired' ? 'This code is no longer valid' : `Expires ${new Date(state.expiresAt).toLocaleTimeString()}`}
            </p>
            <div className="flex items-center justify-center gap-2">
              <button type="button" onClick={() => { navigator.clipboard?.writeText(state.code || ''); setCopied(true); showToast('Code copied', 'success'); }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-blue-300 bg-white text-blue-700 cursor-pointer hover:bg-blue-100">
                <Copy size={12} /> Copy code
              </button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button type="button" onClick={handleDownload} disabled={downloading || loadingStatus}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white cursor-pointer shadow-sm hover:opacity-90 disabled:opacity-50"
            style={{ background: C.brand }}>
            {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {downloading ? 'Preparing installer...' : 'Download Factory Connector'}
          </button>

           {statusKey !== 'online' && (
            <button type="button" onClick={handleGenerateCode} disabled={creatingCode}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold cursor-pointer border hover:border-blue-400"
              style={{ background: '#EFF6FF', color: C.brandDark, borderColor: '#BFDBFE' }}>
               <KeyRound size={14} /> {creatingCode ? 'Requesting...' : (statusKey === 'code_active' ? 'Request new code' : 'Request pairing code')}
            </button>
          )}

          <button type="button" onClick={() => { loadStatus(); if (onRefresh) onRefresh(); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-500 cursor-pointer border border-slate-200 bg-white hover:bg-slate-50">
            <RefreshCw size={14} /> Check status
          </button>
        </div>

        {/* Helpful note */}
        <p className="text-[11px] text-slate-500 border-t border-slate-100 pt-3 flex items-start gap-1.5">
          <AlertCircle size={13} className="shrink-0 mt-0.5 text-amber-500" />
           Only the factory PC needs this installer. If automatic pairing is unavailable, download the ZIP, extract it, and run Start.bat on the factory PC.
        </p>
      </div>
    </Modal>
  );
}
