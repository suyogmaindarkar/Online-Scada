// ═══════════════════════════════════════════════════════════
// Email Service — Nodemailer wrapper
//
// Task Bundle applied:
//   ✅ T019  — Email notifications for critical alarms
//
// Features:
//   • Reads SMTP config from Settings collection (falls back to env)
//   • Graceful fallback when SMTP not configured (logs & skips)
//   • Rate limiting per alarm (respects emailThrottleMinutes)
//   • Professional HTML templates matching brand
// ═══════════════════════════════════════════════════════════

const nodemailer = require('nodemailer');
const Settings = require('../models/Settings');

let transporter = null;
let isReady = false;
let lastConfigLoad = 0;
const CONFIG_RELOAD_INTERVAL = 60_000; // Reload SMTP settings every 60s

// ─────────────────────────────────────────
// Load SMTP config from Settings (or env fallback)
// ─────────────────────────────────────────
const loadConfig = async (force = false) => {
  const now = Date.now();
  if (!force && transporter && (now - lastConfigLoad) < CONFIG_RELOAD_INTERVAL) {
    return transporter;
  }
  lastConfigLoad = now;

  try {
    let cfg = null;

    // Try loading from Settings collection first
    try {
      const settings = await Settings.findOne();
      if (settings?.email?.enabled) {
        cfg = settings.email;
      }
    } catch (e) {
      // Settings may not exist yet — that's fine
    }

    // Fallback to env vars
    if (!cfg) {
      if (process.env.SMTP_HOST && process.env.SMTP_USER) {
        cfg = {
          enabled: true,
          smtpHost: process.env.SMTP_HOST,
          smtpPort: parseInt(process.env.SMTP_PORT || '587'),
          smtpSecure: process.env.SMTP_SECURE === 'true',
          smtpUser: process.env.SMTP_USER,
          smtpPassword: process.env.SMTP_PASSWORD,
          fromEmail: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
          fromName: process.env.SMTP_FROM_NAME || 'OnlineSCADA',
        };
      }
    }

    if (!cfg || !cfg.enabled || !cfg.smtpHost || !cfg.smtpUser) {
      transporter = null;
      isReady = false;
      return null;
    }

    // Create transporter
    transporter = nodemailer.createTransport({
      host: cfg.smtpHost,
      port: cfg.smtpPort || 587,
      secure: cfg.smtpSecure || false,
      auth: {
        user: cfg.smtpUser,
        pass: cfg.smtpPassword,
      },
      tls: { rejectUnauthorized: false },
    });

    // Cache from-fields
    transporter._fromEmail = cfg.fromEmail || cfg.smtpUser;
    transporter._fromName = cfg.fromName || 'OnlineSCADA';

    isReady = true;
    return transporter;
  } catch (error) {
    console.error('❌ Email service config error:', error.message);
    transporter = null;
    isReady = false;
    return null;
  }
};

// ─────────────────────────────────────────
// Verify SMTP connection
// ─────────────────────────────────────────
const verifyConnection = async () => {
  try {
    const t = await loadConfig();
    if (!t) return { ok: false, message: 'Email not configured' };

    await t.verify();
    return { ok: true, message: 'SMTP connection verified' };
  } catch (error) {
    return { ok: false, message: error.message };
  }
};

