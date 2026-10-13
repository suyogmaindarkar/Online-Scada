// Allen-Bradley Ethernet/IP reader (MicroLogix/ControlLogix/CompactLogix).
const { Controller, Tag } = require('ethernet-ip');

class EthernetIPReader {
    constructor(config) { this.config = config; this.PLC = new Controller(); this.isConnected = false; this.tags = new Map(); }
    async connect() {
        try { await this.PLC.connect(this.config.ip || this.config.ipAddress, this.config.slot ?? 0); this.isConnected = true; return true; }
        catch (err) { this.isConnected = false; this.lastError = err.message; return false; }
    }
    async readTags(tags) {
        if (!this.isConnected) return tags.map(t => ({ tagId: t.tagId, tagName: t.tagName, value: null, quality: 'BAD' }));
        return Promise.all(tags.map(async t => { try { const tag = this.tags.get(t.address) || new Tag(t.address); this.tags.set(t.address, tag); await this.PLC.readTag(tag); return { tagId: t.tagId, tagName: t.tagName, value: tag.value, quality: 'GOOD' }; } catch (err) { return { tagId: t.tagId, tagName: t.tagName, value: null, quality: 'BAD', error: err.message }; } }));
    }
    async writeTag(address, value) { if (!this.isConnected) throw new Error('Ethernet/IP PLC is not connected'); const tag = this.tags.get(address) || new Tag(address); tag.value = value; this.tags.set(address, tag); await this.PLC.writeTag(tag); }
    disconnect() { try { this.PLC.disconnect(); } catch (_) {} this.isConnected = false; }
}
module.exports = EthernetIPReader;
