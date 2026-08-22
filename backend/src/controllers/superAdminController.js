// ═══════════════════════════════════════════════════════════
// Super Admin Controller — Platform-level management
// ═══════════════════════════════════════════════════════════

const jwt        = require('jsonwebtoken');
const SuperAdmin = require('../models/SuperAdmin');
const Company    = require('../models/Company');
const User       = require('../models/User');
const Settings   = require('../models/Settings');
const PLCConnection = require('../models/PLCConnection');
const Tag        = require('../models/Tag');
const Graphic    = require('../models/Graphic');
const Alarm      = require('../models/Alarm');
const Recipe     = require('../models/Recipe');

const generateSuperAdminToken = (id) => {
  return jwt.sign(
    { type: 'super-admin', id },
    process.env.JWT_SECRET,
    { expiresIn: '4h' }
  );
};

const superAdminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password',
      });
    }

    const superAdmin = await SuperAdmin.findOne({
      email: email.toLowerCase().trim(),
      isActive: true,
    }).select('+password');

    if (!superAdmin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const passwordMatch = await superAdmin.comparePassword(password);
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    superAdmin.lastLogin = new Date();
    await superAdmin.save();

    const token = generateSuperAdminToken(superAdmin._id);

    res.json({
      success: true,
      message: 'Super admin logged in',
      data: {
        token,
        superAdmin: {
          _id: superAdmin._id,
          username: superAdmin.username,
          email: superAdmin.email,
          fullName: superAdmin.fullName,
        },
      },
    });
  } catch (error) {
    console.error('❌ superAdminLogin error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

const listCompanies = async (req, res) => {
  try {
    const companies = await Company.find().sort({ createdAt: -1 });

    const withStats = await Promise.all(
      companies.map(async (company) => {
        const [userCount, plcCount, tagCount, screenCount] = await Promise.all([
          User.countDocuments({ companyId: company._id }),
          PLCConnection.countDocuments({ companyId: company._id }),
          Tag.countDocuments({ companyId: company._id }),
          Graphic.countDocuments({ companyId: company._id }),
        ]);

        return {
          ...company.toObject(),
          stats: { userCount, plcCount, tagCount, screenCount },
          isExpiredNow: company.isExpired(),
        };
      })
    );

    res.json({
      success: true,
      count: companies.length,
      data: withStats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

const createCompany = async (req, res) => {
  try {
    const {
      companyName, slug, contactEmail, contactName, contactPhone,
      plan, timezone, country,
      adminUsername, adminEmail, adminPassword, adminFullName,
    } = req.body;

    if (!companyName || !slug || !contactEmail || !adminEmail || !adminPassword) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    const existing = await Company.findOne({ slug: slug.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Workspace slug "${slug}" already exists. Choose another.`,
      });
    }

    const company = await Company.create({
      companyName: companyName.trim(),
      slug: slug.toLowerCase().trim(),
      contactEmail: contactEmail.toLowerCase().trim(),
      contactName: contactName || '',
      contactPhone: contactPhone || '',
      plan: plan || 'trial',
      timezone: timezone || 'UTC',
      country: country || '',
      createdBy: req.superAdmin?._id,
    });

    const admin = await User.create({
      companyId: company._id,
      username: adminUsername || 'admin',
      email: adminEmail.toLowerCase().trim(),
      password: adminPassword,
      fullName: adminFullName || 'Administrator',
      role: 'admin',
      avatarColor: '#2563EB',
    });

    await Settings.create({
      companyId: company._id,
      system: {
        systemName: 'OnlineSCADA',
        companyName: company.companyName,
      },
    });

    res.status(201).json({
      success: true,
      message: `Company "${companyName}" created successfully`,
      data: {
        company: company.toObject(),
        admin: {
          _id: admin._id,
          username: admin.username,
          email: admin.email,
          role: admin.role,
        },
        loginInfo: {
          url: `${req.protocol}://${req.get('host')}/login`,
          slug: company.slug,
          adminEmail: admin.email,
          note: 'Please share these credentials securely with the company admin.',
        },
      },
    });
  } catch (error) {
    console.error('❌ createCompany error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to create company',
      error: error.message,
    });
  }
};

const updateCompany = async (req, res) => {
  try {
    const allowed = [
      'companyName', 'contactEmail', 'contactName', 'contactPhone',
      'plan', 'isActive', 'isSuspended', 'suspensionReason',
      'trialEndsAt', 'subscriptionExpiresAt', 'timezone', 'country', 'logoUrl',
    ];
    const updates = {};
    allowed.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const company = await Company.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found',
      });
    }

    res.json({
      success: true,
      message: 'Company updated',
      data: company,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

const deleteCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const { confirm } = req.body;

    if (confirm !== 'DELETE') {
      return res.status(400).json({
        success: false,
        message: 'To delete, send { "confirm": "DELETE" } in body',
      });
    }

    const company = await Company.findById(id);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found',
      });
    }

    await Promise.all([
      User.deleteMany({ companyId: id }),
      PLCConnection.deleteMany({ companyId: id }),
      Tag.deleteMany({ companyId: id }),
      Graphic.deleteMany({ companyId: id }),
      Alarm.deleteMany({ companyId: id }),
      Recipe.deleteMany({ companyId: id }),
      Settings.deleteMany({ companyId: id }),
    ]);

    await Company.findByIdAndDelete(id);

    res.json({
      success: true,
      message: `Company "${company.companyName}" and all associated data deleted`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

const resetCompanyAdminPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password required (min 6 chars)',
      });
    }

    const admin = await User.findOne({ companyId: id, role: 'admin' });
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'No admin found for this company',
      });
    }

    admin.password = newPassword;
    await admin.save();

    res.json({
      success: true,
      message: `Password reset for ${admin.email}`,
      data: {
        adminEmail: admin.email,
        note: 'Share the new password securely with the admin.',
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// ═══════════════════════════════════════════════════════════
// EXPORT ALL USERS CSV (Platform-wide user directory)
// ═══════════════════════════════════════════════════════════
const exportAllUsersCSV = async (req, res) => {
  try {
    const users = await User.find()
      .populate('companyId', 'companyName slug plan')
      .sort({ createdAt: -1 });

    const csvEscape = (v) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const headers = [
      'Company Name',
      'Workspace Slug',
      'Plan',
      'Full Name',
      'Username',
      'Email',
      'Role',
      'Status',
      'Created Date',
      'Last Login',
    ];

    let csv = `# OnlineSCADA Platform-Wide Registered Users Export\n`;
    csv += `# Generated At: ${new Date().toISOString()}\n`;
    csv += `# Total Registered Users: ${users.length}\n#\n`;
    csv += headers.map(csvEscape).join(',') + '\n';

    users.forEach((u) => {
      const company = u.companyId || {};
      const row = [
        csvEscape(company.companyName || 'Unassigned'),
        csvEscape(company.slug || 'N/A'),
        csvEscape(company.plan || 'N/A'),
        csvEscape(u.fullName || u.username),
        csvEscape(u.username),
        csvEscape(u.email),
        csvEscape(u.role),
        csvEscape(u.isActive ? 'Active' : 'Disabled'),
        csvEscape(u.createdAt ? new Date(u.createdAt).toISOString() : ''),
        csvEscape(u.lastLogin ? new Date(u.lastLogin).toISOString() : 'Never'),
      ];
      csv += row.join(',') + '\n';
    });

    const filename = `onlinescada_all_users_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    console.error('Export All Users CSV Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export users CSV',
      error: error.message,
    });
  }
};

module.exports = {
  superAdminLogin,
  listCompanies,
  createCompany,
  updateCompany,
  deleteCompany,
  resetCompanyAdminPassword,
  exportAllUsersCSV,
};