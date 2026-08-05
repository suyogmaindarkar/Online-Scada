import { NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import socketService from '../../services/socket';
import {
  LayoutDashboard,
  Cpu,
  Tag,
  Palette,
  Monitor,
  Bell,
  TrendingUp,
  ChefHat,
  Users,
  Settings as SettingsIcon,
  Zap,
  LogOut,
  User,
   FileText, 
} from 'lucide-react';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // ─── Track unread alarm count (from socket events) ───
  const [unreadAlarms, setUnreadAlarms] = useState(0);

  useEffect(() => {
    const handleAlarmTriggered = () => {
      setUnreadAlarms((prev) => prev + 1);
    };

    // Clear count when user visits alarms page
    const handleRouteChange = () => {
      if (window.location.pathname === '/alarms') {
        setUnreadAlarms(0);
      }
    };

    socketService.on('alarmTriggered', handleAlarmTriggered);
    window.addEventListener('popstate', handleRouteChange);
    handleRouteChange(); // Initial check

    return () => {
      socketService.off('alarmTriggered', handleAlarmTriggered);
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, []);

  const menuItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/plc',       icon: Cpu,             label: 'PLC Management' },
    { path: '/tags',      icon: Tag,             label: 'Tag Management' },
    { path: '/designer',  icon: Palette,         label: 'Graphic Designer' },
    { path: '/runtime',   icon: Monitor,         label: 'Runtime' },
    { path: '/alarms',    icon: Bell,            label: 'Alarms', badge: unreadAlarms },
    { path: '/trends',    icon: TrendingUp,      label: 'Trends' },
    { path: '/recipes',   icon: ChefHat,         label: 'Recipes' },
      { path: '/reports',   icon: FileText,        label: 'Reports' },   // ✅ NEW
    { path: '/users',     icon: Users,           label: 'Users' },
    { path: '/settings',  icon: SettingsIcon,    label: 'Settings' },
  ];

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      logout();
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
      {/* ═══════════ LOGO SECTION ═══════════ */}
      <div
        className="px-6 py-5"
        style={{ borderBottom: '1px solid #E5E7EB' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #2563EB 0%, #0F3D91 100%)',
              boxShadow: '0px 4px 12px rgba(37, 99, 235, 0.30)',
            }}
          >
            <Zap className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
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
            <p
              className="text-xs mt-0.5"
              style={{ color: '#94A3B8', fontWeight: 500 }}
            >
              v1.0.0
            </p>
          </div>
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
          {menuItems.map((item) => (
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
                      boxShadow: isActive
                        ? '0px 4px 12px rgba(37, 99, 235, 0.25)'
                        : 'none',
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
                    <item.icon
                      className="w-5 h-5 flex-shrink-0"
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                    <span className="flex-1">{item.label}</span>

                    {/* ─── Unread alarm badge on Alarms menu ─── */}
                    {item.badge > 0 && (
                      <span
                        className="ml-auto px-1.5 py-0.5 text-[10px] font-bold rounded-full min-w-[20px] text-center"
                        style={{
                          background: isActive ? '#FFFFFF' : '#DC2626',
                          color: isActive ? '#DC2626' : '#FFFFFF',
                        }}
                      >
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </div>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* ═══════════ USER PROFILE + STATUS SECTION ═══════════ */}
      <div style={{ borderTop: '1px solid #E5E7EB' }}>
        {/* ─── System Online status pill ─── */}
        <div className="px-4 pt-3 pb-2">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{
              background: 'rgba(22, 163, 74, 0.08)',
              border: '1px solid rgba(22, 163, 74, 0.20)',
            }}
          >
            <div className="relative flex items-center justify-center">
              <div
                className="absolute w-3 h-3 rounded-full animate-ping"
                style={{ background: '#16A34A', opacity: 0.4 }}
              ></div>
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: '#16A34A' }}
              ></div>
            </div>
            <span
              className="text-xs font-semibold"
              style={{ color: '#15803D' }}
            >
              System Online
            </span>
          </div>
        </div>

        {/* ─── User Profile Card ─── */}
        <div
          className="mx-3 mb-2 rounded-xl p-3"
          style={{
            background: '#F8FAFC',
            border: '1px solid #E5E7EB',
          }}
        >
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, #2563EB 0%, #0F3D91 100%)',
                boxShadow: '0px 2px 8px rgba(37, 99, 235, 0.30)',
              }}
            >
              <User className="w-5 h-5 text-white" />
            </div>

            {/* Name + Role */}
            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-bold truncate"
                style={{
                  color: '#081B43',
                  fontFamily: "'Montserrat', sans-serif",
                }}
                title={user?.username}
              >
                {user?.username || 'User'}
              </p>
              <p
                className="text-[10px] capitalize truncate font-semibold"
                style={{ color: '#5F6B7A' }}
              >
                {user?.role || 'guest'}
              </p>
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
                ></span>
              )}
            </button>
          </div>

          {/* ─── Logout Button ─── */}
          <button
            onClick={handleLogout}
            className="w-full mt-3 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: '#FFFFFF',
              color: '#DC2626',
              border: '1px solid rgba(220, 38, 38, 0.30)',
              fontFamily: "'Montserrat', sans-serif",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#DC2626';
              e.currentTarget.style.color = '#FFFFFF';
              e.currentTarget.style.borderColor = '#DC2626';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#FFFFFF';
              e.currentTarget.style.color = '#DC2626';
              e.currentTarget.style.borderColor = 'rgba(220, 38, 38, 0.30)';
            }}
            title="Sign out of OnlineSCADA"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;