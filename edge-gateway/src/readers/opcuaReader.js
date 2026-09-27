// ═══════════════════════════════════════════════════════════
// OPC-UA Reader — Robust Type Casting & Read/Write Handler
// ═══════════════════════════════════════════════════════════

const opcua = require('node-opcua');

class OPCUAReader {
    constructor(plcConfig) {
        this.config = plcConfig;
        this.client = null;
        this.session = null;
        this.isConnected = false;
    }

    async connect() {
        try {
            const url = `opc.tcp://${this.config.ip}:${this.config.port || 4840}`;
            this.client = opcua.OPCUAClient.create({
                securityMode: opcua.MessageSecurityMode.None,
                securityPolicy: opcua.SecurityPolicy.None,
                endpointMustExist: false
            });
            await this.client.connect(url);
            this.session = await this.client.createSession();
            this.isConnected = true;
            return true;
        } catch (e) {
            this.isConnected = false;
            return false;
        }
    }

    async readTags(tags) {
        if (!this.isConnected || !this.session) return [];
        try {
            const nodes = tags.map(t => ({
                nodeId: t.address,
                attributeId: opcua.AttributeIds.Value
            }));
            const dataValues = await this.session.read(nodes);

            return tags.map((t, index) => {
                const dv = dataValues[index];
                let val = dv?.value?.value;

                // Handle BigInt conversion safely
                if (typeof val === 'bigint') {
                    val = Number(val);
                }

                return {
                    tagId: t.tagId,
                    tagName: t.tagName,
                    value: val !== undefined ? val : null,
                    quality: dv?.statusCode?.isGood() ? 'GOOD' : 'BAD'
                };
            });
        } catch (e) {
            return [];
        }
    }

    async writeTag(nodeId, value, dataTypeStr) {
        if (!this.isConnected || !this.session) {
            throw new Error('OPC-UA session not connected');
        }

        let opcuaDataType = opcua.DataType.Double;
        let processedValue = value;

        const upperType = (dataTypeStr || '').toUpperCase();

        // Robust case-insensitive type mapping & casting
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
}

module.exports = OPCUAReader;