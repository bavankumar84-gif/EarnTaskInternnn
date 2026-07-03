const mongoose = require('mongoose');

const EnrollmentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending'
  }
}, {
  timestamps: true
});

// Ensure a user can only enroll in a job once
EnrollmentSchema.index({ userId: 1, jobId: 1 }, { unique: true });

module.exports = mongoose.model('Enrollment', EnrollmentSchema);
