// ═══════════════════════════════════════════════════════════
// ServerTimeContext — subscribes to server time broadcasts
// ✅ FIXED: Skip socket listeners when no userToken or on super-admin
// ═══════════════════════════════════════════════════════════

import { createContext, useContext, useEffect, useState, useRef } from 'react';
import socketService from '../services/socket';

const ServerTimeContext = createContext(null);

// ─── Helper: Is this a workspace user context? ─────────────
const isWorkspaceUserContext = () => {
  if (typeof window === 'undefined') return false;
  if (window.location.pathname.startsWith('/super-admin')) return false;
  if (!localStorage.getItem('userToken')) return false;
  return true;
};

export const ServerTimeProvider = ({ children }) => {
  const [serverTime, setServerTime]             = useState(new Date());
  const [isServerConnected, setIsServerConnected] = useState(false);

  const lastServerUpdateRef = useRef(Date.now());
  const localTickRef        = useRef(null);

  useEffect(() => {
    // ✅ Guard: super-admin and logged-out pages don't need server time sync
    if (!isWorkspaceUserContext()) {
      // Still tick locally so clock components (if any) work
      localTickRef.current = setInterval(() => {
        setServerTime(new Date());
      }, 1000);
      return () => {
        if (localTickRef.current) clearInterval(localTickRef.current);
      };
    }

    const handleServerTime = (data) => {
      if (data?.timestamp) {
        setServerTime(new Date(data.timestamp));
        lastServerUpdateRef.current = Date.now();
        if (!isServerConnected) setIsServerConnected(true);
      }
    };

    socketService.on('serverTime', handleServerTime);

    localTickRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceLastServer = now - lastServerUpdateRef.current;

      if (timeSinceLastServer > 3000) {
        if (isServerConnected) setIsServerConnected(false);
        setServerTime(new Date());
      }
    }, 1000);

    return () => {
      socketService.off('serverTime', handleServerTime);
      if (localTickRef.current) clearInterval(localTickRef.current);
    };
  }, [isServerConnected]);

  return (
    <ServerTimeContext.Provider value={{ serverTime, isServerConnected }}>
      {children}
    </ServerTimeContext.Provider>
  );
};

export const useServerTime = () => {
  const ctx = useContext(ServerTimeContext);
  if (!ctx) {
    return { serverTime: new Date(), isServerConnected: false };
  }
  return ctx;
};

export default ServerTimeContext;