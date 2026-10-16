// ═══════════════════════════════════════════════════════════
// OPC-UA Reader — Silent Logger & Robust Type Casting
// ═══════════════════════════════════════════════════════════

const opcua = require('node-opcua');
const { CODES, badTag } = require('../utils/diagnostics');
const { isValidOpcuaNodeId } = require('../utils/opcuaNodeId');

// Silence node-opcua internal warning spam (certificates, clock skew warnings)
if (opcua.Logger && opcua.LogLevel) {
    opcua.Logger.level = opcua.LogLevel.Error;
}

class OPCUAReader {
    constructor(plcConfig) {
        this.config = plcConfig;
        this.client = null;
        this.session = null;
        this.isConnected = false;
        this.lastError = null;
    }

    async connect() {
        try {
            const url = this._endpointUrl();
            this.client = opcua.OPCUAClient.create({
                securityMode: opcua.MessageSecurityMode.None,
                securityPolicy: opcua.SecurityPolicy.None,
                endpointMustExist: false
            });
            await this.client.connect(url);
            const identity = this.config.username || this.config.user
                ? { userName: this.config.username || this.config.user, password: this.config.password || '' }
                : null;
            this.session = await this.client.createSession(identity);
            this.isConnected = true;
            return true;
        } catch (e) {
            this.isConnected = false;
            this.lastError = new Error(`OPC-UA connection failed for ${this._endpointUrl()}: ${e.message}`);
            if (this.client) { try { await this.client.disconnect(); } catch (_) { } }
            this.client = null;
            this.session = null;
            return false;
        }
    }

    async readTags(tags) {
        if (!this.isConnected || !this.session) return tags.map(t => badTag(t, null, CODES.CONNECTION_FAILED));
        const results = tags.map((tag) => ({ tag, result: null }));
        const valid = results.filter(({ tag }) => isValidOpcuaNodeId(tag.address));
        for (const item of results.filter(({ tag }) => !isValidOpcuaNodeId(tag.address))) {
            item.result = badTag(item.tag, new Error(`Invalid OPC-UA NodeId: ${item.tag.address}`), CODES.INVALID_ADDRESS);
        }
        if (valid.length === 0) return results.map(({ result }) => result);
        try {
            const nodes = valid.map(({ tag }) => ({
                nodeId: tag.address,
                attributeId: opcua.AttributeIds.Value
            }));
            const dataValues = await this.session.read(nodes);

            valid.forEach(({ tag }, index) => {
                const dv = dataValues[index];
                let val = dv?.value?.value;

                if (typeof val === 'bigint') {
                    val = Number(val);
                }

                results.find((item) => item.tag === tag).result = {
                    tagId: tag.tagId,
                    tagName: tag.tagName,
                    value: val !== undefined ? val : null,
                    quality: dv?.statusCode?.isGood() ? 'GOOD' : 'BAD'
                };
            });
            return results.map(({ result }) => result);
        } catch (e) {
            for (const item of valid) {
                try {
                    const dataValues = await this.session.read([{ nodeId: item.tag.address, attributeId: opcua.AttributeIds.Value }]);
                    const dv = dataValues[0];
                    let val = dv?.value?.value;
                    if (typeof val === 'bigint') val = Number(val);
                    item.result = { tagId: item.tag.tagId, tagName: item.tag.tagName, value: val !== undefined ? val : null, quality: dv?.statusCode?.isGood() ? 'GOOD' : 'BAD' };
                } catch (error) {
                    item.result = badTag(item.tag, error, CODES.BAD_DEVICE_QUALITY);
                }
            }
            this.lastError = new Error(`OPC-UA read degraded: ${e.message}`);
            return results.map(({ result }) => result);
        }
    }

    async writeTag(nodeId, value, dataTypeStr) {
        if (!this.isConnected || !this.session) {
            throw new Error('OPC-UA session not connected');
        }

        let opcuaDataType = opcua.DataType.Double;
        let processedValue = value;
        const upperType = (dataTypeStr || '').toUpperCase();

        if (upperType === 'BOOL' || upperType === 'BOOLEAN') {
            opcuaDataType = opcua.DataType.Boolean;
            if (typeof processedValue === 'string') {
                processedValue = processedValue.toLowerCase() === 'true' || processedValue === '1';
            } else {
                processedValue = Boolean(processedValue);
            }
        } else if (upperType.includes('INT') || upperType === 'DINT' || upperType === 'UINT' || upperType === 'WORD') {
            opcuaDataType = opcua.DataType.Int32;
            processedValue = Number(processedValue);
        } else if (upperType.includes('REAL') || upperType.includes('FLOAT')) {
            opcuaDataType = opcua.DataType.Float;
            processedValue = Number(processedValue);
        }

        const nodeToWrite = {
            nodeId: nodeId,
            attributeId: opcua.AttributeIds.Value,
            value: {
                value: {
                    dataType: opcuaDataType,
                    value: processedValue
                }
            }
        };

        const statusCode = await this.session.write([nodeToWrite]);
        if (statusCode[0].isGood()) {
            return true;
        } else {
            throw new Error(`OPC-UA write rejected with status: ${statusCode[0].toString()}`);
        }
    }

    disconnect() {
        if (this.client) {
            try {
                this.client.disconnect(() => { });
            } catch (e) { }
        }
        this.isConnected = false;
    }

    _endpointUrl() {
        const endpoint = String(this.config.endpoint || this.config.url || this.config.ip || '').trim();
        if (!endpoint) throw new Error('OPC-UA endpoint is required');
        return endpoint.includes('://') ? endpoint : `opc.tcp://${endpoint}:${this.config.port || 4840}`;
    }
}

module.exports = OPCUAReader;
