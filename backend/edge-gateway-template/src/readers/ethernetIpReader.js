// ═══════════════════════════════════════════════════════════
// Ethernet/IP Reader — Allen-Bradley PLC Support
// ═══════════════════════════════════════════════════════════

const { Controller, Tag } = require('ethernet-ip');

class EthernetIPReader {
    constructor(plcConfig) {
        this.config = plcConfig;
        this.PLC = new Controller();
        this.isConnected = false;
        this.tags = new Map();
    }

    async connect() {
        try {
            await this.PLC.connect(this.config.ip, this.config.slot || 0);
            this.isConnected = true;
            return true;
        } catch (e) {
            this.isConnected = false;
            return false;
        }
    }

    async readTags(tagList) {
        if (!this.isConnected) return [];
        const results = [];
        for (const t of tagList) {
            try {
                let tagObj = this.tags.get(t.address);
                if (!tagObj) {
                    tagObj = new Tag(t.address);
                    this.tags.set(t.address, tagObj);
                }
                await this.PLC.readTag(tagObj);
                results.push({ tagId: t.tagId, tagName: t.tagName, value: tagObj.value, quality: 'GOOD' });
            } catch (e) {
                results.push({ tagId: t.tagId, tagName: t.tagName, value: null, quality: 'BAD' });
            }
        }
        return results;
    }

    async writeTag(addr, val, dataType) {
        let tagObj = this.tags.get(addr);
        if (!tagObj) {
            tagObj = new Tag(addr);
            this.tags.set(addr, tagObj);
        }
        tagObj.value = val;
        await this.PLC.writeTag(tagObj);
    }

    disconnect() {
        try {
            this.PLC.disconnect();
        } catch (e) { }
        this.isConnected = false;
    }
}

module.exports = EthernetIPReader;