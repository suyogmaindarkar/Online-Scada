// ═══════════════════════════════════════════════════════════
// Sidebar — Professional UI (Collapsible & Emoji-Free)
// ═══════════════════════════════════════════════════════════

import { NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import socketService from '../../services/socket';
import {
  LayoutDashboard, Cpu, Tag, Palette, Monitor, Bell,
  TrendingUp, ChefHat, Users, Settings as SettingsIcon,
  LogOut, Repeat, Shield, Wrench, Radio, Eye, Network, FileText,
  HelpCircle, ChevronLeft, ChevronRight, Building2, Zap
} from 'lucide-react';

const ROLE_CONFIG = {
  admin: { label: 'Administrator', icon: Shield, color: '#DC2626', bg: '#FEE2E2' },
  engineer: { label: 'Engineer', icon: Wrench, color: '#2563EB', bg: '#EEF6FF' },
  operator: { label: 'Operator', icon: Radio, color: '#F59E0B', bg: '#FEF3C7' },
  viewer: { label: 'Viewer', icon: Eye, color: '#9333EA', bg: '#F3E8FF' },
};

const MENU_ITEMS = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['admin', 'engineer'] },
  { path: '/plc', icon: Cpu, label: 'Equipment', roles: ['admin', 'engineer'] },
  { path: '/tags', icon: Tag, label: 'Tag Management', roles: ['admin', 'engineer'] },
  { path: '/designer', icon: Palette, label: 'Graphic Designer', roles: ['admin', 'engineer'] },
  { path: '/runtime', icon: Monitor, label: 'Runtime', roles: ['admin', 'engineer', 'operator', 'viewer'] },
  { path: '/alarms', icon: Bell, label: 'Alarms', roles: ['admin', 'engineer', 'operator', 'viewer'] },
  { path: '/trends', icon: TrendingUp, label: 'Trends', roles: ['admin', 'engineer'] },
  { path: '/recipes', icon: ChefHat, label: 'Recipes', roles: ['admin', 'engineer'] },
  { path: '/reports', icon: FileText, label: 'Reports', roles: ['admin', 'engineer'] },
  { path: '/users', icon: Users, label: 'Users', roles: ['admin'] },
  { path: '/settings', icon: SettingsIcon, label: 'Settings', roles: ['admin'] },
  { path: '/help', icon: HelpCircle, label: 'Help & Docs', roles: ['admin', 'engineer', 'operator', 'viewer'] },
];

