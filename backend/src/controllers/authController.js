const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { logActivity } = require('./reportController');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

// ===== REGISTER USER =====
const register = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide username, email, and password',
      });
    }

    const userExists = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User with this email or username already exists',
      });
    }

    let permissions = {
      canDesign: false,
      canManageTags: false,
      canControlPLC: false,
      canViewRuntime: true,
      canManageUsers: false,
    };

    if (role === 'admin') {
      permissions = {
        canDesign: true,
        canManageTags: true,
        canControlPLC: true,
        canViewRuntime: true,
        canManageUsers: true,
      };
    } else if (role === 'engineer') {
      permissions = {
        canDesign: true,
        canManageTags: true,
        canControlPLC: true,
        canViewRuntime: true,
        canManageUsers: false,
      };
    } else if (role === 'operator') {
      permissions = {
        canDesign: false,
        canManageTags: false,
        canControlPLC: true,
        canViewRuntime: true,
        canManageUsers: false,
      };
    }

    const user = await User.create({
      username,
      email,
      password,
      role: role || 'operator',
      permissions,
    });

    if (user) {
      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          _id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          permissions: user.permissions,
          token: generateToken(user._id),
        },
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message,
    });
  }
};

// ===== LOGIN USER =====
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide username and password',
      });
    }

    // ✅ STEP 1 — Find user FIRST (user variable must exist before logActivity)
    const user = await User.findOne({
      $or: [{ username }, { email: username }],
    }).select('+password');

    // ✅ STEP 2 — User not found → log failed attempt → return 401
    if (!user) {
      // Fire-and-forget — don't await so it doesn't block response
      logActivity({
        username: username || 'unknown',
        action: 'LOGIN_FAILED',
        description: 'Failed login attempt - user not found',
        ipAddress: req.ip || req.headers['x-forwarded-for'] || '',
        userAgent: req.headers['user-agent'] || '',
        success: false,
        errorMessage: 'Invalid credentials',
      }).catch(err => console.warn('logActivity failed:', err.message));

      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // ✅ STEP 3 — Check if account is active
    if (!user.isActive) {
      logActivity({
        username: user.username,
        userRole: user.role,
        userId: user._id,
        action: 'LOGIN_FAILED',
        description: 'Failed login attempt - account deactivated',
        ipAddress: req.ip || req.headers['x-forwarded-for'] || '',
        userAgent: req.headers['user-agent'] || '',
        success: false,
        errorMessage: 'Account deactivated',
      }).catch(err => console.warn('logActivity failed:', err.message));

      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Contact administrator.',
      });
    }

    // ✅ STEP 4 — Check password
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      logActivity({
        username: user.username,
        userRole: user.role,
        userId: user._id,
        action: 'LOGIN_FAILED',
        description: 'Failed login attempt - wrong password',
        ipAddress: req.ip || req.headers['x-forwarded-for'] || '',
        userAgent: req.headers['user-agent'] || '',
        success: false,
        errorMessage: 'Invalid credentials',
      }).catch(err => console.warn('logActivity failed:', err.message));

      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // ✅ STEP 5 — Successful login → update lastLogin → log → respond
    user.lastLogin = Date.now();
    await user.save();

    // Fire-and-forget activity log
    logActivity({
      username: user.username,
      userRole: user.role,
      userId: user._id,
      action: 'LOGIN',
      description: 'User logged in successfully',
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '',
      userAgent: req.headers['user-agent'] || '',
      success: true,
    }).catch(err => console.warn('logActivity failed:', err.message));

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
        lastLogin: user.lastLogin,
        token: generateToken(user._id),
      },
    });
  } catch (error) {
    console.error('❌ Login error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message,
    });
  }
};

// ===== GET CURRENT USER =====
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message,
    });
  }
};

// ===== GET ALL USERS (Admin only) =====
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message,
    });
  }
};

// ===== UPDATE USER =====
const updateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      message: 'User updated successfully',
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message,
    });
  }
};

// ===== DELETE USER =====
const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message,
    });
  }
};

module.exports = {
  register,
  login,
  getMe,
  getAllUsers,
  updateUser,
  deleteUser,
};