// ═══════════════════════════════════════════════════════════
// Modbus Reader — Modbus TCP/RTU (With Delta DVP Direct Address Support)
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

    // ─── Parse Address (Supports Delta DVP Shortcuts: D0, Y0, M0, X0) ───
    _parseAddress(address) {
        const raw = String(address).trim().toUpperCase();

        // 🟢 Delta DVP Direct Names Support
        if (raw.startsWith('D') && /^D\d+$/.test(raw)) {
            const dNum = parseInt(raw.substring(1), 10);
            return { fc: 3, register: 4096 + dNum, type: 'holding', altRegister: dNum };
        }
        if (raw.startsWith('Y') && /^Y\d+$/.test(raw)) {
            const yNum = parseInt(raw.substring(1), 10);
            return { fc: 1, register: 1280 + yNum, type: 'coil', altRegister: yNum };
        }
        if (raw.startsWith('M') && /^M\d+$/.test(raw)) {
            const mNum = parseInt(raw.substring(1), 10);
            return { fc: 1, register: 2048 + mNum, type: 'coil', altRegister: mNum };
        }
        if (raw.startsWith('X') && /^X\d+$/.test(raw)) {
            const xNum = parseInt(raw.substring(1), 10);
            return { fc: 2, register: 1024 + xNum, type: 'discrete', altRegister: xNum };
        }

        // Standard 5-digit Modbus format (44097, 01281, etc.)
        const num = parseInt(raw, 10);
        if (raw.startsWith('0') && raw.length === 5) {
            return { fc: 1, register: num - 1, type: 'coil' };
        }
        if (raw.startsWith('1') && raw.length === 5) {
            return { fc: 2, register: num - 10001, type: 'discrete' };
        }
        if (raw.startsWith('3') && raw.length === 5) {
            return { fc: 4, register: num - 30001, type: 'input' };
        }
        if (raw.startsWith('4') && raw.length === 5) {
            return { fc: 3, register: num - 40001, type: 'holding' };
        }

        return { fc: 3, register: isNaN(num) ? 0 : num, type: 'holding' };
    }

    async connect() {
        return new Promise(async (resolve) => {
            try {
                this.client = new ModbusRTU();
                this.client.setID(this.unitId);
                this.client.setTimeout(3000);

                await this.client.connectTCP(this.config.ip, {
                    port: this.config.port || 502,
                });

                this.isConnected = true;
                console.log(`✅ Modbus TCP connected to ${this.config.ip}:${this.config.port || 502} (Unit ID ${this.unitId})`);
                resolve(true);
            } catch (err) {
                console.error(`❌ Modbus connect error to ${this.config.ip}:${this.config.port}: ${err.message}`);
                this.isConnected = false;
                this._scheduleReconnect();
                resolve(false);
            }
        });
    }

    async readTags(tags) {
        if (!this.isConnected || !this.client) {
            return tags.map((t) => ({ tagId: t.tagId, tagName: t.tagName, value: null, quality: 'BAD' }));
        }

        const results = [];

        for (const tag of tags) {
            try {
                const parsed = this._parseAddress(tag.address);
                let value = null;

                // Try primary Modbus register address
                try {
                    value = await this._readRegister(parsed.fc, parsed.register, tag.dataType);
                } catch (firstErr) {
                    // Fallback: If Delta simulator uses 0-based offset (e.g. D0 = 0 instead of 4096)
                    if (parsed.altRegister !== undefined) {
                        try {
                            value = await this._readRegister(parsed.fc, parsed.altRegister, tag.dataType);
                        } catch (altErr) {
                            throw firstErr;
                        }
                    } else {
                        throw firstErr;
                    }
                }

                results.push({
                    tagId: tag.tagId,
                    tagName: tag.tagName,
                    value: this._normalize(value, tag.dataType),
                    quality: 'GOOD',
                });
            } catch (err) {
                console.error(`⚠️  Modbus read failed for "${tag.tagName}" (${tag.address}): ${err.message}`);

                results.push({
                    tagId: tag.tagId,
                    tagName: tag.tagName,
                    value: null,
                    quality: 'BAD',
                });

                if (err.message.includes('Port') || err.message.includes('connect') || err.message.includes('closed')) {
                    this.isConnected = false;
                    this._scheduleReconnect();
                    break;
                }
            }
        }

        return results;
    }

    async _readRegister(fc, reg, dataType) {
        switch (fc) {
            case 1: {
                const res = await this.client.readCoils(reg, 1);
                return res.data[0];
            }
            case 2: {
                const res = await this.client.readDiscreteInputs(reg, 1);
                return res.data[0];
            }
            case 3: {
                const is32Bit = dataType === 'REAL' || dataType === 'DINT' || dataType === 'DWORD';
                const count = is32Bit ? 2 : 1;
                const res = await this.client.readHoldingRegisters(reg, count);

                if (dataType === 'REAL' && res.data.length >= 2) {
                    const buf = Buffer.alloc(4);
                    buf.writeUInt16BE(res.data[0], 0);
                    buf.writeUInt16BE(res.data[1], 2);
                    return buf.readFloatBE(0);
                } else if ((dataType === 'DINT' || dataType === 'DWORD') && res.data.length >= 2) {
                    return (res.data[0] << 16) | res.data[1];
                } else {
                    return res.data[0];
                }
            }
            case 4: {
                const res = await this.client.readInputRegisters(reg, 1);
                return res.data[0];
            }
            default:
                throw new Error(`Unsupported Function Code: ${fc}`);
        }
    }

    async writeTag(address, value, dataType) {
        if (!this.isConnected || !this.client) {
            throw new Error('Modbus not connected');
        }

        const parsed = this._parseAddress(address);

        try {
            await this._writeRegister(parsed.type, parsed.register, value, dataType);
        } catch (err) {
            if (parsed.altRegister !== undefined) {
                await this._writeRegister(parsed.type, parsed.altRegister, value, dataType);
            } else {
                throw err;
            }
        }

        console.log(`✅ Modbus Write OK: ${address} = ${value}`);
    }

    async _writeRegister(type, reg, value, dataType) {
        if (type === 'coil') {
            const boolVal = (value === true || value === 'true' || value === 1 || value === '1');
            await this.client.writeCoil(reg, boolVal);
        } else {
            if (dataType === 'REAL') {
                const buf = Buffer.alloc(4);
                buf.writeFloatBE(parseFloat(value), 0);
                await this.client.writeRegisters(reg, [buf.readUInt16BE(0), buf.readUInt16BE(2)]);
            } else {
                await this.client.writeRegister(reg, Math.round(Number(value)));
            }
        }
    }

    _normalize(value, dataType) {
        if (value === null || value === undefined) return null;
        switch ((dataType || '').toUpperCase()) {
            case 'BOOL': return Boolean(value);
            case 'REAL': return parseFloat(Number(value).toFixed(4));
            case 'INT': case 'WORD': case 'DINT': case 'DWORD': case 'BYTE':
                return Math.round(Number(value));
            default: return value;
        }
    }

    _scheduleReconnect() {
        if (this.reconnectTimer) return;
        this.reconnectTimer = setTimeout(async () => {
            this.reconnectTimer = null;
            if (!this.isConnected) {
                await this.connect();
            }
        }, 5000);
    }

    disconnect() {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        if (this.client) try { this.client.close(() => { }); } catch { }
        this.isConnected = false;
    }
}

module.exports = ModbusReader;