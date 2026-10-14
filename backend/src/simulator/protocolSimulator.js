'use strict';

// Deterministic, hardware-free connector harness. This intentionally does not
// import production PLC services; its shape follows edge-gateway PLCReader.

const PROTOCOLS = ['S7', 'MODBUS_TCP', 'MODBUS_RTU', 'OPC_UA', 'ETHERNET_IP', 'PROFIBUS_GATEWAY'];
const PROFIBUS_TRANSPORTS = ['S7', 'MODBUS_TCP', 'OPC_UA', 'ETHERNET_IP'];

function protocolFor(config) {
  const protocol = String(config.protocol || '').toUpperCase();
  if (protocol === 'PROFIBUS_GATEWAY') {
    const transport = String(config.transportProtocol || '').toUpperCase();
    if (!PROFIBUS_TRANSPORTS.includes(transport)) throw new Error(`Unsupported Profibus gateway transport: ${transport || '(missing)'}`);
    return transport;
  }
  if (!PROTOCOLS.includes(protocol)) throw new Error(`Unsupported simulator protocol: ${protocol}`);
  return protocol;
}

class ProtocolSimulator {
  constructor(config = {}) {
    this.config = { ...config };
    this.protocol = String(config.protocol || '').toUpperCase();
    this.transport = protocolFor(config);
    this.connected = false;
    this.cycle = 0;
    this.values = new Map();
    this.events = [];
    this.seed = Number.isFinite(config.seed) ? config.seed >>> 0 : 0x51ca7;
    this.failureCycles = new Set((config.failureCycles || []).map(Number));
  }

  _random() {
    this.seed = (1664525 * this.seed + 1013904223) >>> 0;
    return this.seed / 0x100000000;
  }

  _event(type, detail) { this.events.push({ cycle: this.cycle, type, ...detail }); }

  async connect() {
    if (this.connected) return { success: true, alreadyConnected: true };
    this.connected = true;
    this._event('connect', { protocol: this.protocol, transport: this.transport });
    return { success: true, protocol: this.protocol, transport: this.transport };
  }

  async disconnect(reason = 'requested') {
    if (!this.connected) return { success: true, alreadyDisconnected: true };
    this.connected = false;
    this._event('disconnect', { reason });
    return { success: true };
  }

  async reconnect() { await this.disconnect('reconnect'); return this.connect(); }

  async read(tags = []) {
    if (!this.connected) throw new Error('Simulator is not connected');
    this.cycle += 1;
    if (this.failureCycles.has(this.cycle)) {
      this.connected = false;
      this._event('failure', { reason: 'scheduled read failure' });
      throw new Error(`Scheduled simulator failure at cycle ${this.cycle}`);
    }
    const values = tags.map((tag, index) => {
      const key = String(tag.tagId || tag.id || tag.tagName || index);
      const type = String(tag.dataType || 'REAL').toUpperCase();
      let value;
      if (type === 'BOOL') value = this.cycle % 2 === 0;
      else if (type === 'STRING') value = `SIM_${this.cycle}`;
      else value = Number(((this._random() * 100) + index).toFixed(2));
      this.values.set(key, value);
      return { tagId: key, tagName: tag.tagName || key, value, quality: 'GOOD', timestamp: this.cycle };
    });
    this._event('read', { count: values.length });
    return values;
  }

  async write(tag, value) {
    if (!this.connected) throw new Error('Simulator is not connected');
    const key = String(tag.tagId || tag.id || tag.tagName || tag);
    this.values.set(key, value);
    this._event('write', { tagId: key, value });
    return { success: true, tagId: key, value };
  }

  async run(tags = [], cycles = 3) {
    const results = { protocol: this.protocol, transport: this.transport, cycles: [], events: this.events };
    await this.connect();
    for (let i = 0; i < cycles; i += 1) {
      try { results.cycles.push({ cycle: this.cycle + 1, values: await this.read(tags) }); }
      catch (error) {
        results.cycles.push({ cycle: this.cycle, error: error.message });
        await this.reconnect();
      }
    }
    if (tags.length) await this.write(tags[0], 42);
    await this.disconnect('complete');
    return results;
  }
}

module.exports = { ProtocolSimulator, PROTOCOLS, PROFIBUS_TRANSPORTS, protocolFor };
