const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // ✅ Support BOTH names for backward compat
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

    if (!uri) {
      throw new Error('MONGODB_URI (or MONGO_URI) not defined in .env file');
    }

    const conn = await mongoose.connect(uri);

    console.log('========================================');
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📦 Database Name: ${conn.connection.name}`);
    console.log('========================================');
  } catch (error) {
    console.log('❌ MongoDB Connection Failed:');
    console.log(error.message);
    process.exit(1);
  }
};

module.exports = connectDB;