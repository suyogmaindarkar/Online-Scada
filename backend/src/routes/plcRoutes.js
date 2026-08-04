// ═══════════════════════════════════════════════════════════
// PLC Routes
//
// Task Bundle applied:
//   ✅ SIM   — /quick-simulation
//   ✅ T062  — /import/csv
//   ✅ BONUS — /export/csv + /template/csv
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
  exportPLCsCSV,       // ✅ BONUS
  importPLCsCSV,       // ✅ T062
  downloadPLCTemplate, // ✅ BONUS
} = require('../controllers/plcController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// ─── Specific routes FIRST (before /:id catches everything) ───
router.post('/quick-simulation', authorize('admin', 'engineer'), createQuickSimulationPLC);

// ─── Round 5: CSV Import/Export ───
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