// ═══════════════════════════════════════════════════════════
// Alarm Engine — Multi-Tenant Scoped
// ═══════════════════════════════════════════════════════════

const Alarm = require('../models/Alarm');
const AlarmHistory = require('../models/AlarmHistory');
const Tag = require('../models/Tag');
const { sendAlarmEmail } = require('./emailService');

class AlarmEngine {
  constructor() {
    this.io = null;
    this.checkInterval = null;
    this.checkRate = 1000;
  }

  init(io) {
    this.io = io;
    this.start();
    console.log('[+] Alarm Engine initialized (multi-tenant)');
  }

  start() {
    if (this.checkInterval) return;
    this.checkInterval = setInterval(() => {
      this.checkAllAlarms();
    }, this.checkRate);
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  async checkAllAlarms() {
    try {
      const alarms = await Alarm.find({ isEnabled: true });
      for (const alarm of alarms) {
        await this.checkAlarm(alarm);
      }
    } catch (error) {
      console.error('[x] Alarm check error:', error.message);
    }
  }

  async checkAlarm(alarm) {
    try {
      const tag = await Tag.findOne({
        companyId: alarm.companyId,
        tagName: alarm.tag,
      });
      if (!tag) return;

      const currentValue = tag.currentValue;
      const shouldTrigger = this.evaluateAlarm(alarm, currentValue);

      // ALARM TRIGGERED
      if (shouldTrigger && !alarm.isActive) {
        alarm.isActive = true;
        alarm.isAcknowledged = false;
        alarm.triggeredAt = new Date();
        alarm.clearedAt = null;
        await alarm.save();

        await AlarmHistory.create({
          companyId: alarm.companyId,
          alarmName: alarm.alarmName,
          tag: alarm.tag,
          triggerValue: currentValue,
          priority: alarm.priority,
          message: alarm.message || `${alarm.tag} ${alarm.alarmType} alarm triggered`,
          event: 'TRIGGERED',
        });

        if (this.io) {
          this.io.to(`company:${alarm.companyId}`).emit('alarmTriggered', {
            _id: alarm._id,
            companyId: alarm.companyId,
            alarmName: alarm.alarmName,
            tag: alarm.tag,
            priority: alarm.priority,
            message: alarm.message,
            value: currentValue,
            triggeredAt: alarm.triggeredAt,
            soundEnabled: alarm.soundEnabled !== false,
          });
        }

        console.log(`[!] ALARM TRIGGERED [Company ${alarm.companyId}]: ${alarm.alarmName} (${currentValue})`);

        if (alarm.enableEmail && alarm.emailRecipients?.length > 0) {
          this.sendEmailAsync(alarm, currentValue);
        }
      }

      // ALARM CLEARED
      else if (!shouldTrigger && alarm.isActive) {
        alarm.isActive = false;
        alarm.clearedAt = new Date();
        await alarm.save();

        await AlarmHistory.create({
          companyId: alarm.companyId,
          alarmName: alarm.alarmName,
          tag: alarm.tag,
          triggerValue: currentValue,
          priority: alarm.priority,
          message: `${alarm.alarmName} cleared`,
          event: 'CLEARED',
        });

        if (this.io) {
          this.io.to(`company:${alarm.companyId}`).emit('alarmCleared', {
            _id: alarm._id,
            companyId: alarm.companyId,
            alarmName: alarm.alarmName,
            priority: alarm.priority,
            clearedAt: alarm.clearedAt,
          });
        }

        console.log(`[+] ALARM CLEARED [Company ${alarm.companyId}]: ${alarm.alarmName}`);
      }
    } catch (error) {
      console.error(`[x] Error checking alarm ${alarm.alarmName}:`, error.message);
    }
  }

  async sendEmailAsync(alarm, currentValue) {
    try {
      const result = await sendAlarmEmail(alarm, currentValue);
      if (result.sent) {
        await Alarm.findByIdAndUpdate(alarm._id, {
          lastEmailSentAt: new Date(),
        });
      } else if (result.reason && !result.reason.includes('Throttled')) {
        console.warn(`[i] Email skipped for ${alarm.alarmName}: ${result.reason}`);
      }
    } catch (error) {
      console.error(`[x] Email send failed for ${alarm.alarmName}:`, error.message);
    }
  }

  evaluateAlarm(alarm, value) {
    if (value === null || value === undefined) return false;

    const setpoint = parseFloat(alarm.setpoint);
    const deadband = parseFloat(alarm.deadband) || 0;
    const numValue = parseFloat(value);

    switch (alarm.alarmType) {
      case 'HIGH':
      case 'HIGH_HIGH':
        if (alarm.isActive) return numValue > (setpoint - deadband);
        return numValue > setpoint;

      case 'LOW':
      case 'LOW_LOW':
        if (alarm.isActive) return numValue < (setpoint + deadband);
        return numValue < setpoint;

      case 'EQUAL': return numValue === setpoint;
      case 'NOT_EQUAL': return numValue !== setpoint;
      case 'DIGITAL': return value === true || value === 1 || value === 'true';
      case 'DEVIATION': return Math.abs(numValue - setpoint) > deadband;

      default: return false;
    }
  }
}

module.exports = new AlarmEngine();