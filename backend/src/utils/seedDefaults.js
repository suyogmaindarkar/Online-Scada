// ═══════════════════════════════════════════════════════════
// Seed Defaults — Creates Super Admin + Demo Company
//
// Runs automatically on first server boot (if no super admin exists)
// OR manually via migration script
//
// Phase A Update: Now also creates a default Edge Gateway
//                 with API key for the demo company
// ═══════════════════════════════════════════════════════════

const Company = require('../models/Company');
const SuperAdmin = require('../models/SuperAdmin');
const User = require('../models/User');
const Settings = require('../models/Settings');
const PLCConnection = require('../models/PLCConnection');
const Tag = require('../models/Tag');
const EdgeGateway = require('../models/EdgeGateway');

// ═══════════════════════════════════════════════════════════
// SEED SUPER ADMIN (you — Suyog)
// ═══════════════════════════════════════════════════════════
async function seedSuperAdmin() {
  const existing = await SuperAdmin.findOne({ email: 'suyog@onlinescada.in' });
  if (existing) {
    console.log('ℹ️  Super Admin already exists — skipping');
    return existing;
  }

  const superAdmin = await SuperAdmin.create({
    username: 'suyog',
    email: 'suyog@onlinescada.in',
    password: 'ChangeMe@2026',    // ⚠️ CHANGE THIS IMMEDIATELY AFTER FIRST LOGIN
    fullName: 'Suyog Maindarkar',
  });

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║   👑 SUPER ADMIN CREATED                        ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log('║   Email:    suyog@onlinescada.in                ║');
  console.log('║   Password: ChangeMe@2026                       ║');
  console.log('║   URL:      /super-admin/login                  ║');
  console.log('║                                                  ║');
  console.log('║   ⚠️  CHANGE PASSWORD IMMEDIATELY!              ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  return superAdmin;
}

// ═══════════════════════════════════════════════════════════
// SEED DEMO COMPANY (for testing)
// Creates workspace "demo" with 4 users (one per role)
// Phase A: Now also creates Edge Gateway + API Key
// ═══════════════════════════════════════════════════════════
async function seedDemoCompany(superAdmin) {
  const existing = await Company.findOne({ slug: 'demo' });
  if (existing) {
    console.log('ℹ️  Demo Company already exists — skipping');
    return existing;
  }

  // ─── 1. Create demo company ───────────────────────────
  const company = await Company.create({
    companyName: 'OnlineSCADA Demo Corp',
    slug: 'demo',
    contactEmail: 'demo@onlinescada.in',
    contactName: 'Demo Administrator',
    plan: 'pro',
    timezone: 'Asia/Kolkata',
    country: 'India',
    createdBy: superAdmin._id,
  });

  // ─── 2. Create 4 demo users (one per role) ────────────
  const users = [
    { username: 'admin', email: 'admin@demo.com', password: 'admin123', fullName: 'Demo Admin', role: 'admin', avatarColor: '#2563EB' },
    { username: 'engineer', email: 'engineer@demo.com', password: 'engineer123', fullName: 'Demo Engineer', role: 'engineer', avatarColor: '#16A34A' },
    { username: 'operator', email: 'operator@demo.com', password: 'operator123', fullName: 'Demo Operator', role: 'operator', avatarColor: '#F59E0B' },
    { username: 'viewer', email: 'viewer@demo.com', password: 'viewer123', fullName: 'Demo Viewer', role: 'viewer', avatarColor: '#9333EA' },
  ];

  for (const userData of users) {
    await User.create({
      ...userData,
      companyId: company._id,
    });
  }

  // ─── 3. Create default settings ───────────────────────
  await Settings.create({
    companyId: company._id,
    system: {
      systemName: 'OnlineSCADA',
      companyName: company.companyName,
    },
  });

  // ─── 4. Create a demo Simulation PLC with 5 tags ──────
  const simPLC = await PLCConnection.create({
    companyId: company._id,
    name: 'Demo Simulation PLC',
    description: 'Auto-generated simulation with 5 demo tags',
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
    { tagName: 'SIM_TEMPERATURE', dataType: 'REAL', unit: '°C', minValue: 20, maxValue: 80, simulationPattern: 'sine' },
    { tagName: 'SIM_PRESSURE', dataType: 'REAL', unit: 'bar', minValue: 0, maxValue: 10, simulationPattern: 'walk' },
    { tagName: 'SIM_LEVEL', dataType: 'REAL', unit: '%', minValue: 0, maxValue: 100, simulationPattern: 'ramp' },
    { tagName: 'SIM_MOTOR_RUN', dataType: 'BOOL', unit: '', minValue: 0, maxValue: 1, simulationPattern: 'toggle' },
    { tagName: 'SIM_COUNTER', dataType: 'INT', unit: '', minValue: 0, maxValue: 9999, simulationPattern: 'counter' },
  ];

  for (const tagData of demoTags) {
    await Tag.create({
      ...tagData,
      companyId: company._id,
      plcConnection: simPLC._id,
      isSimulationTag: true,
      currentValue: 0,
      quality: 'GOOD',
    });
  }

  // ─── 5. Create Edge Gateway + API Key ⭐ (Phase A) ────
  const { rawKey, hash, prefix } = EdgeGateway.generateApiKey();

  await EdgeGateway.create({
    companyId: company._id,
    name: 'Demo Factory Gateway',
    apiKeyHash: hash,
    apiKeyPrefix: prefix,
    status: 'never_connected',
  });

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║   🏢 DEMO COMPANY CREATED                       ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log('║   Workspace: demo                                ║');
  console.log('║   URL:       /login                              ║');
  console.log('║                                                  ║');
  console.log('║   Test Users (Workspace = "demo"):              ║');
  console.log('║   ┌────────────┬──────────────────┬───────────┐ ║');
  console.log('║   │ Role       │ Email            │ Password  │ ║');
  console.log('║   ├────────────┼──────────────────┼───────────┤ ║');
  console.log('║   │ admin      │ admin@demo.com   │ admin123  │ ║');
  console.log('║   │ engineer   │ engineer@demo.com│ engineer.. │ ║');
  console.log('║   │ operator   │ operator@demo.com│ operator..│ ║');
  console.log('║   │ viewer     │ viewer@demo.com  │ viewer123 │ ║');
  console.log('║   └────────────┴──────────────────┴───────────┘ ║');
  console.log('║                                                  ║');
  console.log('║   Bonus: 1 Simulation PLC + 5 demo tags         ║');
  console.log(`║   Edge Gateway Key: ${prefix}...          ║`);
  console.log('╚══════════════════════════════════════════════════╝\n');

  return company;
}

// ═══════════════════════════════════════════════════════════
// MAIN SEED FUNCTION (called from migration or server boot)
// ═══════════════════════════════════════════════════════════
async function seedDefaults() {
  try {
    const superAdmin = await seedSuperAdmin();
    await seedDemoCompany(superAdmin);
    return true;
  } catch (err) {
    console.error('❌ Seed error:', err.message);
    console.error(err.stack);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════
// AUTO-SEED ON SERVER BOOT (if no super admin exists)
// ═══════════════════════════════════════════════════════════
async function autoSeedIfEmpty() {
  try {
    const superAdminCount = await SuperAdmin.countDocuments();
    if (superAdminCount === 0) {
      console.log('\n🌱 No super admin found — running first-time seed...\n');
      await seedDefaults();
    }
  } catch (err) {
    console.warn('⚠️  Auto-seed check failed:', err.message);
  }
}

module.exports = {
  seedDefaults,
  seedSuperAdmin,
  seedDemoCompany,
  autoSeedIfEmpty,
};