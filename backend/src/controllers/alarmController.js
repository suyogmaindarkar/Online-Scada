// ═══════════════════════════════════════════════════════════
// Alarm Controller
//
// Task Bundle applied:
//   ✅ T019  — accepts emailRecipients + emailThrottleMinutes in create/update
//   ✅ T021  — POST /alarms/export CSV endpoint (current + history)
//   ✅ T018  — accepts soundEnabled in create/update
// ═══════════════════════════════════════════════════════════

const Alarm = require('../models/Alarm');
const AlarmHistory = require('../models/AlarmHistory');

// ─────────────────────────────────────────
// CREATE Alarm — POST /api/alarms
// ─────────────────────────────────────────
const createAlarm = async (req, res) => {
  try {
    const {
      alarmName, description, tag, alarmType,
      setpoint, deadband, priority, message, group,
      enableEmail, enableSMS, isEnabled,
      // ✅ T018 + T019 new fields
      emailRecipients, emailThrottleMinutes, soundEnabled,
    } = req.body;

    if (!alarmName || !tag || !alarmType) {
      return res.status(400).json({
        success: false,
        message: 'alarmName, tag, alarmType are required',
      });
    }

    const existingAlarm = await Alarm.findOne({ alarmName });
    if (existingAlarm) {
      return res.status(400).json({
        success: false,
        message: `Alarm with name '${alarmName}' already exists`,
      });
    }

    const alarm = await Alarm.create({
      alarmName,
      description,
      tag,
      alarmType,
      setpoint: setpoint || 0,
      deadband: deadband || 0,
      priority: priority || 'MEDIUM',
      message,
      group: group || 'Default',
      enableEmail: enableEmail || false,
      emailRecipients: Array.isArray(emailRecipients) ? emailRecipients : [],
      emailThrottleMinutes: emailThrottleMinutes ?? 15,
      soundEnabled: soundEnabled !== undefined ? soundEnabled : true,
      enableSMS: enableSMS || false,
      isEnabled: isEnabled !== undefined ? isEnabled : true,
    });

    res.status(201).json({
      success: true,
      message: 'Alarm created successfully',
      alarm,
    });
  } catch (error) {
    console.error('Create Alarm Error:', error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Alarm name already exists',
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to create alarm',
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────
// GET ALL Alarms — GET /api/alarms
// ─────────────────────────────────────────
const getAllAlarms = async (req, res) => {
  try {
    const {
      priority, group, isActive, isEnabled, alarmType,
      page = 1, limit = 50,
    } = req.query;

    const filter = {};
    if (priority)  filter.priority  = priority.toUpperCase();
    if (group)     filter.group     = group;
    if (alarmType) filter.alarmType = alarmType.toUpperCase();
    if (isActive  !== undefined) filter.isActive  = isActive  === 'true';
    if (isEnabled !== undefined) filter.isEnabled = isEnabled === 'true';

    const alarms = await Alarm.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Alarm.countDocuments(filter);

    res.json({
      success: true,
      count: alarms.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      alarms,
    });
  } catch (error) {
    console.error('Get All Alarms Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch alarms',
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────
// GET Single Alarm — GET /api/alarms/:id
// ─────────────────────────────────────────
const getAlarm = async (req, res) => {
  try {
    const alarm = await Alarm.findById(req.params.id);
    if (!alarm) {
      return res.status(404).json({ success: false, message: 'Alarm not found' });
    }
    res.json({ success: true, alarm });
  } catch (error) {
    console.error('Get Alarm Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch alarm', error: error.message });
  }
};

// ─────────────────────────────────────────
// GET ACTIVE Alarms — GET /api/alarms/active
// ─────────────────────────────────────────
const getActiveAlarms = async (req, res) => {
  try {
    const alarms = await Alarm.find({
      isActive: true,
      isEnabled: true,
    }).sort({
      priority: -1,
      triggeredAt: -1,
    });

    const summary = {
      total:    alarms.length,
      critical: alarms.filter(a => a.priority === 'CRITICAL').length,
      high:     alarms.filter(a => a.priority === 'HIGH').length,
      medium:   alarms.filter(a => a.priority === 'MEDIUM').length,
      low:      alarms.filter(a => a.priority === 'LOW').length,
      unacknowledged: alarms.filter(a => !a.isAcknowledged).length,
    };

    res.json({ success: true, summary, alarms });
  } catch (error) {
    console.error('Get Active Alarms Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch active alarms', error: error.message });
  }
};

// ─────────────────────────────────────────
// GET Alarm History — GET /api/alarms/history
// ─────────────────────────────────────────
const getAlarmHistory = async (req, res) => {
  try {
    const { tag, priority, startDate, endDate, limit = 100 } = req.query;

    const filter = {};
    if (tag)      filter.tag      = tag;
    if (priority) filter.priority = priority.toUpperCase();

    if (startDate || endDate) {
      filter.triggeredAt = {};
      if (startDate) filter.triggeredAt.$gte = new Date(startDate);
      if (endDate)   filter.triggeredAt.$lte = new Date(endDate);
    }

    filter.triggeredAt = filter.triggeredAt || { $ne: null };

    const alarms = await Alarm.find(filter)
      .sort({ triggeredAt: -1 })
      .limit(Number(limit));

    res.json({ success: true, count: alarms.length, alarms });
  } catch (error) {
    console.error('Get Alarm History Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch alarm history', error: error.message });
  }
};

// ─────────────────────────────────────────
// ACKNOWLEDGE Single Alarm — POST /api/alarms/:id/acknowledge
// ─────────────────────────────────────────
const acknowledgeAlarm = async (req, res) => {
  try {
    const alarm = await Alarm.findById(req.params.id);
    if (!alarm) return res.status(404).json({ success: false, message: 'Alarm not found' });
    if (!alarm.isActive) return res.status(400).json({ success: false, message: 'Cannot acknowledge - alarm is not active' });
    if (alarm.isAcknowledged) return res.status(400).json({ success: false, message: 'Alarm is already acknowledged' });

    alarm.isAcknowledged = true;
    alarm.acknowledgedAt = new Date();
    alarm.acknowledgedBy = req.user.name || req.user.email;
    await alarm.save();

    // Log acknowledgment in history
    await AlarmHistory.create({
      alarmName: alarm.alarmName,
      tag: alarm.tag,
      priority: alarm.priority,
      message: `Acknowledged by ${alarm.acknowledgedBy}`,
      event: 'ACKNOWLEDGED',
      user: alarm.acknowledgedBy,
    });

    // Broadcast
    const io = req.app.get('io');
    if (io) {
      io.emit('alarmAcknowledged', {
        _id: alarm._id,
        alarmName: alarm.alarmName,
        acknowledgedBy: alarm.acknowledgedBy,
        acknowledgedAt: alarm.acknowledgedAt,
      });
    }

    res.json({
      success: true,
      message: `Alarm '${alarm.alarmName}' acknowledged successfully`,
      alarm,
    });
  } catch (error) {
    console.error('Acknowledge Alarm Error:', error);
    res.status(500).json({ success: false, message: 'Failed to acknowledge alarm', error: error.message });
  }
};

// ─────────────────────────────────────────
// ACKNOWLEDGE ALL — POST /api/alarms/acknowledge-all
// ─────────────────────────────────────────
const acknowledgeAllAlarms = async (req, res) => {
  try {
    const activeAlarms = await Alarm.find({ isActive: true, isAcknowledged: false });

    if (activeAlarms.length === 0) {
      return res.json({ success: true, message: 'No unacknowledged alarms found', count: 0 });
    }

    const ackBy = req.user.name || req.user.email;
    const result = await Alarm.updateMany(
      { isActive: true, isAcknowledged: false },
      {
        $set: {
          isAcknowledged: true,
          acknowledgedAt: new Date(),
          acknowledgedBy: ackBy,
        },
      }
    );

    // Bulk history entries
    await AlarmHistory.insertMany(activeAlarms.map(a => ({
      alarmName: a.alarmName,
      tag: a.tag,
      priority: a.priority,
      message: `Ack (bulk) by ${ackBy}`,
      event: 'ACKNOWLEDGED',
      user: ackBy,
    })));

    const io = req.app.get('io');
    if (io) io.emit('alarmAcknowledged', { bulk: true, count: result.modifiedCount });

    res.json({
      success: true,
      message: `${result.modifiedCount} alarms acknowledged`,
      count: result.modifiedCount,
    });
  } catch (error) {
    console.error('Acknowledge All Alarms Error:', error);
    res.status(500).json({ success: false, message: 'Failed to acknowledge all alarms', error: error.message });
  }
};

// ─────────────────────────────────────────
// UPDATE Alarm — PUT /api/alarms/:id
// ─────────────────────────────────────────
const updateAlarm = async (req, res) => {
  try {
    const alarm = await Alarm.findById(req.params.id);
    if (!alarm) return res.status(404).json({ success: false, message: 'Alarm not found' });

    // ✅ T018 + T019: allow new fields
    const allowedFields = [
      'alarmName', 'description', 'tag', 'alarmType',
      'setpoint', 'deadband', 'priority', 'message', 'group',
      'enableEmail', 'emailRecipients', 'emailThrottleMinutes',
      'soundEnabled', 'enableSMS', 'isEnabled',
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        alarm[field] = req.body[field];
      }
    });

    await alarm.save();

    res.json({
      success: true,
      message: 'Alarm updated successfully',
      alarm,
    });
  } catch (error) {
    console.error('Update Alarm Error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Alarm name already exists' });
    }
    res.status(500).json({ success: false, message: 'Failed to update alarm', error: error.message });
  }
};

