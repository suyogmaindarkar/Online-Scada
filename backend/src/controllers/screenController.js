// ═══════════════════════════════════════════════════════════
// Screen Controller — Multi-Tenant Update
//
// ✅ All queries scoped by req.companyId
// ✅ All creates include companyId
// ✅ Plan limit enforcement (maxScreens)
// ✅ Template/Startup/Popup flags scoped WITHIN company
//    (each company can have their own template, startup, popups)
// ═══════════════════════════════════════════════════════════

const Graphic = require('../models/Graphic');

// ════════════════════════════════════════════════════════════
// SANITIZER
// ════════════════════════════════════════════════════════════
function sanitizeValue(val) {
  if (val === undefined) return undefined;
  if (typeof val === 'number' && (isNaN(val) || !isFinite(val))) return 0;
  if (typeof val === 'string' && /^#[0-9a-fA-F]{3}$/.test(val.trim())) {
    const t = val.trim();
    return '#' + t[1] + t[1] + t[2] + t[2] + t[3] + t[3];
  }
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    const cleaned = {};
    Object.keys(val).forEach((k) => {
      const v = sanitizeValue(val[k]);
      if (v !== undefined) cleaned[k] = v;
    });
    return cleaned;
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeValue).filter((v) => v !== undefined);
  }
  return val;
}

function sanitizeElements(elements) {
  if (!Array.isArray(elements)) return [];
  return elements.map((el) => sanitizeValue(el));
}

function toBool(v) {
  return v === true || v === 'true' || v === 1 || v === '1';
}

// ─── Helper: Check plan limits ───
const checkScreenLimit = async (req) => {
  const currentCount = await Graphic.countDocuments({ companyId: req.companyId });
  const maxScreens = req.company?.limits?.maxScreens || 999999;
  if (currentCount >= maxScreens) {
    return {
      exceeded: true,
      current: currentCount,
      max: maxScreens,
      message: `Plan limit reached: ${currentCount}/${maxScreens} screens. Upgrade your plan to add more.`,
    };
  }
  return { exceeded: false };
};

// ═══════════════════════════════════════════════════════════
// CREATE SCREEN
// ═══════════════════════════════════════════════════════════
const createScreen = async (req, res) => {
  console.log(`\n━━━━━ CREATE SCREEN [${req.companySlug}] ━━━━━`);
  console.log('Screen name:', req.body.screenName);
  console.log('isTemplate:', req.body.isTemplate, '| isPopup:', req.body.isPopup);

  try {
    const isTemplate = toBool(req.body.isTemplate);
    const isPopup    = toBool(req.body.isPopup);

    if (isTemplate && isPopup) {
      return res.status(400).json({
        success: false,
        message: 'Screen cannot be both a template and a popup',
      });
    }

    // ✅ Plan limit check
    const limitCheck = await checkScreenLimit(req);
    if (limitCheck.exceeded) {
      return res.status(403).json({
        success: false,
        message: limitCheck.message,
        code: 'PLAN_LIMIT_EXCEEDED',
      });
    }

    const data = {
      companyId: req.companyId, // ✅ MULTI-TENANT
      screenName:        (req.body.screenName || '').trim(),
      description:       req.body.description || '',
      width:             Number(req.body.width) || 1920,
      height:            Number(req.body.height) || 1080,
      backgroundColor:   sanitizeValue(req.body.backgroundColor) || '#ffffff',
      elements:          sanitizeElements(req.body.elements),
      directConnections: Array.isArray(req.body.directConnections)
        ? sanitizeElements(req.body.directConnections) : [],
      isStartupScreen:   toBool(req.body.isStartupScreen),
      isTemplate,
      isPopup,
      popupModal:            req.body.popupModal          === undefined ? true : toBool(req.body.popupModal),
      popupCloseable:        req.body.popupCloseable      === undefined ? true : toBool(req.body.popupCloseable),
      popupCloseOnBackdrop:  req.body.popupCloseOnBackdrop === undefined ? true : toBool(req.body.popupCloseOnBackdrop),
    };

    if (!data.screenName) {
      return res.status(400).json({ success: false, message: 'Screen name is required' });
    }

    // ✅ Uniqueness check SCOPED to company
    const exists = await Graphic.findOne({ companyId: req.companyId, screenName: data.screenName });
    if (exists) {
      return res.status(400).json({
        success: false,
        message: `Screen "${data.screenName}" already exists in this workspace.`,
      });
    }

    // ✅ Only ONE startup screen PER COMPANY
    if (data.isStartupScreen) {
      await Graphic.updateMany(
        { companyId: req.companyId },
        { $set: { isStartupScreen: false } }
      );
    }

    // ✅ Only ONE template screen PER COMPANY
    if (data.isTemplate) {
      await Graphic.updateMany(
        { companyId: req.companyId, isTemplate: true },
        { $set: { isTemplate: false } }
      );
    }

    const screen = await Graphic.create(data);
    console.log('✅ Screen created:', screen._id);

    res.status(201).json({
      success: true,
      message: 'Screen created successfully',
      data: screen,
    });
  } catch (error) {
    console.error('❌ CREATE SCREEN ERROR:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create screen',
      errorName: error.name,
    });
  }
};

