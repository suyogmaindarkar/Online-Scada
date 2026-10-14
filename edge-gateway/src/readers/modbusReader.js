// ═══════════════════════════════════════════════════════════
// Modbus Reader — Universal & Intelligent Offset Resolver
// Compatible with ModSim32, Modbus Slave, Delta DVP PLCs,
// Schneider, ABB, Siemens, and all Modbus TCP Devices/Gateways.
// ═══════════════════════════════════════════════════════════

const ModbusRTU = require('modbus-serial');
const { CODES, normalizeError, badTag } = require('../utils/diagnostics');

class ModbusReader {
    constructor(plcConfig, verbose = false) {
        this.config = plcConfig;
        this.verbose = verbose;
        this.client = null;
        this.isConnected = false;
        this.reconnectTimer = null;
        this.unitId = Number.isInteger(Number(plcConfig.unitId)) ? Number(plcConfig.unitId) : 1;
        if (this.unitId < 0 || this.unitId > 255) this.unitId = 1;
        this.pollInProgress = false;

        // Cache working register offsets per tag for ultra-fast polling
        this.workingOffsetCache = new Map();
    }

    // ─── Generate Candidate Offsets for Any Input Address ───
    _getCandidates(address) {
        const raw = String(address).trim().toUpperCase();
        const candidates = [];

        // 1. Delta DVP Memory Shortcuts (D0, Y0, M0, X0, T0, C0)
        if (/^D\d+$/.test(raw)) {
            const num = parseInt(raw.substring(1), 10);
            candidates.push({ fc: 3, reg: 4096 + num, type: 'holding', desc: `Delta D${num} (Offset ${4096 + num})` });
            candidates.push({ fc: 3, reg: num, type: 'holding', desc: `Direct D${num} (Offset ${num})` });
        } else if (/^Y\d+$/.test(raw)) {
            const num = parseInt(raw.substring(1), 10);
            candidates.push({ fc: 1, reg: 1280 + num, type: 'coil', desc: `Delta Y${num} (Offset ${1280 + num})` });
            candidates.push({ fc: 1, reg: num, type: 'coil', desc: `Direct Y${num} (Offset ${num})` });
        } else if (/^M\d+$/.test(raw)) {
            const num = parseInt(raw.substring(1), 10);
            candidates.push({ fc: 1, reg: 2048 + num, type: 'coil', desc: `Delta M${num} (Offset ${2048 + num})` });
            candidates.push({ fc: 1, reg: num, type: 'coil', desc: `Direct M${num} (Offset ${num})` });
        } else if (/^X\d+$/.test(raw)) {
            const num = parseInt(raw.substring(1), 10);
            candidates.push({ fc: 2, reg: 1024 + num, type: 'discrete', desc: `Delta X${num} (Offset ${1024 + num})` });
            candidates.push({ fc: 2, reg: num, type: 'discrete', desc: `Direct X${num} (Offset ${num})` });
        } else if (/^T\d+$/.test(raw) || /^C\d+$/.test(raw)) {
            const area = raw[0]; const num = parseInt(raw.substring(1), 10);
            candidates.push({ fc: 3, reg: (area === 'T' ? 1536 : 2048) + num, type: 'holding', desc: `Delta ${area}${num}` });
            candidates.push({ fc: 3, reg: num, type: 'holding', desc: `Direct ${area}${num}` });
        }

        // 2. Standard 5/6-digit Modbus Notation (0xxxx, 1xxxx, 3xxxx, 4xxxx)
        const num = parseInt(raw.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(num)) {
            if (raw.startsWith('0') || (num < 10000 && candidates.length === 0)) {
                // Coil (FC01)
                if (num >= 1000) candidates.push({ fc: 1, reg: num - 1, type: 'coil', desc: `Standard Coil (Offset ${num - 1})` });
                candidates.push({ fc: 1, reg: num > 0 ? (num % 1000) - 1 : 0, type: 'coil', desc: `Modulo Coil (Offset ${(num % 1000) - 1})` });
                candidates.push({ fc: 1, reg: num > 0 ? num % 1000 : 0, type: 'coil', desc: `Direct Coil (Offset ${num % 1000})` });
                candidates.push({ fc: 1, reg: 0, type: 'coil', desc: `Coil 0 Fallback` });
            } else if (raw.startsWith('1')) {
                // Discrete Input (FC02)
                candidates.push({ fc: 2, reg: num - 10001, type: 'discrete', desc: `Standard Input (Offset ${num - 10001})` });
                candidates.push({ fc: 2, reg: (num % 1000) - 1, type: 'discrete', desc: `Modulo Input (Offset ${(num % 1000) - 1})` });
                candidates.push({ fc: 2, reg: 0, type: 'discrete', desc: `Input 0 Fallback` });
            } else if (raw.startsWith('3')) {
                // Input Register (FC04)
                candidates.push({ fc: 4, reg: num - 30001, type: 'input', desc: `Standard Input Reg (Offset ${num - 30001})` });
                candidates.push({ fc: 4, reg: (num % 1000) - 1, type: 'input', desc: `Modulo Input Reg (Offset ${(num % 1000) - 1})` });
                candidates.push({ fc: 4, reg: 0, type: 'input', desc: `Input Reg 0 Fallback` });
            } else if (raw.startsWith('4') || candidates.length === 0) {
                // Holding Register (FC03)
                if (num >= 40001) candidates.push({ fc: 3, reg: num - 40001, type: 'holding', desc: `Standard Holding Reg (Offset ${num - 40001})` });
                else if (num >= 4000) candidates.push({ fc: 3, reg: num - 4001, type: 'holding', desc: `Standard Holding Reg (Offset ${num - 4001})` });
                candidates.push({ fc: 3, reg: num > 0 ? (num % 1000) - 1 : 0, type: 'holding', desc: `Modulo Reg (Offset ${(num % 1000) - 1})` });
                candidates.push({ fc: 3, reg: num, type: 'holding', desc: `Direct Offset ${num}` });
                candidates.push({ fc: 3, reg: 0, type: 'holding', desc: `Register 0 Fallback` });
            }
        }

        if (candidates.length === 0) {
            candidates.push({ fc: 3, reg: 0, type: 'holding', desc: 'Default Fallback' });
        }

        return candidates.filter((candidate) => Number.isInteger(candidate.reg) && candidate.reg >= 0);
    }

