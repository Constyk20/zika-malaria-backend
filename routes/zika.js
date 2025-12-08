const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const ClinicalRecord = require('../models/ClinicalRecord');
const Patient = require('../models/Patient');

// Simple test prediction - remove AI server calls for now
router.post('/predict', auth, async (req, res) => {
  try {
    console.log('📥 Received prediction request:', req.body);
    
    const { patientId, age, sex, travel_history } = req.body;

    // Validate input
    if (!age || !sex) {
      return res.status(400).json({
        success: false,
        message: 'Age and sex are required fields'
      });
    }

    // Generate mock prediction
    const prediction = generateLocalPrediction(age, sex, travel_history);
    
    console.log('✅ Generated prediction:', prediction);

    // Save or update patient record
    try {
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
        timestamp: new Date(),
        source: 'mock_backend'
      });
      await record.save();
      console.log('✅ Clinical record saved');
    } catch (saveError) {
      console.error('⚠️ Failed to save record:', saveError.message);
      // Continue anyway - don't fail the request
    }

    // Return response to Flutter app
    res.json({
      success: true,
      message: 'Risk assessment completed successfully',
      ai_prediction: prediction,
      patient: {
        patientId,
        age: parseInt(age),
        sex: sex.toUpperCase()
      }
    });

  } catch (error) {
    console.error('❌ Error in prediction route:', error.message);
    console.error('Stack trace:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Failed to process prediction',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      details: 'Internal server error'
    });
  }
});

// Local fallback prediction logic
function generateLocalPrediction(age, sex, travelHistory) {
  // Simple local prediction algorithm
  let riskScore = 0;
  const travelStr = (travelHistory || '').toLowerCase();
  
  // Age factor
  if (age > 50) riskScore += 2;
  else if (age > 30) riskScore += 1;
  
  // Sex factor (pregnant women at higher risk)
  if (sex.toString().toUpperCase() === 'F') riskScore += 1;
  
  // Travel factor
  const highRiskAreas = ['brazil', 'mexico', 'colombia', 'venezuela', 'thailand', 'philippines'];
  const hasHighRiskTravel = highRiskAreas.some(area => travelStr.includes(area));
  
  if (hasHighRiskTravel) {
    riskScore += 3;
  } else if (travelStr.includes('travel') || travelStr.includes('abroad')) {
    riskScore += 1;
  }
  
  // Determine risk level
  let riskLevel, confidence, recommendation;
  
  if (riskScore >= 4) {
    riskLevel = 'HIGH RISK';
    confidence = 0.85;
    recommendation = 'Immediate medical consultation recommended. Monitor for symptoms and avoid mosquito exposure.';
  } else if (riskScore >= 2) {
    riskLevel = 'MODERATE RISK';
    confidence = 0.65;
    recommendation = 'Schedule medical checkup. Use mosquito repellent and wear protective clothing.';
  } else {
    riskLevel = 'LOW RISK';
    confidence = 0.90;
    recommendation = 'Low probability of Zika infection. Maintain standard mosquito precautions.';
  }
  
  return {
    risk_level: riskLevel,
    confidence: confidence,
    recommendation: recommendation,
    factors_considered: {
      age: parseInt(age),
      sex: sex.toString().toUpperCase(),
      travel_history: travelHistory || 'None',
      calculated_risk_score: riskScore
    },
    source: 'mock_backend'
  };
}

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
        lowRisk: lowRiskCount
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

module.exports = router;