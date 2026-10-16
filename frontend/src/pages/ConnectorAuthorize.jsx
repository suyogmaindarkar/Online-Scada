import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CheckCircle2, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { deviceAuthorizationAPI } from '../services/api';

export default function ConnectorAuthorize() {
  const location = useLocation();
  const { authState, loading, company } = useAuth();
  const code = new URLSearchParams(location.search).get('user_code') || '';
  const [state, setState] = useState('ready');
  const [message, setMessage] = useState('');
  const [device, setDevice] = useState(null);

  useEffect(() => {
    if (!code) return;
    deviceAuthorizationAPI.details(code)
      .then((response) => setDevice(response.data?.data || null))
      .catch((error) => {
        setState('error');
        setMessage(error.response?.data?.message || 'This authorization link is invalid or expired.');
      });
  }, [code]);

  useEffect(() => {
    if (authState !== 'LOGGED_IN') {
      sessionStorage.setItem('connectorAuthorizationRedirect', `${location.pathname}${location.search}`);
    }
  }, [authState, location.pathname, location.search]);

  const approve = async () => {
    if (!code) { setState('error'); setMessage('This authorization link is missing its device code.'); return; }
    setState('approving');
    try {
      await deviceAuthorizationAPI.approve(code);
      setState('approved');
    } catch (error) {
      setState('error');
      setMessage(error.response?.data?.message || 'The authorization code is invalid, expired, or already used.');
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 text-sm text-slate-600">Checking your OnlineSCADA session...</div>
  );

  if (authState !== 'LOGGED_IN') return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <ShieldCheck className="mx-auto mb-4 text-blue-600" size={40} />
        <h1 className="text-2xl font-bold text-slate-900">Authorize Factory Connector</h1>
        <p className="mt-2 text-sm text-slate-600">Sign in to OnlineSCADA to approve this factory computer.</p>
        <Link to={authState === 'WORKSPACE_ONLY' ? '/select-user' : '/login'} className="mt-6 inline-flex rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white">Sign in to approve</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        {state === 'approved' ? <CheckCircle2 className="mx-auto mb-4 text-emerald-600" size={44} /> : <ShieldCheck className="mx-auto mb-4 text-blue-600" size={44} />}
        <h1 className="text-2xl font-bold text-slate-900">{state === 'approved' ? 'Factory Connector approved' : 'Authorize Factory Connector'}</h1>
        {state === 'approved' ? <p className="mt-3 text-sm text-slate-600">You can close this browser tab. The installer will finish automatically.</p> : <>
          <p className="mt-2 text-sm text-slate-600">Approve this factory computer for your current OnlineSCADA workspace.</p>
          {device && <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-left text-sm text-slate-700"><div className="font-semibold text-slate-900">{device.deviceHostname}</div><div className="text-xs text-slate-500">{device.devicePlatform} · Workspace: {company?.name || company?.companyName || 'current workspace'}</div></div>}
          <div className="my-6 rounded-xl bg-blue-50 py-4 font-mono text-2xl font-bold tracking-widest text-blue-900">{code || 'Missing code'}</div>
          {state === 'error' && <p className="mb-4 flex items-center justify-center gap-2 text-sm text-red-600"><AlertCircle size={16} />{message}</p>}
          <button type="button" onClick={approve} disabled={state === 'approving' || !code} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
            {state === 'approving' && <Loader2 className="animate-spin" size={16} />} Approve this connector
          </button>
        </>}
      </div>
    </div>
  );
}
