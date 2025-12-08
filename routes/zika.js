const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/auth');
const ClinicalRecord = require('../models/ClinicalRecord');
const Patient = require('../models/Patient');

// Python AI Server URL (from environment variable)
const AI_SERVER_URL = process.env.PYTHON_AI_URL || 'https://zika-ai-engine.onrender.com';

// POST /api/zika/predict - Clinical Risk Prediction
router.post('/predict', auth, async (req, res) => {
  try {
    const { patientId, age, sex, travel_history } = req.body;

    // Validate input
    if (!age || !sex) {
      return res.status(400).json({
        success: false,
        message: 'Age and sex are required'
      });
    }

    console.log('📤 Calling Python AI server:', AI_SERVER_URL);
    console.log('📋 Request data:', { age, sex, travel_history });

    // Call Python AI server with proper format
    const aiResponse = await axios.post(`${AI_SERVER_URL}/predict`, {
      age: parseInt(age),
      sex: sex.toString().toUpperCase(),
      travel_history: travel_history || 'No'
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 second timeout
    });

    console.log('✅ AI response received:', aiResponse.data);

    const prediction = aiResponse.data.ai_prediction;

    // Save or update patient record
    let patient = await Patient.findOne({ patientId });
    if (!patient) {
      patient = new Patient({
        patientId,
        age: parseInt(age),
        sex: sex.toUpperCase()
      });
      await patient.save();
      console.log('✅ New patient created:', patientId);
    }

    // Save clinical record
    const record = new ClinicalRecord({
      patient: patient._id,
      patientId,
      age: parseInt(age),
      sex: sex.toUpperCase(),
      travelHistory: travel_history || 'No',
      prediction: prediction,
      predictedBy: req.user.id,
      timestamp: new Date()
    });
    await record.save();
    console.log('✅ Clinical record saved');

    // Return response to Flutter app
    res.json({
      success: true,
      message: 'Risk assessment completed',
      ai_prediction: prediction,
      patient: {
        patientId,
        age,
        sex
      },
      recordId: record._id
    });

  } catch (error) {
    console.error('❌ Zika prediction error:', error.message);
    
    // Detailed error logging
    if (error.response) {
      console.error('AI Server Response:', error.response.data);
      console.error('Status:', error.response.status);
    } else if (error.request) {
      console.error('No response from AI server. Is it running?');
      console.error('AI Server URL:', AI_SERVER_URL);
    }

    res.status(500).json({
      success: false,
      message: 'AI server error. Please try again.',
      error: error.message,
      details: error.response?.data || 'Could not connect to AI server'
    });
  }
});

// GET /api/zika/history - Get prediction history
router.get('/history', auth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;

    const records = await ClinicalRecord.find({ predictedBy: req.user.id })
      .sort({ timestamp: -1 })
      .skip(offset)
      .limit(limit)
      .populate('patient', 'patientId age sex');

    const total = await ClinicalRecord.countDocuments({ predictedBy: req.user.id });

    res.json({
      success: true,
      history: records,
      total,
      limit,
      offset
    });
  } catch (error) {
    console.error('History error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve history'
    });
  }
});

// GET /api/zika/stats - Get statistics
router.get('/stats', auth, async (req, res) => {
  try {
    const totalPredictions = await ClinicalRecord.countDocuments({
      predictedBy: req.user.id
    });

    const highRiskCount = await ClinicalRecord.countDocuments({
      predictedBy: req.user.id,
      'prediction.risk_level': /HIGH/i
    });

    const lowRiskCount = totalPredictions - highRiskCount;

    res.json({
      success: true,
      stats: {
        total: totalPredictions,
        highRisk: highRiskCount,
        lowRisk: lowRiskCount,
        highRiskPercentage: totalPredictions > 0 
          ? ((highRiskCount / totalPredictions) * 100).toFixed(1) 
          : 0
      }
    });
  } catch (error) {
    console.error('Stats error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve statistics'
    });
  }
});

// DELETE /api/zika/record/:id - Delete a prediction record
router.delete('/record/:id', auth, async (req, res) => {
  try {
    const record = await ClinicalRecord.findOneAndDelete({
      _id: req.params.id,
      predictedBy: req.user.id
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Record not found'
      });
    }

    res.json({
      success: true,
      message: 'Record deleted successfully'
    });
  } catch (error) {
    console.error('Delete error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to delete record'
    });
  }
});

module.exports = router;