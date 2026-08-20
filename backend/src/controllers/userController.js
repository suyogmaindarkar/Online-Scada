// ═══════════════════════════════════════════════════════════
// User Controller — Multi-Tenant Update
//
// ✅ All queries scoped by req.companyId
// ✅ Creates include companyId
// ✅ Plan limit enforcement (maxUsers)
// ✅ Users only visible within their company
// ═══════════════════════════════════════════════════════════

const User = require('../models/User');
const bcrypt = require('bcryptjs');

// ─── Helper: Check plan limits ───
const checkUserLimit = async (req) => {
  const currentCount = await User.countDocuments({ companyId: req.companyId });
  const maxUsers = req.company?.limits?.maxUsers || 999;
  if (currentCount >= maxUsers) {
    return {
      exceeded: true,
      current: currentCount,
      max: maxUsers,
      message: `Plan limit reached: ${currentCount}/${maxUsers} users. Upgrade your plan.`,
    };
  }
  return { exceeded: false };
};

// ─────────────────────────────────────────
// GET ALL Users (scoped to company)
// ─────────────────────────────────────────
const getAllUsers = async (req, res) => {
  try {
    const { role, isActive, search } = req.query;

    const filter = { companyId: req.companyId }; // ✅ MULTI-TENANT
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    console.error('Get All Users Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch users', error: error.message });
  }
};

// ─────────────────────────────────────────
// GET Single User (scoped)
// ─────────────────────────────────────────
const getUser = async (req, res) => {
  try {
    const user = await User.findOne({
      _id: req.params.id,
      companyId: req.companyId, // ✅ MULTI-TENANT
    }).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found in this workspace' });
    }
    res.json({ success: true, user });
  } catch (error) {
    console.error('Get User Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch user', error: error.message });
  }
};

// ─────────────────────────────────────────
// CREATE User (Admin Only, scoped)
// ─────────────────────────────────────────
const createUser = async (req, res) => {
  try {
    const { username, fullName, email, password, role, isActive } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'email and password are required' });
    }

    // ✅ Plan limit check
    const limitCheck = await checkUserLimit(req);
    if (limitCheck.exceeded) {
      return res.status(403).json({
        success: false,
        message: limitCheck.message,
        code: 'PLAN_LIMIT_EXCEEDED',
      });
    }

    // ✅ Uniqueness check SCOPED to company
    const existing = await User.findOne({
      companyId: req.companyId,
      $or: [{ email }, { username: username || email.split('@')[0] }],
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: existing.email === email
          ? 'Email already registered in this workspace'
          : 'Username already taken in this workspace',
      });
    }

    // ✅ Random avatar color
    const avatarColors = ['#2563EB', '#DC2626', '#16A34A', '#F59E0B', '#9333EA', '#0891B2', '#EA580C'];
    const randomColor = avatarColors[Math.floor(Math.random() * avatarColors.length)];

    const user = await User.create({
      companyId: req.companyId, // ✅ MULTI-TENANT
      username: username || email.split('@')[0],
      fullName: fullName || username || email.split('@')[0],
      email,
      password,
      role: role || 'viewer',
      isActive: isActive !== undefined ? isActive : true,
      avatarColor: randomColor,
    });

    const userObj = user.toObject();
    delete userObj.password;

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: userObj,
    });
  } catch (error) {
    console.error('Create User Error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Email or username already exists in this workspace' });
    }
    res.status(500).json({ success: false, message: 'Failed to create user', error: error.message });
  }
};

