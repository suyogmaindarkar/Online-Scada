// ═══════════════════════════════════════════════════════════
// Workspace Controller — Two-Step Authentication + Signup
//
// SELF-SERVICE SIGNUP:
//   POST /api/workspace/register
//     Creates Company + Admin User + Settings + Demo PLC
//     + Edge Gateway + Lead entry
//     Returns workspaceToken + userToken (instant login!)
//
// Step 1: POST /api/workspace/verify
//   Verify company slug exists + is active
//   Returns workspaceToken (8h) + list of users
//
// Step 2: POST /api/workspace/login-user
//   Login as specific user within the workspace
//   Requires workspaceToken from Step 1
//   Returns userToken (2h) + user details
//
// Other endpoints:
//   GET  /api/workspace/users     — refresh user list (needs workspaceToken)
//   POST /api/workspace/logout-user — clear userToken, keep workspaceToken
//   POST /api/workspace/logout-all  — clear both tokens
//   GET  /api/workspace/me         — get current user + company info
// ═══════════════════════════════════════════════════════════

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Company = require('../models/Company');
const User = require('../models/User');
const Settings = require('../models/Settings');
const PLCConnection = require('../models/PLCConnection');
const Tag = require('../models/Tag');
const EdgeGateway = require('../models/EdgeGateway');
const Lead = require('../models/Lead');
const { logActivity } = require('./reportController');

// ─── Token generators ─────────────────────────────────────
const generateWorkspaceToken = (companyId, companySlug) => {
  return jwt.sign(
    { type: 'workspace', companyId, companySlug },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );
};

const generateUserToken = (userId, companyId, role) => {
  return jwt.sign(
    { type: 'user', userId, companyId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '2h' }
  );
};

// ─── Slug generator ───────────────────────────────────────
const generateSlug = (companyName) => {
  return companyName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')   // remove special chars
    .replace(/\s+/g, '-')            // spaces → hyphens
    .replace(/-+/g, '-')             // collapse multiple hyphens
    .replace(/^-|-$/g, '')           // trim hyphens
    .substring(0, 25);               // leave room for suffix
};

