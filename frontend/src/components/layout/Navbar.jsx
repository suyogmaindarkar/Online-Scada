import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAlarmNotification } from '../../context/AlarmNotificationContext';
import {
  LogOut, User, Bell, AlertTriangle, CheckCircle,
  Volume2, VolumeX, ChevronRight, ExternalLink
} from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { activeAlarms = [], soundEnabled, setSoundEnabled, testSound } = useAlarmNotification();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const hasActive = activeAlarms.length > 0;
  const hasCritical = activeAlarms.some((a) => a.priority === 'CRITICAL' || a.priority === 'HIGH');

  const getPriorityStyle = (priority) => {
    switch (priority) {
      case 'CRITICAL':
        return { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' };
      case 'HIGH':
        return { bg: '#FFF7ED', text: '#EA580C', border: '#FED7AA' };
      case 'MEDIUM':
        return { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' };
      default:
        return { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' };
    }
  };

  return (
    <header
      className="sticky top-0 z-20 px-6 py-3.5"
      style={{
        background: '#FFFFFF',
        borderBottom: '1px solid #E5E7EB',
        boxShadow: '0px 1px 3px rgba(8, 27, 67, 0.04)',
      }}
    >
      <div className="flex items-center justify-between">
        {/* ─── Welcome section ─── */}
        <div>
          <h2
            className="text-lg font-semibold"
            style={{
              fontFamily: "'Montserrat', sans-serif",
              color: '#081B43',
            }}
          >
            Welcome back, {user?.username}
          </h2>
          <p className="text-sm mt-0.5" style={{ color: '#5F6B7A' }}>
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        {/* ─── Right side actions ─── */}
        <div className="flex items-center gap-3">
          {/* Notifications Dropdown Container */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="relative p-2.5 rounded-xl transition-all"
              style={{
                background: showDropdown || hasActive ? '#EEF6FF' : '#F8FAFC',
                color: showDropdown || hasActive ? '#2563EB' : '#5F6B7A',
                border: '1px solid',
                borderColor: showDropdown || hasActive ? '#BFDBFE' : '#E5E7EB',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#EEF6FF';
                e.currentTarget.style.color = '#2563EB';
              }}
              onMouseLeave={(e) => {
                if (!showDropdown && !hasActive) {
                  e.currentTarget.style.background = '#F8FAFC';
                  e.currentTarget.style.color = '#5F6B7A';
                }
              }}
              title="Alarm Notifications"
            >
              <Bell className="w-5 h-5" />
              {hasActive && (
                <span
                  className={`absolute -top-1 -right-1 min-w-[20px] h-5 px-1 flex items-center justify-center text-[11px] font-bold text-white rounded-full ${
                    hasCritical ? 'animate-pulse' : ''
                  }`}
                  style={{ background: hasCritical ? '#DC2626' : '#F59E0B' }}
                >
                  {activeAlarms.length > 99 ? '99+' : activeAlarms.length}
                </span>
              )}
            </button>

            {/* Dropdown Panel */}
            {showDropdown && (
              <div
                className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150"
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E5E7EB',
                  boxShadow: '0px 12px 36px rgba(8, 27, 67, 0.16)',
                }}
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <h3 className="font-semibold text-sm text-[#081B43]">
                      Active Alarms ({activeAlarms.length})
                    </h3>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSoundEnabled(!soundEnabled)}
                      className="p-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors"
                      style={{
                        background: soundEnabled ? '#F0FDF4' : '#FEF2F2',
                        color: soundEnabled ? '#16A34A' : '#DC2626',
                        border: `1px solid ${soundEnabled ? '#BBF7D0' : '#FECACA'}`,
                      }}
                      title={soundEnabled ? 'Mute alarm sound' : 'Unmute alarm sound'}
                    >
                      {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => testSound('MEDIUM')}
                      className="px-2 py-1 rounded-lg text-[11px] font-medium text-[#2563EB] bg-[#EFF6FF] hover:bg-[#DBEAFE] transition-colors"
                      title="Test alarm sound"
                    >
                      Test
                    </button>
                  </div>
                </div>

                {/* Alarm List */}
                <div className="max-h-64 overflow-y-auto space-y-2 mb-3 pr-1">
                  {activeAlarms.length === 0 ? (
                    <div className="py-6 text-center text-gray-500 text-xs flex flex-col items-center gap-2">
                      <CheckCircle className="w-8 h-8 text-emerald-500 opacity-80" />
                      <span>All systems normal. No active alarms.</span>
                    </div>
                  ) : (
                    activeAlarms.map((alarm, idx) => {
                      const style = getPriorityStyle(alarm.priority);
                      return (
                        <div
                          key={alarm._id || idx}
                          className="p-2.5 rounded-xl transition-all"
                          style={{
                            background: '#F8FAFC',
                            border: '1px solid #E5E7EB',
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-xs text-[#081B43]">
                                {alarm.alarmName}
                              </p>
                              <p className="text-[11px] text-[#5F6B7A] mt-0.5">
                                Tag: <span className="font-mono">{alarm.tag}</span>
                                {alarm.value !== undefined && ` (${alarm.value})`}
                              </p>
                            </div>
                            <span
                              className="px-1.5 py-0.5 text-[10px] font-bold rounded"
                              style={{
                                background: style.bg,
                                color: style.text,
                                border: `1px solid ${style.border}`,
                              }}
                            >
                              {alarm.priority || 'ALARM'}
                            </span>
                          </div>
                          {alarm.message && (
                            <p className="text-[11px] text-gray-600 mt-1 italic">
                              {alarm.message}
                            </p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer Link */}
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    navigate('/alarms');
                  }}
                  className="w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 text-white transition-colors"
                  style={{
                    background: '#081B43',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#123E8A')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#081B43')}
                >
                  <span>Go to Alarms Management</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* User Info Chip */}
          <div
            className="flex items-center gap-3 px-3 py-2 rounded-xl"
            style={{
              background: '#F8FAFC',
              border: '1px solid #E5E7EB',
            }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #2563EB 0%, #0F3D91 100%)',
                boxShadow: '0px 2px 8px rgba(37, 99, 235, 0.30)',
              }}
            >
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="text-sm">
              <p
                className="font-semibold leading-tight"
                style={{ color: '#081B43' }}
              >
                {user?.username}
              </p>
              <p
                className="text-xs capitalize leading-tight mt-0.5"
                style={{ color: '#5F6B7A' }}
              >
                {user?.role}
              </p>
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
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
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;