// ═══════════════════════════════════════════════════════════
// PLC Routes — Multi-Tenant Update
// Uses userProtect (validates userToken + scopes to company)
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const {
  createPLC,
  createQuickSimulationPLC,
  getAllPLCs,
  getPLC,
  updatePLC,
  deletePLC,
  testPLCConnection,
  startPLC,
  stopPLC,
  getPLCStatus,
  exportPLCsCSV,
  importPLCsCSV,
  downloadPLCTemplate,
} = require('../controllers/plcController');
const { userProtect, authorize } = require('../middleware/auth');

// ✅ All routes require valid user token (which injects req.companyId)
router.use(userProtect);

// ─── Specific routes FIRST (before /:id catches everything) ───
router.post('/quick-simulation', authorize('admin', 'engineer'), createQuickSimulationPLC);

// ─── CSV Import/Export ───
router.get('/export/csv', exportPLCsCSV);
router.get('/template/csv', downloadPLCTemplate);
router.post('/import/csv', authorize('admin', 'engineer'), importPLCsCSV);

// ─── Standard CRUD ───
router.post('/', authorize('admin', 'engineer'), createPLC);
router.get('/', getAllPLCs);
router.get('/:id', getPLC);
router.put('/:id', authorize('admin', 'engineer'), updatePLC);
router.delete('/:id', authorize('admin', 'engineer'), deletePLC);

// ─── PLC Control ───
router.post('/:id/test', testPLCConnection);
router.post('/:id/start', authorize('admin', 'engineer'), startPLC);
router.post('/:id/stop', authorize('admin', 'engineer'), stopPLC);
router.get('/:id/status', getPLCStatus);

module.exports = router;