// ═══════════════════════════════════════════════════════════
// Screen Routes — Multi-Tenant Update
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const {
  createScreen,
  getAllScreens,
  getScreen,
  updateScreen,
  deleteScreen,
} = require('../controllers/screenController');
const { userProtect, authorize } = require('../middleware/auth');

// ✅ All routes require valid user token (injects req.companyId)
router.use(userProtect);

// ─── CRUD ───
// Operators/Viewers CAN read screens (needed for runtime)
router.get('/', getAllScreens);
router.get('/:id', getScreen);

// Create/update/delete restricted to admin + engineer
router.post('/', authorize('admin', 'engineer'), createScreen);
router.put('/:id', authorize('admin', 'engineer'), updateScreen);
router.delete('/:id', authorize('admin', 'engineer'), deleteScreen);

module.exports = router;