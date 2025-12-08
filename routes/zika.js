const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/auth');
const ClinicalRecord = require('../models/ClinicalRecord');
const Patient = require('../models/Patient');

// Python AI Server URL (from environment variable)
const AI_SERVER_URL = process.env.PYTHON_AI_URL || 'https://zika-ai-engine.onrender.com';

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

// Helper function with retry logic
const makeRequestWithRetry = async (url, data, retries = MAX_RETRIES) => {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`🔄 Attempt ${i + 1}/${retries} to AI server`);
      
      const response = await axios.post(url, data, {
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'ABSUTH-Medical-App/1.0'
        },
        timeout: 30000, // 30 second timeout
      });
      
      console.log(`✅ AI request successful on attempt ${i + 1}`);
      return response.data;
      
    } catch (error) {
      console.error(`❌ Attempt ${i + 1} failed:`, error.message);
      
      // Check if it's a 429 rate limit error
      if (error.response?.status === 429) {
        console.log('⚠️ Rate limited by AI server (429)');
        
        // Extract retry-after header if available
        const retryAfter = error.response.headers['retry-after'];
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : RETRY_DELAY * (i + 1);
        
        console.log(`⏳ Waiting ${waitTime}ms before retry (rate limit)`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      if (i === retries - 1) {
        throw error; // Last attempt failed
      }
      
      // For other errors, wait and retry
      console.log(`⏳ Waiting ${RETRY_DELAY}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }
};

// POST /api/zika/predict - Clinical Risk Prediction
router.post('/predict', auth, async (req, res) => {
  try {
    const { patientId, age, sex, travel_history } = req.body;

    // Validate input
    if (!age || !sex) {
      return res.status(400).json({
        success: false,
        message: 'Age and sex are required fields'
      });
    }

    console.log('📤 Calling Python AI server:', AI_SERVER_URL);
    console.log('📋 Request data:', { 
      age: parseInt(age), 
      sex: sex.toString().toUpperCase(), 
      travel_history: travel_history || 'No' 
    });

    // Prepare AI request data
    const aiData = {
      age: parseInt(age),
      sex: sex.toString().toUpperCase(),
      travel_history: travel_history || 'No travel history provided'
    };

    // Use retry logic for AI request
    let aiResponse;
    try {
      aiResponse = await makeRequestWithRetry(
        `${AI_SERVER_URL}/predict`, 
        aiData
      );
    } catch (aiError) {
      console.error('❌ All AI retries failed:', aiError.message);
      
      // Check if it's a Cloudflare challenge (429 with HTML response)
      if (aiError.response?.status === 429 && 
          aiError.response?.data?.includes && 
          aiError.response.data.includes('<!DOCTYPE html>')) {
        
        console.log('⚠️ AI server blocked by Cloudflare protection');
        
        // Return user-friendly error
        return res.status(429).json({
          success: false,
          message: 'AI server is currently under heavy load. Please try again in a few minutes.',
          error: 'rate_limit_cloudflare',
          retryAfter: 60 // Suggest 60 seconds wait
        });
      }
      
      // For other AI errors, use local fallback
      console.log('🔄 Using local fallback prediction');
      
      // Local fallback prediction logic
      const fallbackPrediction = generateLocalPrediction(age, sex, travel_history);
      
      // Save with fallback flag
      await savePredictionRecord(req, {
        patientId,
        age,
        sex,
        travel_history,
        prediction: fallbackPrediction,
        isFallback: true
      });
      
      return res.json({
        success: true,
        message: 'Risk assessment completed (local fallback)',
        ai_prediction: fallbackPrediction,
        patient: { patientId, age, sex },
        fallback: true,
        note: 'AI server unavailable, using local assessment'
      });
    }

    console.log('✅ AI response received:', aiResponse);

    // Handle different AI response formats
    let prediction;
    if (aiResponse.ai_prediction) {
      prediction = aiResponse.ai_prediction;
    } else if (aiResponse.prediction) {
      prediction = aiResponse.prediction;
    } else if (aiResponse.risk_level) {
      prediction = {
        risk_level: aiResponse.risk_level,
        confidence: aiResponse.confidence || 0.8,
        recommendation: aiResponse.recommendation || 'Consult with healthcare provider'
      };
    } else {
      prediction = aiResponse;
    }

    // Save prediction record
    await savePredictionRecord(req, {
      patientId,
      age,
      sex,
      travel_history,
      prediction,
      isFallback: false
    });

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
      fallback: false
    });

  } catch (error) {
    console.error('❌ Zika prediction error:', error.message);
    console.error('Error stack:', error.stack);
    
    // Determine appropriate status code and message
    let statusCode = 500;
    let errorMessage = 'Failed to process prediction';
    
    if (error.response?.status === 429) {
      statusCode = 429;
      errorMessage = 'AI server is busy. Please try again in a few moments.';
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = 'Request timeout. Please try again.';
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = 'Cannot connect to AI server. Please check network connection.';
    }

    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      details: error.response?.data || 'AI server communication error'
    });
  }
});

// Helper function to save prediction record
async function savePredictionRecord(req, data) {
  try {
    const { patientId, age, sex, travel_history, prediction, isFallback } = data;
    
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
      timestamp: new Date(),
      source: isFallback ? 'local_fallback' : 'ai_server'
    });
    await record.save();
    console.log('✅ Clinical record saved');
    
    return record;
  } catch (saveError) {
    console.error('❌ Failed to save record:', saveError.message);
    // Don't throw, as saving shouldn't fail the whole prediction
  }
}

// Local fallback prediction logic
function generateLocalPrediction(age, sex, travelHistory) {
  // Simple local prediction algorithm
  let riskScore = 0;
  const travelStr = (travelHistory || '').toLowerCase();
  
  // Age factor
  if (age > 50) riskScore += 2;
  else if (age > 30) riskScore += 1;
  
  // Sex factor (pregnant women at higher risk)
  if (sex.toUpperCase() === 'F') riskScore += 1;
  
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
      age,
      sex,
      travel_history: travelHistory || 'None',
      calculated_risk_score: riskScore
    },
    source: 'local_fallback_algorithm'
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

    const moderateRiskCount = await ClinicalRecord.countDocuments({
      predictedBy: req.user.id,
      'prediction.risk_level': /MODERATE/i
    });

    const lowRiskCount = totalPredictions - highRiskCount - moderateRiskCount;

    res.json({
      success: true,
      stats: {
        total: totalPredictions,
        highRisk: highRiskCount,
        moderateRisk: moderateRiskCount,
        lowRisk: lowRiskCount,
        highRiskPercentage: totalPredictions > 0 
          ? ((highRiskCount / totalPredictions) * 100).toFixed(1) 
          : 0,
        aiPredictions: await ClinicalRecord.countDocuments({
          predictedBy: req.user.id,
          source: 'ai_server'
        }),
        fallbackPredictions: await ClinicalRecord.countDocuments({
          predictedBy: req.user.id,
          source: 'local_fallback'
        })
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
        message: 'Record not found or not authorized'
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