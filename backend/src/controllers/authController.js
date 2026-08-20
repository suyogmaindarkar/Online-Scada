// ═══════════════════════════════════════════════════════════
// Legacy Auth Controller — SIMPLIFIED
//
// The old /api/auth/login is now DEPRECATED.
// Use /api/workspace/verify + /api/workspace/login-user instead.
//
// This file is kept for backward compat with any code still calling
// /api/auth/me — it now returns the same as /api/workspace/me
// ═══════════════════════════════════════════════════════════

const User = require('../models/User');

// ─── DEPRECATED — old single-step login ─────────────────────
const login = (req, res) => {
  res.status(410).json({
    success: false,
    message: 'This endpoint is deprecated. Use /api/workspace/verify then /api/workspace/login-user',
    code: 'ENDPOINT_DEPRECATED',
    hint: 'Update your frontend to use the two-step workspace login flow.',
  });
};

// ─── DEPRECATED — old registration ──────────────────────────
const register = (req, res) => {
  res.status(410).json({
    success: false,
    message: 'Self-registration disabled. Contact your workspace admin to create user accounts.',
    code: 'ENDPOINT_DEPRECATED',
  });
};

// ─── Kept — get current user ────────────────────────────────
const getMe = async (req, res) => {
  try {
    // req.user is set by userProtect middleware
    res.json({
      success: true,
      data: req.user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// ─── Kept — list users (admin only, scoped to company) ─────
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ companyId: req.companyId })
      .select('-password')
      .sort({ role: 1, fullName: 1 });

    res.json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// ─── Kept — update user (scoped to company) ────────────────
const updateUser = async (req, res) => {
  try {
    // Can only update users in same company
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found in this workspace',
      });
    }

    res.json({
      success: true,
      message: 'User updated',
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// ─── Kept — delete user (scoped to company) ────────────────
const deleteUser = async (req, res) => {
  try {
    // Prevent deleting yourself
    if (String(req.params.id) === String(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account',
      });
    }

    const user = await User.findOneAndDelete({
      _id: req.params.id,
      companyId: req.companyId,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found in this workspace',
      });
    }

    res.json({
      success: true,
      message: 'User deleted',
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
  register,       // deprecated
  login,          // deprecated
  getMe,
  getAllUsers,
  updateUser,
  deleteUser,
};