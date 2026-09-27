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

const generateWorkspaceToken = (companyId, companySlug) => jwt.sign({ type: 'workspace', companyId, companySlug }, process.env.JWT_SECRET, { expiresIn: '8h' });
const generateUserToken = (userId, companyId, role) => jwt.sign({ type: 'user', userId, companyId, role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '2h' });

const generateSlug = (companyName) => companyName.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').substring(0, 25);

const registerCompany = async (req, res) => {
  try {
    const { companyName, contactName, email, password } = req.body;

    if (!companyName || !contactName || !email || !password) return res.status(400).json({ success: false, message: 'Please provide company name, your name, email, and password', code: 'MISSING_FIELDS' });
    if (password.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters', code: 'WEAK_PASSWORD' });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ success: false, message: 'Please provide a valid email address', code: 'INVALID_EMAIL' });

    if (await User.findOne({ email: email.toLowerCase().trim() })) return res.status(409).json({ success: false, message: 'An account with this email already exists. Try logging in.', code: 'EMAIL_EXISTS' });

    let slug = generateSlug(companyName);
    if (slug.length < 3) slug = 'company-' + slug;
    let slugCandidate = slug; let suffix = 1;
    while (await Company.findOne({ slug: slugCandidate })) {
      slugCandidate = `${slug}-${suffix}`; suffix++;
      if (suffix > 99) { slugCandidate = `${slug}-${crypto.randomBytes(2).toString('hex')}`; break; }
    }

    const company = await Company.create({ companyName: companyName.trim(), slug: slugCandidate, contactEmail: email.toLowerCase().trim(), contactName: contactName.trim(), plan: 'trial', timezone: 'Asia/Kolkata', country: 'India' });

    const adminUser = await User.create({ companyId: company._id, username: contactName.trim().split(' ')[0].toLowerCase(), email: email.toLowerCase().trim(), password, fullName: contactName.trim(), role: 'admin', avatarColor: '#2563EB' });

    await Settings.create({ companyId: company._id, system: { systemName: 'OnlineSCADA', companyName: company.companyName } });

    // ─── Create Edge Gateway (NO DEMO PLC CREATED) ─────────────
    const { rawKey, hash, prefix } = EdgeGateway.generateApiKey();
    const gateway = await EdgeGateway.create({ companyId: company._id, name: 'Factory Connector', apiKeyHash: hash, apiKeyPrefix: prefix, status: 'never_connected' });

    try { await Lead.create({ companyName: company.companyName, contactName: contactName.trim(), email: email.toLowerCase().trim(), source: 'self-signup', status: 'trial', notes: `Self-service trial signup. Workspace: ${slugCandidate}.`, companyId: company._id }); } catch (e) { }

    const workspaceToken = generateWorkspaceToken(company._id, company.slug);
    const userToken = generateUserToken(adminUser._id, company._id, 'admin');

    try { await logActivity({ companyId: company._id, username: adminUser.username, userRole: 'admin', userId: adminUser._id, action: 'COMPANY_REGISTERED', description: `New trial company registered: ${company.companyName}`, ipAddress: req.ip || '', userAgent: req.headers['user-agent'] || '' }); } catch (e) { }

    res.status(201).json({
      success: true, message: 'Account created successfully! Welcome to OnlineSCADA.',
      data: {
        workspaceToken, userToken,
        company: { _id: company._id, companyName: company.companyName, slug: company.slug, plan: company.plan, limits: company.limits, trialEndsAt: company.trialEndsAt, logoUrl: company.logoUrl },
        user: { _id: adminUser._id, username: adminUser.username, email: adminUser.email, fullName: adminUser.fullName, role: adminUser.role, avatarColor: adminUser.avatarColor },
        edgeGateway: { _id: gateway._id, name: gateway.name, apiKey: rawKey, apiKeyPrefix: gateway.apiKeyPrefix, status: gateway.status, message: 'Save this API key securely. It will not be shown again.' },
      },
    });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: `A company with this ${Object.keys(error.keyPattern)[0]} already exists`, code: 'DUPLICATE' });
    res.status(500).json({ success: false, message: 'Server error during registration', error: error.message });
  }
};

const verifyWorkspace = async (req, res) => { /* Omitted for brevity: Use exact existing implementation */ };
const loginUser = async (req, res) => { /* Omitted for brevity: Use exact existing implementation */ };
const getWorkspaceUsers = async (req, res) => { /* Omitted for brevity: Use exact existing implementation */ };
const getMe = async (req, res) => { /* Omitted for brevity: Use exact existing implementation */ };
const logoutUser = async (req, res) => { res.json({ success: true, message: 'User logged out' }); };
const logoutAll = async (req, res) => { res.json({ success: true, message: 'Logged out completely' }); };

// Ensure you don't overwrite your working auth functions, just replace the registerCompany function!
module.exports = { registerCompany, verifyWorkspace, loginUser, getWorkspaceUsers, getMe, logoutUser, logoutAll };