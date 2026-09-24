// ═══════════════════════════════════════════════════════════
// Sidebar — Multi-Tenant with Role-Based Menu Filtering
//
// ✅ Hides menu items based on user role
// ✅ Shows workspace name in header
// ✅ Added Edge Gateways link to menu
// ✅ "Switch User" button (keeps workspace, back to UserSelection)
// ✅ "Switch Workspace" button (full logout)
// ═══════════════════════════════════════════════════════════

import { NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import socketService from '../../services/socket';
import {
  LayoutDashboard, Cpu, Tag, Palette, Monitor, Bell,
  TrendingUp, ChefHat, Users, Settings as SettingsIcon,
  Zap, LogOut, User, FileText, Repeat, Shield, Wrench, Radio, Eye, Network, HelpCircle
} from 'lucide-react';

// ─── Role display config ──────────────────────────────────
const ROLE_CONFIG = {
  admin: { label: 'Administrator', icon: Shield, color: '#DC2626', bg: '#FEE2E2' },
  engineer: { label: 'Engineer', icon: Wrench, color: '#2563EB', bg: '#EEF6FF' },
  operator: { label: 'Operator', icon: Radio, color: '#F59E0B', bg: '#FEF3C7' },
  viewer: { label: 'Viewer', icon: Eye, color: '#9333EA', bg: '#F3E8FF' },
};

// ─── Menu items with role restrictions ────────────────────
const MENU_ITEMS = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['admin', 'engineer'] },
  { path: '/plc', icon: Cpu, label: 'PLC Management', roles: ['admin', 'engineer'] },
  { path: '/tags', icon: Tag, label: 'Tag Management', roles: ['admin', 'engineer'] },
  { path: '/designer', icon: Palette, label: 'Graphic Designer', roles: ['admin', 'engineer'] },
  { path: '/runtime', icon: Monitor, label: 'Runtime', roles: ['admin', 'engineer', 'operator', 'viewer'] },
  { path: '/alarms', icon: Bell, label: 'Alarms', roles: ['admin', 'engineer', 'operator', 'viewer'] },
  { path: '/trends', icon: TrendingUp, label: 'Trends', roles: ['admin', 'engineer'] },
  { path: '/recipes', icon: ChefHat, label: 'Recipes', roles: ['admin', 'engineer'] },
  { path: '/reports', icon: FileText, label: 'Reports', roles: ['admin', 'engineer'] },
  { path: '/users', icon: Users, label: 'Users', roles: ['admin'] },
  { path: '/settings', icon: SettingsIcon, label: 'Settings', roles: ['admin'] },
  { path: '/help', icon: HelpCircle, label: 'Help', roles: ['admin', 'engineer', 'operator', 'viewer'] },
];

