// ═══════════════════════════════════════════════════════════
// Recipe Controller
//
// Task Bundle applied:
//   ✅ T051  — Execution accepts optional `note` (from confirm dialog)
//   ✅ T052  — Auto-log every execution to RecipeLog
//   ✅ T053  — Auto-version bump on update + version history + restore
//   ✅ T054  — Duplicate endpoint for templates
// ═══════════════════════════════════════════════════════════

const Recipe = require('../models/Recipe');
const RecipeLog = require('../models/RecipeLog');
const Tag = require('../models/Tag');

// ─── Helper: Bump version string (e.g. "1.0" → "1.1", "1.9" → "2.0") ───
const bumpVersion = (current, majorBump = false) => {
  const parts = String(current || '1.0').split('.');
  let major = parseInt(parts[0]) || 1;
  let minor = parseInt(parts[1]) || 0;

  if (majorBump) {
    major += 1;
    minor = 0;
  } else {
    minor += 1;
    if (minor >= 10) {
      major += 1;
      minor = 0;
    }
  }
  return `${major}.${minor}`;
};

// ─── Helper: Compare parameters (deep equal) ───
const paramsChanged = (oldParams, newParams) => {
  if (!oldParams || !newParams) return true;
  if (oldParams.length !== newParams.length) return true;
  return JSON.stringify(oldParams.map(p => ({ tag: p.tagName, val: p.value }))) !==
         JSON.stringify(newParams.map(p => ({ tag: p.tagName, val: p.value })));
};

