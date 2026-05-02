const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // These options are for older mongoose versions, remove if not needed
      // useNewUrlParser: true,
      // useUnifiedTopology: true,
    });
    
    console.log(`✅ MongoDB Atlas Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected');
    });
    
    return conn;
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB Atlas:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;