// ═══════════════════════════════════════════════════════════
// FactoryConnectorSetup — Install + Pairing Modal
//
// Guides a customer from "Download installer" through browser approval
// to "Connector online + paired". Emoji-free,
// blue theme, lucide icons. Uses browser authorization + existing edge download.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { pairingAPI, equipmentAPI } from '../services/api';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import Modal from './ui/Modal';
import { Download, Loader2, RefreshCw, ShieldCheck, Monitor, AlertCircle, Wifi } from 'lucide-react';

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
  const [downloading, setDownloading] = useState(false);
  const [state, setState] = useState({
    paired: false,
    connectorOnline: false,
    loading: true,
  });

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const [pairRes, connRes] = await Promise.all([
        pairingAPI.status().catch(() => null),
        equipmentAPI.connectorStatus().catch(() => null),
      ]);
      const pairData = pairRes?.data?.data;
      const connData = connRes?.data?.data;
        setState((previous) => ({
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

  const handleDownload = async () => {
    if (!gateway?._id) { showToast('Connector profile not ready. Wait a moment and retry.', 'warning'); return; }
    setDownloading(true);
    try {
      const installerUrl = import.meta.env.VITE_CONNECTOR_INSTALLER_URL;
      if (installerUrl) {
        window.open(installerUrl, '_blank', 'noopener,noreferrer');
        showToast('Installer download started. Run it on the factory PC; the browser will handle sign-in and approval.', 'success', 9000);
        return;
      }
      const res = await api.get(`/edge/${gateway._id}/download-package`, { responseType: 'blob' });
      const filename = 'OnlineSCADA-Factory-Connector.zip';
      const cd = res.headers?.['content-disposition'];
      const match = cd && cd.match(/filename="?([^"]+)"?/);
      downloadBlob(res.data, match ? match[1] : filename);
      showToast('Fallback package downloaded. Configure VITE_CONNECTOR_INSTALLER_URL for the Windows installer.', 'success', 9000);
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
  else statusKey = 'not_started';

  const steps =
    statusKey === 'online' ? [] :
    statusKey === 'paired_offline' ? ['Connector is paired', 'Start the Factory Connector service on the PC', 'Wait for the cloud link to establish'] :
    ['Download the Windows Factory Connector installer', 'Run it once on the factory PC', 'Sign in through the browser when prompted', 'Approve the factory computer'];

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
            { background: '#F1F5F9', borderColor: '#E2E8F0', color: C.muted }
          }
        >
           {statusKey === 'online' ? <Wifi size={16} /> :
            statusKey === 'loading' ? <Loader2 size={16} className="animate-spin" /> :
           <Monitor size={16} />}
          <span className="font-semibold">
             {statusKey === 'online' ? 'Factory Connector online and connected' :
              statusKey === 'paired_offline' ? 'Connector paired. Waiting for it to connect.' :
              statusKey === 'loading' ? 'Checking installation status...' :
             'Beginning setup. Download the installer to start.'}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button type="button" onClick={handleDownload} disabled={downloading || loadingStatus}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white cursor-pointer shadow-sm hover:opacity-90 disabled:opacity-50"
            style={{ background: C.brand }}>
            {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
             {downloading ? 'Preparing installer...' : (import.meta.env.VITE_CONNECTOR_INSTALLER_URL ? 'Download Windows Installer' : 'Download fallback package')}
          </button>

          <button type="button" onClick={() => { loadStatus(); if (onRefresh) onRefresh(); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-500 cursor-pointer border border-slate-200 bg-white hover:bg-slate-50">
            <RefreshCw size={14} /> Check status
          </button>
        </div>

        {/* Helpful note */}
        <p className="text-[11px] text-slate-500 border-t border-slate-100 pt-3 flex items-start gap-1.5">
          <AlertCircle size={13} className="shrink-0 mt-0.5 text-amber-500" />
           Only the factory PC needs this installer. It opens OnlineSCADA in the browser and waits for an administrator or engineer to approve the connection.
        </p>
      </div>
    </Modal>
  );
}