// ─────────────────────────────────────────
// CREATE Recipe — POST /api/recipes
// ─────────────────────────────────────────
const createRecipe = async (req, res) => {
  try {
    const { recipeName, description, category, parameters, version } = req.body;

    if (!recipeName || !parameters || parameters.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'recipeName and parameters are required',
      });
    }

    const existing = await Recipe.findOne({ recipeName });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Recipe '${recipeName}' already exists`,
      });
    }

    const recipe = await Recipe.create({
      recipeName,
      description: description || '',
      category: category || 'Default',
      parameters,
      version: version || '1.0',
      versionNumber: 1,
      versionHistory: [],
      createdBy: req.user?.name || req.user?.email || 'admin',
      lastModifiedBy: req.user?.name || req.user?.email || 'admin',
    });

    res.status(201).json({
      success: true,
      message: 'Recipe created successfully',
      recipe,
    });
  } catch (error) {
    console.error('Create Recipe Error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Recipe name already exists' });
    }
    res.status(500).json({ success: false, message: 'Failed to create recipe', error: error.message });
  }
};

// ─────────────────────────────────────────
// GET ALL Recipes — GET /api/recipes
// ─────────────────────────────────────────
const getAllRecipes = async (req, res) => {
  try {
    const { category, isActive } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    // Exclude versionHistory from list (heavy field)
    const recipes = await Recipe.find(filter)
      .select('-versionHistory')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: recipes.length, recipes });
  } catch (error) {
    console.error('Get All Recipes Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch recipes', error: error.message });
  }
};

// ─────────────────────────────────────────
// GET Single Recipe — GET /api/recipes/:id
// ─────────────────────────────────────────
const getRecipe = async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) {
      return res.status(404).json({ success: false, message: 'Recipe not found' });
    }
    res.json({ success: true, recipe });
  } catch (error) {
    console.error('Get Recipe Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch recipe', error: error.message });
  }
};

// ─────────────────────────────────────────
// UPDATE Recipe — PUT /api/recipes/:id
// ✅ T053: Auto-bump version when parameters change
// ─────────────────────────────────────────
const updateRecipe = async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) {
      return res.status(404).json({ success: false, message: 'Recipe not found' });
    }

    const allowedFields = [
      'recipeName', 'description', 'category', 'parameters', 'version', 'isActive',
    ];

    // ✅ T053: Detect parameter change to trigger auto-version
    const shouldBumpVersion = req.body.parameters && paramsChanged(recipe.parameters, req.body.parameters);

    // If auto-bumping: save current state to history BEFORE overwriting
    if (shouldBumpVersion) {
      const historyEntry = {
        version: recipe.version,
        parameters: recipe.parameters,
        savedAt: new Date(),
        savedBy: recipe.lastModifiedBy || recipe.createdBy,
        changeNote: req.body.changeNote || 'Parameters updated',
      };

      // Cap history at 20 entries to avoid unbounded growth
      recipe.versionHistory = [historyEntry, ...(recipe.versionHistory || [])].slice(0, 20);

      // Auto-bump version
      if (!req.body.version || req.body.version === recipe.version) {
        recipe.version = bumpVersion(recipe.version);
        recipe.versionNumber = (recipe.versionNumber || 1) + 1;
      }
    }

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined && field !== 'version') {
        recipe[field] = req.body[field];
      }
    });

    // Manual version override (only if user provided AND params didn't change)
    if (req.body.version && !shouldBumpVersion) {
      recipe.version = req.body.version;
    }

    recipe.lastModifiedBy = req.user?.name || req.user?.email || 'admin';

    await recipe.save();

    res.json({
      success: true,
      message: shouldBumpVersion
        ? `Recipe updated (auto-bumped to v${recipe.version})`
        : 'Recipe updated successfully',
      recipe,
      versionBumped: shouldBumpVersion,
    });
  } catch (error) {
    console.error('Update Recipe Error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Recipe name already exists' });
    }
    res.status(500).json({ success: false, message: 'Failed to update recipe', error: error.message });
  }
};

// ─────────────────────────────────────────
// ✅ T053: RESTORE previous version
// POST /api/recipes/:id/restore/:versionIndex
// ─────────────────────────────────────────
const restoreVersion = async (req, res) => {
  try {
    const { id, versionIndex } = req.params;
    const idx = parseInt(versionIndex);

    const recipe = await Recipe.findById(id);
    if (!recipe) {
      return res.status(404).json({ success: false, message: 'Recipe not found' });
    }
    if (!recipe.versionHistory || !recipe.versionHistory[idx]) {
      return res.status(400).json({ success: false, message: 'Version not found in history' });
    }

    const target = recipe.versionHistory[idx];

    // Save current state to history first
    const backupEntry = {
      version: recipe.version,
      parameters: recipe.parameters,
      savedAt: new Date(),
      savedBy: recipe.lastModifiedBy || recipe.createdBy,
      changeNote: `Backed up before restoring v${target.version}`,
    };
    recipe.versionHistory = [backupEntry, ...recipe.versionHistory].slice(0, 20);

    // Restore
    recipe.parameters = target.parameters;
    recipe.version = bumpVersion(recipe.version); // New version, since it's a change
    recipe.versionNumber = (recipe.versionNumber || 1) + 1;
    recipe.lastModifiedBy = req.user?.name || 'admin';

    await recipe.save();

    res.json({
      success: true,
      message: `Restored to v${target.version} (saved as new v${recipe.version})`,
      recipe,
    });
  } catch (error) {
    console.error('Restore Version Error:', error);
    res.status(500).json({ success: false, message: 'Failed to restore version', error: error.message });
  }
};

// ─────────────────────────────────────────
// DELETE Recipe — DELETE /api/recipes/:id
// ─────────────────────────────────────────
const deleteRecipe = async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) {
      return res.status(404).json({ success: false, message: 'Recipe not found' });
    }
    await recipe.deleteOne();
    res.json({ success: true, message: `Recipe '${recipe.recipeName}' deleted successfully` });
  } catch (error) {
    console.error('Delete Recipe Error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete recipe', error: error.message });
  }
};

// ─────────────────────────────────────────
// ✅ T054: DUPLICATE Recipe (create template)
// POST /api/recipes/:id/duplicate
// ─────────────────────────────────────────
const duplicateRecipe = async (req, res) => {
  try {
    const { newName } = req.body;
    const source = await Recipe.findById(req.params.id);
    if (!source) {
      return res.status(404).json({ success: false, message: 'Recipe not found' });
    }

    // Auto-generate name if not provided
    let targetName = newName?.trim();
    if (!targetName) {
      targetName = `${source.recipeName} (Copy)`;
      // Ensure unique — append (2), (3) if needed
      let counter = 2;
      while (await Recipe.findOne({ recipeName: targetName })) {
        targetName = `${source.recipeName} (Copy ${counter})`;
        counter++;
      }
    } else {
      const dup = await Recipe.findOne({ recipeName: targetName });
      if (dup) {
        return res.status(400).json({
          success: false,
          message: `Recipe '${targetName}' already exists`,
        });
      }
    }

    const copy = await Recipe.create({
      recipeName: targetName,
      description: `Copy of ${source.recipeName}. ${source.description || ''}`.trim(),
      category: source.category,
      parameters: source.parameters.map(p => ({ ...p.toObject ? p.toObject() : p })),
      version: '1.0',
      versionNumber: 1,
      versionHistory: [],
      createdBy: req.user?.name || 'admin',
      lastModifiedBy: req.user?.name || 'admin',
    });

    res.status(201).json({
      success: true,
      message: `Recipe duplicated as '${targetName}'`,
      recipe: copy,
    });
  } catch (error) {
    console.error('Duplicate Recipe Error:', error);
    res.status(500).json({ success: false, message: 'Failed to duplicate recipe', error: error.message });
  }
};

// ─────────────────────────────────────────
// EXECUTE Recipe — POST /api/recipes/:id/execute
// ✅ T051: Accepts optional note
// ✅ T052: Auto-logs to RecipeLog
// ─────────────────────────────────────────
const executeRecipe = async (req, res) => {
  const startTime = Date.now();
  try {
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) {
      return res.status(404).json({ success: false, message: 'Recipe not found' });
    }
    if (!recipe.isActive) {
      return res.status(400).json({ success: false, message: 'Recipe is not active' });
    }

    const { note = '' } = req.body || {};
    const results = { success: [], failed: [] };

    // Loop through each parameter and write to tag
    for (const param of recipe.parameters) {
      try {
        const tag = await Tag.findOne({ tagName: param.tagName });
        if (!tag) {
          results.failed.push({ tagName: param.tagName, reason: 'Tag not found' });
          continue;
        }

        tag.currentValue = param.value;
        tag.lastUpdated = new Date();
        await tag.save();

        results.success.push({ tagName: param.tagName, value: param.value });

        // Emit socket update
        const io = req.app.get('io');
        if (io) {
          io.emit('tagsUpdate', [{
            tagName: tag.tagName,
            value: tag.currentValue,
            quality: tag.quality,
            timestamp: tag.lastUpdated,
          }]);
        }
      } catch (err) {
        results.failed.push({ tagName: param.tagName, reason: err.message });
      }
    }

    // Update recipe execution metadata
    recipe.lastExecutedAt = new Date();
    recipe.lastExecutedBy = req.user?.name || req.user?.email || 'admin';
    recipe.executionCount = (recipe.executionCount || 0) + 1;
    await recipe.save();

    // ✅ T052: Save to execution log
    const durationMs = Date.now() - startTime;
    const status =
      results.failed.length === 0 ? 'SUCCESS' :
      results.success.length === 0 ? 'FAILED' :
      'PARTIAL';

    await RecipeLog.create({
      recipeId: recipe._id,
      recipeName: recipe.recipeName,
      recipeVersion: recipe.version,
      category: recipe.category,
      executedBy: req.user?.name || req.user?.email || 'admin',
      status,
      totalParameters: recipe.parameters.length,
      successCount: results.success.length,
      failedCount: results.failed.length,
      durationMs,
      results,
      parametersSnapshot: recipe.parameters.map(p => ({
        tagName: p.tagName,
        value: p.value,
        unit: p.unit,
      })),
      note,
    });

    res.json({
      success: true,
      message: `Recipe '${recipe.recipeName}' executed`,
      recipeName: recipe.recipeName,
      executedBy: req.user?.name || 'admin',
      executedAt: new Date(),
      durationMs,
      status,
      stats: {
        total: recipe.parameters.length,
        success: results.success.length,
        failed: results.failed.length,
      },
      results,
    });
  } catch (error) {
    console.error('Execute Recipe Error:', error);

    // ✅ T052: Log the failure too
    try {
      await RecipeLog.create({
        recipeName: 'Unknown',
        executedBy: req.user?.name || 'admin',
        status: 'FAILED',
        durationMs: Date.now() - startTime,
        note: `Execution error: ${error.message}`,
      });
    } catch {}

    res.status(500).json({ success: false, message: 'Failed to execute recipe', error: error.message });
  }
};

// ─────────────────────────────────────────
// SNAPSHOT Recipe — POST /api/recipes/snapshot
// ─────────────────────────────────────────
const createRecipeFromSnapshot = async (req, res) => {
  try {
    const { recipeName, description, category, tagNames } = req.body;

    if (!recipeName || !tagNames || tagNames.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'recipeName and tagNames are required',
      });
    }

    const existing = await Recipe.findOne({ recipeName });
    if (existing) {
      return res.status(400).json({ success: false, message: `Recipe '${recipeName}' already exists` });
    }

    const tags = await Tag.find({ tagName: { $in: tagNames } });
    if (tags.length === 0) {
      return res.status(404).json({ success: false, message: 'No tags found' });
    }

    const parameters = tags.map((tag) => ({
      tagName: tag.tagName,
      value: tag.currentValue,
      unit: tag.unit || '',
      description: tag.description || '',
    }));

    const recipe = await Recipe.create({
      recipeName,
      description: description || `Snapshot taken at ${new Date().toLocaleString()}`,
      category: category || 'Snapshot',
      parameters,
      createdBy: req.user?.name || 'admin',
    });

    res.status(201).json({ success: true, message: 'Recipe created from snapshot', recipe });
  } catch (error) {
    console.error('Snapshot Recipe Error:', error);
    res.status(500).json({ success: false, message: 'Failed to create snapshot', error: error.message });
  }
};

// ─────────────────────────────────────────
// GET Categories — GET /api/recipes/categories
// ─────────────────────────────────────────
const getCategories = async (req, res) => {
  try {
    const categories = await Recipe.distinct('category');
    res.json({ success: true, categories });
  } catch (error) {
    console.error('Get Categories Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch categories', error: error.message });
  }
};

// ─────────────────────────────────────────
// ✅ T052: GET Execution Logs
// GET /api/recipes/logs?recipeId=...&status=...&startDate=...&limit=100
// ─────────────────────────────────────────
const getExecutionLogs = async (req, res) => {
  try {
    const { recipeId, status, executedBy, startDate, endDate, limit = 100 } = req.query;

    const filter = {};
    if (recipeId) filter.recipeId = recipeId;
    if (status) filter.status = status.toUpperCase();
    if (executedBy) filter.executedBy = new RegExp(executedBy, 'i');
    if (startDate || endDate) {
      filter.executedAt = {};
      if (startDate) filter.executedAt.$gte = new Date(startDate);
      if (endDate)   filter.executedAt.$lte = new Date(endDate);
    }

    const logs = await RecipeLog.find(filter)
      .sort({ executedAt: -1 })
      .limit(Number(limit));

    // Summary stats
    const summary = {
      total: logs.length,
      success: logs.filter(l => l.status === 'SUCCESS').length,
      partial: logs.filter(l => l.status === 'PARTIAL').length,
      failed:  logs.filter(l => l.status === 'FAILED').length,
    };

    res.json({ success: true, summary, logs });
  } catch (error) {
    console.error('Get Execution Logs Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch logs', error: error.message });
  }
};

// ─────────────────────────────────────────
// ✅ T052: GET Single Execution Log
// GET /api/recipes/logs/:logId
// ─────────────────────────────────────────
const getExecutionLog = async (req, res) => {
  try {
    const log = await RecipeLog.findById(req.params.logId);
    if (!log) {
      return res.status(404).json({ success: false, message: 'Log not found' });
    }
    res.json({ success: true, log });
  } catch (error) {
    console.error('Get Log Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch log', error: error.message });
  }
};

// ─────────────────────────────────────────
// ✅ T053: GET Version History
// GET /api/recipes/:id/versions
// ─────────────────────────────────────────
const getVersionHistory = async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id).select('recipeName version versionHistory');
    if (!recipe) {
      return res.status(404).json({ success: false, message: 'Recipe not found' });
    }
    res.json({
      success: true,
      recipeName: recipe.recipeName,
      currentVersion: recipe.version,
      history: recipe.versionHistory || [],
    });
  } catch (error) {
    console.error('Get Versions Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch versions', error: error.message });
  }
};

module.exports = {
  createRecipe,
  getAllRecipes,
  getRecipe,
  updateRecipe,
  deleteRecipe,
  executeRecipe,
  createRecipeFromSnapshot,
  getCategories,
  duplicateRecipe,       // ✅ T054
  getExecutionLogs,      // ✅ T052
  getExecutionLog,       // ✅ T052
  getVersionHistory,     // ✅ T053
  restoreVersion,        // ✅ T053
};