    async connect() {
        return new Promise(async (resolve) => {
            try {
                this.client = new ModbusRTU();
                this.client.setID(this.unitId);
                this.client.setTimeout(3000);

                if (this.config.protocol === 'MODBUS_RTU') await this.client.connectRTUBuffered(this.config.ip, { baudRate: this.config.baudRate || 9600, dataBits: 8, stopBits: 1, parity: this.config.parity || 'none' });
                else await this.client.connectTCP(this.config.ip, { port: this.config.port || 502 });

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
        if (this.pollInProgress) return tags.map((t) => badTag(t, null, CODES.TIMEOUT));
        this.pollInProgress = true;
        try {
        if (!this.isConnected || !this.client) {
            return tags.map((t) => badTag(t, null, CODES.CONNECTION_FAILED));
        }

        const results = [];

        for (const tag of tags) {
            const cacheKey = tag.tagId || tag.tagName;
            let value = null;
            let readSuccess = false;

            // ─── 1. Check if we already found the working offset for this tag ───
            const cached = this.workingOffsetCache.get(cacheKey);

            if (cached) {
                try {
                    value = await this._readRegister(cached.fc, cached.reg, tag.dataType);
                    readSuccess = true;
                } catch (err) {
                    // Cached offset failed — invalidate cache and fall back to discovery
                    this.workingOffsetCache.delete(cacheKey);
                }
            }

            // ─── 2. Auto-Discovery Candidate Loop ─────────────────────────────
            if (!readSuccess) {
                const candidates = this._getCandidates(tag.address);
                let lastError = null;

                for (const cand of candidates) {
                    try {
                        value = await this._readRegister(cand.fc, cand.reg, tag.dataType);
                        readSuccess = true;

                        // Cache this working offset so future reads are instantaneous!
                        this.workingOffsetCache.set(cacheKey, cand);
                        console.log(`💡 Auto-detected working Modbus register for "${tag.tagName}" (${tag.address}): ${cand.desc}`);
                        break;
                    } catch (candErr) {
                        lastError = candErr;
                        // Try next candidate
                    }
                }

                if (!readSuccess && lastError) {
                    console.error(`⚠️  Modbus read failed for "${tag.tagName}" (${tag.address}): ${lastError.message}`);
                }
            }

                results.push({
                tagId: tag.tagId,
                tagName: tag.tagName,
                value: readSuccess ? this._normalize(value, tag.dataType) : null,
                    quality: readSuccess ? 'GOOD' : 'BAD',
                    ...(readSuccess ? {} : { errorCode: normalizeError(lastError, CODES.BAD_DEVICE_QUALITY).code, error: lastError?.message }),
            });
        }

        return results;
        } catch (err) {
            this.isConnected = false;
            this._scheduleReconnect();
            console.error(`⚠️ Modbus polling error: ${err.message}`);
            return tags.map((t) => badTag(t, err, CODES.CONNECTION_FAILED));
        } finally {
            this.pollInProgress = false;
        }
    }

    async _readRegister(fc, reg, dataType) {
        // Prevent negative offset errors
        const safeReg = Number(reg);
        if (!Number.isInteger(safeReg) || safeReg < 0 || safeReg > 65535) throw new Error(`Invalid Modbus offset: ${reg}`);
        const normalizedType = String(dataType || '').toUpperCase();

        switch (fc) {
            case 1: {
                const res = await this.client.readCoils(safeReg, 1);
                return res.data[0];
            }
            case 2: {
                const res = await this.client.readDiscreteInputs(safeReg, 1);
                return res.data[0];
            }
            case 3: {
                const is32Bit = normalizedType === 'REAL' || normalizedType === 'DINT' || normalizedType === 'DWORD';
                const count = is32Bit ? 2 : 1;
                const res = await this.client.readHoldingRegisters(safeReg, count);

                if (normalizedType === 'REAL' && res.data.length >= 2) {
                    const buf = Buffer.alloc(4);
                    buf.writeUInt16BE(res.data[0], 0);
                    buf.writeUInt16BE(res.data[1], 2);
                    return buf.readFloatBE(0);
                } else if ((normalizedType === 'DINT' || normalizedType === 'DWORD') && res.data.length >= 2) {
                    const buf = Buffer.alloc(4);
                    buf.writeUInt16BE(res.data[0], 0); buf.writeUInt16BE(res.data[1], 2);
                    return normalizedType === 'DINT' ? buf.readInt32BE(0) : buf.readUInt32BE(0);
                } else {
                    return res.data[0];
                }
            }
            case 4: {
                const is32Bit = normalizedType === 'REAL' || normalizedType === 'DINT' || normalizedType === 'DWORD';
                const res = await this.client.readInputRegisters(safeReg, is32Bit ? 2 : 1);
                if (is32Bit && res.data.length >= 2) {
                    const buf = Buffer.alloc(4);
                    buf.writeUInt16BE(res.data[0], 0); buf.writeUInt16BE(res.data[1], 2);
                    if (normalizedType === 'REAL') return buf.readFloatBE(0);
                    return normalizedType === 'DINT' ? buf.readInt32BE(0) : buf.readUInt32BE(0);
                }
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

        const candidates = this._getCandidates(address);
        let writeSuccess = false;
        let lastErr = null;

        for (const cand of candidates) {
            try {
                await this._writeRegister(cand.type, cand.reg, value, dataType);
                writeSuccess = true;
                console.log(`✅ Modbus Write OK: "${address}" = ${value} (${cand.desc})`);
                break;
            } catch (err) {
                lastErr = err;
            }
        }

        if (!writeSuccess) {
            const d = normalizeError(lastErr, CODES.WRITE_PERMISSION_DENIED);
            throw Object.assign(new Error(`Modbus write failed for "${address}": ${d.message}`), { code: d.code });
        }
    }

    async _writeRegister(type, reg, value, dataType) {
        const safeReg = Number(reg);
        if (!Number.isInteger(safeReg) || safeReg < 0 || safeReg > 65535) throw new Error('Invalid Modbus offset');

        if (type === 'coil') {
            const boolVal = (value === true || value === 'true' || value === 1 || value === '1');
            await this.client.writeCoil(safeReg, boolVal);
        } else {
            if (dataType === 'REAL') {
                const buf = Buffer.alloc(4);
                buf.writeFloatBE(parseFloat(value), 0);
                await this.client.writeRegisters(safeReg, [buf.readUInt16BE(0), buf.readUInt16BE(2)]);
            } else {
                const numeric = Number(value);
                if (!Number.isInteger(numeric) || numeric < -32768 || numeric > 65535) throw new Error('Value is outside the supported Modbus register range');
                await this.client.writeRegister(safeReg, numeric & 65535);
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
        this.workingOffsetCache.clear();
    }
}

module.exports = ModbusReader;
