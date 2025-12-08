const mongoose = require('mongoose');

const recordSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
  age: Number,
  sex: String,
  travelHistory: String,
  prediction: {
    riskLevel: String,
    probability: Number,
    recommendation: String
  },
  predictedAt: { type: Date, default: Date.now },
  predictedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

module.exports = mongoose.model('ClinicalRecord', recordSchema);