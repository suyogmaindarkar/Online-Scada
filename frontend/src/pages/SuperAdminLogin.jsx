// ═══════════════════════════════════════════════════════════
// SuperAdminLogin — Platform administrator login
//
// Dark control-panel theme to distinguish from workspace login.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSuperAdminAuth } from '../context/SuperAdminAuthContext';
import { Lock, Mail, AlertCircle, Loader2, ShieldCheck, Zap } from 'lucide-react';

const SuperAdminLogin = () => {
  const [email, setEmail]       = useState('suyog@onlinescada.in');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const { login, isAuthenticated } = useSuperAdminAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) navigate('/super-admin/dashboard');
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email.trim(), password);

    if (result.success) {
      navigate('/super-admin/dashboard');
    } else {
      setError(result.message);
    }
    setLoading(false);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        background: 'radial-gradient(circle at 30% 20%, #1E293B 0%, #0F172A 60%, #020617 100%)',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Grid overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `
          linear-gradient(to right, rgba(37,99,235,0.06) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(37,99,235,0.06) 1px, transparent 1px)
        `,
        backgroundSize: '48px 48px',
      }} />

      {/* Glow */}
      <div style={{
        position: 'absolute', top: '-200px', right: '-200px',
        width: '500px', height: '500px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(37,99,235,0.15) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 10 }}>
        {/* Logo/Brand */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '72px', height: '72px', borderRadius: '20px',
            background: 'linear-gradient(135deg, #DC2626 0%, #7F1D1D 100%)',
            marginBottom: '16px',
            boxShadow: '0px 12px 32px rgba(220,38,38,0.35)',
            border: '2px solid rgba(255,255,255,0.1)',
          }}>
            <ShieldCheck style={{ width: 36, height: 36, color: '#FFFFFF' }} strokeWidth={2.2} />
          </div>
          <h1 style={{
            fontSize: '32px', fontWeight: 700, color: '#FFFFFF', margin: 0,
            fontFamily: "'Montserrat', sans-serif", letterSpacing: '-0.02em',
          }}>
            Super <span style={{ color: '#DC2626' }}>Admin</span>
          </h1>
          <p style={{ color: '#94A3B8', fontSize: '14px', marginTop: '6px' }}>
            OnlineSCADA Platform Control
          </p>
        </div>

        {/* Card */}
        <div style={{
          padding: '32px', borderRadius: '20px',
          background: 'rgba(15,23,42,0.7)',
          border: '1px solid rgba(148,163,184,0.15)',
          backdropFilter: 'blur(24px)',
          boxShadow: '0px 32px 80px rgba(0,0,0,0.5)',
        }}>
          <h2 style={{
            fontSize: '20px', fontWeight: 700, color: '#F8FAFC',
            marginBottom: '8px', textAlign: 'center',
            fontFamily: "'Montserrat', sans-serif",
          }}>
            Platform Access
          </h2>
          <p style={{ fontSize: '12px', color: '#64748B', textAlign: 'center', marginBottom: '24px' }}>
            Restricted area — authorized personnel only
          </p>

          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: '10px', marginBottom: '16px',
              background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.4)',
              color: '#FCA5A5', fontSize: '13px', display: 'flex', alignItems: 'flex-start', gap: '8px',
            }}>
              <AlertCircle style={{ width: 16, height: 16, flexShrink: 0, marginTop: '2px' }} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Email</label>
              <div style={{ position: 'relative' }}>
                <Mail style={iconStyle} />
                <input
                  type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@onlinescada.in" required autoFocus
                  style={inputStyle}
                  onFocus={(e) => { e.target.style.borderColor = '#DC2626'; e.target.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.15)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'rgba(148,163,184,0.2)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Password</label>
              <div style={{ position: 'relative' }}>
                <Lock style={iconStyle} />
                <input
                  type="password" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password" required
                  style={inputStyle}
                  onFocus={(e) => { e.target.style.borderColor = '#DC2626'; e.target.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.15)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'rgba(148,163,184,0.2)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            </div>

            <button
              type="submit" disabled={loading}
              style={{
                width: '100%', padding: '13px', borderRadius: '12px', border: 'none',
                background: loading ? '#475569' : 'linear-gradient(135deg, #DC2626 0%, #7F1D1D 100%)',
                color: '#FFFFFF', fontSize: '14px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                fontFamily: "'Montserrat', sans-serif",
                boxShadow: loading ? 'none' : '0px 8px 20px rgba(220,38,38,0.35)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { if (!loading) e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              {loading ? (<><Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />Authenticating…</>) : 'Sign In'}
            </button>
          </form>

          {/* Return to workspace */}
          <div style={{
            marginTop: '20px', paddingTop: '16px',
            borderTop: '1px solid rgba(148,163,184,0.1)',
            textAlign: 'center',
          }}>
            <a
              href="/login"
              style={{ fontSize: '12px', color: '#64748B', textDecoration: 'none' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#2563EB'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#64748B'; }}
            >
              ← Back to workspace login
            </a>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: '11px', color: '#475569', marginTop: '20px' }}>
          © 2026 OnlineSCADA — Platform Control · Secured 4-hour session
        </p>
      </div>
    </div>
  );
};

// ─── Shared styles ─────────────────────────────────────────
const labelStyle = {
  display: 'block', fontSize: '11px', fontWeight: 600,
  color: '#CBD5E1', marginBottom: '6px', textTransform: 'uppercase',
  letterSpacing: '0.05em',
};
const iconStyle = {
  position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
  width: 16, height: 16, color: '#64748B', pointerEvents: 'none',
};
const inputStyle = {
  width: '100%', padding: '11px 12px 11px 38px',
  borderRadius: '10px', border: '1px solid rgba(148,163,184,0.2)',
  background: 'rgba(15,23,42,0.6)', color: '#F8FAFC',
  fontSize: '14px', outline: 'none', transition: 'all 0.15s ease',
  fontFamily: 'inherit',
};

export default SuperAdminLogin;