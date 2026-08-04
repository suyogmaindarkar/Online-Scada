const Graphic = require('../models/Graphic');

// ════════════════════════════════════════════════════════════
// SANITIZER: Deep clean elements to prevent MongoDB errors
// ════════════════════════════════════════════════════════════
function sanitizeValue(val) {
  // Handle NaN, Infinity, undefined
  if (val === undefined) return undefined;
  if (typeof val === 'number' && (isNaN(val) || !isFinite(val))) return 0;

  // Normalize 3-digit hex colors
  if (typeof val === 'string' && /^#[0-9a-fA-F]{3}$/.test(val.trim())) {
    const t = val.trim();
    return '#' + t[1] + t[1] + t[2] + t[2] + t[3] + t[3];
  }

  // Recurse into objects
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    const cleaned = {};
    Object.keys(val).forEach((k) => {
      const v = sanitizeValue(val[k]);
      if (v !== undefined) cleaned[k] = v;
    });
    return cleaned;
  }

  // Recurse into arrays
  if (Array.isArray(val)) {
    return val.map(sanitizeValue).filter((v) => v !== undefined);
  }

  return val;
}

function sanitizeElements(elements) {
  if (!Array.isArray(elements)) return [];
  return elements.map((el) => sanitizeValue(el));
}

// ===== CREATE SCREEN =====
const createScreen = async (req, res) => {
  console.log('\n━━━━━ CREATE SCREEN ━━━━━');
  console.log('Body keys:', Object.keys(req.body));
  console.log('Screen name:', req.body.screenName);
  console.log('Elements count:', req.body.elements?.length);

  try {
        const data = {
      screenName: (req.body.screenName || '').trim(),
      description: req.body.description || '',
      width: Number(req.body.width) || 1920,
      height: Number(req.body.height) || 1080,
      backgroundColor: sanitizeValue(req.body.backgroundColor) || '#ffffff',
      elements: sanitizeElements(req.body.elements),
      directConnections: Array.isArray(req.body.directConnections)
        ? sanitizeElements(req.body.directConnections)
        : [],
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

    // Log first element with animation for debug
    const elementsWithAnim = data.elements.filter((e) => e.animation?.enabled);
    if (elementsWithAnim.length) {
      console.log('Animations found:', JSON.stringify(elementsWithAnim.map(e => ({
        type: e.type,
        animation: e.animation,
      })), null, 2));
    }

    const screen = await Graphic.create(data);
    console.log('✅ Screen created:', screen._id);

    res.status(201).json({
      success: true,
      message: 'Screen created successfully',
      data: screen,
    });
  } catch (error) {
    console.error('❌ CREATE SCREEN ERROR:');
    console.error('   Name:', error.name);
    console.error('   Message:', error.message);
    if (error.errors) {
      console.error('   Validation errors:');
      Object.keys(error.errors).forEach(k => {
        console.error(`      ${k}: ${error.errors[k].message}`);
      });
    }
    console.error('   Stack:', error.stack);
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
  console.log('Elements count:', req.body.elements?.length);

  try {
    const updates = {};

    if (req.body.screenName !== undefined) updates.screenName = req.body.screenName.trim();
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.width !== undefined) updates.width = Number(req.body.width) || 1920;
    if (req.body.height !== undefined) updates.height = Number(req.body.height) || 1080;
    if (req.body.backgroundColor !== undefined) {
      updates.backgroundColor = sanitizeValue(req.body.backgroundColor) || '#ffffff';
    }
        if (Array.isArray(req.body.elements)) {
      updates.elements = sanitizeElements(req.body.elements);
    }
    if (Array.isArray(req.body.directConnections)) {
      updates.directConnections = sanitizeElements(req.body.directConnections);
    }

    // Log animations for debug
    if (updates.elements) {
      const elementsWithAnim = updates.elements.filter((e) => e.animation?.enabled);
      if (elementsWithAnim.length) {
        console.log('Animations found:', JSON.stringify(elementsWithAnim.map(e => ({
          type: e.type,
          animation: e.animation,
        })), null, 2));
      }
    }

    const screen = await Graphic.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: false, strict: false }
    );

    if (!screen) {
      return res.status(404).json({ success: false, message: 'Screen not found' });
    }

    console.log('✅ Screen updated:', screen._id);
    res.json({
      success: true,
      message: 'Screen updated successfully',
      data: screen,
    });
  } catch (error) {
    console.error('❌ UPDATE SCREEN ERROR:');
    console.error('   Name:', error.name);
    console.error('   Message:', error.message);
    if (error.errors) {
      console.error('   Validation errors:');
      Object.keys(error.errors).forEach(k => {
        console.error(`      ${k}: ${error.errors[k].message}`);
      });
    }
    console.error('   Stack:', error.stack);
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