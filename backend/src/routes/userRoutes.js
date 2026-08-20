// ═══════════════════════════════════════════════════════════
// User Routes — Multi-Tenant Update
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  resetPassword,
  changePassword,
  toggleActive,
  getUserStats,
} = require('../controllers/userController');
const { userProtect, authorize } = require('../middleware/auth');

// ✅ All routes require valid user token (injects req.companyId)
router.use(userProtect);

// User own password change (any logged-in user)
router.put('/change-password', changePassword);

// Stats (admin only)
router.get('/stats', authorize('admin'), getUserStats);

// User CRUD (admin only)
router.get('/', authorize('admin'), getAllUsers);
router.post('/', authorize('admin'), createUser);
router.get('/:id', authorize('admin'), getUser);
router.put('/:id', authorize('admin'), updateUser);
router.delete('/:id', authorize('admin'), deleteUser);
router.put('/:id/reset-password', authorize('admin'), resetPassword);
router.put('/:id/toggle-active', authorize('admin'), toggleActive);

module.exports = router;