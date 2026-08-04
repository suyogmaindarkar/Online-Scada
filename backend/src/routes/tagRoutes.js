// ═══════════════════════════════════════════════════════════
// Tag Routes
//
// Task Bundle applied:
//   ✅ T060  — POST /tags/import/csv
//   ✅ T061  — GET /tags/export/csv
//   ✅ BONUS — GET /tags/template/csv
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const {
  createTag,
  getAllTags,
  getTag,
  updateTag,
  deleteTag,
  writeTagValue,
  getTagGroups,
  bulkCreateTags,
  exportTagsCSV,       // ✅ T061
  importTagsCSV,       // ✅ T060
  downloadTagTemplate, // ✅ BONUS
} = require('../controllers/tagController');
const { protect, authorize } = require('../middleware/auth');

// All routes protected
router.use(protect);

// ─── Specific routes FIRST (before /:id catches everything) ───
router.post('/bulk', authorize('admin', 'engineer'), bulkCreateTags);
router.post('/write', writeTagValue);
router.get('/groups', getTagGroups);

// ─── Round 5: CSV Import/Export ───
router.get('/export/csv', exportTagsCSV);
router.get('/template/csv', downloadTagTemplate);
router.post('/import/csv', authorize('admin', 'engineer'), importTagsCSV);

// ─── Standard CRUD ───
router.post('/', authorize('admin', 'engineer'), createTag);
router.get('/', getAllTags);
router.get('/:id', getTag);
router.put('/:id', authorize('admin', 'engineer'), updateTag);
router.delete('/:id', authorize('admin', 'engineer'), deleteTag);

module.exports = router;