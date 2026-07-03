const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  picture: {
    type: String
  },
  googleId: {
    type: String,
    required: true,
    unique: true
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  phone: {
    type: String,
    default: ''
  },
  upiId: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', UserSchema);
