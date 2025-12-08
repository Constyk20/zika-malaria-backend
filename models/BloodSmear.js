// models/BloodSmear.js
const mongoose = require('mongoose');

const bloodSmearSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
  imageUrl: String,
  parasiteDetected: Boolean,
  parasiteCount: Number,
  confidence: Number,
  modelVersion: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('BloodSmear', bloodSmearSchema);