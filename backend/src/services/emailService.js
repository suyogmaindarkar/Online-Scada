// ═══════════════════════════════════════════════════════════
// Email Service — Multi-Tenant Nodemailer Transport
// ✅ Hardened for Render.com (FORCED IPv4 ONLY - family: 4)
// ═══════════════════════════════════════════════════════════

const nodemailer = require('nodemailer');
const dns        = require('dns');

// Force global Node.js DNS to return IPv4 first across all network calls
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

// Custom lookup function to guarantee only IPv4 addresses are returned
const ipv4Lookup = (hostname, options, callback) => {
  return dns.lookup(hostname, { family: 4, all: false }, callback);
};

const DEFAULT_SENDER = 'suyogmaindarkar@gmail.com';

const getTransporter = () => {
  const user = process.env.SMTP_USER || DEFAULT_SENDER;
  const pass = process.env.SMTP_PASS;

  if (!pass) {
    return null;
  }

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT, 10) || 465;
  const isSecure = port === 465;

  // ✅ CRITICAL FIX for Render.com:
  // Explicit custom lookup guarantees IPv4 (A records only), bypassing IPv6 completely
  // and preventing "connect ENETUNREACH 2607:f8b0:..." errors.
  return nodemailer.createTransport({
    host,
    port,
    secure: isSecure,
    lookup: ipv4Lookup,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false,
      servername: host,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 15000,
  });
};

