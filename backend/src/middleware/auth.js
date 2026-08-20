// ═══════════════════════════════════════════════════════════
// Auth Middleware — Multi-Tenant Version
//
// Three levels of protection:
//   1. workspaceProtect — validates workspaceToken (Step 1)
//   2. userProtect       — validates userToken (Step 2, MOST COMMON)
//   3. superAdminProtect — validates super admin token
//
// authorize(...roles) — role check (use AFTER userProtect)
// requirePermission(perm) — permission check
// ═══════════════════════════════════════════════════════════

const jwt        = require('jsonwebtoken');
const User       = require('../models/User');
const Company    = require('../models/Company');
const SuperAdmin = require('../models/SuperAdmin');

// ─── Helper: extract Bearer token ─────────────────────────
const extractToken = (req) => {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) return auth.substring(7);
  return null;
};

// ─── Helper: verify JWT with expiry handling ──────────────
const verifyJwt = (token) => {
  try {
    return { ok: true, payload: jwt.verify(token, process.env.JWT_SECRET) };
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return { ok: false, code: 'TOKEN_EXPIRED', message: 'Session expired. Please log in again.' };
    }
    return { ok: false, code: 'TOKEN_INVALID', message: 'Invalid token' };
  }
};

// ═══════════════════════════════════════════════════════════
// 1. WORKSPACE PROTECT
// Requires workspaceToken from Step 1
// Attaches: req.companyId, req.companySlug, req.company
// Used for: getWorkspaceUsers, loginUser
// ═══════════════════════════════════════════════════════════
const workspaceProtect = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No workspace token provided',
      code: 'NO_WORKSPACE_TOKEN',
    });
  }

  const { ok, payload, code, message } = verifyJwt(token);
  if (!ok) return res.status(401).json({ success: false, message, code });

  if (payload.type !== 'workspace' && payload.type !== 'user') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token type',
      code: 'WRONG_TOKEN_TYPE',
    });
  }

  const company = await Company.findById(payload.companyId);
  if (!company || !company.canAccess()) {
    return res.status(403).json({
      success: false,
      message: 'Workspace no longer accessible',
      code: 'WORKSPACE_INACCESSIBLE',
    });
  }

  req.companyId    = company._id;
  req.companySlug  = company.slug;
  req.company      = company;
  next();
};

// ═══════════════════════════════════════════════════════════
// 2. USER PROTECT (MAIN middleware for most routes)
// Requires userToken from Step 2
// Attaches: req.user, req.company, req.companyId
// Used for: EVERYTHING except workspace + super-admin routes
// ═══════════════════════════════════════════════════════════
const userProtect = async (req, res, next) => {
  const token = extractToken(req);

   // ✅ ADD THIS DEBUG LINE:
  console.log(`[userProtect] ${req.method} ${req.originalUrl} | token=${token ? 'YES(' + token.substring(0, 15) + '...)' : 'NULL'}`);

  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No user token provided',
      code: 'NO_USER_TOKEN',
    });
  }

  const { ok, payload, code, message } = verifyJwt(token);
  if (!ok) return res.status(401).json({ success: false, message, code });

  if (payload.type !== 'user') {
    return res.status(401).json({
      success: false,
      message: 'User authentication required',
      code: 'WRONG_TOKEN_TYPE',
    });
  }

  // Load user with company
  const user = await User.findById(payload.userId).select('-password');
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'User not found',
      code: 'USER_NOT_FOUND',
    });
  }
  if (!user.isActive) {
    return res.status(403).json({
      success: false,
      message: 'User account is deactivated',
      code: 'USER_INACTIVE',
    });
  }

  // Verify user still belongs to the company in the token
  if (String(user.companyId) !== String(payload.companyId)) {
    return res.status(403).json({
      success: false,
      message: 'Token/user company mismatch',
      code: 'TENANT_MISMATCH',
    });
  }

  const company = await Company.findById(user.companyId);
  if (!company || !company.canAccess()) {
    return res.status(403).json({
      success: false,
      message: 'Workspace no longer accessible',
      code: 'WORKSPACE_INACCESSIBLE',
    });
  }

  req.user      = user;
  req.company   = company;
  req.companyId = company._id;
  next();
};

// ═══════════════════════════════════════════════════════════
// 3. SUPER ADMIN PROTECT
// Requires super admin token
// Attaches: req.superAdmin
// ═══════════════════════════════════════════════════════════
const superAdminProtect = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No super admin token provided',
      code: 'NO_SUPER_ADMIN_TOKEN',
    });
  }

  const { ok, payload, code, message } = verifyJwt(token);
  if (!ok) return res.status(401).json({ success: false, message, code });

  if (payload.type !== 'super-admin') {
    return res.status(403).json({
      success: false,
      message: 'Super admin access required',
      code: 'NOT_SUPER_ADMIN',
    });
  }

  const superAdmin = await SuperAdmin.findById(payload.id);
  if (!superAdmin || !superAdmin.isActive) {
    return res.status(403).json({
      success: false,
      message: 'Super admin not found or inactive',
      code: 'SUPER_ADMIN_INACTIVE',
    });
  }

  req.superAdmin = superAdmin;
  next();
};

// ═══════════════════════════════════════════════════════════
// ROLE CHECK (use AFTER userProtect)
// authorize('admin', 'engineer') — allows only those roles
// ═══════════════════════════════════════════════════════════
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
        code: 'NOT_AUTHENTICATED',
      });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user.role}' not authorized for this action`,
        code: 'INSUFFICIENT_ROLE',
      });
    }
    next();
  };
};

// ═══════════════════════════════════════════════════════════
// PERMISSION CHECK (use AFTER userProtect)
// requirePermission('canManageUsers')
// ═══════════════════════════════════════════════════════════
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
    }
    if (!req.user.permissions || !req.user.permissions[permission]) {
      return res.status(403).json({
        success: false,
        message: `Permission '${permission}' required`,
        code: 'INSUFFICIENT_PERMISSION',
      });
    }
    next();
  };
};

// ═══════════════════════════════════════════════════════════
// LEGACY EXPORT (backward compat — keep old 'protect' name)
// so existing routes don't break during migration
// ═══════════════════════════════════════════════════════════
const protect = userProtect;

module.exports = {
  workspaceProtect,
  userProtect,
  superAdminProtect,
  authorize,
  requirePermission,
  protect, // legacy alias
};