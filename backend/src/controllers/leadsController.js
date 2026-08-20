// ═══════════════════════════════════════════════════════════
// Leads Controller — Handles demo requests from landing site
//
// Public endpoints:
//   POST /api/leads          — Create new lead (from landing form)
//
// Super-admin endpoints:
//   GET  /api/leads          — List all leads (with filters)
//   GET  /api/leads/:id      — Get single lead
//   PUT  /api/leads/:id      — Update lead status/notes
//   DELETE /api/leads/:id    — Delete lead (spam)
// ═══════════════════════════════════════════════════════════

const Lead = require('../models/Lead');
const nodemailer = require('nodemailer');

// ─── Email transporter (reuses SMTP config from .env) ───
const getTransporter = () => {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

// ─── Email formatter for new lead notification ───
const buildLeadNotificationEmail = (lead) => {
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #F8FAFC; padding: 20px;">
  <div style="background: linear-gradient(135deg, #2563EB 0%, #0F3D91 100%); color: white; padding: 24px; border-radius: 12px 12px 0 0;">
    <h1 style="margin: 0; font-size: 22px;">🎯 New Lead — OnlineSCADA</h1>
    <p style="margin: 8px 0 0; opacity: 0.9; font-size: 13px;">
      Source: ${lead.source} · Received: ${new Date(lead.createdAt).toLocaleString()}
    </p>
  </div>

  <div style="background: white; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #E5E7EB;">
    <h2 style="color: #081B43; margin: 0 0 16px; font-size: 18px;">Contact Details</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <tr><td style="padding: 8px 0; color: #5F6B7A; width: 130px;">Company:</td><td style="padding: 8px 0; color: #081B43; font-weight: 600;">${lead.companyName}</td></tr>
      <tr><td style="padding: 8px 0; color: #5F6B7A;">Contact Person:</td><td style="padding: 8px 0; color: #081B43;">${lead.contactName}</td></tr>
      <tr><td style="padding: 8px 0; color: #5F6B7A;">Email:</td><td style="padding: 8px 0;"><a href="mailto:${lead.email}" style="color: #2563EB;">${lead.email}</a></td></tr>
      ${lead.phone ? `<tr><td style="padding: 8px 0; color: #5F6B7A;">Phone:</td><td style="padding: 8px 0;"><a href="tel:${lead.phone}" style="color: #2563EB;">${lead.phone}</a></td></tr>` : ''}
      ${lead.country ? `<tr><td style="padding: 8px 0; color: #5F6B7A;">Country:</td><td style="padding: 8px 0; color: #081B43;">${lead.country}</td></tr>` : ''}
    </table>

    <h2 style="color: #081B43; margin: 24px 0 16px; font-size: 18px;">Business Info</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <tr><td style="padding: 8px 0; color: #5F6B7A; width: 130px;">Company Size:</td><td style="padding: 8px 0; color: #081B43;">${lead.companySize}</td></tr>
      ${lead.industry ? `<tr><td style="padding: 8px 0; color: #5F6B7A;">Industry:</td><td style="padding: 8px 0; color: #081B43;">${lead.industry}</td></tr>` : ''}
      <tr><td style="padding: 8px 0; color: #5F6B7A;">Plan Interest:</td><td style="padding: 8px 0; color: #081B43; font-weight: 600;">${lead.planInterest.toUpperCase()}</td></tr>
      ${lead.numPLCs ? `<tr><td style="padding: 8px 0; color: #5F6B7A;"># of PLCs:</td><td style="padding: 8px 0; color: #081B43;">${lead.numPLCs}</td></tr>` : ''}
      ${lead.numUsers ? `<tr><td style="padding: 8px 0; color: #5F6B7A;"># of Users:</td><td style="padding: 8px 0; color: #081B43;">${lead.numUsers}</td></tr>` : ''}
    </table>

    ${lead.message ? `
      <h2 style="color: #081B43; margin: 24px 0 16px; font-size: 18px;">Message</h2>
      <div style="padding: 14px; background: #F1F5F9; border-left: 4px solid #2563EB; border-radius: 4px; color: #334155; line-height: 1.6;">
        ${lead.message.replace(/\n/g, '<br />')}
      </div>
    ` : ''}

    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #E5E7EB;">
      <p style="font-size: 12px; color: #94A3B8; margin: 0;">
        <strong>Lead ID:</strong> <code>${lead._id}</code><br>
        <strong>IP:</strong> ${lead.ipAddress || 'unknown'}<br>
        <strong>Browser:</strong> ${(lead.userAgent || 'unknown').substring(0, 80)}${lead.userAgent && lead.userAgent.length > 80 ? '...' : ''}
      </p>
    </div>

    <div style="text-align: center; margin-top: 24px;">
      <a href="mailto:${lead.email}?subject=Re: Your OnlineSCADA Demo Request&body=Hi ${lead.contactName},%0D%0A%0D%0AThank you for your interest in OnlineSCADA..." 
         style="display: inline-block; background: linear-gradient(135deg, #2563EB 0%, #0F3D91 100%); color: white; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 700;">
        Reply to Lead →
      </a>
    </div>
  </div>

  <p style="text-align: center; color: #94A3B8; font-size: 11px; margin-top: 20px;">
    OnlineSCADA Lead Notification System · This email was auto-generated
  </p>
</body>
</html>`;

  const text = `
NEW LEAD — OnlineSCADA
━━━━━━━━━━━━━━━━━━━━━━━━

Source: ${lead.source}
Received: ${new Date(lead.createdAt).toLocaleString()}

CONTACT DETAILS
Company:  ${lead.companyName}
Name:     ${lead.contactName}
Email:    ${lead.email}
Phone:    ${lead.phone || 'N/A'}
Country:  ${lead.country || 'N/A'}

BUSINESS INFO
Company Size:  ${lead.companySize}
Industry:      ${lead.industry || 'N/A'}
Plan Interest: ${lead.planInterest}
# of PLCs:     ${lead.numPLCs || 'N/A'}
# of Users:    ${lead.numUsers || 'N/A'}

MESSAGE
${lead.message || '(no message)'}

━━━━━━━━━━━━━━━━━━━━━━━━
Lead ID: ${lead._id}
IP: ${lead.ipAddress}
`;

  return { html, text };
};

// ═══════════════════════════════════════════════════════════
// POST /api/leads — Create new lead (PUBLIC endpoint)
// ═══════════════════════════════════════════════════════════
const createLead = async (req, res) => {
  try {
    const {
      companyName, contactName, email, phone, country,
      companySize, industry, planInterest,
      numPLCs, numUsers, message, source,
    } = req.body;

    // ─── Validation ───
    if (!companyName || !contactName || !email) {
      return res.status(400).json({
        success: false,
        message: 'Company name, contact name, and email are required',
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address',
      });
    }

    // ─── Spam prevention: check for very recent submission from same email ───
    const recentLead = await Lead.findOne({
      email: email.toLowerCase().trim(),
      createdAt: { $gte: new Date(Date.now() - 60 * 1000) }, // last 60 seconds
    });

    if (recentLead) {
      return res.status(429).json({
        success: false,
        message: 'A request from this email was received recently. Please wait a moment before submitting again.',
      });
    }

    // ─── Create lead ───
    const lead = await Lead.create({
      companyName:  companyName.trim(),
      contactName:  contactName.trim(),
      email:        email.toLowerCase().trim(),
      phone:        (phone || '').trim(),
      country:      (country || '').trim(),
      companySize:  companySize || 'unknown',
      industry:     (industry || '').trim(),
      planInterest: planInterest || 'not_sure',
      numPLCs:      (numPLCs || '').trim(),
      numUsers:     (numUsers || '').trim(),
      message:      (message || '').trim(),
      source:       source || 'landing_form',
      ipAddress:    req.ip || req.headers['x-forwarded-for'] || 'unknown',
      userAgent:    req.headers['user-agent'] || '',
      referrer:     req.headers['referer'] || req.headers['referrer'] || '',
    });

    console.log(`📨 New lead: ${lead.companyName} (${lead.email}) from ${lead.source}`);

    // ─── Send notification email to Suyog (fire-and-forget) ───
    const transporter = getTransporter();
    if (transporter) {
      const { html, text } = buildLeadNotificationEmail(lead);
      transporter.sendMail({
        from: `"OnlineSCADA Leads" <${process.env.SMTP_USER}>`,
        to: process.env.LEADS_EMAIL || process.env.SMTP_USER || 'suyog@onlinescada.in',
        subject: `🎯 New Lead: ${lead.companyName} — ${lead.planInterest.toUpperCase()}`,
        text,
        html,
        replyTo: lead.email,
      }).catch((err) => {
        console.warn('⚠️  Lead notification email failed:', err.message);
      });
    } else {
      console.warn('⚠️  SMTP not configured — lead saved but no email sent');
    }

    res.status(201).json({
      success: true,
      message: 'Thank you! We\'ll be in touch within 24 hours.',
      leadId:  lead._id,
    });
  } catch (error) {
    console.error('❌ Create Lead Error:', error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map(e => e.message).join(', '),
      });
    }

    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again or contact us directly at suyog@onlinescada.in',
    });
  }
};

// ═══════════════════════════════════════════════════════════
// SUPER-ADMIN endpoints (list, view, update, delete)
// ═══════════════════════════════════════════════════════════

const listLeads = async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const leads = await Lead.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .populate('convertedCompanyId', 'companyName slug');

    const total = await Lead.countDocuments(filter);

    // Summary stats
    const [newCount, contactedCount, convertedCount] = await Promise.all([
      Lead.countDocuments({ status: 'new' }),
      Lead.countDocuments({ status: 'contacted' }),
      Lead.countDocuments({ status: 'converted' }),
    ]);

    res.json({
      success: true,
      count: leads.length,
      total,
      summary: {
        new: newCount,
        contacted: contactedCount,
        converted: convertedCount,
      },
      leads,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate('convertedCompanyId', 'companyName slug');
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    res.json({ success: true, lead });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateLead = async (req, res) => {
  try {
    const allowed = ['status', 'notes', 'contactedAt', 'convertedAt', 'convertedCompanyId'];
    const updates = {};
    allowed.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    // Auto-set timestamps
    if (updates.status === 'contacted' && !updates.contactedAt) {
      updates.contactedAt = new Date();
    }
    if (updates.status === 'converted' && !updates.convertedAt) {
      updates.convertedAt = new Date();
    }

    const lead = await Lead.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    res.json({ success: true, lead });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteLead = async (req, res) => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    res.json({ success: true, message: 'Lead deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createLead,
  listLeads,
  getLead,
  updateLead,
  deleteLead,
};