// ═══════════════════════════════════════════════════════════
// SELF-SERVICE SIGNUP (Free Trial)
// Body: { companyName, contactName, email, password }
//
// Auto-creates EVERYTHING:
//   1. Company (trial, 14 days)
//   2. Workspace slug
//   3. Admin User
//   4. Default Settings
//   5. Demo Simulation PLC + 5 Tags
//   6. Edge Gateway + API Key
//   7. Lead entry for sales tracking
//
// Returns: workspaceToken + userToken (instant login!)
// ═══════════════════════════════════════════════════════════
const registerCompany = async (req, res) => {
  try {
    const { companyName, contactName, email, password } = req.body;

    // ─── 1. Validate input ────────────────────────────────
    if (!companyName || !contactName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide company name, your name, email, and password',
        code: 'MISSING_FIELDS',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
        code: 'WEAK_PASSWORD',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address',
        code: 'INVALID_EMAIL',
      });
    }

    // ─── 2. Check if email already exists ─────────────────
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists. Try logging in.',
        code: 'EMAIL_EXISTS',
      });
    }

    // ─── 3. Generate unique slug ──────────────────────────
    let slug = generateSlug(companyName);
    if (slug.length < 3) slug = 'company-' + slug;

    let slugCandidate = slug;
    let suffix = 1;
    while (await Company.findOne({ slug: slugCandidate })) {
      slugCandidate = `${slug}-${suffix}`;
      suffix++;
      if (suffix > 99) {
        slugCandidate = `${slug}-${crypto.randomBytes(2).toString('hex')}`;
        break;
      }
    }
    slug = slugCandidate;

    // ─── 4. Create Company ────────────────────────────────
    const company = await Company.create({
      companyName: companyName.trim(),
      slug,
      contactEmail: email.toLowerCase().trim(),
      contactName: contactName.trim(),
      plan: 'trial',
      timezone: 'Asia/Kolkata',
      country: 'India',
    });

    // ─── 5. Create Admin User ─────────────────────────────
    const adminUser = await User.create({
      companyId: company._id,
      username: contactName.trim().split(' ')[0].toLowerCase(),
      email: email.toLowerCase().trim(),
      password,
      fullName: contactName.trim(),
      role: 'admin',
      avatarColor: '#2563EB',
    });

    // ─── 6. Create Default Settings ───────────────────────
    await Settings.create({
      companyId: company._id,
      system: {
        systemName: 'OnlineSCADA',
        companyName: company.companyName,
      },
    });

    // ─── 7. Create Demo Simulation PLC + 5 Tags ──────────
    const simPLC = await PLCConnection.create({
      companyId: company._id,
      name: 'Demo Simulation PLC',
      description: 'Auto-generated simulation — delete when you connect a real PLC',
      protocol: 'SIMULATION',
      ipAddress: '10.0.0.100',
      port: 502,
      brand: 'SIMULATION',
      model: 'Virtual PLC',
      isSimulation: true,
      simulationPrefix: 'SIM_',
      pollingRate: 1000,
      isActive: true,
    });

    const demoTags = [
      { tagName: 'SIM_TEMPERATURE', dataType: 'REAL', unit: '°C', minValue: 20, maxValue: 80, simulationPattern: 'sine' },
      { tagName: 'SIM_PRESSURE', dataType: 'REAL', unit: 'bar', minValue: 0, maxValue: 10, simulationPattern: 'walk' },
      { tagName: 'SIM_LEVEL', dataType: 'REAL', unit: '%', minValue: 0, maxValue: 100, simulationPattern: 'ramp' },
      { tagName: 'SIM_MOTOR_RUN', dataType: 'BOOL', unit: '', minValue: 0, maxValue: 1, simulationPattern: 'toggle' },
      { tagName: 'SIM_COUNTER', dataType: 'INT', unit: '', minValue: 0, maxValue: 9999, simulationPattern: 'counter' },
    ];

    for (const tagData of demoTags) {
      await Tag.create({
        ...tagData,
        companyId: company._id,
        plcConnection: simPLC._id,
        isSimulationTag: true,
        currentValue: 0,
        quality: 'GOOD',
      });
    }

    // ─── 8. Create Edge Gateway + API Key ⭐ ─────────────
    const { rawKey, hash, prefix } = EdgeGateway.generateApiKey();

    const gateway = await EdgeGateway.create({
      companyId: company._id,
      name: 'Default Gateway',
      apiKeyHash: hash,
      apiKeyPrefix: prefix,
      status: 'never_connected',
    });

    // ─── 9. Create Lead Entry for Sales Tracking ──────────
    try {
      await Lead.create({
        companyName: company.companyName,
        contactName: contactName.trim(),
        email: email.toLowerCase().trim(),
        source: 'self-signup',
        status: 'trial',
        notes: `Self-service trial signup. Workspace: ${slug}. Plan: trial (14 days).`,
        companyId: company._id,
      });
    } catch (leadErr) {
      // Don't fail signup if lead creation fails
      console.warn('⚠️  Lead creation failed (non-critical):', leadErr.message);
    }

    // ─── 10. Generate Tokens ──────────────────────────────
    const workspaceToken = generateWorkspaceToken(company._id, company.slug);
    const userToken = generateUserToken(adminUser._id, company._id, 'admin');

    // ─── 11. Log Activity ─────────────────────────────────
    try {
      await logActivity({
        companyId: company._id,
        username: adminUser.username,
        userRole: 'admin',
        userId: adminUser._id,
        action: 'COMPANY_REGISTERED',
        description: `New trial company registered: ${company.companyName} (${slug})`,
        ipAddress: req.ip || '',
        userAgent: req.headers['user-agent'] || '',
      });
    } catch { }

    console.log(`\n🎉 NEW SIGNUP: ${company.companyName} (${slug})`);
    console.log(`   Admin: ${email} | Gateway Key: ${prefix}...\n`);

    // ─── 12. Return Everything ────────────────────────────
    res.status(201).json({
      success: true,
      message: 'Account created successfully! Welcome to OnlineSCADA.',
      data: {
        workspaceToken,
        userToken,
        company: {
          _id: company._id,
          companyName: company.companyName,
          slug: company.slug,
          plan: company.plan,
          limits: company.limits,
          trialEndsAt: company.trialEndsAt,
          logoUrl: company.logoUrl,
        },
        user: {
          _id: adminUser._id,
          username: adminUser.username,
          email: adminUser.email,
          fullName: adminUser.fullName,
          role: adminUser.role,
          avatarColor: adminUser.avatarColor,
        },
        edgeGateway: {
          _id: gateway._id,
          name: gateway.name,
          apiKey: rawKey,        // ⚠️ Sent ONLY once! User must save it.
          apiKeyPrefix: gateway.apiKeyPrefix,
          status: gateway.status,
          message: 'Save this API key securely. It will not be shown again. Download your gateway config from Settings → Edge Gateways.',
        },
      },
    });
  } catch (error) {
    console.error('❌ registerCompany error:', error.message);

    // Handle duplicate key errors gracefully
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(409).json({
        success: false,
        message: `A company with this ${field} already exists`,
        code: 'DUPLICATE',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: error.message,
    });
  }
};

