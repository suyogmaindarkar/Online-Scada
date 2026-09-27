// ═══════════════════════════════════════════════════════════
// Workspace Controller — Two-Step Authentication + Signup
// ═══════════════════════════════════════════════════════════

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Company = require('../models/Company');
const User = require('../models/User');
const Settings = require('../models/Settings');
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
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 25);
};

// ═══════════════════════════════════════════════════════════
// SELF-SERVICE SIGNUP (Free Trial)
// ═══════════════════════════════════════════════════════════
const registerCompany = async (req, res) => {
  try {
    const { companyName, contactName, email, password } = req.body;

    if (!companyName || !contactName || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide company name, your name, email, and password', code: 'MISSING_FIELDS' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters', code: 'WEAK_PASSWORD' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address', code: 'INVALID_EMAIL' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists. Try logging in.', code: 'EMAIL_EXISTS' });
    }

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

    const company = await Company.create({
      companyName: companyName.trim(),
      slug,
      contactEmail: email.toLowerCase().trim(),
      contactName: contactName.trim(),
      plan: 'trial',
      timezone: 'Asia/Kolkata',
      country: 'India',
    });

    const adminUser = await User.create({
      companyId: company._id,
      username: contactName.trim().split(' ')[0].toLowerCase(),
      email: email.toLowerCase().trim(),
      password,
      fullName: contactName.trim(),
      role: 'admin',
      avatarColor: '#2563EB',
    });

    await Settings.create({
      companyId: company._id,
      system: { systemName: 'OnlineSCADA', companyName: company.companyName },
    });

    // ─── Create Edge Gateway + API Key ─────────────
    const { rawKey, hash, prefix } = EdgeGateway.generateApiKey();
    const gateway = await EdgeGateway.create({
      companyId: company._id,
      name: 'Factory Connector',
      apiKeyHash: hash,
      apiKeyPrefix: prefix,
      status: 'never_connected',
    });

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
    } catch (leadErr) { }

    const workspaceToken = generateWorkspaceToken(company._id, company.slug);
    const userToken = generateUserToken(adminUser._id, company._id, 'admin');

    try {
      await logActivity({
        companyId: company._id, username: adminUser.username, userRole: 'admin', userId: adminUser._id,
        action: 'COMPANY_REGISTERED', description: `New trial company registered: ${company.companyName} (${slug})`,
        ipAddress: req.ip || '', userAgent: req.headers['user-agent'] || '',
      });
    } catch { }

    res.status(201).json({
      success: true,
      message: 'Account created successfully! Welcome to OnlineSCADA.',
      data: {
        workspaceToken,
        userToken,
        company: { _id: company._id, companyName: company.companyName, slug: company.slug, plan: company.plan, limits: company.limits, trialEndsAt: company.trialEndsAt, logoUrl: company.logoUrl },
        user: { _id: adminUser._id, username: adminUser.username, email: adminUser.email, fullName: adminUser.fullName, role: adminUser.role, avatarColor: adminUser.avatarColor },
        edgeGateway: {
          _id: gateway._id, name: gateway.name, apiKey: rawKey, apiKeyPrefix: gateway.apiKeyPrefix, status: gateway.status,
          message: 'Save this API key securely. It will not be shown again. Download your gateway config from Settings -> Edge Gateways.',
        },
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(409).json({ success: false, message: `A company with this ${field} already exists`, code: 'DUPLICATE' });
    }
    res.status(500).json({ success: false, message: 'Server error during registration', error: error.message });
  }
};

