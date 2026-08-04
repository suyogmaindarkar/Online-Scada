const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    
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