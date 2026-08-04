// ═══════════════════════════════════════════════════════════
// Recipe Routes
//
// Task Bundle applied:
//   ✅ T052  — /logs and /logs/:logId
//   ✅ T053  — /:id/versions and /:id/restore/:versionIndex
//   ✅ T054  — /:id/duplicate
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const {
  createRecipe,
  getAllRecipes,
  getRecipe,
  updateRecipe,
  deleteRecipe,
  executeRecipe,
  createRecipeFromSnapshot,
  getCategories,
  duplicateRecipe,      // ✅ T054
  getExecutionLogs,     // ✅ T052
  getExecutionLog,      // ✅ T052
  getVersionHistory,    // ✅ T053
  restoreVersion,       // ✅ T053
} = require('../controllers/recipeController');
const { protect, authorize } = require('../middleware/auth');

// All routes require login
router.use(protect);

// ─── Special routes FIRST (before /:id catches everything) ───
router.get('/categories', getCategories);
router.get('/logs', getExecutionLogs);              // ✅ T052
router.get('/logs/:logId', getExecutionLog);        // ✅ T052
router.post('/snapshot', authorize('admin', 'engineer'), createRecipeFromSnapshot);

// ─── CRUD ───
router.post('/', authorize('admin', 'engineer'), createRecipe);
router.get('/', getAllRecipes);
router.get('/:id', getRecipe);
router.put('/:id', authorize('admin', 'engineer'), updateRecipe);
router.delete('/:id', authorize('admin', 'engineer'), deleteRecipe);

// ─── Actions ───
router.post('/:id/execute', authorize('admin', 'engineer', 'operator'), executeRecipe);
router.post('/:id/duplicate', authorize('admin', 'engineer'), duplicateRecipe);  // ✅ T054

// ─── T053: Versioning ───
router.get('/:id/versions', getVersionHistory);
router.post('/:id/restore/:versionIndex', authorize('admin', 'engineer'), restoreVersion);

module.exports = router;