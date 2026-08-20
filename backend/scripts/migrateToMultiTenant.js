// ═══════════════════════════════════════════════════════════
// Multi-Tenancy Migration Script
//
// ⚠️  DESTRUCTIVE — DELETES ALL EXISTING DATA
//
// Usage:
//   cd backend
//   node scripts/migrateToMultiTenant.js
// ═══════════════════════════════════════════════════════════

// ✅ FIX: Load .env from parent directory (backend/.env)
// __dirname = C:\WebSCADA\backend\scripts
// path.resolve(__dirname, '..', '.env') = C:\WebSCADA\backend\.env
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

// Verify env vars loaded
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('\n❌ MONGODB_URI (or MONGO_URI) not found in .env file');
  console.error('   Expected location: ' + path.resolve(__dirname, '..', '.env'));
  process.exit(1);
}

const mongoose = require('mongoose');
const readline = require('readline');

const askConfirm = (question) => {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
};

const runMigration = async () => {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  ONLINESCADA — MULTI-TENANCY MIGRATION');
  console.log('══════════════════════════════════════════════════════\n');

  console.log('⚠️  This will DELETE ALL EXISTING DATA:');
  console.log('   • All users (including admin)');
  console.log('   • All PLCs, Tags, Screens, Alarms, Recipes');
  console.log('   • All settings, activity logs, alarm history');
  console.log('   • All screens, direct connections, popups\n');

  const answer = await askConfirm('Type "YES DELETE EVERYTHING" to proceed: ');
  if (answer !== 'yes delete everything') {
    console.log('\n❌ Migration cancelled. No changes made.\n');
    process.exit(0);
  }

  console.log('\n🔌 Connecting to MongoDB...');
  console.log('   URI:', process.env.MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')); // hide password in log
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected\n');

  const db = mongoose.connection.db;

  // ─── 1. Drop all collections ─────────────────────────
  const collectionsToDrop = [
    'users', 'companies', 'superadmins',
    'plcconnections', 'tags', 'graphics',
    'alarms', 'alarmhistories',
    'recipes', 'recipelogs',
    'settings', 'useractivitylogs',
  ];

  console.log('🗑️  Dropping old collections...');
  for (const coll of collectionsToDrop) {
    try {
      await db.dropCollection(coll);
      console.log(`   ✅ Dropped: ${coll}`);
    } catch (err) {
      if (err.code === 26) {
        console.log(`   ⏭️  Skipped (not found): ${coll}`);
      } else {
        console.log(`   ⚠️  Error dropping ${coll}: ${err.message}`);
      }
    }
  }

  console.log('\n📦 Loading models (creates fresh indexes)...');
  require('../src/models/Company');
  require('../src/models/SuperAdmin');
  require('../src/models/User');
  require('../src/models/PLCConnection');
  require('../src/models/Tag');
  require('../src/models/Graphic');
  require('../src/models/Alarm');
  require('../src/models/AlarmHistory');
  require('../src/models/Recipe');
  require('../src/models/RecipeLog');
  require('../src/models/Settings');
  require('../src/models/UserActivityLog');
  console.log('✅ Models loaded\n');

   // ─── 2. Run seed script ──────────────────────────────
  console.log('🌱 Running seed script (creates Super Admin + Demo Company)...\n');
  const { seedDefaults } = require('../src/utils/seedDefaults');
  const seedOk = await seedDefaults();

  if (!seedOk) {
    console.log('\n══════════════════════════════════════════════════════');
    console.log('❌ MIGRATION INCOMPLETE — seed failed');
    console.log('══════════════════════════════════════════════════════\n');
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log('\n══════════════════════════════════════════════════════');
  console.log('✅ MIGRATION COMPLETE');
  console.log('══════════════════════════════════════════════════════\n');
}; // <--- THIS CLOSING BRACE WAS MISSING

runMigration().catch((err) => {
  console.error('\n❌ Migration failed:', err.message);
  console.error(err.stack);
  process.exit(1);
}).finally(() => {
  // Ensure disconnect even if migration fails
  mongoose.disconnect();
});