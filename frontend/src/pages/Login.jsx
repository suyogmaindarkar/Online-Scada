import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, User, AlertCircle, Loader2, Zap } from 'lucide-react';

const Login = () => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // ✅ T009: Show session expiry reason if redirected here from expired token
  useEffect(() => {
    const reason = sessionStorage.getItem('authRedirectReason');
    if (reason) {
      setError(reason);
      sessionStorage.removeItem('authRedirectReason');
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(username, password);

    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.message);
    }

    setLoading(false);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #F8FBFF 0%, #EEF6FF 100%)',
      }}
    >
      {/* Blueprint grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(15, 61, 145, 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(15, 61, 145, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      <div className="w-full max-w-md relative z-10">
        {/* ─── Logo + Brand ─── */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{
              background: 'linear-gradient(135deg, #2563EB 0%, #0F3D91 100%)',
              boxShadow: '0px 10px 25px -3px rgba(37, 99, 235, 0.35)',
            }}
          >
            <Zap className="w-8 h-8 text-white" strokeWidth={2.5} />
          </div>
          <h1
            className="text-4xl font-bold mb-2"
            style={{
              fontFamily: "'Montserrat', sans-serif",
              color: '#081B43',
              letterSpacing: '-0.02em',
            }}
          >
            Online<span style={{ color: '#2563EB' }}>SCADA</span>
          </h1>
          <p style={{ color: '#5F6B7A', fontSize: '15px' }}>
            Supervise · Control · Optimize
          </p>
        </div>

        {/* ─── Login Card ─── */}
        <div
          className="p-8 rounded-2xl"
          style={{
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            boxShadow: '0px 24px 80px rgba(8, 27, 67, 0.10)',
          }}
        >
          <h2
            className="text-2xl font-bold mb-6 text-center"
            style={{ fontFamily: "'Montserrat', sans-serif", color: '#081B43' }}
          >
            Sign In
          </h2>

          {/* ─── Error banner ─── */}
          {error && (
            <div
              className="px-4 py-3 rounded-lg mb-4 flex items-start gap-2"
              style={{
                background: '#FEE2E2',
                border: '1px solid rgba(220, 38, 38, 0.30)',
                color: '#7F1D1D',
              }}
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#DC2626' }} />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}

          {/* ─── Form ─── */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label
                className="block text-sm font-semibold mb-2"
                style={{ color: '#081B43' }}
              >
                Username
              </label>
              <div className="relative">
                <User
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5"
                  style={{ color: '#94A3B8' }}
                />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl outline-none transition-all"
                  style={{
                    background: '#F8FAFC',
                    border: '1px solid #E5E7EB',
                    color: '#081B43',
                    fontSize: '15px',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#2563EB';
                    e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.15)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#E5E7EB';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                className="block text-sm font-semibold mb-2"
                style={{ color: '#081B43' }}
              >
                Password
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5"
                  style={{ color: '#94A3B8' }}
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl outline-none transition-all"
                  style={{
                    background: '#F8FAFC',
                    border: '1px solid #E5E7EB',
                    color: '#081B43',
                    fontSize: '15px',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#2563EB';
                    e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.15)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#E5E7EB';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>

            {/* Submit Button — matches "Book a Demo" style */}
            <button
              type="submit"
              disabled={loading}
              className="w-full font-semibold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
              style={{
                background: '#081B43',
                color: '#FFFFFF',
                boxShadow: '0px 4px 16px rgba(8, 27, 67, 0.25)',
                fontFamily: "'Montserrat', sans-serif",
                fontSize: '15px',
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = '#123E8A'; }}
              onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = '#081B43'; }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Default Credentials Info */}
          <div
            className="mt-6 p-3 rounded-lg text-center"
            style={{
              background: '#EEF6FF',
              border: '1px solid rgba(37, 99, 235, 0.20)',
            }}
          >
            <p className="text-xs" style={{ color: '#5F6B7A' }}>
              Default:{' '}
              <span style={{ color: '#0F3D91', fontWeight: 700 }}>admin</span>
              {' / '}
              <span style={{ color: '#0F3D91', fontWeight: 700 }}>admin123</span>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p
          className="text-center text-sm mt-6"
          style={{ color: '#5F6B7A' }}
        >
          © 2025{' '}
          <span style={{ color: '#081B43', fontWeight: 600 }}>
            Online<span style={{ color: '#2563EB' }}>SCADA</span>
          </span>
          {' — '}Modern Web-Based SCADA Platform
        </p>
      </div>
    </div>
  );
};

export default Login;