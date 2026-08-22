// ═══════════════════════════════════════════════════════════
// WorkspaceLogin — Step 1 of Two-Step Authentication
// ✅ Added "Confirm Password" field for manual signup
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Lock, Mail, AlertCircle, Loader2, Building2, User,
} from 'lucide-react';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

const WorkspaceLogin = () => {
  const [tab, setTab]                     = useState('login'); // 'login' | 'signup'
  
  // Login State
  const [slug, setSlug]                   = useState('');
  const [adminEmail, setAdminEmail]       = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  // Signup State
  const [signupCompany, setSignupCompany] = useState('');
  const [signupName, setSignupName]       = useState('');
  const [signupEmail, setSignupEmail]     = useState('');
  const [signupPass, setSignupPass]       = useState('');
  const [signupPassConfirm, setSignupPassConfirm] = useState(''); // ✅ NEW

  const [error, setError]                 = useState('');
  const [loading, setLoading]             = useState(false);

  const { verifyWorkspace, signupManual, signupGoogle, authState } = useAuth();
  const navigate = useNavigate();
  const googleBtnRef = useRef(null);

  useEffect(() => {
    if (authState === 'LOGGED_IN')      navigate('/dashboard');
    if (authState === 'WORKSPACE_ONLY') navigate('/select-user');
  }, [authState, navigate]);

  useEffect(() => {
    const reason = sessionStorage.getItem('authRedirectReason');
    if (reason) {
      setError(reason);
      sessionStorage.removeItem('authRedirectReason');
    }
    const savedSlug = localStorage.getItem('lastWorkspaceSlug');
    if (savedSlug) setSlug(savedSlug);
  }, []);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const loadGoogleScript = () => {
      if (document.getElementById('google-jssdk')) {
        renderGoogleBtn();
        return;
      }
      const script = document.createElement('script');
      script.id = 'google-jssdk';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = renderGoogleBtn;
      document.body.appendChild(script);
    };

    const renderGoogleBtn = () => {
      if (window.google?.accounts?.id && googleBtnRef.current) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCallback,
        });

        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline',
          size: 'large',
          width: '100%',
          text: 'continue_with',
          shape: 'pill',
        });
      }
    };

    loadGoogleScript();
  }, [tab]);

  const handleGoogleCallback = async (response) => {
    if (!response.credential) return;
    setError('');
    setLoading(true);

    const res = await signupGoogle(response.credential);
    if (res.success) {
      navigate('/dashboard');
    } else {
      setError(res.message);
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e) => {
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

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // ✅ NEW: Verify passwords match before calling API
    if (signupPass !== signupPassConfirm) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    const result = await signupManual(
      signupCompany.trim(),
      signupName.trim(),
      signupEmail.trim(),
      signupPass
    );

    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.message);
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #F8FBFF 0%, #EEF6FF 100%)' }}
    >
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

      <div className="w-full max-w-md relative z-10 my-8">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold mb-1"
            style={{ fontFamily: "'Montserrat', sans-serif", color: '#081B43', letterSpacing: '-0.02em' }}>
            Online<span style={{ color: '#2563EB' }}>SCADA</span>
          </h1>
          <p style={{ color: '#5F6B7A', fontSize: '14px' }}>
            Next-Gen Cloud SCADA / HMI Platform
          </p>
        </div>

        <div
          className="p-8 rounded-2xl"
          style={{
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            boxShadow: '0px 24px 80px rgba(8,27,67,0.10)',
          }}
        >
          <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => { setTab('login'); setError(''); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                tab === 'login'
                  ? 'bg-white text-[#081B43] shadow-sm'
                  : 'text-[#5F6B7A] hover:text-[#081B43]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setTab('signup'); setError(''); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                tab === 'signup'
                  ? 'bg-[#2563EB] text-white shadow-sm'
                  : 'text-[#5F6B7A] hover:text-[#2563EB]'
              }`}
            >
              Sign Up
            </button>
          </div>

          {error && (
            <div
              className="px-4 py-3 rounded-lg mb-5 flex items-start gap-2 text-sm"
              style={{ background: '#FEE2E2', border: '1px solid rgba(220,38,38,0.30)', color: '#7F1D1D' }}
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#DC2626' }} />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: LOGIN */}
          {tab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#081B43' }}>
                  Workspace
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#94A3B8' }} />
                  <input
                    type="text" value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="e.g. acme-corp" required autoFocus
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl outline-none text-sm transition-all"
                    style={{ background: '#F8FAFC', border: '1px solid #E5E7EB', color: '#081B43' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#081B43' }}>
                  Admin Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#94A3B8' }} />
                  <input
                    type="email" value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@company.com" required
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl outline-none text-sm transition-all"
                    style={{ background: '#F8FAFC', border: '1px solid #E5E7EB', color: '#081B43' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: '#081B43' }}>
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#94A3B8' }} />
                  <input
                    type="password" value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Enter password" required
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl outline-none text-sm transition-all"
                    style={{ background: '#F8FAFC', border: '1px solid #E5E7EB', color: '#081B43' }}
                  />
                </div>
              </div>

              <button
                type="submit" disabled={loading}
                className="w-full font-semibold py-3 rounded-xl flex items-center justify-center gap-2 text-sm text-white transition-all cursor-pointer mt-2"
                style={{ background: '#081B43' }}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Continue →'}
              </button>
            </form>
          )}

          {/* TAB 2: SIGNUP */}
          {tab === 'signup' && (
            <div className="space-y-4">
              {GOOGLE_CLIENT_ID && (
                <>
                  <div ref={googleBtnRef} className="w-full min-h-[40px] flex justify-center" />
                  <div className="flex items-center my-3">
                    <div className="flex-1 border-t border-gray-200" />
                    <span className="px-3 text-xs text-gray-400 font-semibold uppercase">Or manual signup</span>
                    <div className="flex-1 border-t border-gray-200" />
                  </div>
                </>
              )}

              <form onSubmit={handleSignupSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#081B43' }}>
                    Company / Plant Name *
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text" value={signupCompany}
                      onChange={(e) => setSignupCompany(e.target.value)}
                      placeholder="e.g. Acme Automation" required autoFocus
                      className="w-full pl-9 pr-4 py-2 rounded-xl text-sm border border-gray-200 bg-slate-50 outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#081B43' }}>
                    Your Full Name *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text" value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      placeholder="e.g. John Doe" required
                      className="w-full pl-9 pr-4 py-2 rounded-xl text-sm border border-gray-200 bg-slate-50 outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#081B43' }}>
                    Work Email *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email" value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      placeholder="john@company.com" required
                      className="w-full pl-9 pr-4 py-2 rounded-xl text-sm border border-gray-200 bg-slate-50 outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#081B43' }}>
                    Password *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="password" value={signupPass}
                      onChange={(e) => setSignupPass(e.target.value)}
                      placeholder="Min 6 characters" required minLength={6}
                      className="w-full pl-9 pr-4 py-2 rounded-xl text-sm border border-gray-200 bg-slate-50 outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                {/* ✅ NEW: Confirm Password Field */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#081B43' }}>
                    Confirm Password *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="password" value={signupPassConfirm}
                      onChange={(e) => setSignupPassConfirm(e.target.value)}
                      placeholder="Re-type password" required minLength={6}
                      className="w-full pl-9 pr-4 py-2 rounded-xl text-sm border border-gray-200 bg-slate-50 outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                <button
                  type="submit" disabled={loading}
                  className="w-full font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm text-white bg-blue-600 hover:bg-blue-700 shadow-md transition-all cursor-pointer mt-3"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Creating Workspace…</>
                  ) : (
                    'CONTINUE'
                  )}
                </button>
              </form>
            </div>
          )}

          {/* Contact sales link */}
          <div className="mt-6 pt-4 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400">
              Need enterprise setup or custom features?{' '}
              <a
                href="mailto:suyogmaindarkar@gmail.com?subject=Enterprise SCADA Inquiry"
                className="font-semibold text-blue-600 hover:underline"
              >
                Contact Sales
              </a>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs mt-6 text-gray-400">
          © 2026 <span className="font-bold text-slate-800">Online<span className="text-blue-600">SCADA</span></span> — Enterprise Cloud SCADA Platform
        </p>
      </div>
    </div>
  );
};

export default WorkspaceLogin;