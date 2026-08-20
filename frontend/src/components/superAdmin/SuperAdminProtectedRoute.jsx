// ═══════════════════════════════════════════════════════════
// SuperAdminProtectedRoute — Guards /super-admin/* pages
// Redirects to /super-admin/login if not authenticated
// ═══════════════════════════════════════════════════════════

import { Navigate } from 'react-router-dom';
import { useSuperAdminAuth } from '../../context/SuperAdminAuthContext';
import { Loader2 } from 'lucide-react';

const SuperAdminProtectedRoute = ({ children }) => {
  const { loading, isAuthenticated } = useSuperAdminAuth();

  if (loading) {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0F172A',
      }}>
        <Loader2 style={{ width: 48, height: 48, color: '#2563EB', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/super-admin/login" replace />;
  }

  return children;
};

export default SuperAdminProtectedRoute;