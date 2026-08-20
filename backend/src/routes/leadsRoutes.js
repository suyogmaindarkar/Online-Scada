// ═══════════════════════════════════════════════════════════
// Leads Routes
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router  = express.Router();
const {
  createLead, listLeads, getLead, updateLead, deleteLead,
} = require('../controllers/leadsController');
const { superAdminProtect } = require('../middleware/auth');

// ─── PUBLIC: Create lead from landing page ─────────────────
router.post('/', createLead);

// ─── SUPER-ADMIN: Manage leads ─────────────────────────────
router.get('/',        superAdminProtect, listLeads);
router.get('/:id',     superAdminProtect, getLead);
router.put('/:id',     superAdminProtect, updateLead);
router.delete('/:id',  superAdminProtect, deleteLead);

module.exports = router;