// routes/zika.js - Clinical AI (using real sklearn package)
const express = require('express');
const sklearn = require('sklearn');
const auth = require('../middleware/auth');
const Patient = require('../models/Patient');
const ClinicalRecord = require('../models/ClinicalRecord');

const router = express.Router();

// Load your ABSUTH model
const model = sklearn.load('./models/ABSUTH_early_detection_model.pkl');

router.post('/predict', auth, async (req, res) => {
  try {
    const { age, sex, travel_history } = req.body;

    const is_female = sex.toUpperCase() === 'F' ? 1 : 0;
    const has_travel = /yes|lagos|abuja|travel/i.test(travel_history || '') ? 1 : 0;

    const features = [[age, is_female, has_travel]];
    
    // Run prediction
    const risk = model.predict(features)[0];
    const probability = model.predict_proba(features)[0][1];

    const prediction = {
      risk_level: risk === 1 ? "HIGH - Urgent Testing Required" : "LOW - Monitor Symptoms",
      risk_probability: Number(probability.toFixed(4)),
      recommendation: risk === 1
        ? "Refer for immediate Malaria & Zika lab tests"
        : "Continue mosquito prevention"
    };

    res.json({ success: true, prediction });
  } catch (error) {
    console.error("Clinical AI error:", error);
    res.status(500).json({ success: false, message: "Prediction failed" });
  }
});

module.exports = router;