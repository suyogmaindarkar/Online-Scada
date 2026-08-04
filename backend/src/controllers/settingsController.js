const Settings = require('../models/Settings');
const User = require('../models/User');
const PLCConnection = require('../models/PLCConnection');
const Tag = require('../models/Tag');
const Graphic = require('../models/Graphic');
const mongoose = require('mongoose');
const os = require('os');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET ALL SETTINGS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const getSettings = async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UPDATE SETTINGS SECTION (Admin only)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const updateSettings = async (req, res) => {
  try {
    const { section, data } = req.body;

    if (!section || !data) {
      return res.status(400).json({
        success: false,
        message: 'Section and data are required',
      });
    }

    const validSections = [
      'appearance',
      'notifications',
      'system',
      'dataManagement',
      'security',
      'email',
    ];

    if (!validSections.includes(section)) {
      return res.status(400).json({
        success: false,
        message: `Invalid section. Valid: ${validSections.join(', ')}`,
      });
    }

    const settings = await Settings.getSettings();
    
    // Update the specific section
    settings[section] = { ...settings[section].toObject(), ...data };
    settings.lastUpdatedBy = req.user._id;
    await settings.save();

    res.json({
      success: true,
      message: `${section} settings updated successfully`,
      data: settings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET SYSTEM INFO (for About page)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const getSystemInfo = async (req, res) => {
  try {
    // Get counts
    const [userCount, plcCount, tagCount, screenCount] = await Promise.all([
      User.countDocuments(),
      PLCConnection.countDocuments(),
      Tag.countDocuments(),
      Graphic.countDocuments(),
    ]);

    // Get active PLC count
    const activePLCs = await PLCConnection.countDocuments({ isConnected: true });

    // Memory info
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryUsagePercent = ((usedMem / totalMem) * 100).toFixed(2);

    // Process memory
    const processMem = process.memoryUsage();

    // Uptime
    const serverUptime = process.uptime(); // seconds
    const systemUptime = os.uptime(); // seconds

    // MongoDB status
    const mongoStatus = mongoose.connection.readyState;
    const mongoStatusText = {
      0: 'Disconnected',
      1: 'Connected',
      2: 'Connecting',
      3: 'Disconnecting',
    }[mongoStatus];

    const systemInfo = {
      application: {
        name: 'WebSCADA',
        version: '1.0.0',
        buildDate: '2026-01-15',
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
      },
      statistics: {
        totalUsers: userCount,
        totalPLCs: plcCount,
        activePLCs: activePLCs,
        totalTags: tagCount,
        totalScreens: screenCount,
      },
      memory: {
        totalMB: (totalMem / 1024 / 1024).toFixed(2),
        usedMB: (usedMem / 1024 / 1024).toFixed(2),
        freeMB: (freeMem / 1024 / 1024).toFixed(2),
        usagePercent: memoryUsagePercent,
        processMB: (processMem.heapUsed / 1024 / 1024).toFixed(2),
      },
      uptime: {
        serverSeconds: Math.floor(serverUptime),
        systemSeconds: Math.floor(systemUptime),
        serverFormatted: formatUptime(serverUptime),
        systemFormatted: formatUptime(systemUptime),
      },
      databases: {
        mongodb: {
          status: mongoStatusText,
          connected: mongoStatus === 1,
        },
        influxdb: {
          status: 'Check service logs',
          connected: true, // You can enhance this
        },
      },
      developer: {
        name: 'Suyog Maindarkar',
        email: 'suyogmaindarkar@gmail.com',
        portfolio: 'https://suyogmaindarkar.netlify.app',
      },
    };

    res.json({
      success: true,
      data: systemInfo,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BACKUP - Export all data as JSON
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const exportBackup = async (req, res) => {
  try {
    const { type = 'all' } = req.query;

    const backup = {
      metadata: {
        exportDate: new Date().toISOString(),
        exportedBy: req.user.username,
        version: '1.0.0',
        type,
      },
    };

    if (type === 'all' || type === 'plcs') {
      backup.plcs = await PLCConnection.find().lean();
    }
    if (type === 'all' || type === 'tags') {
      backup.tags = await Tag.find().lean();
    }
    if (type === 'all' || type === 'screens') {
  backup.screens = await Graphic.find().lean();
}
    if (type === 'all' || type === 'settings') {
      backup.settings = await Settings.findOne({ settingKey: 'main' }).lean();
    }
    if (type === 'all' || type === 'users') {
      backup.users = await User.find().select('-password').lean();
    }

    res.json({
      success: true,
      data: backup,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RESTORE - Import backup (Admin only)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const importBackup = async (req, res) => {
  try {
    const { backup, options = {} } = req.body;

    if (!backup || !backup.metadata) {
      return res.status(400).json({
        success: false,
        message: 'Invalid backup file',
      });
    }

    const results = {
      restored: {},
      errors: [],
    };

    const { 
      restorePLCs = true, 
      restoreTags = true, 
      restoreScreens = true,
      restoreSettings = true,
      overwrite = false,
    } = options;

    // Restore PLCs
    if (restorePLCs && backup.plcs) {
      try {
        if (overwrite) await PLCConnection.deleteMany({});
        await PLCConnection.insertMany(backup.plcs, { ordered: false });
        results.restored.plcs = backup.plcs.length;
      } catch (e) {
        results.errors.push(`PLCs: ${e.message}`);
      }
    }

    // Restore Tags
    if (restoreTags && backup.tags) {
      try {
        if (overwrite) await Tag.deleteMany({});
        await Tag.insertMany(backup.tags, { ordered: false });
        results.restored.tags = backup.tags.length;
      } catch (e) {
        results.errors.push(`Tags: ${e.message}`);
      }
    }

    // Restore Screens
  if (restoreScreens && backup.screens) {
  try {
    if (overwrite) await Graphic.deleteMany({});
    await Graphic.insertMany(backup.screens, { ordered: false });
    results.restored.screens = backup.screens.length;
  } catch (e) {
    results.errors.push(`Screens: ${e.message}`);
  }
}

    // Restore Settings
    if (restoreSettings && backup.settings) {
      try {
        await Settings.deleteOne({ settingKey: 'main' });
        await Settings.create(backup.settings);
        results.restored.settings = 1;
      } catch (e) {
        results.errors.push(`Settings: ${e.message}`);
      }
    }

    res.json({
      success: true,
      message: 'Backup restored successfully',
      data: results,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RESET TO DEFAULTS (Admin only)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const resetSettings = async (req, res) => {
  try {
    const { section } = req.body;

    if (section) {
      // Reset specific section
      await Settings.updateOne(
        { settingKey: 'main' },
        { $unset: { [section]: '' } }
      );
    } else {
      // Reset all settings
      await Settings.deleteOne({ settingKey: 'main' });
    }

    const settings = await Settings.getSettings();

    res.json({
      success: true,
      message: `Settings ${section ? section + ' ' : ''}reset to defaults`,
      data: settings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER: Format uptime
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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