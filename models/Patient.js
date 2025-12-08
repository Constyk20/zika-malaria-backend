const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
  patientId: String,
  age: Number,
  sex: String,
  residence: String,
  dateReported: Date
});

module.exports = mongoose.model('Patient', patientSchema);