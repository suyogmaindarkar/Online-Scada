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

// ✅ Convert boolean-ish inputs from body to actual booleans
function toBool(v) {
  return v === true || v === 'true' || v === 1 || v === '1';
}

// ===== CREATE SCREEN =====
const createScreen = async (req, res) => {
  console.log('\n━━━━━ CREATE SCREEN ━━━━━');
  console.log('Screen name:', req.body.screenName);
  console.log('isTemplate:', req.body.isTemplate, '| isPopup:', req.body.isPopup);

  try {
    const isTemplate = toBool(req.body.isTemplate);
    const isPopup    = toBool(req.body.isPopup);

    // Prevent both flags being true
    if (isTemplate && isPopup) {
      return res.status(400).json({
        success: false,
        message: 'Screen cannot be both a template and a popup',
      });
    }

    const data = {
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
      popupModal:          req.body.popupModal          === undefined ? true : toBool(req.body.popupModal),
      popupCloseable:      req.body.popupCloseable      === undefined ? true : toBool(req.body.popupCloseable),
      popupCloseOnBackdrop: req.body.popupCloseOnBackdrop === undefined ? true : toBool(req.body.popupCloseOnBackdrop),
    };

    if (!data.screenName) {
      return res.status(400).json({ success: false, message: 'Screen name is required' });
    }

    const exists = await Graphic.findOne({ screenName: data.screenName });
    if (exists) {
      return res.status(400).json({
        success: false,
        message: `Screen "${data.screenName}" already exists.`,
      });
    }

    // ✅ Only ONE startup screen allowed
    if (data.isStartupScreen) {
      await Graphic.updateMany({}, { $set: { isStartupScreen: false } });
    }

    // ✅ Only ONE template screen allowed — clear existing template
    if (data.isTemplate) {
      await Graphic.updateMany({ isTemplate: true }, { $set: { isTemplate: false } });
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

// ===== GET ALL =====
const getAllScreens = async (req, res) => {
  try {
    const screens = await Graphic.find().sort({ updatedAt: -1 });
    res.json({ success: true, count: screens.length, data: screens });
  } catch (error) {
    console.error('❌ getAllScreens:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ===== GET ONE =====
const getScreen = async (req, res) => {
  try {
    const screen = await Graphic.findById(req.params.id);
    if (!screen) {
      return res.status(404).json({ success: false, message: 'Screen not found' });
    }
    res.json({ success: true, data: screen });
  } catch (error) {
    console.error('❌ getScreen:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ===== UPDATE =====
const updateScreen = async (req, res) => {
  console.log('\n━━━━━ UPDATE SCREEN ━━━━━');
  console.log('ID:', req.params.id);
  console.log('Body keys:', Object.keys(req.body));

  try {
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

    // ─── Startup screen ───
    if (req.body.isStartupScreen === true || req.body.isStartupScreen === 'true') {
      await Graphic.updateMany(
        { _id: { $ne: req.params.id } },
        { $set: { isStartupScreen: false } }
      );
      updates.isStartupScreen = true;
    } else if (req.body.isStartupScreen === false || req.body.isStartupScreen === 'false') {
      updates.isStartupScreen = false;
    }

    // ─── Template flag ───
    if (req.body.isTemplate === true || req.body.isTemplate === 'true') {
      // Clear existing template + ensure this screen isn't also popup
      await Graphic.updateMany(
        { _id: { $ne: req.params.id }, isTemplate: true },
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
      updates.isTemplate = false; // popup can't be template
      updates.isStartupScreen = false; // popup can't be startup
    } else if (req.body.isPopup === false || req.body.isPopup === 'false') {
      updates.isPopup = false;
    }

    // ─── Popup settings ───
    if (req.body.popupModal !== undefined) updates.popupModal = toBool(req.body.popupModal);
    if (req.body.popupCloseable !== undefined) updates.popupCloseable = toBool(req.body.popupCloseable);
    if (req.body.popupCloseOnBackdrop !== undefined) updates.popupCloseOnBackdrop = toBool(req.body.popupCloseOnBackdrop);

    const screen = await Graphic.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: false, strict: false }
    );

    if (!screen) {
      return res.status(404).json({ success: false, message: 'Screen not found' });
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

// ===== DELETE =====
const deleteScreen = async (req, res) => {
  try {
    const screen = await Graphic.findByIdAndDelete(req.params.id);
    if (!screen) {
      return res.status(404).json({ success: false, message: 'Screen not found' });
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