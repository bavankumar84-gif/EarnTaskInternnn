const mongoose = require('mongoose');

const dbCheck = (req, res, next) => {
  // mongoose.connection.readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      message: 'Database is currently offline. Please ensure MongoDB is running (locally or on Atlas) and connected.'
    });
  }
  next();
};

module.exports = dbCheck;
