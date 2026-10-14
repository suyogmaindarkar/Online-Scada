// Native Allen-Bradley Ethernet/IP service. Tag addresses are symbolic names
// supported by ethernet-ip (controller-scoped or program-scoped tags).
const { Controller, Tag } = require('ethernet-ip');
const { CODES, normalizeError } = require('../utils/diagnostics');
const TagModel = require('../models/Tag');

class EthernetIpService {
  constructor() { this.connections = new Map(); this.intervals = new Map(); this.tags = new Map(); this.polling = new Set(); }
  async connect(plc) {
    const controller = new Controller();
    try { await controller.connect(plc.ipAddress, plc.slot ?? 0); this.connections.set(String(plc._id), controller); return { success: true, controller }; }
    catch (err) { const diagnostic = normalizeError(err, CODES.CONNECTION_FAILED); return { success: false, error: err.message, errorCode: diagnostic.code }; }
  }
  async test(plc) { const result = await this.connect(plc); if (result.controller) { try { result.controller.disconnect(); } catch (_) {} this.connections.delete(String(plc._id)); } return result; }
  async start(plc, io) {
    const id = String(plc._id); this.stop(id);
    const result = await this.connect(plc); if (!result.success) throw new Error(result.error);
    const tags = await TagModel.find({ companyId: plc.companyId, plcConnection: plc._id, isActive: true }).lean();
    this.tags.set(id, new Map());
    const poll = async () => {
      if (this.polling.has(id)) return;
      this.polling.add(id);
      const updates = [];
      try {
        for (const tag of tags) {
          try {
            const address = tag.plcAddress || tag.tagName;
            let t = this.tags.get(id).get(address);
            if (!t) { t = new Tag(address); this.tags.get(id).set(address, t); }
            await result.controller.readTag(t);
            await TagModel.updateOne({ _id: tag._id, companyId: plc.companyId }, { $set: { currentValue: t.value, quality: 'GOOD', lastUpdated: new Date() } });
            updates.push({ tagName: tag.tagName, tagId: tag._id, value: t.value, quality: 'GOOD', timestamp: Date.now() });
          } catch (error) {
            await TagModel.updateOne({ _id: tag._id, companyId: plc.companyId }, { $set: { quality: 'BAD' } });
            updates.push({ tagName: tag.tagName, tagId: tag._id, value: null, quality: 'BAD', error: error.message, timestamp: Date.now() });
          }
        }
        if (updates.length && io) io.to(`company:${plc.companyId}`).emit('tagsUpdate', updates);
      } finally {
        this.polling.delete(id);
      }
    };
    const timer = setInterval(poll, plc.pollingRate || 1000); this.intervals.set(id, timer); await poll();
    return { success: true, message: tags.length ? 'Connected and polling' : 'Connected but no tags' };
  }
  async writeTag(plcId, tag, value) { const c = this.connections.get(String(plcId)); if (!c) throw new Error('Ethernet/IP PLC is not connected'); const t = new Tag(tag.plcAddress || tag.address || tag.tagName || tag); t.value = value; await c.writeTag(t); return { success: true }; }
  stop(plcId) { const id = String(plcId); if (this.intervals.has(id)) clearInterval(this.intervals.get(id)); this.intervals.delete(id); const c = this.connections.get(id); if (c) try { c.disconnect(); } catch (_) {} this.connections.delete(id); this.tags.delete(id); }
  stopAll() { for (const id of this.intervals.keys()) this.stop(id); }
  isRunning(plcId) { return this.connections.has(String(plcId)); }
}
module.exports = new EthernetIpService();