// ─────────────────────────────────────────
// DELETE Alarm — DELETE /api/alarms/:id
// ─────────────────────────────────────────
const deleteAlarm = async (req, res) => {
  try {
    const alarm = await Alarm.findById(req.params.id);
    if (!alarm) return res.status(404).json({ success: false, message: 'Alarm not found' });
    await alarm.deleteOne();
    res.json({ success: true, message: `Alarm '${alarm.alarmName}' deleted successfully` });
  } catch (error) {
    console.error('Delete Alarm Error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete alarm', error: error.message });
  }
};

// ─────────────────────────────────────────
// ✅ T021: EXPORT Alarms as CSV
// GET /api/alarms/export?type=active|history|all&priority=CRITICAL&startDate=...&endDate=...
// ─────────────────────────────────────────
const exportAlarmsCSV = async (req, res) => {
  try {
    const { type = 'all', priority, startDate, endDate } = req.query;

    // CSV escape helper
    const esc = (v) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    let csv = '';
    const filename = `alarms_${type}_${new Date().toISOString().slice(0, 10)}.csv`;

    if (type === 'history') {
      // Export alarm history
      const filter = {};
      if (priority) filter.priority = priority.toUpperCase();
      if (startDate || endDate) {
        filter.timestamp = {};
        if (startDate) filter.timestamp.$gte = new Date(startDate);
        if (endDate)   filter.timestamp.$lte = new Date(endDate);
      }

      const history = await AlarmHistory.find(filter).sort({ timestamp: -1 }).limit(10000);

      const headers = ['Timestamp', 'Alarm Name', 'Tag', 'Priority', 'Event', 'Trigger Value', 'Message', 'User'];
      const rows = history.map(h => [
        new Date(h.timestamp).toISOString(),
        h.alarmName,
        h.tag,
        h.priority,
        h.event,
        h.triggerValue ?? '',
        h.message ?? '',
        h.user ?? '',
      ]);

      csv = `# OnlineSCADA Alarm History Export\n`;
      csv += `# Generated: ${new Date().toISOString()}\n`;
      csv += `# Total Records: ${rows.length}\n`;
      if (priority) csv += `# Priority Filter: ${priority}\n`;
      if (startDate || endDate) csv += `# Date Range: ${startDate || 'any'} → ${endDate || 'any'}\n`;
      csv += `\n${headers.map(esc).join(',')}\n`;
      csv += rows.map(r => r.map(esc).join(',')).join('\n');
    } else {
      // Export current alarms (all or active)
      const filter = {};
      if (type === 'active') filter.isActive = true;
      if (priority) filter.priority = priority.toUpperCase();

      const alarms = await Alarm.find(filter).sort({ priority: -1, alarmName: 1 });

      const headers = [
        'Alarm Name', 'Description', 'Tag', 'Type', 'Setpoint', 'Deadband',
        'Priority', 'Group', 'Message', 'Status', 'Acknowledged',
        'Triggered At', 'Cleared At', 'Ack By', 'Ack At',
        'Email Enabled', 'Email Recipients', 'Sound Enabled', 'Is Enabled',
      ];
      const rows = alarms.map(a => [
        a.alarmName,
        a.description ?? '',
        a.tag,
        a.alarmType,
        a.setpoint,
        a.deadband,
        a.priority,
        a.group,
        a.message ?? '',
        a.isActive ? 'ACTIVE' : 'NORMAL',
        a.isAcknowledged ? 'YES' : 'NO',
        a.triggeredAt ? new Date(a.triggeredAt).toISOString() : '',
        a.clearedAt ? new Date(a.clearedAt).toISOString() : '',
        a.acknowledgedBy ?? '',
        a.acknowledgedAt ? new Date(a.acknowledgedAt).toISOString() : '',
        a.enableEmail ? 'YES' : 'NO',
        (a.emailRecipients || []).join('; '),
        a.soundEnabled !== false ? 'YES' : 'NO',
        a.isEnabled ? 'YES' : 'NO',
      ]);

      csv = `# OnlineSCADA Alarm Export (${type})\n`;
      csv += `# Generated: ${new Date().toISOString()}\n`;
      csv += `# Total Alarms: ${rows.length}\n`;
      if (priority) csv += `# Priority Filter: ${priority}\n`;
      csv += `\n${headers.map(esc).join(',')}\n`;
      csv += rows.map(r => r.map(esc).join(',')).join('\n');
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    console.error('Export Alarms Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export alarms',
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────
// TRIGGER Alarm (internal — kept for compat)
// ─────────────────────────────────────────
const triggerAlarm = async (alarmName, currentValue) => {
  try {
    const alarm = await Alarm.findOne({ alarmName, isEnabled: true });
    if (!alarm) return;

    if (!alarm.isActive) {
      alarm.isActive = true;
      alarm.isAcknowledged = false;
      alarm.triggeredAt = new Date();
      alarm.clearedAt = null;
      alarm.acknowledgedBy = null;
      alarm.acknowledgedAt = null;
      await alarm.save();
      console.log(`🔔 Alarm TRIGGERED: ${alarmName} | Value: ${currentValue}`);
    }
  } catch (error) {
    console.error('Trigger Alarm Error:', error);
  }
};

// ─────────────────────────────────────────
// CLEAR Alarm (internal — kept for compat)
// ─────────────────────────────────────────
const clearAlarm = async (alarmName) => {
  try {
    const alarm = await Alarm.findOne({ alarmName });
    if (!alarm) return;
    if (alarm.isActive) {
      alarm.isActive = false;
      alarm.isAcknowledged = false;
      alarm.clearedAt = new Date();
      await alarm.save();
      console.log(`✅ Alarm CLEARED: ${alarmName}`);
    }
  } catch (error) {
    console.error('Clear Alarm Error:', error);
  }
};

module.exports = {
  createAlarm,
  getAllAlarms,
  getAlarm,
  getActiveAlarms,
  getAlarmHistory,
  acknowledgeAlarm,
  acknowledgeAllAlarms,
  updateAlarm,
  deleteAlarm,
  exportAlarmsCSV, // ✅ T021
  // Internal for PLC Manager
  triggerAlarm,
  clearAlarm,
};