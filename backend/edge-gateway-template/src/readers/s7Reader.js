// ═══════════════════════════════════════════════════════════
// S7 Reader — Siemens S7 Protocol via nodes7
//
// Supports: S7-300, S7-400, S7-1200, S7-1500
//
// CRITICAL RULES:
//   S7-1500 / S7-1200: Rack=0, Slot=0 (ALWAYS)
//   S7-300:            Rack=0, Slot=2
//   S7-400:            Rack=0, Slot=2 or 3
//   PLC must have "Permit access with PUT/GET" ENABLED
// ═══════════════════════════════════════════════════════════

const nodes7 = require('nodes7');

class S7Reader {
    constructor(plcConfig, verbose = false) {
        this.config = plcConfig;
        this.verbose = verbose;
        this.conn = null;
        this.isConnected = false;
        this.reconnectTimer = null;
    }

    // ─── Connect to PLC ─────────────────────────────────────
    connect() {
        return new Promise((resolve) => {
            try {
                this.conn = new nodes7();

                // Disable logging unless verbose
                if (!this.verbose) {
                    this.conn.silent = true;
                }

                const rack = this.config.rack ?? 0;
                const slot = this.config.slot ?? 0;

                const connectionParams = {
                    host: this.config.ip,
                    port: this.config.port || 102,
                    rack,
                    slot,
                };

                if (this.verbose) {
                    console.log(`S7 connecting to ${this.config.ip}:${connectionParams.port} (Rack=${rack}, Slot=${slot})`);
                }

                this.conn.initiateConnection(connectionParams, (err) => {
                    if (err) {
                        console.error(`S7 connection failed to ${this.config.ip}: ${err.message || err}`);
                        this.isConnected = false;
                        this.conn = null;
                        this._scheduleReconnect();
                        resolve(false);
                        return;
                    }

                    this.isConnected = true;
                    console.log(`S7 connected to ${this.config.ip} (Rack=${rack}, Slot=${slot})`);
                    resolve(true);
                });
            } catch (err) {
                console.error(`S7 init error: ${err.message}`);
                this.conn = null;
                this._scheduleReconnect();
                resolve(false);
            }
        });
    }

    // ─── Read Tags ──────────────────────────────────────────
    readTags(tags) {
        return new Promise((resolve) => {
            if (!this.isConnected || !this.conn) {
                resolve(tags.map((t) => ({
                    tagId: t.tagId,
                    tagName: t.tagName,
                    value: null,
                    quality: 'BAD',
                })));
                return;
            }

            // Build address list for nodes7
            const addresses = tags.map((t) => this._convertAddress(t));
            if (addresses.some((address) => !address)) {
                resolve(this._badResults(tags));
                return;
            }

            try {
                this.conn.readAllItems((err, values) => {
                    if (err) {
                        if (this.verbose) {
                            console.error(`S7 read error: ${err.message || err}`);
                        }
                        this.isConnected = false;
                        this._scheduleReconnect();
                        resolve(tags.map((t) => ({
                            tagId: t.tagId,
                            tagName: t.tagName,
                            value: null,
                            quality: 'BAD',
                        })));
                        return;
                    }

                    const results = tags.map((t, index) => {
                        const rawValue = values[addresses[index]];
                        const quality = (rawValue !== undefined && rawValue !== null) ? 'GOOD' : 'BAD';

                        return {
                            tagId: t.tagId,
                            tagName: t.tagName,
                            value: quality === 'GOOD' ? this._normalizeValue(rawValue, t.dataType) : null,
                            quality,
                        };
                    });

                    resolve(results);
                });

                // Re-add variables before reading (nodes7 requires this)
                this.conn.addItems(addresses);
            } catch (err) {
                if (this.verbose) {
                    console.error(`S7 readAllItems error: ${err.message}`);
                }
                this.isConnected = false;
                this._scheduleReconnect();
                resolve(tags.map((t) => ({
                    tagId: t.tagId,
                    tagName: t.tagName,
                    value: null,
                    quality: 'BAD',
                })));
            }
        });
    }

