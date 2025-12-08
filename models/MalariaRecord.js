// models/MalariaRecord.js
const mongoose = require('mongoose');

const MalariaRecordSchema = new mongoose.Schema({
  detectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  result: {
    type: String,
    enum: ['Parasitized', 'Uninfected'],
    required: true
  },
  confidence: {
    type: Number,
    required: true
  },
  parasiteProbability: {
    type: Number,
    required: true
  },
  recommendation: {
    type: String,
    required: true
  },
  imageSize: Number,
  imageName: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('MalariaRecord', MalariaRecordSchema);