// ═══════════════════════════════════════════════════════════
// Super Admin Routes
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router  = express.Router();
const {
  superAdminLogin,
  listCompanies,
  createCompany,
  updateCompany,
  deleteCompany,
  resetCompanyAdminPassword,
} = require('../controllers/superAdminController');
const { superAdminProtect } = require('../middleware/auth');

// Public
router.post('/login', superAdminLogin);

// Protected — all require super admin token
router.get('/companies',              superAdminProtect, listCompanies);
router.post('/companies',             superAdminProtect, createCompany);
router.put('/companies/:id',          superAdminProtect, updateCompany);
router.delete('/companies/:id',       superAdminProtect, deleteCompany);
router.post('/companies/:id/reset-admin', superAdminProtect, resetCompanyAdminPassword);

module.exports = router;