    // ─── Write Tag ──────────────────────────────────────────
    writeTag(address, value, dataType) {
        return new Promise((resolve, reject) => {
            if (!this.isConnected || !this.conn) {
                return reject(new Error('S7 not connected'));
            }

            try {
                const writeValue = this._denormalizeValue(value, dataType);
                this.conn.writeItems(address, writeValue, (err) => {
                    if (err) {
                        reject(new Error(`S7 write failed: ${err}`));
                    } else {
                        resolve();
                    }
                });
            } catch (err) {
                reject(new Error(`S7 write error: ${err.message}`));
            }
        });
    }

    // ─── Normalize Value ────────────────────────────────────
    _normalizeValue(raw, dataType) {
        if (raw === undefined || raw === null) return null;

        switch (dataType) {
            case 'BOOL':
                return Boolean(raw);
            case 'INT':
            case 'WORD':
                return Math.round(Number(raw));
            case 'DINT':
            case 'DWORD':
                return Math.round(Number(raw));
            case 'REAL':
                return parseFloat(Number(raw).toFixed(4));
            case 'BYTE':
                return Math.round(Number(raw)) & 0xFF;
            case 'STRING':
                return String(raw);
            default:
                return raw;
        }
    }

    // ─── Denormalize Value for Write ────────────────────────
    _denormalizeValue(value, dataType) {
        switch (dataType) {
            case 'BOOL':
                return Boolean(value);
            case 'INT':
            case 'WORD':
            case 'DINT':
            case 'DWORD':
            case 'BYTE':
                return Math.round(Number(value));
            case 'REAL':
                return parseFloat(value);
            default:
                return value;
        }
    }

    // ─── Reconnect ──────────────────────────────────────────
    _scheduleReconnect() {
        if (this.reconnectTimer) return;

        this.reconnectTimer = setTimeout(async () => {
            this.reconnectTimer = null;
            if (!this.isConnected) {
                if (this.verbose) {
                    console.log(`S7 reconnecting to ${this.config.ip}...`);
                }
                await this.connect();
            }
        }, 5000);
    }

    // ─── Disconnect ─────────────────────────────────────────
    disconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.conn) {
            try {
                this.conn.dropConnection();
            } catch { }
            this.conn = null;
        }
        this.isConnected = false;
    }

    _badResults(tags) {
        return tags.map((t) => ({ tagId: t.tagId, tagName: t.tagName, value: null, quality: 'BAD' }));
    }

    _convertAddress(tag) {
        let addr = String(tag.address || tag.plcAddress || '').trim().toUpperCase();
        if (!addr) return null;
        if (/^DB\d+,[A-Z]+\d/.test(addr) || /^M\d+(\.\d+)?$/.test(addr) || /^(MB|MW|MD)\d+$/.test(addr)) return addr;
        if (/^[IE](\d+\.\d+|B\d+|W\d+|D\d+)$/.test(addr)) return addr.replace(/^E/, 'I');
        if (/^[QA](\d+\.\d+|B\d+|W\d+|D\d+)$/.test(addr)) return addr.replace(/^A/, 'Q');
        let match = addr.match(/^DB(\d+)\.DBX(\d+)\.(\d+)$/);
        if (match) return `DB${match[1]},X${match[2]}.${match[3]}`;
        match = addr.match(/^DB(\d+)\.DBB(\d+)$/);
        if (match) return `DB${match[1]},BYTE${match[2]}`;
        match = addr.match(/^DB(\d+)\.DBW(\d+)$/);
        if (match) return `DB${match[1]},${tag.dataType === 'WORD' ? 'WORD' : 'INT'}${match[2]}`;
        match = addr.match(/^DB(\d+)\.DBD(\d+)$/);
        if (match) return `DB${match[1]},${tag.dataType === 'REAL' ? 'REAL' : tag.dataType === 'DWORD' ? 'DWORD' : 'DINT'}${match[2]}`;
        match = addr.match(/^DB(\d+),(\d+)$/);
        if (match) {
            const type = { REAL: 'REAL', DINT: 'DINT', BOOL: 'X', WORD: 'WORD', DWORD: 'DWORD', STRING: 'S' }[tag.dataType] || 'INT';
            return type === 'X' ? `DB${match[1]},X${match[2]}.0` : `DB${match[1]},${type}${match[2]}`;
        }
        return /^DB\d+,/.test(addr) ? addr : null;
    }
}

module.exports = S7Reader;