const Sidebar = () => {
  const { userData, company, logoutUser, logoutAll } = useAuth();
  const navigate = useNavigate();

  const [unreadAlarms, setUnreadAlarms] = useState(0);

  useEffect(() => {
    const handleAlarmTriggered = () => setUnreadAlarms((prev) => prev + 1);
    const handleRouteChange = () => {
      if (window.location.pathname === '/alarms') setUnreadAlarms(0);
    };
    socketService.on('alarmTriggered', handleAlarmTriggered);
    window.addEventListener('popstate', handleRouteChange);
    handleRouteChange();
    return () => {
      socketService.off('alarmTriggered', handleAlarmTriggered);
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, []);

  // ─── Filter menu based on user role ────────────────────
  const visibleMenu = MENU_ITEMS.filter(item =>
    item.roles.includes(userData?.role)
  );

  // ─── Get role config ──────────────────────────────────
  const roleConfig = ROLE_CONFIG[userData?.role] || ROLE_CONFIG.viewer;
  const RoleIcon = roleConfig.icon;

  // ─── Actions ──────────────────────────────────────────
  const handleSwitchUser = async () => {
    if (window.confirm('Switch to another user?')) {
      await logoutUser();
      navigate('/select-user');
    }
  };

  const handleFullLogout = async () => {
    if (window.confirm('Sign out completely and return to workspace login?')) {
      await logoutAll();
      navigate('/login');
    }
  };

  const handleBellClick = () => {
    setUnreadAlarms(0);
    navigate('/alarms');
  };

  return (
    <aside
      className="w-64 h-screen sticky top-0 flex flex-col"
      style={{
        background: '#FFFFFF',
        borderRight: '1px solid #E5E7EB',
        boxShadow: '1px 0 3px rgba(8, 27, 67, 0.03)',
      }}
    >
      {/* ═══════════ LOGO / TITLE SECTION ═══════════ */}
      <div className="px-6 py-4" style={{ borderBottom: '1px solid #E5E7EB' }}>
        <div>
          <h1
            className="text-lg font-bold leading-tight"
            style={{
              fontFamily: "'Montserrat', sans-serif",
              color: '#081B43',
              letterSpacing: '-0.01em',
            }}
          >
            Online<span style={{ color: '#2563EB' }}>SCADA</span>
          </h1>
          {/* Workspace name */}
          {company?.companyName && (
            <p
              className="text-[11px] mt-0.5 truncate"
              style={{ color: '#5F6B7A', fontWeight: 600 }}
              title={company.companyName}
            >
              🏢 {company.companyName}
            </p>
          )}
        </div>
      </div>

      {/* ═══════════ MENU SECTION ═══════════ */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <p
          className="px-3 mb-2 text-xs font-bold uppercase tracking-wider"
          style={{ color: '#94A3B8' }}
        >
          Main Menu
        </p>
        <ul className="space-y-0.5">
          {visibleMenu.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className="block"
                title={item.label}
                onClick={() => {
                  if (item.path === '/alarms') setUnreadAlarms(0);
                }}
              >
                {({ isActive }) => (
                  <div
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative"
                    style={{
                      background: isActive
                        ? 'linear-gradient(135deg, #2563EB 0%, #0F3D91 100%)'
                        : 'transparent',
                      color: isActive ? '#FFFFFF' : '#5F6B7A',
                      boxShadow: isActive ? '0px 4px 12px rgba(37, 99, 235, 0.25)' : 'none',
                      fontFamily: "'Inter', sans-serif",
                      fontWeight: isActive ? 600 : 500,
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = '#EEF6FF';
                        e.currentTarget.style.color = '#2563EB';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = '#5F6B7A';
                      }
                    }}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" strokeWidth={isActive ? 2.5 : 2} />
                    <span className="flex-1">{item.label}</span>

                    {item.path === '/alarms' && unreadAlarms > 0 && (
                      <span
                        className="ml-auto px-1.5 py-0.5 text-[10px] font-bold rounded-full min-w-[20px] text-center"
                        style={{
                          background: isActive ? '#FFFFFF' : '#DC2626',
                          color: isActive ? '#DC2626' : '#FFFFFF',
                        }}
                      >
                        {unreadAlarms > 99 ? '99+' : unreadAlarms}
                      </span>
                    )}
                  </div>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* ═══════════ USER PROFILE SECTION ═══════════ */}
      <div className="pt-3" style={{ borderTop: '1px solid #E5E7EB' }}>
        {/* ─── User Profile Card ─── */}
        <div
          className="mx-3 mb-2 rounded-xl p-3"
          style={{ background: '#F8FAFC', border: '1px solid #E5E7EB' }}
        >
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                background: `linear-gradient(135deg, ${userData?.avatarColor || '#2563EB'} 0%, ${userData?.avatarColor || '#0F3D91'}dd 100%)`,
                boxShadow: `0px 2px 8px ${userData?.avatarColor || '#2563EB'}40`,
              }}
            >
              <span style={{
                fontSize: '15px', fontWeight: 700, color: '#FFFFFF',
                fontFamily: "'Montserrat', sans-serif",
              }}>
                {(userData?.fullName || userData?.username || '?').charAt(0).toUpperCase()}
              </span>
            </div>

            {/* Name + Role */}
            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-bold truncate"
                style={{ color: '#081B43', fontFamily: "'Montserrat', sans-serif" }}
                title={userData?.fullName || userData?.username}
              >
                {userData?.fullName || userData?.username || 'User'}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <RoleIcon size={10} style={{ color: roleConfig.color }} />
                <p className="text-[10px] font-semibold" style={{ color: roleConfig.color }}>
                  {roleConfig.label}
                </p>
              </div>
            </div>

            {/* Bell notification button */}
            <button
              onClick={handleBellClick}
              className="relative p-2 rounded-lg transition-all flex-shrink-0"
              style={{
                background: unreadAlarms > 0 ? 'rgba(220, 38, 38, 0.10)' : 'transparent',
                color: unreadAlarms > 0 ? '#DC2626' : '#5F6B7A',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(220, 38, 38, 0.15)';
                e.currentTarget.style.color = '#DC2626';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = unreadAlarms > 0 ? 'rgba(220, 38, 38, 0.10)' : 'transparent';
                e.currentTarget.style.color = unreadAlarms > 0 ? '#DC2626' : '#5F6B7A';
              }}
              title={unreadAlarms > 0 ? `${unreadAlarms} new alarm(s)` : 'View alarms'}
            >
              <Bell className={`w-4 h-4 ${unreadAlarms > 0 ? 'animate-pulse' : ''}`} />
              {unreadAlarms > 0 && (
                <span
                  className="absolute top-1 right-1 w-2 h-2 rounded-full"
                  style={{ background: '#DC2626' }}
                />
              )}
            </button>
          </div>

          {/* ─── Switch User + Logout Buttons ─── */}
          <div className="flex gap-2 mt-3">
            {/* Switch User (keeps workspace) */}
            <button
              onClick={handleSwitchUser}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: '#FFFFFF', color: '#2563EB',
                border: '1px solid rgba(37, 99, 235, 0.30)',
                fontFamily: "'Montserrat', sans-serif",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#2563EB';
                e.currentTarget.style.color = '#FFFFFF';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#FFFFFF';
                e.currentTarget.style.color = '#2563EB';
              }}
              title="Switch to another user (keep workspace)"
            >
              <Repeat className="w-3 h-3" />
              Switch
            </button>

            {/* Full logout */}
            <button
              onClick={handleFullLogout}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: '#FFFFFF', color: '#DC2626',
                border: '1px solid rgba(220, 38, 38, 0.30)',
                fontFamily: "'Montserrat', sans-serif",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#DC2626';
                e.currentTarget.style.color = '#FFFFFF';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#FFFFFF';
                e.currentTarget.style.color = '#DC2626';
              }}
              title="Sign out completely (return to workspace login)"
            >
              <LogOut className="w-3 h-3" />
              Logout
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;