// ═══════════════════════════════════════════════════════════
// Socket Service — Multi-Tenant Update
// ✅ Sends userToken with socket connection for auth
// ✅ Reconnects with fresh token on each attempt
// ═══════════════════════════════════════════════════════════

import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:5000';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  // ─────────────────────────────────────────
  // Connect (idempotent — safe to call multiple times)
  // Reads userToken from localStorage at connection time
  // ─────────────────────────────────────────
  connect() {
    if (this.socket?.connected) return this.socket;

    if (this.socket && !this.socket.connected) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    // ✅ Get token at connect time (not module load)
    const token = localStorage.getItem('userToken');

    if (!token) {
      console.warn('⚠️  Socket connect skipped — no userToken');
      return null;
    }

    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      // ✅ MULTI-TENANT: Send userToken for auth
      auth: {
        token,
      },
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket.id);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('⚠️  Socket error:', error.message);

      // If auth error, trigger re-login
      if (error.message === 'AUTH_REQUIRED' ||
          error.message === 'AUTH_INVALID' ||
          error.message === 'WRONG_TOKEN_TYPE') {
        console.warn('🔒 Socket auth failed — token may be expired');
        // Optional: could dispatch an event here for app to react
      }
    });

    this.socket.on('reconnect', (attempt) => {
      console.log(`🔄 Socket reconnected after ${attempt} attempts`);
    });

    // ✅ Server sends welcome with company info
    this.socket.on('welcome', (data) => {
      console.log(`🎉 Server welcomed us: company=${data.companyId}, role=${data.role}`);
    });

    return this.socket;
  }

  // ─────────────────────────────────────────
  // Reconnect with fresh token (call after login)
  // ─────────────────────────────────────────
  reconnectWithNewToken() {
    console.log('🔄 Reconnecting socket with new token...');
    this.disconnect();
    return this.connect();
  }

  disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this.listeners.clear();
    }
  }

  on(event, callback) {
    if (!this.socket) this.connect();
    if (typeof callback !== 'function') {
      console.warn(`⚠️  socketService.on('${event}') called without callback`);
      return;
    }
    // Socket may still be null if no token
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event, callback) {
    if (!this.socket) return;
    if (callback) {
      this.socket.off(event, callback);
    } else {
      console.warn(`⚠️  socketService.off('${event}') called without callback — removing ALL handlers`);
      this.socket.off(event);
    }
  }

  emit(event, data) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn(`⚠️  Cannot emit '${event}' — socket not connected`);
    }
  }

  isConnected() {
    return this.socket?.connected || false;
  }

  register(event, callback) {
    this.on(event, callback);
    return () => this.off(event, callback);
  }
}

export default new SocketService();