// ═══════════════════════════════════════════════════════════
// AuthContext — Multi-Tenant Dual-Token Management
// ✅ FIXED: Reconnects socket with new userToken on login/logout
// ═══════════════════════════════════════════════════════════

import { createContext, useContext, useState, useEffect } from 'react';
import { workspaceAPI } from '../services/api';
import socketService from '../services/socket';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [workspaceData, setWorkspaceData] = useState(null);
  const [userData,      setUserData]      = useState(null);
  const [loading,       setLoading]       = useState(true);

  useEffect(() => {
    try {
      const ws = localStorage.getItem('workspaceData');
      const u  = localStorage.getItem('userData');
      if (ws) setWorkspaceData(JSON.parse(ws));
      if (u)  {
        setUserData(JSON.parse(u));
        // ✅ Reconnect socket if we already have a userToken on mount
        setTimeout(() => socketService.connect(), 500);
      }
    } catch (err) {
      console.warn('[Auth] Failed to load stored session:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyWorkspace = async (slug, adminEmail, adminPassword) => {
    try {
      const res = await workspaceAPI.verify(slug, adminEmail, adminPassword);
      const { workspaceToken, company, users } = res.data.data;

      localStorage.setItem('workspaceToken', workspaceToken);
      const wsData = { company, users };
      localStorage.setItem('workspaceData', JSON.stringify(wsData));
      setWorkspaceData(wsData);

      return { success: true, users };
    } catch (error) {
      return {
        success: false,
        code:    error.response?.data?.code || 'UNKNOWN',
        message: error.response?.data?.message || 'Workspace verification failed',
      };
    }
  };

  const loginUser = async (userId, password) => {
    try {
      const res = await workspaceAPI.loginUser(userId, password);
      const { userToken, user } = res.data.data;

      localStorage.setItem('userToken', userToken);
      localStorage.setItem('userData', JSON.stringify(user));
      setUserData(user);

      // ✅ CRITICAL: Reconnect socket with the new userToken
      // so backend can authenticate and join user's company room
      socketService.reconnectWithNewToken();

      return { success: true, user };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Login failed',
      };
    }
  };

  const logoutUser = async () => {
    try {
      await workspaceAPI.logoutUser().catch(() => {});
    } catch {}

    // ✅ Disconnect socket (no user context anymore)
    socketService.disconnect();

    localStorage.removeItem('userToken');
    localStorage.removeItem('userData');
    setUserData(null);
  };

  const logoutAll = async () => {
    try {
      await workspaceAPI.logoutAll().catch(() => {});
    } catch {}

    socketService.disconnect();

    localStorage.removeItem('userToken');
    localStorage.removeItem('userData');
    localStorage.removeItem('workspaceToken');
    localStorage.removeItem('workspaceData');
    setUserData(null);
    setWorkspaceData(null);
  };

  const refreshUsers = async () => {
    try {
      const res = await workspaceAPI.getUsers();
      const users = res.data?.data || [];
      const updated = { ...workspaceData, users };
      setWorkspaceData(updated);
      localStorage.setItem('workspaceData', JSON.stringify(updated));
      return users;
    } catch (error) {
      return [];
    }
  };

  const authState = (() => {
    if (userData && workspaceData) return 'LOGGED_IN';
    if (workspaceData)             return 'WORKSPACE_ONLY';
    return 'LOGGED_OUT';
  })();

  const isRole = (...roles) => {
    if (!userData) return false;
    return roles.includes(userData.role);
  };

  const hasPermission = (perm) => {
    if (!userData?.permissions) return false;
    return !!userData.permissions[perm];
  };

  const legacyUser = userData ? {
    ...userData,
    username: userData.username,
    role:     userData.role,
    email:    userData.email,
    _id:      userData._id,
  } : null;

  const legacyLogin = async () => {
    throw new Error('Legacy login() is deprecated. Use verifyWorkspace() + loginUser().');
  };

  const legacyLogout = async () => {
    await logoutAll();
    window.location.href = '/login';
  };

  const value = {
    workspaceData,
    userData,
    company:  workspaceData?.company || null,
    users:    workspaceData?.users   || [],
    loading,
    authState,
    verifyWorkspace,
    loginUser,
    logoutUser,
    logoutAll,
    refreshUsers,
    isRole,
    hasPermission,

    // Legacy compat
    user:            legacyUser,
    login:           legacyLogin,
    logout:          legacyLogout,
    isAuthenticated: authState === 'LOGGED_IN',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
};