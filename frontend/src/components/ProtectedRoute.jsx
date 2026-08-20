// ═══════════════════════════════════════════════════════════
// ProtectedRoute — Multi-Tenant Route Guard
//
// Three protection levels:
//   1. Not logged in at all       → redirect to /login
//   2. Workspace verified, no user → redirect to /select-user
//   3. Logged in, but wrong role  → redirect to their landing page
//
// Usage:
//   <ProtectedRoute>
//     <Dashboard />
//   </ProtectedRoute>
//
//   <ProtectedRoute allowedRoles={['admin', 'engineer']}>
//     <Users />
//   </ProtectedRoute>
//
//   <ProtectedRoute allowedRoles={['admin', 'engineer', 'operator', 'viewer']}>
//     <Runtime />
//   </ProtectedRoute>
// ═══════════════════════════════════════════════════════════

import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

const ProtectedRoute = ({ children, allowedRoles = null }) => {
  const { loading, authState, userData } = useAuth();

  // ─── Loading state ────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#F8FBFF',
      }}>
        <Loader2 style={{
          width: 48, height: 48, color: '#2563EB',
          animation: 'spin 1s linear infinite',
        }} />
      </div>
    );
  }

  // ─── Not logged in at all ─────────────────────────────
  if (authState === 'LOGGED_OUT') {
    return <Navigate to="/login" replace />;
  }

  // ─── Workspace verified but no user chosen ────────────
  if (authState === 'WORKSPACE_ONLY') {
    return <Navigate to="/select-user" replace />;
  }

  // ─── Role check (if allowedRoles specified) ───────────
  if (allowedRoles && Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    if (!allowedRoles.includes(userData?.role)) {
      // Redirect to their landing page based on role
      const landing = getLandingForRole(userData?.role);
      return <Navigate to={landing} replace />;
    }
  }

  // ─── All checks passed ────────────────────────────────
  return children;
};

// ─── Landing page based on role ──────────────────────────
// Admin/Engineer → Dashboard (full app)
// Operator/Viewer → Runtime (locked page)
export const getLandingForRole = (role) => {
  if (role === 'operator' || role === 'viewer') return '/runtime';
  return '/dashboard';
};

export default ProtectedRoute;