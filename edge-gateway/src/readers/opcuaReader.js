// ═══════════════════════════════════════════════════════════
// OPC-UA Reader — Robust Read & Write
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

    async connect() {
        return new Promise(async (resolve) => {
            try {
                const endpointUrl = `opc.tcp://${this.config.ip}:${this.config.port || 4840}`;

                this.client = opcua.OPCUAClient.create({
                    connectionStrategy: { initialDelay: 1000, maxRetry: 3 },
                    securityMode: opcua.MessageSecurityMode.None,
                    securityPolicy: opcua.SecurityPolicy.None,
                    endpointMustExist: false,
                });

                await this.client.connect(endpointUrl);

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
                console.error(`❌ OPC-UA connect error: ${err.message}`);
                this.isConnected = false;
                this._scheduleReconnect();
                resolve(false);
            }
        });
    }

    async readTags(tags) {
        if (!this.isConnected || !this.session) {
            return tags.map((t) => ({ tagId: t.tagId, tagName: t.tagName, value: null, quality: 'BAD' }));
        }

        try {
            const nodesToRead = tags.map((t) => ({
                nodeId: t.address,
                attributeId: opcua.AttributeIds.Value,
            }));

            const dataValues = await this.session.read(nodesToRead);

            return tags.map((t, i) => {
                const dv = dataValues[i];
                const isGood = dv?.statusCode && dv.statusCode.isGood();
                let value = null;
                if (isGood && dv.value) {
                    value = this._extractValue(dv.value, t.dataType);
                }

                return {
                    tagId: t.tagId,
                    tagName: t.tagName,
                    value,
                    quality: isGood ? 'GOOD' : 'BAD',
                };
            });
        } catch (err) {
            if (err.message.includes('session') || err.message.includes('closed')) {
                this.isConnected = false;
                this._scheduleReconnect();
            }
            return tags.map((t) => ({ tagId: t.tagId, tagName: t.tagName, value: null, quality: 'BAD' }));
        }
    }

    // ═══════════════════════════════════════════════════════════
    // ✍️ ENHANCED WRITE TAG METHOD
    // ═══════════════════════════════════════════════════════════
    async writeTag(address, value, dataType) {
        if (!this.isConnected || !this.session) {
            throw new Error('OPC-UA session not active');
        }

        const opcuaVariant = this._toOPCUAValue(value, dataType);

        const nodesToWrite = [{
            nodeId: address,
            attributeId: opcua.AttributeIds.Value,
            value: {
                value: opcuaVariant,
            },
        }];

        const results = await this.session.write(nodesToWrite);

        if (results[0] && !results[0].isGood()) {
            const statusName = results[0].name || results[0].toString();
            throw new Error(`OPC-UA write rejected by server: ${statusName}`);
        }

        console.log(`✅ OPC-UA Write OK: ${address} = ${value} (${dataType})`);
        return true;
    }

    _extractValue(variant, dataType) {
        if (!variant || variant.value === undefined || variant.value === null) return null;
        let raw = variant.value;
        if (typeof raw === 'bigint') raw = Number(raw);

        switch ((dataType || '').toUpperCase()) {
            case 'BOOL': return Boolean(raw);
            case 'REAL': return parseFloat(Number(raw).toFixed(6));
            case 'INT': case 'WORD': case 'BYTE': return Math.round(Number(raw));
            case 'DINT': case 'DWORD': return Math.round(Number(raw));
            case 'STRING': return String(raw);
            default: return typeof raw === 'number' ? raw : Number(raw);
        }
    }

    _toOPCUAValue(value, dataType) {
        const dt = (dataType || '').toUpperCase();

        switch (dt) {
            case 'BOOL': {
                const boolVal = (value === true || value === 'true' || value === 1 || value === '1');
                return new opcua.Variant({ dataType: opcua.DataType.Boolean, value: boolVal });
            }
            case 'REAL':
                return new opcua.Variant({ dataType: opcua.DataType.Float, value: parseFloat(value) });
            case 'INT':
                return new opcua.Variant({ dataType: opcua.DataType.Int16, value: Math.round(Number(value)) });
            case 'DINT':
                return new opcua.Variant({ dataType: opcua.DataType.Int32, value: Math.round(Number(value)) });
            case 'WORD':
                return new opcua.Variant({ dataType: opcua.DataType.UInt16, value: Math.round(Number(value)) });
            case 'DWORD':
                return new opcua.Variant({ dataType: opcua.DataType.UInt32, value: Math.round(Number(value)) });
            case 'BYTE':
                return new opcua.Variant({ dataType: opcua.DataType.Byte, value: Math.round(Number(value)) });
            case 'STRING':
                return new opcua.Variant({ dataType: opcua.DataType.String, value: String(value) });
            default:
                return new opcua.Variant({ dataType: opcua.DataType.Double, value: Number(value) });
        }
    }

    _scheduleReconnect() {
        if (this.reconnectTimer) return;
        this.reconnectTimer = setTimeout(async () => {
            this.reconnectTimer = null;
            if (!this.isConnected) {
                this.disconnect();
                await this.connect();
            }
        }, 5000);
    }

    disconnect() {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        if (this.session) try { this.session.close(() => { }); } catch { }
        if (this.client) try { this.client.disconnect(() => { }); } catch { }
        this.isConnected = false;
    }
}

module.exports = OPCUAReader;