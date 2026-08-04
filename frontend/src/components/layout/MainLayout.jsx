import Sidebar from './Sidebar';
import { useLocation } from 'react-router-dom';

const MainLayout = ({ children }) => {
  const location = useLocation();

  // ─── Designer & Runtime need full-bleed (no padding, no page-scroll) ───
  const isDesigner = location.pathname === '/designer';
  const isRuntime  = location.pathname === '/runtime';
  const fullBleed  = isDesigner || isRuntime;

  const mainClassName = fullBleed
    ? 'flex-1 overflow-hidden p-0'
    : 'flex-1 overflow-y-auto overflow-x-hidden p-6';

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ backgroundColor: '#F8FAFC' }}
    >
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* ✅ Navbar REMOVED — user info + logout moved to Sidebar footer */}
        <main
          className={mainClassName}
          style={{ backgroundColor: '#F8FAFC' }}
        >
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;