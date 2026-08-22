// ═══════════════════════════════════════════════════════════
// AuthContext — Multi-Tenant Dual-Token + Signup Management
// ═══════════════════════════════════════════════════════════

import { createContext, useContext, useState, useEffect } from 'react';
import { workspaceAPI, signupAPI } from '../services/api';
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
        setTimeout(() => socketService.connect(), 500);
      }
    } catch (err) {
      console.warn('[Auth] Failed to load stored session:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Helper to persist successful signup/login
  const handleAuthSuccess = (data) => {
    const { workspaceToken, userToken, company, user, users } = data;

    localStorage.setItem('workspaceToken', workspaceToken);
    localStorage.setItem('userToken', userToken);

    const wsData = { company, users: users || [user] };
    localStorage.setItem('workspaceData', JSON.stringify(wsData));
    localStorage.setItem('userData', JSON.stringify(user));

    setWorkspaceData(wsData);
    setUserData(user);

    socketService.reconnectWithNewToken();
  };

  // Step 1: Verify Workspace
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

  // Step 2: Login User
  const loginUser = async (userId, password) => {
    try {
      const res = await workspaceAPI.loginUser(userId, password);
      const { userToken, user } = res.data.data;

      localStorage.setItem('userToken', userToken);
      localStorage.setItem('userData', JSON.stringify(user));
      setUserData(user);

      socketService.reconnectWithNewToken();

      return { success: true, user };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Login failed',
      };
    }
  };

  // Manual Signup
  const signupManual = async (companyName, fullName, email, password) => {
    try {
      const res = await signupAPI.manual(companyName, fullName, email, password);
      handleAuthSuccess(res.data.data);
      return { success: true, user: res.data.data.user };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Signup failed',
      };
    }
  };

  // Google Signup/Login
  const signupGoogle = async (credential) => {
    try {
      const res = await signupAPI.google(credential);
      handleAuthSuccess(res.data.data);
      return { success: true, user: res.data.data.user };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Google authentication failed',
      };
    }
  };

  const logoutUser = async () => {
    try { await workspaceAPI.logoutUser().catch(() => {}); } catch {}
    socketService.disconnect();
    localStorage.removeItem('userToken');
    localStorage.removeItem('userData');
    setUserData(null);
  };

  const logoutAll = async () => {
    try { await workspaceAPI.logoutAll().catch(() => {}); } catch {}
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
    } catch {
      return [];
    }
  };

  const authState = (() => {
    if (userData && workspaceData) return 'LOGGED_IN';
    if (workspaceData)             return 'WORKSPACE_ONLY';
    return 'LOGGED_OUT';
  })();

  const isRole = (...roles) => userData && roles.includes(userData.role);
  const hasPermission = (perm) => !!userData?.permissions?.[perm];

  const legacyUser = userData ? { ...userData, username: userData.username, role: userData.role, email: userData.email, _id: userData._id } : null;

  return (
    <AuthContext.Provider
      value={{
        workspaceData, userData,
        company: workspaceData?.company || null,
        users: workspaceData?.users || [],
        loading, authState,
        verifyWorkspace, loginUser,
        signupManual, signupGoogle,
        logoutUser, logoutAll, refreshUsers,
        isRole, hasPermission,
        user: legacyUser,
        isAuthenticated: authState === 'LOGGED_IN',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
};