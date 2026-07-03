const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  reward: {
    type: Number,
    required: true,
    min: 0
  },
  deadline: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Task', TaskSchema);
