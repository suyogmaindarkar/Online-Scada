// ============================================
// User Controller - User Administration
// ============================================

const User = require('../models/User');
const bcrypt = require('bcryptjs');

// ─────────────────────────────────────────
// GET ALL Users
// GET /api/users
// ─────────────────────────────────────────
const getAllUsers = async (req, res) => {
  try {
    const { role, isActive, search } = req.query;

    const filter = {};
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
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
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────
// GET Single User
// GET /api/users/:id
// ─────────────────────────────────────────
const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('Get User Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────
// CREATE User (Admin Only)
// POST /api/users
// ─────────────────────────────────────────
const createUser = async (req, res) => {
  try {
    const {
      name,
      username,
      email,
      password,
      role,
      isActive,
    } = req.body;

    // Validate
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'name, email, password are required',
      });
    }

    // Check if user exists
    const existing = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: existing.email === email
          ? 'Email already registered'
          : 'Username already taken',
      });
    }

    // Create user
    const user = await User.create({
      name,
      username: username || email.split('@')[0],
      email,
      password, // Will be hashed by model pre-save
      role: role || 'viewer',
      isActive: isActive !== undefined ? isActive : true,
    });

    // Return without password
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
      return res.status(400).json({
        success: false,
        message: 'Email or username already exists',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create user',
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────
// UPDATE User
// PUT /api/users/:id
// ─────────────────────────────────────────
const updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Prevent admin from deactivating themselves
    if (
      req.user._id.toString() === user._id.toString() &&
      req.body.isActive === false
    ) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own account',
      });
    }

    // Prevent admin from changing their own role
    if (
      req.user._id.toString() === user._id.toString() &&
      req.body.role &&
      req.body.role !== user.role
    ) {
      return res.status(400).json({
        success: false,
        message: 'You cannot change your own role',
      });
    }

    // Allowed fields to update
    const allowedFields = ['name', 'username', 'email', 'role', 'isActive'];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        user[field] = req.body[field];
      }
    });

    await user.save();

    const userObj = user.toObject();
    delete userObj.password;

    res.json({
      success: true,
      message: 'User updated successfully',
      user: userObj,
    });
  } catch (error) {
    console.error('Update User Error:', error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Email or username already exists',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update user',
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────
// DELETE User
// DELETE /api/users/:id
// ─────────────────────────────────────────
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Prevent self-deletion
    if (req.user._id.toString() === user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account',
      });
    }

    await user.deleteOne();

    res.json({
      success: true,
      message: `User '${user.name}' deleted successfully`,
    });
  } catch (error) {
    console.error('Delete User Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────
// RESET Password (Admin only)
// PUT /api/users/:id/reset-password
// ─────────────────────────────────────────
const resetPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Set new password (will be hashed by pre-save hook)
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: `Password reset successfully for ${user.name}`,
    });
  } catch (error) {
    console.error('Reset Password Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password',
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────
// CHANGE OWN Password
// PUT /api/users/change-password
// ─────────────────────────────────────────
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current and new password required',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters',
      });
    }

    const user = await User.findById(req.user._id);

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Change Password Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password',
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────
// TOGGLE Active Status
// PUT /api/users/:id/toggle-active
// ─────────────────────────────────────────
const toggleActive = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (req.user._id.toString() === user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own account',
      });
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
    res.status(500).json({
      success: false,
      message: 'Failed to toggle status',
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────
// GET User Stats
// GET /api/users/stats
// ─────────────────────────────────────────
const getUserStats = async (req, res) => {
  try {
    const total = await User.countDocuments();
    const active = await User.countDocuments({ isActive: true });
    const inactive = await User.countDocuments({ isActive: false });

    const byRole = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]);

    const roleStats = {};
    byRole.forEach((r) => {
      roleStats[r._id] = r.count;
    });

    res.json({
      success: true,
      stats: {
        total,
        active,
        inactive,
        byRole: roleStats,
      },
    });
  } catch (error) {
    console.error('Get User Stats Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stats',
      error: error.message,
    });
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