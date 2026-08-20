// ═══════════════════════════════════════════════════════════
// Recipe Controller — Multi-Tenant Update
//
// ✅ All queries scoped by req.companyId
// ✅ All creates include companyId
// ✅ Execution writes scoped to company tags
// ═══════════════════════════════════════════════════════════

const Recipe = require('../models/Recipe');
const RecipeLog = require('../models/RecipeLog');
const Tag = require('../models/Tag');

const bumpVersion = (current, majorBump = false) => {
  const parts = String(current || '1.0').split('.');
  let major = parseInt(parts[0]) || 1;
  let minor = parseInt(parts[1]) || 0;
  if (majorBump) { major += 1; minor = 0; }
  else { minor += 1; if (minor >= 10) { major += 1; minor = 0; } }
  return `${major}.${minor}`;
};

const paramsChanged = (oldParams, newParams) => {
  if (!oldParams || !newParams) return true;
  if (oldParams.length !== newParams.length) return true;
  return JSON.stringify(oldParams.map(p => ({ tag: p.tagName, val: p.value }))) !==
         JSON.stringify(newParams.map(p => ({ tag: p.tagName, val: p.value })));
};

// ─── CREATE ───
const createRecipe = async (req, res) => {
  try {
    const { recipeName, description, category, parameters, version } = req.body;
    if (!recipeName || !parameters || parameters.length === 0) {
      return res.status(400).json({ success: false, message: 'recipeName and parameters are required' });
    }

    const existing = await Recipe.findOne({ companyId: req.companyId, recipeName });
    if (existing) {
      return res.status(400).json({ success: false, message: `Recipe '${recipeName}' already exists` });
    }

    const recipe = await Recipe.create({
      companyId: req.companyId,
      recipeName,
      description: description || '',
      category: category || 'Default',
      parameters,
      version: version || '1.0',
      versionNumber: 1,
      versionHistory: [],
      createdBy: req.user?.fullName || req.user?.username || 'admin',
      lastModifiedBy: req.user?.fullName || req.user?.username || 'admin',
    });

    res.status(201).json({ success: true, message: 'Recipe created', recipe });
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ success: false, message: 'Recipe name exists' });
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET ALL (scoped) ───
const getAllRecipes = async (req, res) => {
  try {
    const { category, isActive } = req.query;
    const filter = { companyId: req.companyId };
    if (category) filter.category = category;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const recipes = await Recipe.find(filter).select('-versionHistory').sort({ createdAt: -1 });
    res.json({ success: true, count: recipes.length, recipes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET ONE (scoped) ───
const getRecipe = async (req, res) => {
  try {
    const recipe = await Recipe.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!recipe) return res.status(404).json({ success: false, message: 'Recipe not found' });
    res.json({ success: true, recipe });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── UPDATE (scoped + auto-version) ───
const updateRecipe = async (req, res) => {
  try {
    delete req.body.companyId;

    const recipe = await Recipe.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!recipe) return res.status(404).json({ success: false, message: 'Recipe not found' });

    const shouldBumpVersion = req.body.parameters && paramsChanged(recipe.parameters, req.body.parameters);

    if (shouldBumpVersion) {
      const historyEntry = {
        version: recipe.version,
        parameters: recipe.parameters,
        savedAt: new Date(),
        savedBy: recipe.lastModifiedBy || recipe.createdBy,
        changeNote: req.body.changeNote || 'Parameters updated',
      };
      recipe.versionHistory = [historyEntry, ...(recipe.versionHistory || [])].slice(0, 20);
      if (!req.body.version || req.body.version === recipe.version) {
        recipe.version = bumpVersion(recipe.version);
        recipe.versionNumber = (recipe.versionNumber || 1) + 1;
      }
    }

    const allowedFields = ['recipeName', 'description', 'category', 'parameters', 'version', 'isActive'];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined && field !== 'version') recipe[field] = req.body[field];
    });
    if (req.body.version && !shouldBumpVersion) recipe.version = req.body.version;

    recipe.lastModifiedBy = req.user?.fullName || req.user?.username || 'admin';
    await recipe.save();

    res.json({ success: true, message: shouldBumpVersion ? `Updated (v${recipe.version})` : 'Updated', recipe, versionBumped: shouldBumpVersion });
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ success: false, message: 'Recipe name exists' });
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── RESTORE VERSION (scoped) ───
const restoreVersion = async (req, res) => {
  try {
    const idx = parseInt(req.params.versionIndex);
    const recipe = await Recipe.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!recipe) return res.status(404).json({ success: false, message: 'Recipe not found' });
    if (!recipe.versionHistory?.[idx]) return res.status(400).json({ success: false, message: 'Version not found' });

    const target = recipe.versionHistory[idx];
    const backup = {
      version: recipe.version, parameters: recipe.parameters,
      savedAt: new Date(), savedBy: recipe.lastModifiedBy || recipe.createdBy,
      changeNote: `Backed up before restoring v${target.version}`,
    };
    recipe.versionHistory = [backup, ...recipe.versionHistory].slice(0, 20);
    recipe.parameters = target.parameters;
    recipe.version = bumpVersion(recipe.version);
    recipe.versionNumber = (recipe.versionNumber || 1) + 1;
    recipe.lastModifiedBy = req.user?.fullName || 'admin';
    await recipe.save();

    res.json({ success: true, message: `Restored to v${target.version}`, recipe });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── DELETE (scoped) ───
const deleteRecipe = async (req, res) => {
  try {
    const recipe = await Recipe.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
    if (!recipe) return res.status(404).json({ success: false, message: 'Recipe not found' });
    res.json({ success: true, message: `Recipe '${recipe.recipeName}' deleted` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── DUPLICATE (scoped) ───
const duplicateRecipe = async (req, res) => {
  try {
    const { newName } = req.body;
    const source = await Recipe.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!source) return res.status(404).json({ success: false, message: 'Recipe not found' });

    let targetName = newName?.trim();
    if (!targetName) {
      targetName = `${source.recipeName} (Copy)`;
      let counter = 2;
      while (await Recipe.findOne({ companyId: req.companyId, recipeName: targetName })) {
        targetName = `${source.recipeName} (Copy ${counter})`;
        counter++;
      }
    } else {
      if (await Recipe.findOne({ companyId: req.companyId, recipeName: targetName })) {
        return res.status(400).json({ success: false, message: `Recipe '${targetName}' already exists` });
      }
    }

    const copy = await Recipe.create({
      companyId: req.companyId,
      recipeName: targetName,
      description: `Copy of ${source.recipeName}. ${source.description || ''}`.trim(),
      category: source.category,
      parameters: source.parameters.map(p => ({ ...p.toObject ? p.toObject() : p })),
      version: '1.0', versionNumber: 1, versionHistory: [],
      createdBy: req.user?.fullName || 'admin',
      lastModifiedBy: req.user?.fullName || 'admin',
    });

    res.status(201).json({ success: true, message: `Duplicated as '${targetName}'`, recipe: copy });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── EXECUTE (scoped — only writes to THIS company's tags) ───
const executeRecipe = async (req, res) => {
  const startTime = Date.now();
  try {
    const recipe = await Recipe.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!recipe) return res.status(404).json({ success: false, message: 'Recipe not found' });
    if (!recipe.isActive) return res.status(400).json({ success: false, message: 'Recipe is not active' });

    const { note = '' } = req.body || {};
    const results = { success: [], failed: [] };

    for (const param of recipe.parameters) {
      try {
        // ✅ Only write to THIS company's tags
        const tag = await Tag.findOne({ companyId: req.companyId, tagName: param.tagName });
        if (!tag) { results.failed.push({ tagName: param.tagName, reason: 'Tag not found' }); continue; }

        tag.currentValue = param.value;
        tag.lastUpdated = new Date();
        await tag.save();
        results.success.push({ tagName: param.tagName, value: param.value });

        const io = req.app.get('io');
        if (io) {
          io.emit('tagsUpdate', [{
            tagName: tag.tagName, value: tag.currentValue,
            quality: tag.quality, timestamp: tag.lastUpdated,
          }]);
        }
      } catch (err) {
        results.failed.push({ tagName: param.tagName, reason: err.message });
      }
    }

    recipe.lastExecutedAt = new Date();
    recipe.lastExecutedBy = req.user?.fullName || req.user?.username || 'admin';
    recipe.executionCount = (recipe.executionCount || 0) + 1;
    await recipe.save();

    const durationMs = Date.now() - startTime;
    const status = results.failed.length === 0 ? 'SUCCESS' : results.success.length === 0 ? 'FAILED' : 'PARTIAL';

    await RecipeLog.create({
      companyId: req.companyId,
      recipeId: recipe._id, recipeName: recipe.recipeName,
      recipeVersion: recipe.version, category: recipe.category,
      executedBy: req.user?.fullName || 'admin',
      status, totalParameters: recipe.parameters.length,
      successCount: results.success.length, failedCount: results.failed.length,
      durationMs, results,
      parametersSnapshot: recipe.parameters.map(p => ({ tagName: p.tagName, value: p.value, unit: p.unit })),
      note,
    });

    res.json({ success: true, message: `Recipe executed`, status, durationMs, results });
  } catch (error) {
    try {
      await RecipeLog.create({
        companyId: req.companyId,
        recipeName: 'Unknown', executedBy: req.user?.fullName || 'admin',
        status: 'FAILED', durationMs: Date.now() - startTime,
        note: `Error: ${error.message}`,
      });
    } catch {}
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── SNAPSHOT (scoped) ───
const createRecipeFromSnapshot = async (req, res) => {
  try {
    const { recipeName, description, category, tagNames } = req.body;
    if (!recipeName || !tagNames?.length) {
      return res.status(400).json({ success: false, message: 'recipeName and tagNames required' });
    }

    if (await Recipe.findOne({ companyId: req.companyId, recipeName })) {
      return res.status(400).json({ success: false, message: `Recipe '${recipeName}' exists` });
    }

    const tags = await Tag.find({ companyId: req.companyId, tagName: { $in: tagNames } });
    if (!tags.length) return res.status(404).json({ success: false, message: 'No tags found' });

    const parameters = tags.map(t => ({ tagName: t.tagName, value: t.currentValue, unit: t.unit || '', description: t.description || '' }));

    const recipe = await Recipe.create({
      companyId: req.companyId,
      recipeName, description: description || `Snapshot at ${new Date().toLocaleString()}`,
      category: category || 'Snapshot', parameters,
      createdBy: req.user?.fullName || 'admin',
    });

    res.status(201).json({ success: true, message: 'Snapshot created', recipe });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── CATEGORIES (scoped) ───
const getCategories = async (req, res) => {
  try {
    const categories = await Recipe.distinct('category', { companyId: req.companyId });
    res.json({ success: true, categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── EXECUTION LOGS (scoped) ───
const getExecutionLogs = async (req, res) => {
  try {
    const { recipeId, status, executedBy, startDate, endDate, limit = 100 } = req.query;
    const filter = { companyId: req.companyId };
    if (recipeId) filter.recipeId = recipeId;
    if (status) filter.status = status.toUpperCase();
    if (executedBy) filter.executedBy = new RegExp(executedBy, 'i');
    if (startDate || endDate) {
      filter.executedAt = {};
      if (startDate) filter.executedAt.$gte = new Date(startDate);
      if (endDate) filter.executedAt.$lte = new Date(endDate);
    }

    const logs = await RecipeLog.find(filter).sort({ executedAt: -1 }).limit(Number(limit));
    const summary = {
      total: logs.length,
      success: logs.filter(l => l.status === 'SUCCESS').length,
      partial: logs.filter(l => l.status === 'PARTIAL').length,
      failed: logs.filter(l => l.status === 'FAILED').length,
    };
    res.json({ success: true, summary, logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getExecutionLog = async (req, res) => {
  try {
    const log = await RecipeLog.findOne({ _id: req.params.logId, companyId: req.companyId });
    if (!log) return res.status(404).json({ success: false, message: 'Log not found' });
    res.json({ success: true, log });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getVersionHistory = async (req, res) => {
  try {
    const recipe = await Recipe.findOne({ _id: req.params.id, companyId: req.companyId }).select('recipeName version versionHistory');
    if (!recipe) return res.status(404).json({ success: false, message: 'Recipe not found' });
    res.json({ success: true, recipeName: recipe.recipeName, currentVersion: recipe.version, history: recipe.versionHistory || [] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createRecipe, getAllRecipes, getRecipe, updateRecipe, deleteRecipe,
  executeRecipe, createRecipeFromSnapshot, getCategories,
  duplicateRecipe, getExecutionLogs, getExecutionLog,
  getVersionHistory, restoreVersion,
};