// ═══════════════════════════════════════════════════════════
// Signup Controller — Self-Service Free Trial Workspace Creation
//
// Endpoints:
//   POST /api/signup/manual — Manual form signup
//   POST /api/signup/google — Google OAuth ID Token signup
//
// Auto-Creates per signup:
//   1. Company (slug, trial plan, 14-day expiry)
//   2. Admin User
//   3. Default Settings
//   4. Simulation PLC + 5 live demo tags (instant interactivity)
//   5. Lead record for SuperAdmin tracking
//   6. Returns workspaceToken + userToken (instant login)
// ═══════════════════════════════════════════════════════════

const jwt           = require('jsonwebtoken');
const axios         = require('axios');
const Company       = require('../models/Company');
const User          = require('../models/User');
const Settings      = require('../models/Settings');
const PLCConnection = require('../models/PLCConnection');
const Tag           = require('../models/Tag');
const Lead          = require('../models/Lead');
const { logActivity } = require('./reportController');

// ─── Token Generators ─────────────────────────────────────
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

// ─── Slug Generator (User Friendly) ───────────────────────
const generateUniqueSlug = async (companyName) => {
  let baseSlug = companyName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 24);

  if (!baseSlug || baseSlug.length < 3) baseSlug = 'workspace';

  let candidateSlug = baseSlug;
  let counter = 1;

  while (await Company.findOne({ slug: candidateSlug })) {
    candidateSlug = `${baseSlug}-${counter}`;
    counter++;
  }

  return candidateSlug;
};

// ─── Helper: Auto-provision Demo PLC & Tags ──────────────
const provisionDemoWorkspaceData = async (companyId) => {
  try {
    const simPLC = await PLCConnection.create({
      companyId,
      name: 'Demo Simulation PLC',
      description: 'Auto-generated trial simulation PLC with live tags',
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
      { tagName: 'SIM_TEMPERATURE', dataType: 'REAL', unit: '°C', minValue: 20, maxValue: 80,   simulationPattern: 'sine',    description: 'Boiler temperature' },
      { tagName: 'SIM_PRESSURE',    dataType: 'REAL', unit: 'bar', minValue: 0,  maxValue: 10,   simulationPattern: 'walk',    description: 'Line pressure' },
      { tagName: 'SIM_LEVEL',       dataType: 'REAL', unit: '%',   minValue: 0,  maxValue: 100,  simulationPattern: 'ramp',    description: 'Tank level' },
      { tagName: 'SIM_MOTOR_RUN',   dataType: 'BOOL', unit: '',    minValue: 0,  maxValue: 1,    simulationPattern: 'toggle',  description: 'Motor running status' },
      { tagName: 'SIM_COUNTER',     dataType: 'INT',  unit: '',    minValue: 0,  maxValue: 9999, simulationPattern: 'counter', description: 'Production counter' },
    ];

    for (const tagData of demoTags) {
      await Tag.create({
        ...tagData,
        companyId,
        plcConnection: simPLC._id,
        isSimulationTag: true,
        enableLogging: true,
        currentValue: 0,
        quality: 'GOOD',
        group: 'Simulation',
      });
    }

    console.log(`✨ Provisioned Demo PLC & 5 tags for Company: ${companyId}`);
  } catch (err) {
    console.warn('⚠️ Demo workspace provisioning warning:', err.message);
  }
};

// ═══════════════════════════════════════════════════════════
// 1. MANUAL SIGNUP
// Body: { companyName, fullName, email, password }
// ═══════════════════════════════════════════════════════════
const manualSignup = async (req, res) => {
  try {
    const { companyName, fullName, email, password } = req.body;

    if (!companyName || !fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide company name, full name, email, and password',
        code: 'MISSING_FIELDS',
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long',
        code: 'WEAK_PASSWORD',
      });
    }

    // Generate user-friendly slug
    const slug = await generateUniqueSlug(companyName);

    // 1. Create Company (Trial Plan)
    const company = await Company.create({
      companyName: companyName.trim(),
      slug,
      contactEmail: cleanEmail,
      contactName: fullName.trim(),
      plan: 'trial',
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14-day trial
    });

    // 2. Create Admin User
    const username = cleanEmail.split('@')[0].replace(/[^a-z0-9]/g, '') || 'admin';
    const user = await User.create({
      companyId: company._id,
      username,
      email: cleanEmail,
      password,
      fullName: fullName.trim(),
      role: 'admin',
      avatarColor: '#2563EB',
    });

    // 3. Create Default Settings
    await Settings.create({
      companyId: company._id,
      system: { systemName: 'OnlineSCADA', companyName: company.companyName },
    });

    // 4. Auto-provision Simulation PLC & Demo Tags
    await provisionDemoWorkspaceData(company._id);

    // 5. Track Lead in SuperAdmin
    try {
      await Lead.create({
        companyName: company.companyName,
        contactName: user.fullName,
        email: user.email,
        source: 'self_service_signup',
        planInterest: 'trial',
        status: 'converted',
        convertedCompanyId: company._id,
        convertedAt: new Date(),
        ipAddress: req.ip || '',
        userAgent: req.headers['user-agent'] || '',
      });
    } catch {}

    // 6. Log Activity
    try {
      await logActivity({
        companyId: company._id,
        username: user.username,
        userRole: user.role,
        userId: user._id,
        action: 'WORKSPACE_LOGIN',
        description: `Self-service workspace registered: ${company.slug}`,
        ipAddress: req.ip || '',
        userAgent: req.headers['user-agent'] || '',
      });
    } catch {}

    // 7. Generate Tokens
    const workspaceToken = generateWorkspaceToken(company._id, company.slug);
    const userToken = generateUserToken(user._id, company._id, user.role);

    res.status(201).json({
      success: true,
      message: 'Workspace created successfully! Starting free trial...',
      data: {
        workspaceToken,
        userToken,
        company: {
          _id: company._id,
          companyName: company.companyName,
          slug: company.slug,
          plan: company.plan,
          trialEndsAt: company.trialEndsAt,
        },
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          permissions: user.permissions,
          avatarColor: user.avatarColor,
        },
      },
    });

  } catch (error) {
    console.error('❌ Manual Signup Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create workspace. Please try again.',
      error: error.message,
    });
  }
};

