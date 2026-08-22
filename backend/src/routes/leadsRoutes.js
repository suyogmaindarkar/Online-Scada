// ═══════════════════════════════════════════════════════════
// Leads Routes & Email Diagnostic Endpoint
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router  = express.Router();
const {
  createLead, listLeads, getLead, updateLead, deleteLead,
} = require('../controllers/leadsController');
const { superAdminProtect } = require('../middleware/auth');
const { sendWelcomeEmail }  = require('../services/emailService');

// ─── PUBLIC: Create lead from landing page ─────────────────
router.post('/', createLead);

// ─── PUBLIC: Instant Email Test Endpoint for Suyog ─────────
// Visit: https://onlinescada-backend.onrender.com/api/leads/test-email?to=suyogmaindarkar@gmail.com
router.get('/test-email', async (req, res) => {
  const targetEmail = req.query.to || process.env.SMTP_USER || 'suyogmaindarkar@gmail.com';
  try {
    const result = await sendWelcomeEmail({
      email: targetEmail,
      fullName: 'Suyog Maindarkar (Test)',
      companyName: 'Test OnlineSCADA Corp',
      slug: 'test-workspace',
    });

    res.json({
      success: result.sent,
      message: result.sent ? `Email sent to ${targetEmail}` : `Email failed: ${result.reason}`,
      smtpDetails: {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || '465',
        user: process.env.SMTP_USER || 'Not set',
        passConfigured: !!process.env.SMTP_PASS,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      stack: err.stack,
    });
  }
});

// ─── SUPER-ADMIN: Manage leads ─────────────────────────────
router.get('/',        superAdminProtect, listLeads);
router.get('/:id',     superAdminProtect, getLead);
router.put('/:id',     superAdminProtect, updateLead);
router.delete('/:id',  superAdminProtect, deleteLead);

module.exports = router;