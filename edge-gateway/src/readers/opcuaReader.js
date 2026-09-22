// ═══════════════════════════════════════════════════════════
// OPC-UA Reader — via node-opcua
//
// Connects to OPC-UA servers and reads/writes node values.
// Supports anonymous and username/password authentication.
//
// Address Format: Standard OPC-UA NodeId strings
//   "ns=2;s=Temperature"
//   "ns=2;i=1234"
//   "i=2258" (Server ServerStatus)
// ═══════════════════════════════════════════════════════════

const opcua = require('node-opcua');

class OPCUAReader {
    constructor(plcConfig, verbose = false) {
        this.config = plcConfig;
        this.verbose = verbose;
        this.client = null;
        this.session = null;
        this.isConnected = false;
        this.reconnectTimer = null;
    }

    // ─── Connect ────────────────────────────────────────────
    connect() {
        return new Promise(async (resolve) => {
            try {
                const endpointUrl = `opc.tcp://${this.config.ip}:${this.config.port || 4840}`;

                this.client = opcua.OPCUAClient.create({
                    connectionStrategy: {
                        initialDelay: 1000,
                        maxRetry: 3,
                    },
                    securityMode: opcua.MessageSecurityMode.None,
                    securityPolicy: opcua.SecurityPolicy.None,
                    endpointMustExist: false,
                });

                await this.client.connect(endpointUrl);

                // Build session options
                const sessionOptions = {};
                if (this.config.opcuaUsername && this.config.opcuaPassword) {
                    sessionOptions.userIdentityInfo = {
                        type: opcua.UserTokenType.UserName,
                        userName: this.config.opcuaUsername,
                        password: this.config.opcuaPassword,
                    };
                }

                this.session = await this.client.createSession(sessionOptions);
                this.isConnected = true;

                console.log(`✅ OPC-UA connected to ${endpointUrl}`);
                resolve(true);
            } catch (err) {
                console.error(`❌ OPC-UA connection failed to ${this.config.ip}: ${err.message}`);
                this.isConnected = false;
                this._scheduleReconnect();
                resolve(false);
            }
        });
    }

    // ─── Read Tags ──────────────────────────────────────────
    async readTags(tags) {
        if (!this.isConnected || !this.session) {
            return tags.map((t) => ({
                tagId: t.tagId,
                tagName: t.tagName,
                value: null,
                quality: 'BAD',
            }));
        }

        try {
            const nodesToRead = tags.map((t) => ({
                nodeId: t.address,
                attributeId: opcua.AttributeIds.Value,
            }));

            const dataValues = await this.session.read(nodesToRead);

            return tags.map((t, i) => {
                const dv = dataValues[i];
                const statusCode = dv?.statusCode;
                const isGood = statusCode && statusCode.isGood();

                let value = null;
                if (isGood && dv.value) {
                    value = this._extractValue(dv.value, t.dataType);
                }

                // Debug log for troubleshooting (first few)
                if (this.verbose || value === null) {
                    const sc = dv?.statusCode?.name || dv?.statusCode?.toString?.() || '?';
                    console.log(`   OPC ${t.tagName} [${t.address}] → value=${value} quality=${isGood ? 'GOOD' : sc}`);
                }

                return {
                    tagId: t.tagId,
                    tagName: t.tagName,
                    value,
                    quality: isGood ? 'GOOD' : 'BAD',
                };
            });
        } catch (err) {
            if (this.verbose) {
                console.error(`❌ OPC-UA read error: ${err.message}`);
            }

            // Check if session died
            if (err.message.includes('session') || err.message.includes('closed')) {
                this.isConnected = false;
                this._scheduleReconnect();
            }

            return tags.map((t) => ({
                tagId: t.tagId,
                tagName: t.tagName,
                value: null,
                quality: 'BAD',
            }));
        }
    }

    // ─── Write Tag ──────────────────────────────────────────
    async writeTag(address, value, dataType) {
        if (!this.isConnected || !this.session) {
            throw new Error('OPC-UA not connected');
        }

        const opcuaValue = this._toOPCUAValue(value, dataType);

        const nodesToWrite = [{
            nodeId: address,
            attributeId: opcua.AttributeIds.Value,
            value: {
                value: opcuaValue,
            },
        }];

        const results = await this.session.write(nodesToWrite);

        if (results[0] && !results[0].isGood()) {
            throw new Error(`OPC-UA write failed: ${results[0].toString()}`);
        }
    }

    // ─── Extract Value from OPC-UA Variant ──────────────────
    _extractValue(variant, dataType) {
        if (!variant || variant.value === undefined || variant.value === null) return null;

        let raw = variant.value;

        // node-opcua may return BigInt for Int32/UInt32/Int64
        if (typeof raw === 'bigint') {
            raw = Number(raw);
        }

        switch ((dataType || '').toUpperCase()) {
            case 'BOOL':
                return Boolean(raw);
            case 'REAL':
                return parseFloat(Number(raw).toFixed(6));
            case 'INT':
            case 'WORD':
            case 'BYTE':
                return Math.round(Number(raw));
            case 'DINT':
            case 'DWORD':
                return Math.round(Number(raw));
            case 'STRING':
                return String(raw);
            default:
                return typeof raw === 'number' ? raw : Number(raw);
        }
    }

    // ─── Convert to OPC-UA Variant ──────────────────────────
    _toOPCUAValue(value, dataType) {
        switch (dataType) {
            case 'BOOL':
                return new opcua.Variant({ dataType: opcua.DataType.Boolean, value: Boolean(value) });
            case 'REAL':
                return new opcua.Variant({ dataType: opcua.DataType.Float, value: parseFloat(value) });
            case 'INT':
                return new opcua.Variant({ dataType: opcua.DataType.Int16, value: Math.round(value) });
            case 'DINT':
                return new opcua.Variant({ dataType: opcua.DataType.Int32, value: Math.round(value) });
            case 'WORD':
                return new opcua.Variant({ dataType: opcua.DataType.UInt16, value: Math.round(value) });
            case 'DWORD':
                return new opcua.Variant({ dataType: opcua.DataType.UInt32, value: Math.round(value) });
            case 'STRING':
                return new opcua.Variant({ dataType: opcua.DataType.String, value: String(value) });
            default:
                return new opcua.Variant({ dataType: opcua.DataType.Double, value: Number(value) });
        }
    }

    // ─── Reconnect ──────────────────────────────────────────
    _scheduleReconnect() {
        if (this.reconnectTimer) return;
        this.reconnectTimer = setTimeout(async () => {
            this.reconnectTimer = null;
            if (!this.isConnected) {
                if (this.verbose) console.log(`🔄 OPC-UA reconnecting to ${this.config.ip}...`);
                this.disconnect();
                await this.connect();
            }
        }, 10000); // OPC-UA reconnects slower
    }

    // ─── Disconnect ─────────────────────────────────────────
    disconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.session) {
            try {
                this.session.close(() => { });
            } catch { }
            this.session = null;
        }

        if (this.client) {
            try {
                this.client.disconnect(() => { });
            } catch { }
            this.client = null;
        }

        this.isConnected = false;
    }
}

module.exports = OPCUAReader;