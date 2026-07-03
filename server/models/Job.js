const mongoose = require('mongoose');

const JobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  pricePerTask: {
    type: Number,
    required: true,
    min: 0
  },
  slots: {
    type: Number,
    required: true,
    min: 1
  },
  slotsAvailable: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['Open', 'Closed'],
    default: 'Open'
  },
  youtubeLink: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Job', JobSchema);
