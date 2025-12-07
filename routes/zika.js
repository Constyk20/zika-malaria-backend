const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/auth');
const ClinicalRecord = require('../models/ClinicalRecord');
const Patient = require('../models/Patient');

router.post('/predict', auth, async (req, res) => {
  try {
    const { patientId, age, sex, travel_history } = req.body;

    // Call your Python AI server
    const aiResponse = await axios.post(process.env.PYTHON_AI_URL, {
      age,
      sex,
      travel_history
    });

    const prediction = aiResponse.data.ai_prediction;

    // Save patient if not exists
    let patient = await Patient.findOne({ patientId });
    if (!patient) {
      patient = new Patient({ patientId, age, sex });
      await patient.save();
    }

    // Save prediction record
    const record = new ClinicalRecord({
      patient: patient._id,
      age,
      sex,
      travelHistory: travel_history,
      prediction,
      predictedBy: req.user.id
    });
    await record.save();

    res.json({
      success: true,
      prediction,
      patientId
    });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ success: false, message: 'AI server error' });
  }
});

module.exports = router;