// ─────────────────────────────────────────
// UPDATE User (scoped)
// ─────────────────────────────────────────
const updateUser = async (req, res) => {
  try {
    delete req.body.companyId; // Prevent tenant escape

    const user = await User.findOne({
      _id: req.params.id,
      companyId: req.companyId, // ✅ MULTI-TENANT
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found in this workspace' });
    }

    // Prevent admin from deactivating themselves
    if (String(req.user._id) === String(user._id) && req.body.isActive === false) {
      return res.status(400).json({ success: false, message: 'You cannot deactivate your own account' });
    }

    // Prevent admin from changing their own role
    if (String(req.user._id) === String(user._id) && req.body.role && req.body.role !== user.role) {
      return res.status(400).json({ success: false, message: 'You cannot change your own role' });
    }

    const allowedFields = ['fullName', 'username', 'email', 'role', 'isActive', 'avatarColor'];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        user[field] = req.body[field];
      }
    });

    await user.save();

    const userObj = user.toObject();
    delete userObj.password;

    res.json({ success: true, message: 'User updated successfully', user: userObj });
  } catch (error) {
    console.error('Update User Error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Email or username already exists in this workspace' });
    }
    res.status(500).json({ success: false, message: 'Failed to update user', error: error.message });
  }
};

// ─────────────────────────────────────────
// DELETE User (scoped)
// ─────────────────────────────────────────
const deleteUser = async (req, res) => {
  try {
    const user = await User.findOne({
      _id: req.params.id,
      companyId: req.companyId, // ✅ MULTI-TENANT
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found in this workspace' });
    }

    if (String(req.user._id) === String(user._id)) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
    }

    await user.deleteOne();

    res.json({ success: true, message: `User '${user.fullName || user.username}' deleted successfully` });
  } catch (error) {
    console.error('Delete User Error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete user', error: error.message });
  }
};

// ─────────────────────────────────────────
// RESET Password (Admin only, scoped)
// ─────────────────────────────────────────
const resetPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const user = await User.findOne({
      _id: req.params.id,
      companyId: req.companyId, // ✅ MULTI-TENANT
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found in this workspace' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: `Password reset for ${user.fullName || user.username}` });
  } catch (error) {
    console.error('Reset Password Error:', error);
    res.status(500).json({ success: false, message: 'Failed to reset password', error: error.message });
  }
};

// ─────────────────────────────────────────
// CHANGE OWN Password (scoped)
// ─────────────────────────────────────────
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }

    // ✅ Load with password field
    const user = await User.findOne({
      _id: req.user._id,
      companyId: req.companyId,
    }).select('+password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change Password Error:', error);
    res.status(500).json({ success: false, message: 'Failed to change password', error: error.message });
  }
};

// ─────────────────────────────────────────
// TOGGLE Active Status (scoped)
// ─────────────────────────────────────────
const toggleActive = async (req, res) => {
  try {
    const user = await User.findOne({
      _id: req.params.id,
      companyId: req.companyId, // ✅ MULTI-TENANT
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found in this workspace' });
    }

    if (String(req.user._id) === String(user._id)) {
      return res.status(400).json({ success: false, message: 'You cannot deactivate your own account' });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.json({
      success: true,
      message: `User ${user.isActive ? 'activated' : 'deactivated'}`,
      isActive: user.isActive,
    });
  } catch (error) {
    console.error('Toggle Active Error:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle status', error: error.message });
  }
};

// ─────────────────────────────────────────
// GET User Stats (scoped)
// ─────────────────────────────────────────
const getUserStats = async (req, res) => {
  try {
    const companyFilter = { companyId: req.companyId }; // ✅ MULTI-TENANT

    const total = await User.countDocuments(companyFilter);
    const active = await User.countDocuments({ ...companyFilter, isActive: true });
    const inactive = await User.countDocuments({ ...companyFilter, isActive: false });

    const byRole = await User.aggregate([
      { $match: { companyId: req.companyId } },
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]);

    const roleStats = {};
    byRole.forEach((r) => { roleStats[r._id] = r.count; });

    res.json({
      success: true,
      stats: { total, active, inactive, byRole: roleStats },
    });
  } catch (error) {
    console.error('Get User Stats Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stats', error: error.message });
  }
};

module.exports = {
  getAllUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  resetPassword,
  changePassword,
  toggleActive,
  getUserStats,
};