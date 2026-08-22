// ═══════════════════════════════════════════════════════════
// WorkspaceLogin — Step 1 of Two-Step Authentication
//
// User enters:
//   • Workspace slug (e.g., "acme-corp")
//   • Admin email + password
//
// On success → redirect to /select-user
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Lock, Mail, AlertCircle, Loader2, Building2,
} from 'lucide-react';

const WorkspaceLogin = () => {
  const [slug, setSlug]                   = useState('');
  const [adminEmail, setAdminEmail]       = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError]                 = useState('');
  const [loading, setLoading]             = useState(false);
  const { verifyWorkspace, authState }    = useAuth();
  const navigate = useNavigate();

  // ─── Auto-redirect if already logged in ───────────────
  useEffect(() => {
    if (authState === 'LOGGED_IN')      navigate('/dashboard');
    if (authState === 'WORKSPACE_ONLY') navigate('/select-user');
  }, [authState, navigate]);

  // ─── Show session expiry reason ──────────────────────
  useEffect(() => {
    const reason = sessionStorage.getItem('authRedirectReason');
    if (reason) {
      setError(reason);
      sessionStorage.removeItem('authRedirectReason');
    }
  }, []);

  // ─── Remember last workspace slug ────────────────────
  useEffect(() => {
    const savedSlug = localStorage.getItem('lastWorkspaceSlug');
    if (savedSlug) setSlug(savedSlug);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const cleanSlug = slug.toLowerCase().trim().replace(/\s+/g, '-');

    const result = await verifyWorkspace(cleanSlug, adminEmail.trim(), adminPassword);

    if (result.success) {
      localStorage.setItem('lastWorkspaceSlug', cleanSlug);
      navigate('/select-user');
    } else {
      setError(result.message);
    }
    setLoading(false);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #F8FBFF 0%, #EEF6FF 100%)' }}
    >
      {/* Blueprint grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(15,61,145,0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(15,61,145,0.05) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      <div className="w-full max-w-md relative z-10">
        {/* ─── Brand ─── */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2"
            style={{ fontFamily: "'Montserrat', sans-serif", color: '#081B43', letterSpacing: '-0.02em' }}>
            Online<span style={{ color: '#2563EB' }}>SCADA</span>
          </h1>
          <p style={{ color: '#5F6B7A', fontSize: '15px' }}>
            Sign in to your workspace
          </p>
        </div>

        {/* ─── Login Card ─── */}
        <div
          className="p-8 rounded-2xl"
          style={{
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            boxShadow: '0px 24px 80px rgba(8,27,67,0.10)',
          }}
        >
          <h2 className="text-2xl font-bold mb-6 text-center"
            style={{ fontFamily: "'Montserrat', sans-serif", color: '#081B43' }}>
            Workspace Login
          </h2>

          {/* ─── Error banner ─── */}
          {error && (
            <div
              className="px-4 py-3 rounded-lg mb-4 flex items-start gap-2"
              style={{ background: '#FEE2E2', border: '1px solid rgba(220,38,38,0.30)', color: '#7F1D1D' }}
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#DC2626' }} />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}

          {/* ─── Form ─── */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Workspace */}
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: '#081B43' }}>
                Workspace
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#94A3B8' }} />
                <input
                  type="text" value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="e.g. acme-corp" required autoFocus
                  className="w-full pl-10 pr-4 py-3 rounded-xl outline-none transition-all"
                  style={{
                    background: '#F8FAFC', border: '1px solid #E5E7EB',
                    color: '#081B43', fontSize: '15px',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#2563EB'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.15)'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
              <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
                Your workspace's unique identifier
              </p>
            </div>

            {/* Admin Email */}
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: '#081B43' }}>
                Admin Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#94A3B8' }} />
                <input
                  type="email" value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@company.com" required
                  className="w-full pl-10 pr-4 py-3 rounded-xl outline-none transition-all"
                  style={{
                    background: '#F8FAFC', border: '1px solid #E5E7EB',
                    color: '#081B43', fontSize: '15px',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#2563EB'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.15)'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: '#081B43' }}>
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#94A3B8' }} />
                <input
                  type="password" value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter password" required
                  className="w-full pl-10 pr-4 py-3 rounded-xl outline-none transition-all"
                  style={{
                    background: '#F8FAFC', border: '1px solid #E5E7EB',
                    color: '#081B43', fontSize: '15px',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#2563EB'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.15)'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit" disabled={loading}
              className="w-full font-semibold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed transition-all cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)', color: '#FFFFFF',
                boxShadow: '0px 4px 16px rgba(37, 99, 235, 0.35)',
                fontFamily: "'Montserrat', sans-serif", fontSize: '15px',
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = 'linear-gradient(135deg, #1D4ED8 0%, #1E40AF 100%)'; }}
              onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)'; }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Verifying workspace…
                </>
              ) : (
                'Continue →'
              )}
            </button>
          </form>

          {/* Contact sales link */}
          <div className="mt-6 pt-5 border-t border-gray-100 text-center">
            <p className="text-xs" style={{ color: '#94A3B8' }}>
              Don't have a workspace?{' '}
              <a
                href="mailto:suyogmaindarkar@gmail.com?subject=New Workspace Request&body=Hi,%0D%0A%0D%0AI would like to sign up for OnlineSCADA. Please create a workspace for my company.%0D%0A%0D%0ACompany:%0D%0AContact Name:%0D%0APhone:%0D%0A"
                className="font-semibold hover:underline"
                style={{ color: '#2563EB' }}
              >
                Contact Sales
              </a>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sm mt-6" style={{ color: '#5F6B7A' }}>
          © 2026{' '}
          <span style={{ color: '#081B43', fontWeight: 600 }}>
            Online<span style={{ color: '#2563EB' }}>SCADA</span>
          </span>
          {' — '}Modern Web-Based SCADA Platform
        </p>
      </div>
    </div>
  );
};

export default WorkspaceLogin;