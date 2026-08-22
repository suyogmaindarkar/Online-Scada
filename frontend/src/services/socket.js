// ═══════════════════════════════════════════════════════════
// Socket Service — Multi-Tenant Update
// ✅ FIXED: Auto-detects production environments & fallback protocols
// ═══════════════════════════════════════════════════════════

import { io } from 'socket.io-client';

// ─── Auto-Detect Socket URL with Fallbacks ───
const getSocketUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    // Strip trailing /api or /api/
    return envUrl.replace(/\/api\/?$/, '');
  }

  // Fallback to dynamic window origin if VITE_API_URL is relative or undefined
  const { protocol, hostname, port } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:5000';
  }
  return `${protocol}//${hostname}${port ? ':' + port : ''}`;
};

const SOCKET_URL = getSocketUrl();

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  connect() {
    if (this.socket?.connected) return this.socket;

    if (this.socket && !this.socket.connected) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    const token = localStorage.getItem('userToken');

    if (!token) {
      console.warn('⚠️  Socket connect skipped — no userToken');
      return null;
    }

    console.log(`🔌 Attempting Socket connection to: ${SOCKET_URL}`);

    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      auth: { token },
    });

    // Re-bind any existing listeners to the new socket
    for (const [event, callbacks] of this.listeners.entries()) {
      for (const cb of callbacks) {
        this.socket.on(event, cb);
      }
    }

    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket.id);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('⚠️  Socket error:', error.message);
    });

    return this.socket;
  }

  reconnectWithNewToken() {
    console.log('🔄 Reconnecting socket with new token...');
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
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
    if (typeof callback !== 'function') return;
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    if (!this.socket) {
      this.connect();
    } else {
      this.socket.on(event, callback);
    }
  }

  off(event, callback) {
    if (callback) {
      if (this.listeners.has(event)) {
        this.listeners.get(event).delete(callback);
      }
      if (this.socket) {
        this.socket.off(event, callback);
      }
    } else {
      this.listeners.delete(event);
      if (this.socket) {
        this.socket.off(event);
      }
    }
  }

  emit(event, data) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    }
  }

  isConnected() {
    return this.socket?.connected || false;
  }
}

export default new SocketService();