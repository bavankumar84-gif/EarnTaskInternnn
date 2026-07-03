const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/earntask');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Database connection error: ${error.message}`);
    console.log('Server is running, but database connection failed. Please ensure MongoDB is running or specify MONGO_URI in .env');
  }
};

module.exports = connectDB;
