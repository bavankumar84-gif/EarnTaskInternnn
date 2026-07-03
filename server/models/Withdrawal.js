const mongoose = require('mongoose');

const WithdrawalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 100
  },
  phone: {
    type: String,
    required: true
  },
  upi: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected', 'Processed'],
    default: 'Pending'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Withdrawal', WithdrawalSchema);