// ═══════════════════════════════════════════════════════════
// GET ALL SCREENS (scoped)
// ═══════════════════════════════════════════════════════════
const getAllScreens = async (req, res) => {
  try {
    const screens = await Graphic.find({ companyId: req.companyId })
      .sort({ updatedAt: -1 });
    res.json({ success: true, count: screens.length, data: screens });
  } catch (error) {
    console.error('❌ getAllScreens:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// GET ONE SCREEN (scoped)
// ═══════════════════════════════════════════════════════════
const getScreen = async (req, res) => {
  try {
    const screen = await Graphic.findOne({
      _id: req.params.id,
      companyId: req.companyId,
    });
    if (!screen) {
      return res.status(404).json({
        success: false,
        message: 'Screen not found in this workspace',
      });
    }
    res.json({ success: true, data: screen });
  } catch (error) {
    console.error('❌ getScreen:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// UPDATE SCREEN (scoped)
// ═══════════════════════════════════════════════════════════
const updateScreen = async (req, res) => {
  console.log(`\n━━━━━ UPDATE SCREEN [${req.companySlug}] ━━━━━`);
  console.log('ID:', req.params.id);

  try {
    // Prevent tenant escape
    delete req.body.companyId;

    const updates = {};

    if (req.body.screenName      !== undefined) updates.screenName      = req.body.screenName.trim();
    if (req.body.description     !== undefined) updates.description     = req.body.description;
    if (req.body.width           !== undefined) updates.width           = Number(req.body.width) || 1920;
    if (req.body.height          !== undefined) updates.height          = Number(req.body.height) || 1080;
    if (req.body.backgroundColor !== undefined) {
      updates.backgroundColor = sanitizeValue(req.body.backgroundColor) || '#ffffff';
    }
    if (Array.isArray(req.body.elements)) {
      updates.elements = sanitizeElements(req.body.elements);
    }
    if (Array.isArray(req.body.directConnections)) {
      updates.directConnections = sanitizeElements(req.body.directConnections);
    }

    // ─── Startup screen (scoped to company) ───
    if (req.body.isStartupScreen === true || req.body.isStartupScreen === 'true') {
      await Graphic.updateMany(
        { companyId: req.companyId, _id: { $ne: req.params.id } },
        { $set: { isStartupScreen: false } }
      );
      updates.isStartupScreen = true;
    } else if (req.body.isStartupScreen === false || req.body.isStartupScreen === 'false') {
      updates.isStartupScreen = false;
    }

    // ─── Template flag (scoped to company) ───
    if (req.body.isTemplate === true || req.body.isTemplate === 'true') {
      await Graphic.updateMany(
        { companyId: req.companyId, _id: { $ne: req.params.id }, isTemplate: true },
        { $set: { isTemplate: false } }
      );
      updates.isTemplate = true;
      updates.isPopup = false;
    } else if (req.body.isTemplate === false || req.body.isTemplate === 'false') {
      updates.isTemplate = false;
    }

    // ─── Popup flag ───
    if (req.body.isPopup === true || req.body.isPopup === 'true') {
      updates.isPopup = true;
      updates.isTemplate = false;
      updates.isStartupScreen = false;
    } else if (req.body.isPopup === false || req.body.isPopup === 'false') {
      updates.isPopup = false;
    }

    // ─── Popup settings ───
    if (req.body.popupModal !== undefined) updates.popupModal = toBool(req.body.popupModal);
    if (req.body.popupCloseable !== undefined) updates.popupCloseable = toBool(req.body.popupCloseable);
    if (req.body.popupCloseOnBackdrop !== undefined) updates.popupCloseOnBackdrop = toBool(req.body.popupCloseOnBackdrop);

    // ✅ Update SCOPED to company
    const screen = await Graphic.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      { $set: updates },
      { new: true, runValidators: false, strict: false }
    );

    if (!screen) {
      return res.status(404).json({
        success: false,
        message: 'Screen not found in this workspace',
      });
    }

    console.log('✅ Screen updated:', screen._id,
      '| isStartup:', screen.isStartupScreen,
      '| isTemplate:', screen.isTemplate,
      '| isPopup:', screen.isPopup);

    res.json({
      success: true,
      message: 'Screen updated successfully',
      data: screen,
    });
  } catch (error) {
    console.error('❌ UPDATE SCREEN ERROR:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update screen',
      errorName: error.name,
    });
  }
};

// ═══════════════════════════════════════════════════════════
// DELETE SCREEN (scoped)
// ═══════════════════════════════════════════════════════════
const deleteScreen = async (req, res) => {
  try {
    const screen = await Graphic.findOneAndDelete({
      _id: req.params.id,
      companyId: req.companyId,
    });
    if (!screen) {
      return res.status(404).json({
        success: false,
        message: 'Screen not found in this workspace',
      });
    }
    res.json({ success: true, message: 'Screen deleted successfully' });
  } catch (error) {
    console.error('❌ deleteScreen:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createScreen,
  getAllScreens,
  getScreen,
  updateScreen,
  deleteScreen,
};