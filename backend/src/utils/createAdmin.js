const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config();

const createDefaultAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Get User model
    const User = require('../models/User');

    // Check if admin already exists
    const adminExists = await User.findOne({ role: 'admin' });

    if (adminExists) {
      console.log('⚠️  Admin user already exists');
      console.log(`   Username: ${adminExists.username}`);
      console.log(`   Email: ${adminExists.email}`);
      await mongoose.disconnect();
      process.exit(0);
    }

    // Manually hash password (bypass pre-save hook issue)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);

    // Create admin directly with insertOne (bypasses pre-save)
    const admin = new User({
      username: 'admin',
      email: 'admin@webscada.com',
      password: hashedPassword,
      role: 'admin',
      permissions: {
        canDesign: true,
        canManageTags: true,
        canControlPLC: true,
        canViewRuntime: true,
        canManageUsers: true,
      },
    });

    // Save without triggering pre-save (since we already hashed)
    await User.collection.insertOne({
      username: admin.username,
      email: admin.email,
      password: admin.password,
      role: admin.role,
      permissions: admin.permissions,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log('========================================');
    console.log('✅ Default Admin Created Successfully!');
    console.log('========================================');
    console.log(`Username: admin`);
    console.log(`Password: admin123`);
    console.log(`Email:    admin@webscada.com`);
    console.log(`Role:     admin`);
    console.log('========================================');
    console.log('⚠️  CHANGE PASSWORD AFTER FIRST LOGIN!');
    console.log('========================================');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
};

createDefaultAdmin();