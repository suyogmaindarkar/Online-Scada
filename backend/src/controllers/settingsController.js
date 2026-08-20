// ═══════════════════════════════════════════════════════════
// Settings Controller — Multi-Tenant Update
//
// ✅ Each company has their OWN settings (via companyId)
// ✅ System info shows company-specific counts
// ✅ Backup/restore scoped to company
// ═══════════════════════════════════════════════════════════

const Settings = require('../models/Settings');
const User = require('../models/User');
const PLCConnection = require('../models/PLCConnection');
const Tag = require('../models/Tag');
const Graphic = require('../models/Graphic');
const mongoose = require('mongoose');
const os = require('os');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET SETTINGS (scoped to company)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const getSettings = async (req, res) => {
  try {
    const settings = await Settings.getSettingsForCompany(req.companyId);
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UPDATE SETTINGS (scoped to company)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const updateSettings = async (req, res) => {
  try {
    const { section, data } = req.body;

    if (!section || !data) {
      return res.status(400).json({ success: false, message: 'Section and data are required' });
    }

    const validSections = ['appearance', 'notifications', 'system', 'dataManagement', 'security', 'email'];
    if (!validSections.includes(section)) {
      return res.status(400).json({
        success: false,
        message: `Invalid section. Valid: ${validSections.join(', ')}`,
      });
    }

    const settings = await Settings.getSettingsForCompany(req.companyId);
    settings[section] = { ...settings[section].toObject(), ...data };
    settings.lastUpdatedBy = req.user._id;
    await settings.save();

    res.json({
      success: true,
      message: `${section} settings updated successfully`,
      data: settings,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET SYSTEM INFO (scoped counts)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const getSystemInfo = async (req, res) => {
  try {
    const companyFilter = { companyId: req.companyId }; // ✅ MULTI-TENANT

    const [userCount, plcCount, tagCount, screenCount] = await Promise.all([
      User.countDocuments(companyFilter),
      PLCConnection.countDocuments(companyFilter),
      Tag.countDocuments(companyFilter),
      Graphic.countDocuments(companyFilter),
    ]);

    const activePLCs = await PLCConnection.countDocuments({
      ...companyFilter,
      isConnected: true,
    });

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    const systemInfo = {
      application: {
        name: 'OnlineSCADA',
        version: '2.0.0',
        buildDate: '2026-08-14',
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
        platform: os.platform(),
        arch: os.arch(),
      },
      company: {
        name: req.company?.companyName || '',
        slug: req.company?.slug || '',
        plan: req.company?.plan || 'trial',
        limits: req.company?.limits || {},
      },
      statistics: {
        totalUsers: userCount,
        totalPLCs: plcCount,
        activePLCs,
        totalTags: tagCount,
        totalScreens: screenCount,
      },
      memory: {
        totalMB: (totalMem / 1024 / 1024).toFixed(2),
        usedMB: (usedMem / 1024 / 1024).toFixed(2),
        freeMB: (freeMem / 1024 / 1024).toFixed(2),
        usagePercent: ((usedMem / totalMem) * 100).toFixed(2),
      },
      uptime: {
        serverFormatted: formatUptime(process.uptime()),
        systemFormatted: formatUptime(os.uptime()),
      },
      databases: {
        mongodb: { status: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected' },
      },
    };

    res.json({ success: true, data: systemInfo });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BACKUP — Export company data as JSON (scoped)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const exportBackup = async (req, res) => {
  try {
    const { type = 'all' } = req.query;
    const companyFilter = { companyId: req.companyId }; // ✅ MULTI-TENANT

    const backup = {
      metadata: {
        exportDate: new Date().toISOString(),
        exportedBy: req.user.username,
        workspace: req.company?.slug,
        version: '2.0.0',
        type,
      },
    };

    if (type === 'all' || type === 'plcs')     backup.plcs     = await PLCConnection.find(companyFilter).lean();
    if (type === 'all' || type === 'tags')      backup.tags     = await Tag.find(companyFilter).lean();
    if (type === 'all' || type === 'screens')   backup.screens  = await Graphic.find(companyFilter).lean();
    if (type === 'all' || type === 'settings')  backup.settings = await Settings.findOne(companyFilter).lean();
    if (type === 'all' || type === 'users')     backup.users    = await User.find(companyFilter).select('-password').lean();

    res.json({ success: true, data: backup });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RESTORE — Import backup (scoped, only affects THIS company)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const importBackup = async (req, res) => {
  try {
    const { backup, options = {} } = req.body;

    if (!backup || !backup.metadata) {
      return res.status(400).json({ success: false, message: 'Invalid backup file' });
    }

    const results = { restored: {}, errors: [] };
    const companyFilter = { companyId: req.companyId }; // ✅ MULTI-TENANT

    const {
      restorePLCs = true, restoreTags = true,
      restoreScreens = true, restoreSettings = true,
      overwrite = false,
    } = options;

    // ✅ Add companyId to imported data
    const addCompany = (items) => items.map(item => ({
      ...item,
      companyId: req.companyId,
      _id: undefined, // Remove old IDs to avoid conflicts
    }));

    if (restorePLCs && backup.plcs) {
      try {
        if (overwrite) await PLCConnection.deleteMany(companyFilter);
        await PLCConnection.insertMany(addCompany(backup.plcs), { ordered: false });
        results.restored.plcs = backup.plcs.length;
      } catch (e) { results.errors.push(`PLCs: ${e.message}`); }
    }

    if (restoreTags && backup.tags) {
      try {
        if (overwrite) await Tag.deleteMany(companyFilter);
        await Tag.insertMany(addCompany(backup.tags), { ordered: false });
        results.restored.tags = backup.tags.length;
      } catch (e) { results.errors.push(`Tags: ${e.message}`); }
    }

    if (restoreScreens && backup.screens) {
      try {
        if (overwrite) await Graphic.deleteMany(companyFilter);
        await Graphic.insertMany(addCompany(backup.screens), { ordered: false });
        results.restored.screens = backup.screens.length;
      } catch (e) { results.errors.push(`Screens: ${e.message}`); }
    }

    if (restoreSettings && backup.settings) {
      try {
        await Settings.deleteOne(companyFilter);
        await Settings.create({ ...backup.settings, companyId: req.companyId, _id: undefined });
        results.restored.settings = 1;
      } catch (e) { results.errors.push(`Settings: ${e.message}`); }
    }

    res.json({ success: true, message: 'Backup restored', data: results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RESET TO DEFAULTS (scoped)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const resetSettings = async (req, res) => {
  try {
    const { section } = req.body;

    if (section) {
      await Settings.updateOne(
        { companyId: req.companyId },
        { $unset: { [section]: '' } }
      );
    } else {
      await Settings.deleteOne({ companyId: req.companyId });
    }

    const settings = await Settings.getSettingsForCompany(req.companyId);

    res.json({
      success: true,
      message: `Settings ${section ? section + ' ' : ''}reset to defaults`,
      data: settings,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  return parts.join(' ');
}

module.exports = {
  getSettings,
  updateSettings,
  getSystemInfo,
  exportBackup,
  importBackup,
  resetSettings,
};