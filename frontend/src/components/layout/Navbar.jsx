import { useAuth } from '../../context/AuthContext';
import { LogOut, User, Bell } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useAuth();

  return (
    <header
      className="sticky top-0 z-10 px-6 py-3.5"
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
          {/* Notifications */}
          <button
            className="relative p-2.5 rounded-xl transition-all"
            style={{
              background: '#F8FAFC',
              color: '#5F6B7A',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#EEF6FF';
              e.currentTarget.style.color = '#2563EB';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#F8FAFC';
              e.currentTarget.style.color = '#5F6B7A';
            }}
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            <span
              className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
              style={{ background: '#DC2626' }}
            ></span>
          </button>

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