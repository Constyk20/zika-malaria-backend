const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient');
const auth = require('../middleware/auth');

// Create patient (after prediction)
router.post('/', auth, async (req, res) => {
  try {
    const patient = new Patient(req.body);
    await patient.save();
    res.json(patient);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Get all patients
router.get('/', auth, async (req, res) => {
  try {
    const patients = await Patient.find().sort({ dateReported: -1 });
    res.json(patients);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;