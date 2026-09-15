// ═══════════════════════════════════════════════════════════
// Modbus Reader — Modbus TCP/RTU via modbus-serial
//
// Supports: FC01 (Coils), FC02 (Discrete Inputs),
//           FC03 (Holding Registers), FC04 (Input Registers),
//           FC05 (Write Single Coil), FC06 (Write Single Register),
//           FC16 (Write Multiple Registers)
//
// Address Format:
//   "00001" or "0xxxx" → Coils (FC01/FC05)
//   "10001" or "1xxxx" → Discrete Inputs (FC02)
//   "40001" or "4xxxx" → Holding Registers (FC03/FC06/FC16)
//   "30001" or "3xxxx" → Input Registers (FC04)
// ═══════════════════════════════════════════════════════════

const ModbusRTU = require('modbus-serial');

class ModbusReader {
    constructor(plcConfig, verbose = false) {
        this.config = plcConfig;
        this.verbose = verbose;
        this.client = null;
        this.isConnected = false;
        this.reconnectTimer = null;
        this.unitId = plcConfig.unitId || 1;
    }

    // ─── Parse Modbus Address ───────────────────────────────
    _parseAddress(address) {
        const addr = String(address).trim();
        const num = parseInt(addr, 10);

        if (addr.startsWith('0') && addr.length === 5) {
            return { fc: 1, register: num - 1, type: 'coil' };
        }
        if (addr.startsWith('1') && addr.length === 5) {
            return { fc: 2, register: num - 10001, type: 'discrete' };
        }
        if (addr.startsWith('3') && addr.length === 5) {
            return { fc: 4, register: num - 30001, type: 'input' };
        }
        if (addr.startsWith('4') && addr.length === 5) {
            return { fc: 3, register: num - 40001, type: 'holding' };
        }

        // Fallback: treat as holding register
        return { fc: 3, register: isNaN(num) ? 0 : num, type: 'holding' };
    }

    // ─── Connect ────────────────────────────────────────────
    connect() {
        return new Promise(async (resolve) => {
            try {
                this.client = new ModbusRTU();
                this.client.setID(this.unitId);
                this.client.setTimeout(5000);

                await this.client.connectTCP(this.config.ip, {
                    port: this.config.port || 502,
                });

                this.isConnected = true;
                console.log(`✅ Modbus TCP connected to ${this.config.ip}:${this.config.port || 502} (Unit ${this.unitId})`);
                resolve(true);
            } catch (err) {
                console.error(`❌ Modbus connection failed to ${this.config.ip}: ${err.message}`);
                this.isConnected = false;
                this._scheduleReconnect();
                resolve(false);
            }
        });
    }

    // ─── Read Tags ──────────────────────────────────────────
    async readTags(tags) {
        if (!this.isConnected || !this.client) {
            return tags.map((t) => ({
                tagId: t.tagId,
                tagName: t.tagName,
                value: null,
                quality: 'BAD',
            }));
        }

        const results = [];

        for (const tag of tags) {
            try {
                const parsed = this._parseAddress(tag.address);
                let value = null;
                let quality = 'GOOD';

                switch (parsed.fc) {
                    case 1: { // Coil
                        const res = await this.client.readCoils(parsed.register, 1);
                        value = res.data[0];
                        break;
                    }
                    case 2: { // Discrete Input
                        const res = await this.client.readDiscreteInputs(parsed.register, 1);
                        value = res.data[0];
                        break;
                    }
                    case 3: { // Holding Register
                        const res = await this.client.readHoldingRegisters(parsed.register, tag.dataType === 'REAL' ? 2 : 1);
                        if (tag.dataType === 'REAL' && res.data.length >= 2) {
                            const buf = Buffer.alloc(4);
                            buf.writeUInt16BE(res.data[0], 0);
                            buf.writeUInt16BE(res.data[1], 2);
                            value = buf.readFloatBE(0);
                        } else {
                            value = res.data[0];
                        }
                        break;
                    }
                    case 4: { // Input Register
                        const res = await this.client.readInputRegisters(parsed.register, tag.dataType === 'REAL' ? 2 : 1);
                        if (tag.dataType === 'REAL' && res.data.length >= 2) {
                            const buf = Buffer.alloc(4);
                            buf.writeUInt16BE(res.data[0], 0);
                            buf.writeUInt16BE(res.data[1], 2);
                            value = buf.readFloatBE(0);
                        } else {
                            value = res.data[0];
                        }
                        break;
                    }
                }

                results.push({
                    tagId: tag.tagId,
                    tagName: tag.tagName,
                    value: this._normalize(value, tag.dataType),
                    quality,
                });
            } catch (err) {
                if (this.verbose) {
                    console.error(`❌ Modbus read error ${tag.tagName}: ${err.message}`);
                }
                results.push({
                    tagId: tag.tagId,
                    tagName: tag.tagName,
                    value: null,
                    quality: 'BAD',
                });

                // If we get a connection error, mark disconnected
                if (err.message.includes('Port') || err.message.includes('connect')) {
                    this.isConnected = false;
                    this._scheduleReconnect();
                    break;
                }
            }
        }

        return results;
    }

    // ─── Write Tag ──────────────────────────────────────────
    async writeTag(address, value, dataType) {
        if (!this.isConnected || !this.client) {
            throw new Error('Modbus not connected');
        }

        const parsed = this._parseAddress(address);

        switch (parsed.type) {
            case 'coil':
                await this.client.writeCoil(parsed.register, Boolean(value));
                break;
            case 'holding':
                if (dataType === 'REAL') {
                    const buf = Buffer.alloc(4);
                    buf.writeFloatBE(parseFloat(value), 0);
                    await this.client.writeRegisters(parsed.register, [
                        buf.readUInt16BE(0),
                        buf.readUInt16BE(2),
                    ]);
                } else {
                    await this.client.writeRegister(parsed.register, Math.round(Number(value)));
                }
                break;
            default:
                throw new Error(`Cannot write to ${parsed.type} registers`);
        }
    }

    // ─── Normalize Value ────────────────────────────────────
    _normalize(value, dataType) {
        if (value === null || value === undefined) return null;
        switch (dataType) {
            case 'BOOL': return Boolean(value);
            case 'REAL': return parseFloat(Number(value).toFixed(4));
            case 'INT': case 'WORD': case 'DINT': case 'DWORD': case 'BYTE':
                return Math.round(Number(value));
            default: return value;
        }
    }

    // ─── Reconnect ──────────────────────────────────────────
    _scheduleReconnect() {
        if (this.reconnectTimer) return;
        this.reconnectTimer = setTimeout(async () => {
            this.reconnectTimer = null;
            if (!this.isConnected) {
                if (this.verbose) console.log(`🔄 Modbus reconnecting to ${this.config.ip}...`);
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
        if (this.client) {
            try {
                this.client.close(() => { });
            } catch { }
            this.client = null;
        }
        this.isConnected = false;
    }
}

module.exports = ModbusReader;