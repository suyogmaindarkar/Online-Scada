// ═══════════════════════════════════════════════════════════
// Recipe Routes — Multi-Tenant Update
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const {
  createRecipe, getAllRecipes, getRecipe, updateRecipe, deleteRecipe,
  executeRecipe, createRecipeFromSnapshot, getCategories,
  duplicateRecipe, getExecutionLogs, getExecutionLog,
  getVersionHistory, restoreVersion,
} = require('../controllers/recipeController');
const { userProtect, authorize } = require('../middleware/auth');

router.use(userProtect);

router.get('/categories', getCategories);
router.get('/logs', getExecutionLogs);
router.get('/logs/:logId', getExecutionLog);
router.post('/snapshot', authorize('admin', 'engineer'), createRecipeFromSnapshot);

router.post('/', authorize('admin', 'engineer'), createRecipe);
router.get('/', getAllRecipes);
router.get('/:id', getRecipe);
router.put('/:id', authorize('admin', 'engineer'), updateRecipe);
router.delete('/:id', authorize('admin', 'engineer'), deleteRecipe);

router.post('/:id/execute', authorize('admin', 'engineer', 'operator'), executeRecipe);
router.post('/:id/duplicate', authorize('admin', 'engineer'), duplicateRecipe);

router.get('/:id/versions', getVersionHistory);
router.post('/:id/restore/:versionIndex', authorize('admin', 'engineer'), restoreVersion);

module.exports = router;