// ═══════════════════════════════════════════════════════════
// 2. GOOGLE OAUTH SIGNUP
// Body: { credential } (Google ID Token from frontend)
// ═══════════════════════════════════════════════════════════
const googleSignup = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: 'Google credential token is required',
        code: 'MISSING_CREDENTIAL',
      });
    }

    // Verify token with Google API directly (zero external npm dependency)
    let googleUser;
    try {
      const googleRes = await axios.get(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`
      );
      googleUser = googleRes.data;
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Google authentication token',
        code: 'INVALID_GOOGLE_TOKEN',
      });
    }

    const { email, name, picture, sub: googleId } = googleUser;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Google profile did not return an email address',
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if user already exists in any company
    let user = await User.findOne({ email: cleanEmail });
    let company;

    if (user) {
      // Existing user — log them in directly!
      company = await Company.findById(user.companyId);
      if (!company || !company.canAccess()) {
        return res.status(403).json({
          success: false,
          message: 'Associated workspace is inactive or suspended',
        });
      }
    } else {
      // New user — create company & admin user!
      const companyName = `${name}'s Workspace`;
      const slug = await generateUniqueSlug(companyName);

      company = await Company.create({
        companyName,
        slug,
        contactEmail: cleanEmail,
        contactName: name || email.split('@')[0],
        plan: 'trial',
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      });

      const username = cleanEmail.split('@')[0].replace(/[^a-z0-9]/g, '') || 'admin';
      // Create random strong password for DB requirement
      const randomPass = `G_${Math.random().toString(36).slice(-10)}!2026`;

      user = await User.create({
        companyId: company._id,
        username,
        email: cleanEmail,
        password: randomPass,
        fullName: name || username,
        role: 'admin',
        avatarColor: '#2563EB',
      });

      await Settings.create({
        companyId: company._id,
        system: { systemName: 'OnlineSCADA', companyName: company.companyName },
      });

      await provisionDemoWorkspaceData(company._id);

      // Track Lead
      try {
        await Lead.create({
          companyName: company.companyName,
          contactName: user.fullName,
          email: user.email,
          source: 'google_oauth_signup',
          planInterest: 'trial',
          status: 'converted',
          convertedCompanyId: company._id,
          convertedAt: new Date(),
          ipAddress: req.ip || '',
          userAgent: req.headers['user-agent'] || '',
        });
      } catch {}
    }

    user.lastLogin = new Date();
    await user.save();

    const workspaceToken = generateWorkspaceToken(company._id, company.slug);
    const userToken = generateUserToken(user._id, company._id, user.role);

    res.status(200).json({
      success: true,
      message: 'Google authentication successful',
      data: {
        workspaceToken,
        userToken,
        company: {
          _id: company._id,
          companyName: company.companyName,
          slug: company.slug,
          plan: company.plan,
          trialEndsAt: company.trialEndsAt,
        },
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          permissions: user.permissions,
          avatarColor: user.avatarColor,
        },
      },
    });

  } catch (error) {
    console.error('❌ Google Signup Error:', error);
    res.status(500).json({
      success: false,
      message: 'Google signup failed. Please try manual signup.',
      error: error.message,
    });
  }
};

module.exports = {
  manualSignup,
  googleSignup,
};