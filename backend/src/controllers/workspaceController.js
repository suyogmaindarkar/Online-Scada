// ═══════════════════════════════════════════════════════════
// Workspace Controller — Clean Signup (No Auto-Demo PLC)
// ═══════════════════════════════════════════════════════════

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Company = require('../models/Company');
const User = require('../models/User');
const Settings = require('../models/Settings');
const EdgeGateway = require('../models/EdgeGateway');

const generateWorkspaceToken = (companyId, companySlug) => jwt.sign({ type: 'workspace', companyId, companySlug }, process.env.JWT_SECRET, { expiresIn: '8h' });
const generateUserToken = (userId, companyId, role) => jwt.sign({ type: 'user', userId, companyId, role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '2h' });

const registerCompany = async (req, res) => {
  try {
    const { companyName, contactName, email, password } = req.body;
    if (!companyName || !email || !password) return res.status(400).json({ success: false, message: 'Missing fields' });

    if (await User.findOne({ email: email.toLowerCase().trim() })) {
      return res.status(409).json({ success: false, message: 'Account exists.' });
    }

    let slug = companyName.toLowerCase().trim().replace(/[^a-z0-9]/g, '').substring(0, 15) + '-' + crypto.randomBytes(2).toString('hex');
    const company = await Company.create({ companyName: companyName.trim(), slug, contactEmail: email.toLowerCase().trim(), contactName: contactName.trim(), plan: 'trial' });
    const adminUser = await User.create({ companyId: company._id, username: contactName.trim().split(' ')[0].toLowerCase(), email: email.toLowerCase().trim(), password, fullName: contactName.trim(), role: 'admin', avatarColor: '#2563EB' });
    await Settings.create({ companyId: company._id, system: { systemName: 'OnlineSCADA' } });

    // ONLY create Edge Gateway Profile - NO PLCs
    const { rawKey, hash, prefix } = EdgeGateway.generateApiKey();
    const gateway = await EdgeGateway.create({ companyId: company._id, name: 'Factory Connector', apiKeyHash: hash, apiKeyPrefix: prefix, status: 'never_connected' });

    res.status(201).json({
      success: true, message: 'Account created successfully!',
      data: {
        workspaceToken: generateWorkspaceToken(company._id, company.slug),
        userToken: generateUserToken(adminUser._id, company._id, 'admin'),
        company: { _id: company._id, companyName: company.companyName, slug: company.slug },
        user: { _id: adminUser._id, username: adminUser.username, role: adminUser.role },
        edgeGateway: { apiKey: rawKey }
      }
    });
  } catch (error) { res.status(500).json({ success: false, message: 'Server error' }); }
};

const verifyWorkspace = async (req, res) => {
  try {
    const { slug, adminEmail, adminPassword } = req.body;
    const company = await Company.findOne({ slug: slug.toLowerCase().trim() });
    if (!company) return res.status(404).json({ success: false, message: 'Workspace not found.' });

    const admin = await User.findOne({ companyId: company._id, email: adminEmail.toLowerCase().trim(), role: 'admin', isActive: true }).select('+password');
    if (!admin || !(await admin.comparePassword(adminPassword))) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const users = await User.find({ companyId: company._id, isActive: true }).select('username email fullName role avatarColor');
    res.json({ success: true, data: { workspaceToken: generateWorkspaceToken(company._id, company.slug), company, users } });
  } catch (error) { res.status(500).json({ success: false }); }
};

const loginUser = async (req, res) => {
  try {
    const { userId, password } = req.body;
    const user = await User.findOne({ _id: userId, companyId: req.companyId, isActive: true }).select('+password');
    if (!user || !(await user.comparePassword(password))) return res.status(401).json({ success: false, message: 'Invalid password' });
    res.json({ success: true, data: { userToken: generateUserToken(user._id, req.companyId, user.role), user } });
  } catch (error) { res.status(500).json({ success: false }); }
};

const getWorkspaceUsers = async (req, res) => {
  try { res.json({ success: true, data: await User.find({ companyId: req.companyId, isActive: true }).select('username fullName role avatarColor') }); } catch (error) { res.status(500).json({ success: false }); }
};

const getMe = async (req, res) => res.json({ success: true, data: { user: req.user, company: req.company } });
const logoutUser = async (req, res) => res.json({ success: true, message: 'User logged out' });
const logoutAll = async (req, res) => res.json({ success: true, message: 'Logged out completely' });

module.exports = { registerCompany, verifyWorkspace, loginUser, getWorkspaceUsers, getMe, logoutUser, logoutAll };