const Sidebar = () => {
  const { userData, company, logoutUser, logoutAll } = useAuth();
  const navigate = useNavigate();

  const [unreadAlarms, setUnreadAlarms] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return JSON.parse(localStorage.getItem('os_sidebar_collapsed')) || false;
  });

  useEffect(() => {
    localStorage.setItem('os_sidebar_collapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  useEffect(() => {
    const handleAlarmTriggered = () => setUnreadAlarms((prev) => prev + 1);
    const handleRouteChange = () => { if (window.location.pathname === '/alarms') setUnreadAlarms(0); };
    socketService.on('alarmTriggered', handleAlarmTriggered);
    window.addEventListener('popstate', handleRouteChange);
    handleRouteChange();
    return () => {
      socketService.off('alarmTriggered', handleAlarmTriggered);
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, []);

  const visibleMenu = MENU_ITEMS.filter(item => item.roles.includes(userData?.role));
  const roleConfig = ROLE_CONFIG[userData?.role] || ROLE_CONFIG.viewer;
  const RoleIcon = roleConfig.icon;

  const handleSwitchUser = async () => {
    if (window.confirm('Switch to another user?')) { await logoutUser(); navigate('/select-user'); }
  };
  const handleFullLogout = async () => {
    if (window.confirm('Sign out completely?')) { await logoutAll(); navigate('/login'); }
  };
  const handleBellClick = () => {
    setUnreadAlarms(0); navigate('/alarms');
  };

  return (
    <aside
      className={`h-screen sticky top-0 flex flex-col transition-all duration-300 ease-in-out z-20`}
      style={{
        width: isCollapsed ? '80px' : '260px',
        background: '#FFFFFF',
        borderRight: '1px solid #E5E7EB',
        boxShadow: '1px 0 10px rgba(8, 27, 67, 0.03)',
      }}
    >
      {/* ─── LOGO HEADER ─── */}
      <div className="px-5 py-5 flex items-center shrink-0 h-[80px]" style={{ borderBottom: '1px solid #F1F5F9' }}>
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #2563EB 0%, #0F3D91 100%)', boxShadow: '0 4px 10px rgba(37,99,235,0.2)' }}>
            <Zap size={20} color="#FFFFFF" />
          </div>
          <div className={`flex flex-col transition-opacity duration-300 ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'}`}>
            <h1 className="text-lg font-extrabold leading-tight tracking-tight whitespace-nowrap" style={{ color: '#081B43' }}>
              Online<span style={{ color: '#2563EB' }}>SCADA</span>
            </h1>
            {company?.companyName && (
              <div className="flex items-center gap-1.5 mt-0.5 text-slate-500 whitespace-nowrap">
                <Building2 size={12} />
                <p className="text-[11px] font-semibold truncate max-w-[130px]" title={company.companyName}>
                  {company.companyName}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── MENU ITEMS ─── */}
      <nav className="flex-1 px-3 py-5 overflow-y-auto overflow-x-hidden no-scrollbar">
        {!isCollapsed && <p className="px-3 mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Main Menu</p>}
        <ul className="space-y-1.5">
          {visibleMenu.map((item) => (
            <li key={item.path}>
              <NavLink to={item.path} className="block outline-none" title={isCollapsed ? item.label : undefined} onClick={() => { if (item.path === '/alarms') setUnreadAlarms(0); }}>
                {({ isActive }) => (
                  <div
                    className="flex items-center rounded-xl text-sm transition-all relative overflow-hidden group"
                    style={{
                      padding: isCollapsed ? '10px' : '10px 12px',
                      justifyContent: isCollapsed ? 'center' : 'flex-start',
                      background: isActive ? '#EEF6FF' : 'transparent',
                      color: isActive ? '#2563EB' : '#5F6B7A',
                      fontWeight: isActive ? 700 : 500,
                    }}
                  >
                    {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 rounded-r-full" />}

                    <div className="relative">
                      <item.icon size={isCollapsed ? 22 : 18} className="shrink-0 transition-transform group-hover:scale-110" strokeWidth={isActive ? 2.5 : 2} />
                      {item.path === '/alarms' && unreadAlarms > 0 && isCollapsed && (
                        <span className="absolute -top-1.5 -right-1.5 w-2.5 h-2.5 rounded-full bg-red-600 border-2 border-white" />
                      )}
                    </div>

                    {!isCollapsed && <span className="ml-3 truncate">{item.label}</span>}

                    {item.path === '/alarms' && unreadAlarms > 0 && !isCollapsed && (
                      <span className="ml-auto px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-100 text-red-700">
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

      {/* ─── BOTTOM PROFILE & CONTROLS ─── */}
      <div className="p-3 border-t shrink-0 bg-slate-50" style={{ borderColor: '#F1F5F9' }}>

        {/* User Info */}
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-2'} mb-3`}>
          <div className="relative">
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm border border-white"
              style={{ background: `linear-gradient(135deg, ${userData?.avatarColor || '#2563EB'} 0%, ${userData?.avatarColor || '#0F3D91'}dd 100%)` }}>
              <span className="text-[15px] font-bold text-white uppercase">{(userData?.fullName || userData?.username || '?').charAt(0)}</span>
            </div>
            {isCollapsed && unreadAlarms > 0 && (
              <div onClick={handleBellClick} className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white cursor-pointer animate-pulse" title={`${unreadAlarms} alarms`} />
            )}
          </div>

          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-800 truncate" title={userData?.fullName}>{userData?.fullName || userData?.username}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <RoleIcon size={10} style={{ color: roleConfig.color }} />
                <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: roleConfig.color }}>{roleConfig.label}</p>
              </div>
            </div>
          )}

          {!isCollapsed && (
            <button onClick={handleBellClick} className="p-2 rounded-lg text-slate-500 hover:bg-slate-200 transition-colors relative" title="Alarms">
              <Bell size={16} />
              {unreadAlarms > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-600 border border-white" />}
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className={`flex ${isCollapsed ? 'flex-col' : ''} gap-2`}>
          <button onClick={handleSwitchUser} title="Switch User"
            className="flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg text-xs font-bold text-blue-700 bg-blue-100 hover:bg-blue-200 transition-colors">
            <Repeat size={14} /> {!isCollapsed && "Switch"}
          </button>
          <button onClick={handleFullLogout} title="Logout"
            className="flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg text-xs font-bold text-red-700 bg-red-100 hover:bg-red-200 transition-colors">
            <LogOut size={14} /> {!isCollapsed && "Logout"}
          </button>
        </div>

        {/* Collapse Toggle */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full mt-3 flex items-center justify-center py-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

    </aside>
  );
};

export default Sidebar;