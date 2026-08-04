import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:5000';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map(); // Track handler references for cleanup safety
  }

  // ─────────────────────────────────────────
  // Connect (idempotent — safe to call multiple times)
  // ─────────────────────────────────────────
  connect() {
    if (this.socket?.connected) return this.socket;

    // Cleanup old socket if exists but not connected
    if (this.socket && !this.socket.connected) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'], // fallback to polling if WS fails
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,      // keep trying forever
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket.id);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('⚠️  Socket error:', error.message);
    });

    this.socket.on('reconnect', (attempt) => {
      console.log(`🔄 Socket reconnected after ${attempt} attempts`);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this.listeners.clear();
    }
  }

  // ─────────────────────────────────────────
  // ON — register handler (must pass callback!)
  // ─────────────────────────────────────────
  on(event, callback) {
    if (!this.socket) this.connect();
    if (typeof callback !== 'function') {
      console.warn(`⚠️  socketService.on('${event}') called without a valid callback`);
      return;
    }
    this.socket.on(event, callback);
  }

  // ─────────────────────────────────────────
  // OFF — remove specific handler (recommended)
  //   OR remove all handlers for event (fallback)
  // ─────────────────────────────────────────
  off(event, callback) {
    if (!this.socket) return;
    if (callback) {
      this.socket.off(event, callback);  // remove ONE specific handler
    } else {
      console.warn(`⚠️  socketService.off('${event}') called without callback — removing ALL handlers. This is usually a bug.`);
      this.socket.off(event);            // remove ALL handlers (fallback)
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

  // ─────────────────────────────────────────
  // Helper: register handler once safely
  // Returns a cleanup function that removes THIS handler only
  // ─────────────────────────────────────────
  register(event, callback) {
    this.on(event, callback);
    return () => this.off(event, callback);
  }
}

export default new SocketService();