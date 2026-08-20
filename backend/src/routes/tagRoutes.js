// ═══════════════════════════════════════════════════════════
// Tag Routes — Multi-Tenant Update
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
  exportTagsCSV,
  importTagsCSV,
  downloadTagTemplate,
} = require('../controllers/tagController');
const { userProtect, authorize } = require('../middleware/auth');

// ✅ All routes require valid user token (injects req.companyId)
router.use(userProtect);

// ─── Specific routes FIRST (before /:id catches everything) ───
router.post('/bulk', authorize('admin', 'engineer'), bulkCreateTags);
router.post('/write', writeTagValue);
router.get('/groups', getTagGroups);

// ─── CSV Import/Export ───
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