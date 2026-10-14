// Allen-Bradley Ethernet/IP reader (MicroLogix/ControlLogix/CompactLogix).
const { Controller, Tag } = require('ethernet-ip');
const { CODES, normalizeError, badTag } = require('../utils/diagnostics');

class EthernetIPReader {
    constructor(config) { this.config = config; this.PLC = new Controller(); this.isConnected = false; this.tags = new Map(); }
    async connect() {
        try { await this.PLC.connect(this.config.ip || this.config.ipAddress, this.config.slot ?? 0); this.isConnected = true; return true; }
        catch (err) { this.isConnected = false; this.lastError = err.message; return false; }
    }
    async readTags(tags) {
        if (!this.isConnected) return tags.map(t => badTag(t, null, CODES.CONNECTION_FAILED));
        return Promise.all(tags.map(async t => { try { const tag = this.tags.get(t.address) || new Tag(t.address); this.tags.set(t.address, tag); await this.PLC.readTag(tag); return { tagId: t.tagId, tagName: t.tagName, value: tag.value, quality: 'GOOD' }; } catch (err) { return badTag(t, err); } }));
    }
    async writeTag(address, value) { if (!this.isConnected) throw Object.assign(new Error('Ethernet/IP PLC is not connected'), { code: CODES.CONNECTION_FAILED }); const tag = this.tags.get(address) || new Tag(address); tag.value = value; this.tags.set(address, tag); try { await this.PLC.writeTag(tag); } catch (err) { const d=normalizeError(err,CODES.WRITE_PERMISSION_DENIED); throw Object.assign(new Error(d.message),{code:d.code}); } }
    disconnect() { try { this.PLC.disconnect(); } catch (_) {} this.isConnected = false; }
}
module.exports = EthernetIPReader;
