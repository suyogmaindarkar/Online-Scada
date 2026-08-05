// ═══════════════════════════════════════════════════════════
// ServerTimeContext — subscribes to server time broadcasts
//
// Provides:
//   • serverTime — always-current server time (Date object)
//   • useServerTime() hook for components
//
// Behavior:
//   • Updates every 1s from backend Socket.IO 'serverTime' event
//   • If socket disconnects, falls back to LOCAL time + drift warning
//   • Auto-syncs when reconnected
// ═══════════════════════════════════════════════════════════

import { createContext, useContext, useEffect, useState, useRef } from 'react';
import socketService from '../services/socket';

const ServerTimeContext = createContext(null);

export const ServerTimeProvider = ({ children }) => {
  // Server time as Date object (updated every second from backend)
  const [serverTime, setServerTime] = useState(new Date());

  // Track if we're actually getting server updates (vs falling back to local)
  const [isServerConnected, setIsServerConnected] = useState(false);

  const lastServerUpdateRef = useRef(Date.now());
  const localTickRef = useRef(null);

  useEffect(() => {
    // ─── Handler for server time broadcasts ───
    const handleServerTime = (data) => {
      if (data?.timestamp) {
        setServerTime(new Date(data.timestamp));
        lastServerUpdateRef.current = Date.now();
        if (!isServerConnected) setIsServerConnected(true);
      }
    };

    socketService.on('serverTime', handleServerTime);

    // ─── Local fallback tick — updates every 1s ───
    // If we haven't heard from server in 3 seconds, fall back to local time
    localTickRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceLastServer = now - lastServerUpdateRef.current;

      if (timeSinceLastServer > 3000) {
        // Server silent — fall back to local
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

// ─── Hook ───
export const useServerTime = () => {
  const ctx = useContext(ServerTimeContext);
  if (!ctx) {
    // Fallback if used outside provider — returns local time
    return { serverTime: new Date(), isServerConnected: false };
  }
  return ctx;
};

export default ServerTimeContext;