// ═══════════════════════════════════════════════════════════
// STEP 1: VERIFY WORKSPACE
// Body: { slug: "acme", adminEmail: "admin@...", adminPassword: "..." }
//
// User enters:
//   - Workspace slug (URL-friendly company identifier)
//   - Admin email + password of the workspace
//
// Success: returns workspaceToken + list of users in that workspace
// ═══════════════════════════════════════════════════════════
const verifyWorkspace = async (req, res) => {
  try {
    const { slug, adminEmail, adminPassword } = req.body;

    if (!slug || !adminEmail || !adminPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide workspace, email, and password',
        code: 'MISSING_FIELDS',
      });
    }

    // ─── 1. Find company by slug ──────────────────────────
    const company = await Company.findOne({ slug: slug.toLowerCase().trim() });
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found. Contact your administrator.',
        code: 'WORKSPACE_NOT_FOUND',
      });
    }

    // ─── 2. Check company status ──────────────────────────
    if (!company.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Workspace is inactive. Contact support.',
        code: 'WORKSPACE_INACTIVE',
      });
    }
    if (company.isSuspended) {
      return res.status(403).json({
        success: false,
        message: `Workspace suspended: ${company.suspensionReason || 'Contact support'}`,
        code: 'WORKSPACE_SUSPENDED',
      });
    }
    if (company.isExpired()) {
      return res.status(403).json({
        success: false,
        message: 'Workspace subscription has expired. Please renew.',
        code: 'WORKSPACE_EXPIRED',
      });
    }

    // ─── 3. Verify admin credentials ──────────────────────
    const admin = await User.findOne({
      companyId: company._id,
      email: adminEmail.toLowerCase().trim(),
      role: 'admin',
      isActive: true,
    }).select('+password');

    if (!admin) {
      try {
        await logActivity({
          companyId: company._id,
          username: adminEmail,
          action: 'WORKSPACE_LOGIN_FAILED',
          description: `Failed workspace verification — no matching admin`,
          ipAddress: req.ip || '',
          userAgent: req.headers['user-agent'] || '',
          success: false,
          errorMessage: 'Admin email not found',
        });
      } catch { }

      return res.status(401).json({
        success: false,
        message: 'Invalid workspace credentials',
        code: 'INVALID_CREDENTIALS',
      });
    }

    const passwordMatch = await admin.comparePassword(adminPassword);
    if (!passwordMatch) {
      try {
        await logActivity({
          companyId: company._id,
          username: adminEmail,
          action: 'WORKSPACE_LOGIN_FAILED',
          description: `Failed workspace verification — wrong password`,
          ipAddress: req.ip || '',
          userAgent: req.headers['user-agent'] || '',
          success: false,
          errorMessage: 'Invalid password',
        });
      } catch { }

      return res.status(401).json({
        success: false,
        message: 'Invalid workspace credentials',
        code: 'INVALID_CREDENTIALS',
      });
    }

    // ─── 4. Update company activity ───────────────────────
    company.lastActivityAt = new Date();
    await company.save();

    // ─── 5. Get list of users for this workspace ──────────
    const users = await User.find({ companyId: company._id, isActive: true })
      .select('username email fullName role avatarColor lastLogin')
      .sort({ role: 1, fullName: 1 });

    // ─── 6. Generate workspace token ──────────────────────
    const workspaceToken = generateWorkspaceToken(company._id, company.slug);

    // ─── 7. Log successful workspace login ────────────────
    try {
      await logActivity({
        companyId: company._id,
        username: admin.username,
        userRole: 'admin',
        userId: admin._id,
        action: 'WORKSPACE_LOGIN',
        description: `Workspace ${company.slug} verified by ${admin.username}`,
        ipAddress: req.ip || '',
        userAgent: req.headers['user-agent'] || '',
      });
    } catch { }

    res.json({
      success: true,
      message: 'Workspace verified successfully',
      data: {
        workspaceToken,
        company: {
          _id: company._id,
          companyName: company.companyName,
          slug: company.slug,
          plan: company.plan,
          logoUrl: company.logoUrl,
          trialEndsAt: company.trialEndsAt,
        },
        users: users.map(u => ({
          _id: u._id,
          username: u.username,
          email: u.email,
          fullName: u.fullName || u.username,
          role: u.role,
          avatarColor: u.avatarColor,
          lastLogin: u.lastLogin,
        })),
      },
    });
  } catch (error) {
    console.error('❌ verifyWorkspace error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// ═══════════════════════════════════════════════════════════
// STEP 2: LOGIN AS USER
// Body: { userId: "...", password: "..." }
// Requires: Authorization: Bearer <workspaceToken>
// ═══════════════════════════════════════════════════════════
const loginUser = async (req, res) => {
  try {
    const { userId, password } = req.body;

    if (!userId || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide user and password',
        code: 'MISSING_FIELDS',
      });
    }

    const companyId = req.companyId;
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: 'Workspace session invalid. Please start over.',
        code: 'WORKSPACE_TOKEN_MISSING',
      });
    }

    const user = await User.findOne({
      _id: userId,
      companyId,
      isActive: true,
    }).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found in this workspace',
        code: 'USER_NOT_FOUND',
      });
    }

    const passwordMatch = await user.comparePassword(password);
    if (!passwordMatch) {
      try {
        await logActivity({
          companyId,
          username: user.username,
          userRole: user.role,
          userId: user._id,
          action: 'LOGIN_FAILED',
          description: `Failed user login`,
          ipAddress: req.ip || '',
          userAgent: req.headers['user-agent'] || '',
          success: false,
          errorMessage: 'Invalid password',
        });
      } catch { }

      return res.status(401).json({
        success: false,
        message: 'Invalid password',
        code: 'INVALID_PASSWORD',
      });
    }

    user.lastLogin = new Date();
    await user.save();

    try {
      await logActivity({
        companyId,
        username: user.username,
        userRole: user.role,
        userId: user._id,
        action: 'LOGIN',
        description: `User logged in`,
        ipAddress: req.ip || '',
        userAgent: req.headers['user-agent'] || '',
      });
    } catch { }

    const userToken = generateUserToken(user._id, companyId, user.role);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        userToken,
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          fullName: user.fullName || user.username,
          role: user.role,
          permissions: user.permissions,
          avatarColor: user.avatarColor,
          lastLogin: user.lastLogin,
        },
      },
    });
  } catch (error) {
    console.error('❌ loginUser error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// ═══════════════════════════════════════════════════════════
// GET LIST OF USERS IN CURRENT WORKSPACE
// ═══════════════════════════════════════════════════════════
const getWorkspaceUsers = async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: 'Workspace session invalid',
        code: 'WORKSPACE_TOKEN_MISSING',
      });
    }

    const users = await User.find({ companyId, isActive: true })
      .select('username email fullName role avatarColor lastLogin')
      .sort({ role: 1, fullName: 1 });

    res.json({
      success: true,
      data: users.map(u => ({
        _id: u._id,
        username: u.username,
        email: u.email,
        fullName: u.fullName || u.username,
        role: u.role,
        avatarColor: u.avatarColor,
        lastLogin: u.lastLogin,
      })),
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
// GET CURRENT USER INFO
// ═══════════════════════════════════════════════════════════
const getMe = async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        user: {
          _id: req.user._id,
          username: req.user.username,
          email: req.user.email,
          fullName: req.user.fullName || req.user.username,
          role: req.user.role,
          permissions: req.user.permissions,
          avatarColor: req.user.avatarColor,
          lastLogin: req.user.lastLogin,
        },
        company: {
          _id: req.company._id,
          companyName: req.company.companyName,
          slug: req.company.slug,
          plan: req.company.plan,
          limits: req.company.limits,
          logoUrl: req.company.logoUrl,
          trialEndsAt: req.company.trialEndsAt,
        },
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
// LOGOUT USER (keep workspace session)
// ═══════════════════════════════════════════════════════════
const logoutUser = async (req, res) => {
  try {
    if (req.user && req.companyId) {
      try {
        await logActivity({
          companyId: req.companyId,
          username: req.user.username,
          userRole: req.user.role,
          userId: req.user._id,
          action: 'LOGOUT',
          description: 'User logged out (workspace still active)',
          ipAddress: req.ip || '',
          userAgent: req.headers['user-agent'] || '',
        });
      } catch { }
    }
    res.json({
      success: true,
      message: 'User logged out',
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
// LOGOUT ALL (clear both tokens)
// ═══════════════════════════════════════════════════════════
const logoutAll = async (req, res) => {
  try {
    if (req.user && req.companyId) {
      try {
        await logActivity({
          companyId: req.companyId,
          username: req.user.username,
          userRole: req.user.role,
          userId: req.user._id,
          action: 'WORKSPACE_LOGOUT',
          description: 'Full logout — workspace closed',
          ipAddress: req.ip || '',
          userAgent: req.headers['user-agent'] || '',
        });
      } catch { }
    }
    res.json({
      success: true,
      message: 'Logged out completely',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

module.exports = {
  registerCompany,
  verifyWorkspace,
  loginUser,
  getWorkspaceUsers,
  getMe,
  logoutUser,
  logoutAll,
};