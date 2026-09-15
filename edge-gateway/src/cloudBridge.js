const { io } = require('socket.io-client');

class CloudBridge {
  constructor(config, onWriteCommand) {
    this.config = config;
    this.onWriteCommand = onWriteCommand;
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.baseReconnectDelay = 1000;
    this.heartbeatInterval = null;
    this.isConnected = false;
  }

  connect() {
    const url = `${this.config.cloudUrl}${this.config.namespace}`;
    console.log(`[CloudBridge] Connecting to ${url}...`);

    this.socket = io(url, {
      auth: {
        apiKey: this.config.apiKey,
        companyId: this.config.companyId,
        gatewayId: this.config.gatewayId
      },
      transports: ['websocket', 'polling'],
      reconnection: false,
      timeout: 10000
    });

    this.socket.on('connect', () => {
      console.log('[CloudBridge] Connected to cloud');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.startHeartbeat();
    });

    this.socket.on('disconnect', (reason) => {
      console.log(`[CloudBridge] Disconnected: ${reason}`);
      this.isConnected = false;
      this.stopHeartbeat();
      this.handleReconnect();
    });

    this.socket.on('connect_error', (error) => {
      console.error(`[CloudBridge] Connection error: ${error.message}`);
      this.handleReconnect();
    });

    this.socket.on('edge:writeCommand', (command) => {
      console.log('[CloudBridge] Received write command:', command);
      if (this.onWriteCommand) {
        this.onWriteCommand(command);
      }
    });

    this.socket.on('edge:configUpdate', (config) => {
      console.log('[CloudBridge] Received config update');
      // Handle dynamic config updates if needed
    });
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.socket.emit('edge:heartbeat', {
          gatewayId: this.config.gatewayId,
          timestamp: Date.now(),
          status: 'online'
        });
      }
    }, 30000);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[CloudBridge] Max reconnect attempts reached. Giving up.');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    const jitter = Math.random() * 1000;
    const totalDelay = Math.min(delay + jitter, 30000);

    console.log(`[CloudBridge] Reconnecting in ${Math.round(totalDelay)}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    setTimeout(() => {
      this.connect();
    }, totalDelay);
  }

  sendTagValues(updates) {
    if (!this.isConnected) {
      console.warn('[CloudBridge] Not connected, queuing updates');
      return false;
    }

    this.socket.emit('edge:tagValues', {
      gatewayId: this.config.gatewayId,
      timestamp: Date.now(),
      updates: updates
    });

    return true;
  }

  sendStatus(status) {
    if (!this.isConnected) return false;

    this.socket.emit('edge:status', {
      gatewayId: this.config.gatewayId,
      timestamp: Date.now(),
      status: status
    });

    return true;
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
  }

  getConnectionStatus() {
    return this.isConnected;
  }
}

module.exports = CloudBridge;