// ─── Send Alarm Email ─────────────────────────────────────
const sendAlarmEmail = async (alarm, currentValue) => {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn('⚠️  SMTP_PASS missing — Alarm email skipped');
    return { sent: false, reason: 'SMTP_PASS missing' };
  }

  const recipients = alarm.emailRecipients;
  if (!recipients || recipients.length === 0) {
    return { sent: false, reason: 'No recipients' };
  }

  const throttleMs = (alarm.emailThrottleMinutes || 15) * 60 * 1000;
  if (alarm.lastEmailSentAt && (Date.now() - new Date(alarm.lastEmailSentAt).getTime() < throttleMs)) {
    return { sent: false, reason: 'Throttled' };
  }

  const subject = `🚨 [${alarm.priority}] Alarm: ${alarm.alarmName}`;
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f8fafc; border-radius: 8px;">
      <h2 style="color: #dc2626; margin-top: 0;">🚨 SCADA Alarm Triggered</h2>
      <p><strong>Alarm Name:</strong> ${alarm.alarmName}</p>
      <p><strong>Tag:</strong> ${alarm.tag}</p>
      <p><strong>Priority:</strong> ${alarm.priority}</p>
      <p><strong>Current Value:</strong> ${currentValue}</p>
      <p><strong>Setpoint:</strong> ${alarm.setpoint}</p>
      <p><strong>Message:</strong> ${alarm.message || 'None'}</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="font-size: 12px; color: #64748b;">This is an automated alert from OnlineSCADA.</p>
    </div>
  `;

  try {
    const sender = process.env.SMTP_USER || DEFAULT_SENDER;
    await transporter.sendMail({
      from: `"OnlineSCADA Alarms" <${sender}>`,
      to: recipients.join(','),
      subject,
      html,
    });
    console.log(`✉️ Alarm email sent to ${recipients.join(',')}`);
    return { sent: true };
  } catch (error) {
    console.error('❌ Failed to send alarm email:', error.message);
    return { sent: false, reason: error.message };
  }
};

// ─── Welcome Email for New Registered Users ───────────────
const sendWelcomeEmail = async ({ email, fullName, companyName, slug }) => {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn('⚠️  SMTP_PASS missing in Render environment variables — Welcome email skipped.');
    return { sent: false, reason: 'SMTP_PASS missing' };
  }

  const appUrl = process.env.APP_URL || 'https://app.onlinescada.in';
  const loginUrl = `${appUrl}/login`;
  const subject = `Welcome to OnlineSCADA — Your ${companyName} Workspace is Ready! 🚀`;
  const senderUser = process.env.SMTP_USER || DEFAULT_SENDER;

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F8FAFC; margin: 0; padding: 30px 10px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(8, 27, 67, 0.08); border: 1px solid #E5E7EB;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #2563EB 0%, #0F3D91 100%); padding: 32px 24px; text-align: center; color: #FFFFFF;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">Online<span style="color: #93C5FD;">SCADA</span></h1>
          <p style="margin: 8px 0 0; font-size: 14px; opacity: 0.9;">Next-Gen Cloud SCADA / HMI Platform</p>
        </div>

        <!-- Body -->
        <div style="padding: 32px 28px; color: #334155; line-height: 1.6;">
          <h2 style="color: #081B43; margin-top: 0; font-size: 20px;">Welcome aboard, ${fullName}! 👋</h2>
          <p>Thank you for choosing OnlineSCADA. Your <strong>14-day Free Trial</strong> workspace has been set up and is ready for use.</p>

          <div style="background-color: #EEF6FF; border: 1px solid #BFDBFE; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <h3 style="margin: 0 0 12px; color: #1E40AF; font-size: 15px; text-transform: uppercase; letter-spacing: 0.5px;">Your Workspace Details</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 6px 0; color: #5F6B7A; width: 130px;">Company Name:</td>
                <td style="padding: 6px 0; color: #081B43; font-weight: 700;">${companyName}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #5F6B7A;">Workspace Slug:</td>
                <td style="padding: 6px 0; color: #2563EB; font-weight: 700; font-family: monospace;">${slug}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #5F6B7A;">Admin Email:</td>
                <td style="padding: 6px 0; color: #081B43;">${email}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #5F6B7A;">Plan:</td>
                <td style="padding: 6px 0; color: #16A34A; font-weight: 700;">Pro Trial (14 Days)</td>
              </tr>
            </table>
          </div>

          <!-- CTA Button -->
          <div style="text-align: center; margin: 32px 0;">
            <a href="${loginUrl}" target="_blank" style="background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%); color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);">
              Access Your Workspace →
            </a>
          </div>

          <h4 style="color: #081B43; margin: 24px 0 12px; font-size: 15px;">What's included in your Trial?</h4>
          <ul style="padding-left: 20px; margin: 0; color: #475569;">
            <li style="margin-bottom: 6px;"><strong>Pre-configured Demo PLC</strong> with 5 live simulation tags</li>
            <li style="margin-bottom: 6px;">Full access to the <strong>WinCC HMI Graphic Designer</strong></li>
            <li style="margin-bottom: 6px;">Real-time Alarm monitoring & Email notifications</li>
            <li style="margin-bottom: 6px;">Historical Trend charts & Report generation</li>
          </ul>

          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 32px 0 20px;" />

          <p style="font-size: 13px; color: #64748B; margin: 0;">
            Need assistance or custom PLC connectivity support? Reply directly to this email or reach us at <a href="mailto:${DEFAULT_SENDER}" style="color: #2563EB; text-decoration: none;">${DEFAULT_SENDER}</a>.
          </p>
        </div>

        <!-- Footer -->
        <div style="background-color: #F8FAFC; padding: 20px; text-align: center; border-top: 1px solid #E5E7EB; font-size: 12px; color: #94A3B8;">
          © 2026 OnlineSCADA — Enterprise Web-Based SCADA Platform<br />
          <a href="https://onlinescada.in" style="color: #2563EB; text-decoration: none;">onlinescada.in</a>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: `"OnlineSCADA" <${senderUser}>`,
      to: email,
      subject,
      html,
    });
    console.log(`✉️ Welcome email sent successfully to ${email} (from ${senderUser})`);
    return { sent: true };
  } catch (error) {
    console.error(`❌ Failed to send welcome email to ${email}:`, error.message);
    return { sent: false, reason: error.message };
  }
};

module.exports = {
  sendAlarmEmail,
  sendWelcomeEmail,
};