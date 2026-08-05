// ═══════════════════════════════════════════════════════════
// Time Service — broadcasts server time via Socket.IO
//
// Purpose:
//   Emit current server timestamp every 1 second to all connected clients.
//   Frontend digital clocks can display server time (great for control rooms
//   where all operators should see the same time).
//
// Overhead:
//   ~40 bytes/sec per client. Zero impact on PLC polling.
// ═══════════════════════════════════════════════════════════

class TimeService {
  constructor() {
    this.io = null;
    this.interval = null;
    this.tickRate = 1000; // 1 second
  }

  /**
   * Initialize with Socket.IO instance and start broadcasting
   */
  init(io) {
    this.io = io;
    this.start();
    console.log('⏰ Time Service initialized (broadcasting server time every 1s)');
  }

  start() {
    if (this.interval) return;

    // Send initial time immediately
    this.broadcast();

    // Then tick every second
    this.interval = setInterval(() => {
      this.broadcast();
    }, this.tickRate);
  }

  broadcast() {
    if (!this.io) return;
    this.io.emit('serverTime', {
      timestamp: Date.now(),
      iso: new Date().toISOString(),
    });
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}

module.exports = new TimeService();