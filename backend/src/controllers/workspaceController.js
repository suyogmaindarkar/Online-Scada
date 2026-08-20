// ═══════════════════════════════════════════════════════════
// Workspace Controller — Two-Step Authentication
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

const jwt      = require('jsonwebtoken');
const Company  = require('../models/Company');
const User     = require('../models/User');
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
    // We check that this workspace has AT LEAST ONE admin with these creds
    const admin = await User.findOne({
      companyId: company._id,
      email: adminEmail.toLowerCase().trim(),
      role: 'admin',
      isActive: true,
    }).select('+password');

    if (!admin) {
      // Log failed workspace attempt (no companyId since we don't want to log to nowhere)
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
      } catch {}

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
      } catch {}

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
      .sort({ role: 1, fullName: 1 }); // admins first

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
    } catch {}

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
//
// After Step 1, user picks their avatar from the list.
// They then enter their password to complete login.
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

    // ─── req.companyId is set by workspaceProtect middleware ──
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: 'Workspace session invalid. Please start over.',
        code: 'WORKSPACE_TOKEN_MISSING',
      });
    }

    // ─── 1. Find user within this company ─────────────────
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

    // ─── 2. Verify password ───────────────────────────────
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
      } catch {}

      return res.status(401).json({
        success: false,
        message: 'Invalid password',
        code: 'INVALID_PASSWORD',
      });
    }

    // ─── 3. Update lastLogin ──────────────────────────────
    user.lastLogin = new Date();
    await user.save();

    // ─── 4. Log successful user login ─────────────────────
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
    } catch {}

    // ─── 5. Generate user token ───────────────────────────
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
// Requires: workspaceToken (from Step 1)
// Used to refresh user list without re-verifying workspace
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
// Requires: userToken
// Frontend uses this to bootstrap the app after login
// ═══════════════════════════════════════════════════════════
const getMe = async (req, res) => {
  try {
    // req.user + req.company set by userProtect middleware
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
// After operator presses Ctrl+Q → returns to UserSelection
// (workspace still valid, just user logged out)
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
      } catch {}
    }
    // Frontend just discards userToken (stateless JWT)
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
// Full logout — returns to WorkspaceLogin
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
      } catch {}
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
  verifyWorkspace,
  loginUser,
  getWorkspaceUsers,
  getMe,
  logoutUser,
  logoutAll,
};