// ─────────────────────────────────────────
// Send an alarm notification email
// ─────────────────────────────────────────
const sendAlarmEmail = async (alarm, currentValue) => {
  try {
    const t = await loadConfig();
    if (!t) {
      // Silent skip — SMTP not configured
      return { sent: false, reason: 'SMTP not configured' };
    }

    if (!alarm.emailRecipients || alarm.emailRecipients.length === 0) {
      return { sent: false, reason: 'No recipients configured' };
    }

    // ─── T019: Rate limiting per alarm ───
    const throttleMs = (alarm.emailThrottleMinutes || 15) * 60 * 1000;
    if (alarm.lastEmailSentAt) {
      const sinceLast = Date.now() - new Date(alarm.lastEmailSentAt).getTime();
      if (sinceLast < throttleMs) {
        return {
          sent: false,
          reason: `Throttled (last sent ${Math.round(sinceLast / 60000)} min ago)`,
        };
      }
    }

    // ─── Build HTML template ───
    const priorityColors = {
      CRITICAL: { bg: '#DC2626', text: '#FFFFFF' },
      HIGH:     { bg: '#EA580C', text: '#FFFFFF' },
      MEDIUM:   { bg: '#F59E0B', text: '#FFFFFF' },
      LOW:      { bg: '#2563EB', text: '#FFFFFF' },
    };
    const pc = priorityColors[alarm.priority] || priorityColors.MEDIUM;

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Alarm Notification</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #F8FAFC; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0px 4px 20px rgba(8, 27, 67, 0.10);">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #2563EB 0%, #0F3D91 100%); padding: 24px; text-align: center;">
      <h1 style="color: #FFFFFF; margin: 0; font-size: 24px; font-weight: 700;">
        Online<span style="color: #DBEAFE;">SCADA</span>
      </h1>
      <p style="color: #DBEAFE; margin: 4px 0 0; font-size: 14px;">Alarm Notification</p>
    </div>

    <!-- Priority Badge -->
    <div style="padding: 16px 24px; background: ${pc.bg}; text-align: center;">
      <span style="color: ${pc.text}; font-size: 14px; font-weight: 700; letter-spacing: 2px;">
        🚨 ${alarm.priority} PRIORITY ALARM
      </span>
    </div>

    <!-- Body -->
    <div style="padding: 24px;">
      <h2 style="color: #081B43; margin: 0 0 8px; font-size: 20px;">${alarm.alarmName}</h2>
      <p style="color: #5F6B7A; margin: 0 0 20px; font-size: 14px;">${alarm.description || 'No description'}</p>

      <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
        <tr>
          <td style="padding: 8px 0; color: #5F6B7A; font-size: 13px; font-weight: 600;">Tag:</td>
          <td style="padding: 8px 0; color: #081B43; font-family: monospace; font-size: 13px;">${alarm.tag}</td>
        </tr>
        <tr style="border-top: 1px solid #E5E7EB;">
          <td style="padding: 8px 0; color: #5F6B7A; font-size: 13px; font-weight: 600;">Current Value:</td>
          <td style="padding: 8px 0; color: #DC2626; font-family: monospace; font-size: 15px; font-weight: 700;">${currentValue}</td>
        </tr>
        <tr style="border-top: 1px solid #E5E7EB;">
          <td style="padding: 8px 0; color: #5F6B7A; font-size: 13px; font-weight: 600;">Setpoint:</td>
          <td style="padding: 8px 0; color: #081B43; font-family: monospace; font-size: 13px;">${alarm.setpoint}</td>
        </tr>
        <tr style="border-top: 1px solid #E5E7EB;">
          <td style="padding: 8px 0; color: #5F6B7A; font-size: 13px; font-weight: 600;">Alarm Type:</td>
          <td style="padding: 8px 0; color: #081B43; font-size: 13px;">${alarm.alarmType}</td>
        </tr>
        <tr style="border-top: 1px solid #E5E7EB;">
          <td style="padding: 8px 0; color: #5F6B7A; font-size: 13px; font-weight: 600;">Triggered At:</td>
          <td style="padding: 8px 0; color: #081B43; font-size: 13px;">${new Date().toLocaleString()}</td>
        </tr>
        ${alarm.message ? `
        <tr style="border-top: 1px solid #E5E7EB;">
          <td style="padding: 8px 0; color: #5F6B7A; font-size: 13px; font-weight: 600;">Message:</td>
          <td style="padding: 8px 0; color: #081B43; font-size: 13px;">${alarm.message}</td>
        </tr>
        ` : ''}
      </table>

      <div style="margin-top: 24px; padding: 12px; background: #FEF3C7; border: 1px solid #F59E0B; border-radius: 8px;">
        <p style="margin: 0; color: #78350F; font-size: 12px;">
          ⚠️ Please log in to your OnlineSCADA dashboard to acknowledge this alarm.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background: #081B43; padding: 16px 24px; text-align: center;">
      <p style="color: #B7C3D6; margin: 0; font-size: 11px;">
        This is an automated notification from OnlineSCADA.<br>
        Do not reply to this email.
      </p>
    </div>
  </div>
</body>
</html>
    `.trim();

    // Plain text fallback
    const text = `
🚨 ${alarm.priority} PRIORITY ALARM

Alarm: ${alarm.alarmName}
Tag: ${alarm.tag}
Current Value: ${currentValue}
Setpoint: ${alarm.setpoint}
Type: ${alarm.alarmType}
Triggered: ${new Date().toLocaleString()}

${alarm.description ? 'Description: ' + alarm.description + '\n' : ''}
${alarm.message ? 'Message: ' + alarm.message + '\n' : ''}
Please log in to OnlineSCADA to acknowledge.
    `.trim();

    // Send
    const info = await t.sendMail({
      from: `"${t._fromName}" <${t._fromEmail}>`,
      to: alarm.emailRecipients.join(', '),
      subject: `🚨 [${alarm.priority}] ${alarm.alarmName}`,
      text,
      html,
    });

    console.log(`📧 Alarm email sent: ${alarm.alarmName} → ${alarm.emailRecipients.length} recipient(s)`);
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Failed to send alarm email for ${alarm.alarmName}:`, error.message);
    return { sent: false, reason: error.message };
  }
};

// ─────────────────────────────────────────
// Send a generic test email (used by Settings page)
// ─────────────────────────────────────────
const sendTestEmail = async (toEmail) => {
  try {
    const t = await loadConfig(true);
    if (!t) return { ok: false, message: 'SMTP not configured' };

    await t.sendMail({
      from: `"${t._fromName}" <${t._fromEmail}>`,
      to: toEmail,
      subject: '✅ OnlineSCADA - Test Email',
      text: 'This is a test email from OnlineSCADA. If you received this, your SMTP configuration is working correctly.',
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #081B43;">✅ Test Email Successful</h2>
          <p style="color: #334155;">This is a test email from OnlineSCADA. Your SMTP configuration is working correctly.</p>
          <hr style="border: none; border-top: 1px solid #E5E7EB;">
          <p style="color: #94A3B8; font-size: 12px;">Sent at ${new Date().toLocaleString()}</p>
        </div>
      `,
    });

    return { ok: true, message: 'Test email sent' };
  } catch (error) {
    return { ok: false, message: error.message };
  }
};

// ─────────────────────────────────────────
// Public status
// ─────────────────────────────────────────
const isEmailAvailable = () => isReady;

module.exports = {
  sendAlarmEmail,
  sendTestEmail,
  verifyConnection,
  isEmailAvailable,
  loadConfig,
};