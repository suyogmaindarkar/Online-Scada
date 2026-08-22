// ═══════════════════════════════════════════════════════════
// UserSelection — Step 2: Choose which user to log in as
// ✅ Added "Forgot Password?" Mailto fallback link
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Loader2, AlertCircle, Building2, LogOut, RefreshCw,
  Shield, Wrench, Radio, Eye, X, Lock, User as UserIcon,
} from 'lucide-react';

const ROLE_CONFIG = {
  admin:    { label: 'Administrator', icon: Shield,  color: '#DC2626', bg: '#FEE2E2' },
  engineer: { label: 'Engineer',      icon: Wrench,  color: '#2563EB', bg: '#EEF6FF' },
  operator: { label: 'Operator',      icon: Radio,   color: '#F59E0B', bg: '#FEF3C7' },
  viewer:   { label: 'Viewer',        icon: Eye,     color: '#9333EA', bg: '#F3E8FF' },
};

const UserSelection = () => {
  const navigate = useNavigate();
  const {
    authState, workspaceData, users, company,
    logoutAll, refreshUsers, loginUser,
  } = useAuth();

  const [selectedUser, setSelectedUser] = useState(null);
  const [refreshing,   setRefreshing]   = useState(false);

  useEffect(() => {
    if (authState === 'LOGGED_OUT') navigate('/login');
    if (authState === 'LOGGED_IN')  navigate('/dashboard');
  }, [authState, navigate]);

  useEffect(() => {
    const interval = setInterval(() => {
      refreshUsers().catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshUsers();
    setRefreshing(false);
  };

  const handleUserClick = (user) => setSelectedUser(user);
  const handleClosePasswordModal = () => setSelectedUser(null);

  const handleFullLogout = async () => {
    if (window.confirm('Sign out completely and switch workspace?')) {
      await logoutAll();
      navigate('/login');
    }
  };

  if (!workspaceData) return null;

  return (
    <div
      className="min-h-screen flex flex-col p-4"
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

      <div className="w-full max-w-4xl mx-auto relative z-10 flex-1 flex flex-col justify-center py-8">
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center gap-3 px-5 py-2 rounded-full mb-4"
            style={{
              background: '#FFFFFF', border: '1px solid #E5E7EB',
              boxShadow: '0px 4px 12px rgba(8,27,67,0.05)',
            }}
          >
            <Building2 size={16} style={{ color: '#2563EB' }} />
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#081B43' }}>
              {company?.companyName || 'Workspace'}
            </span>
            <span style={{ fontSize: '10px', color: '#94A3B8', fontFamily: 'monospace' }}>
              /{company?.slug}
            </span>
          </div>

          <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: "'Montserrat', sans-serif", color: '#081B43' }}>
            Choose Your Account
          </h1>
          <p style={{ color: '#5F6B7A', fontSize: '14px' }}>Click your name to sign in</p>
        </div>

        {users.length === 0 ? (
          <div className="text-center py-16">
            <UserIcon size={48} style={{ color: '#94A3B8', margin: '0 auto 12px' }} />
            <p style={{ color: '#5F6B7A' }}>No users found in this workspace.</p>
            <p style={{ color: '#94A3B8', fontSize: '12px', marginTop: '4px' }}>Contact your administrator.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.map((user) => {
              const roleConfig = ROLE_CONFIG[user.role] || ROLE_CONFIG.viewer;
              const RoleIcon = roleConfig.icon;

              return (
                <button
                  key={user._id}
                  onClick={() => handleUserClick(user)}
                  className="p-5 rounded-2xl text-left transition-all"
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E5E7EB',
                    boxShadow: '0px 4px 12px rgba(8,27,67,0.05)',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0px 12px 24px rgba(37,99,235,0.15)';
                    e.currentTarget.style.borderColor = '#2563EB';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0px 4px 12px rgba(8,27,67,0.05)';
                    e.currentTarget.style.borderColor = '#E5E7EB';
                  }}
                >
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center mb-3 mx-auto"
                    style={{
                      background: `linear-gradient(135deg, ${user.avatarColor || '#2563EB'} 0%, ${user.avatarColor || '#0F3D91'}dd 100%)`,
                      boxShadow: `0px 4px 16px ${user.avatarColor || '#2563EB'}40`,
                    }}
                  >
                    <span style={{ fontSize: '24px', fontWeight: 700, color: '#FFFFFF', fontFamily: "'Montserrat', sans-serif" }}>
                      {(user.fullName || user.username || '?').charAt(0).toUpperCase()}
                    </span>
                  </div>

                  <p className="text-center font-bold mb-1" style={{ color: '#081B43', fontSize: '15px', fontFamily: "'Montserrat', sans-serif" }}>
                    {user.fullName || user.username}
                  </p>
                  <p className="text-center text-xs mb-3" style={{ color: '#5F6B7A' }}>
                    @{user.username}
                  </p>

                  <div className="flex items-center justify-center gap-1.5 py-1 px-2 rounded-full mx-auto"
                    style={{ background: roleConfig.bg, color: roleConfig.color, width: 'fit-content' }}>
                    <RoleIcon size={11} />
                    <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {roleConfig.label}
                    </span>
                  </div>

                  {user.lastLogin && (
                    <p className="text-center text-[10px] mt-2" style={{ color: '#94A3B8' }}>
                      Last login: {new Date(user.lastLogin).toLocaleDateString()}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            style={{
              background: '#FFFFFF', border: '1px solid #E5E7EB', color: '#5F6B7A',
              cursor: refreshing ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={(e) => { if (!refreshing) e.currentTarget.style.background = '#EEF6FF'; }}
            onMouseLeave={(e) => { if (!refreshing) e.currentTarget.style.background = '#FFFFFF'; }}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>

          <button
            onClick={handleFullLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{
              background: '#FFFFFF', border: '1px solid rgba(220,38,38,0.30)',
              color: '#DC2626', cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#DC2626'; e.currentTarget.style.color = '#FFFFFF'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.color = '#DC2626'; }}
          >
            <LogOut size={14} />
            Switch Workspace
          </button>
        </div>
      </div>

      {selectedUser && (
        <UserLoginModal
          user={selectedUser}
          company={company}
          onClose={handleClosePasswordModal}
          onSuccess={(user) => {
            if (user.role === 'operator' || user.role === 'viewer') {
              navigate('/runtime');
            } else {
              navigate('/dashboard');
            }
          }}
          loginUser={loginUser}
        />
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// USER LOGIN MODAL
// ═══════════════════════════════════════════════════════════
const UserLoginModal = ({ user, company, onClose, onSuccess, loginUser }) => {
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const roleConfig = ROLE_CONFIG[user.role] || ROLE_CONFIG.viewer;
  const RoleIcon = roleConfig.icon;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await loginUser(user._id, password);
    if (result.success) {
      onSuccess(result.user);
    } else {
      setError(result.message);
      setLoading(false);
    }
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(8,27,67,0.6)', backdropFilter: 'blur(4px)' }} />

      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)', zIndex: 10000,
        background: '#FFFFFF', borderRadius: '16px',
        padding: '28px', width: '380px', maxWidth: '90vw',
        boxShadow: '0px 24px 80px rgba(8,27,67,0.25)',
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: '12px', right: '12px',
            background: 'transparent', border: 'none', cursor: 'pointer',
            padding: '6px', borderRadius: '6px', color: '#94A3B8',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#081B43'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94A3B8'; }}
        >
          <X size={18} />
        </button>

        <div style={{
          width: '72px', height: '72px', borderRadius: '50%',
          background: `linear-gradient(135deg, ${user.avatarColor || '#2563EB'} 0%, ${user.avatarColor || '#0F3D91'}dd 100%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
          boxShadow: `0px 8px 24px ${user.avatarColor || '#2563EB'}40`,
        }}>
          <span style={{ fontSize: '32px', fontWeight: 700, color: '#FFFFFF', fontFamily: "'Montserrat', sans-serif" }}>
            {(user.fullName || user.username || '?').charAt(0).toUpperCase()}
          </span>
        </div>

        <p style={{ textAlign: 'center', fontSize: '18px', fontWeight: 700, color: '#081B43', margin: 0, fontFamily: "'Montserrat', sans-serif" }}>
          {user.fullName || user.username}
        </p>
        <p style={{ textAlign: 'center', fontSize: '12px', color: '#5F6B7A', margin: '4px 0 12px' }}>
          {user.email}
        </p>

        <div style={{
          display: 'flex', alignItems: 'center', justifycenter: 'center', gap: '6px',
          padding: '4px 12px', borderRadius: '999px',
          background: roleConfig.bg, color: roleConfig.color,
          width: 'fit-content', margin: '0 auto 20px',
        }}>
          <RoleIcon size={12} />
          <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {roleConfig.label}
          </span>
        </div>

        {error && (
          <div style={{
            padding: '10px 12px', borderRadius: '8px', marginBottom: '12px',
            background: '#FEE2E2', border: '1px solid rgba(220,38,38,0.30)',
            color: '#7F1D1D', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <AlertCircle size={14} style={{ color: '#DC2626', flexShrink: 0 }} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ position: 'relative', marginBottom: '12px' }}>
            <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input
              type="password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoFocus required
              style={{
                width: '100%', padding: '12px 12px 12px 40px',
                borderRadius: '10px', border: '1px solid #E5E7EB',
                fontSize: '14px', outline: 'none',
                background: '#F8FAFC', color: '#081B43',
              }}
              onFocus={(e) => { e.target.style.borderColor = '#2563EB'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.15)'; }}
              onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
            />
          </div>

          <button
            type="submit" disabled={loading || !password}
            style={{
              width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
              background: '#081B43', color: '#FFFFFF',
              fontSize: '14px', fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              fontFamily: "'Montserrat', sans-serif",
              opacity: (loading || !password) ? 0.6 : 1,
            }}
            onMouseEnter={(e) => { if (!loading && password) e.currentTarget.style.background = '#123E8A'; }}
            onMouseLeave={(e) => { if (!loading && password) e.currentTarget.style.background = '#081B43'; }}
          >
            {loading ? <><Loader2 size={16} className="animate-spin" />Signing in…</> : 'Sign In'}
          </button>
        </form>

        {/* ✅ NEW: Forgot Password Mailto Link */}
        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <a
            href={`mailto:suyogmaindarkar@gmail.com?subject=Password Reset Request - ${company?.companyName || 'OnlineSCADA'}&body=Hi,%0D%0A%0D%0AI have forgotten the password for my user account and need a reset.%0D%0A%0D%0AUser Email: ${user.email}%0D%0AWorkspace: ${company?.slug}%0D%0A`}
            style={{
              fontSize: '12px', color: '#64748B', textDecoration: 'none', fontWeight: 500,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#2563EB'; e.currentTarget.style.textDecoration = 'underline'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#64748B'; e.currentTarget.style.textDecoration = 'none'; }}
          >
            Forgot Password?
          </a>
        </div>

      </div>
    </>
  );
};

export default UserSelection;