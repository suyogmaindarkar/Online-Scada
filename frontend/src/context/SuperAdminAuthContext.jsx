// ═══════════════════════════════════════════════════════════
// SuperAdminAuthContext — Platform-level admin auth
//
// Completely isolated from workspace/user auth.
// Uses `superAdminToken` in localStorage (4h expiry).
// ═══════════════════════════════════════════════════════════

import { createContext, useContext, useState, useEffect } from 'react';
import { superAdminAPI } from '../services/api';

const SuperAdminAuthContext = createContext(null);

export const SuperAdminAuthProvider = ({ children }) => {
  const [superAdmin, setSuperAdmin] = useState(null);
  const [loading, setLoading]       = useState(true);

  // ─── Load stored session on mount ─────────────────────
  useEffect(() => {
    try {
      const stored = localStorage.getItem('superAdminData');
      if (stored) setSuperAdmin(JSON.parse(stored));
    } catch (err) {
      console.warn('[SuperAdminAuth] Failed to load stored session:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Login ───────────────────────────────────────────
  const login = async (email, password) => {
    try {
      const res = await superAdminAPI.login(email, password);
      const { token, superAdmin: adminData } = res.data.data;

      localStorage.setItem('superAdminToken', token);
      localStorage.setItem('superAdminData', JSON.stringify(adminData));
      setSuperAdmin(adminData);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Login failed',
      };
    }
  };

  // ─── Logout ──────────────────────────────────────────
  const logout = () => {
    localStorage.removeItem('superAdminToken');
    localStorage.removeItem('superAdminData');
    setSuperAdmin(null);
  };

  const isAuthenticated = !!superAdmin;

  return (
    <SuperAdminAuthContext.Provider
      value={{ superAdmin, loading, isAuthenticated, login, logout }}
    >
      {children}
    </SuperAdminAuthContext.Provider>
  );
};

export const useSuperAdminAuth = () => {
  const context = useContext(SuperAdminAuthContext);
  if (!context) {
    throw new Error('useSuperAdminAuth must be used inside SuperAdminAuthProvider');
  }
  return context;
};