const verifyWorkspace = async (req, res) => {
  try {
    const { slug, adminEmail, adminPassword } = req.body;
    if (!slug || !adminEmail || !adminPassword) return res.status(400).json({ success: false, message: 'Please provide workspace, email, and password', code: 'MISSING_FIELDS' });

    const company = await Company.findOne({ slug: slug.toLowerCase().trim() });
    if (!company) return res.status(404).json({ success: false, message: 'Workspace not found. Contact your administrator.', code: 'WORKSPACE_NOT_FOUND' });
    if (!company.isActive) return res.status(403).json({ success: false, message: 'Workspace is inactive. Contact support.', code: 'WORKSPACE_INACTIVE' });
    if (company.isSuspended) return res.status(403).json({ success: false, message: `Workspace suspended: ${company.suspensionReason || 'Contact support'}`, code: 'WORKSPACE_SUSPENDED' });
    if (company.isExpired()) return res.status(403).json({ success: false, message: 'Workspace subscription has expired. Please renew.', code: 'WORKSPACE_EXPIRED' });

    const admin = await User.findOne({ companyId: company._id, email: adminEmail.toLowerCase().trim(), role: 'admin', isActive: true }).select('+password');
    if (!admin) return res.status(401).json({ success: false, message: 'Invalid workspace credentials', code: 'INVALID_CREDENTIALS' });

    const passwordMatch = await admin.comparePassword(adminPassword);
    if (!passwordMatch) return res.status(401).json({ success: false, message: 'Invalid workspace credentials', code: 'INVALID_CREDENTIALS' });

    company.lastActivityAt = new Date();
    await company.save();

    const users = await User.find({ companyId: company._id, isActive: true }).select('username email fullName role avatarColor lastLogin').sort({ role: 1, fullName: 1 });
    const workspaceToken = generateWorkspaceToken(company._id, company.slug);

    res.json({
      success: true, message: 'Workspace verified successfully',
      data: {
        workspaceToken,
        company: { _id: company._id, companyName: company.companyName, slug: company.slug, plan: company.plan, logoUrl: company.logoUrl, trialEndsAt: company.trialEndsAt },
        users: users.map(u => ({ _id: u._id, username: u.username, email: u.email, fullName: u.fullName || u.username, role: u.role, avatarColor: u.avatarColor, lastLogin: u.lastLogin })),
      },
    });
  } catch (error) { res.status(500).json({ success: false, message: 'Server error', error: error.message }); }
};

const loginUser = async (req, res) => {
  try {
    const { userId, password } = req.body;
    if (!userId || !password) return res.status(400).json({ success: false, message: 'Please provide user and password', code: 'MISSING_FIELDS' });

    const companyId = req.companyId;
    if (!companyId) return res.status(401).json({ success: false, message: 'Workspace session invalid. Please start over.', code: 'WORKSPACE_TOKEN_MISSING' });

    const user = await User.findOne({ _id: userId, companyId, isActive: true }).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found in this workspace', code: 'USER_NOT_FOUND' });

    const passwordMatch = await user.comparePassword(password);
    if (!passwordMatch) return res.status(401).json({ success: false, message: 'Invalid password', code: 'INVALID_PASSWORD' });

    user.lastLogin = new Date();
    await user.save();
    const userToken = generateUserToken(user._id, companyId, user.role);

    res.json({
      success: true, message: 'Login successful',
      data: {
        userToken,
        user: { _id: user._id, username: user.username, email: user.email, fullName: user.fullName || user.username, role: user.role, permissions: user.permissions, avatarColor: user.avatarColor, lastLogin: user.lastLogin },
      },
    });
  } catch (error) { res.status(500).json({ success: false, message: 'Server error', error: error.message }); }
};

const getWorkspaceUsers = async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(401).json({ success: false, message: 'Workspace session invalid', code: 'WORKSPACE_TOKEN_MISSING' });
    const users = await User.find({ companyId, isActive: true }).select('username email fullName role avatarColor lastLogin').sort({ role: 1, fullName: 1 });
    res.json({ success: true, data: users.map(u => ({ _id: u._id, username: u.username, email: u.email, fullName: u.fullName || u.username, role: u.role, avatarColor: u.avatarColor, lastLogin: u.lastLogin })) });
  } catch (error) { res.status(500).json({ success: false, message: 'Server error', error: error.message }); }
};

const getMe = async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        user: { _id: req.user._id, username: req.user.username, email: req.user.email, fullName: req.user.fullName || req.user.username, role: req.user.role, permissions: req.user.permissions, avatarColor: req.user.avatarColor, lastLogin: req.user.lastLogin },
        company: { _id: req.company._id, companyName: req.company.companyName, slug: req.company.slug, plan: req.company.plan, limits: req.company.limits, logoUrl: req.company.logoUrl, trialEndsAt: req.company.trialEndsAt },
      },
    });
  } catch (error) { res.status(500).json({ success: false, message: 'Server error', error: error.message }); }
};

const logoutUser = async (req, res) => {
  res.json({ success: true, message: 'User logged out' });
};

const logoutAll = async (req, res) => {
  res.json({ success: true, message: 'Logged out completely' });
};

module.exports = { registerCompany, verifyWorkspace, loginUser, getWorkspaceUsers, getMe, logoutUser, logoutAll };