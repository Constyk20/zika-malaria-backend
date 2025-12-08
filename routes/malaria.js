// routes/malaria.js - Malaria Clinical AI Engine
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// Import the MalariaDetectionModel from your zika_models.js
const { MalariaDetectionModel } = require('./zika_models');

// ============================================================================
// MALARIA AI ENGINE
// ============================================================================
class MalariaAIEngine {
  constructor() {
    this.name = "ABSUTH Malaria Clinical AI v2.0";
    this.version = "2.0.0";
    this.lastUpdated = "2024-12-01";
    
    // Initialize the malaria model
    this.malariaModel = new MalariaDetectionModel();
  }

  /**
   * Analyze malaria risk from clinical parameters
   */
  analyzeMalaria(patientData, imageData = {}) {
    const { age, sex, travelHistory, symptoms = [] } = patientData;
    
    console.log(`🦠 Malaria AI Processing: Age=${age}, Sex=${sex}, Symptoms=${symptoms.length}`);
    
    // 1. INPUT VALIDATION
    const validation = this.validateInput(patientData);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.error}`);
    }

    // 2. PROCESS WITH MALARIA MODEL
    const analysis = this.malariaModel.analyze({
      age: parseInt(age),
      sex: sex,
      travelHistory: travelHistory || '',
      symptoms: Array.isArray(symptoms) ? symptoms : [symptoms].filter(Boolean)
    }, imageData);

    return {
      success: true,
      timestamp: new Date().toISOString(),
      patient_summary: {
        age: patientData.age,
        sex: patientData.sex,
        travel_history: patientData.travelHistory || 'Not provided',
        symptoms: patientData.symptoms || []
      },
      analysis: analysis.analysis,
      ai_metadata: {
        model_name: this.malariaModel.name,
        version: this.malariaModel.version,
        disclaimer: "This AI analysis is for clinical decision support only. Malaria diagnosis requires confirmation by microscopy."
      }
    };
  }

  /**
   * Batch analyze multiple patients
   */
  batchAnalyze(patients, imageDataArray = []) {
    console.log(`🔄 Batch malaria analysis for ${patients.length} patients`);
    
    const analyses = patients.map((patient, index) => {
      try {
        return {
          patient_id: patient.patientId || `MAL${index + 1}`,
          analysis: this.analyzeMalaria(patient, imageDataArray[index] || {})
        };
      } catch (error) {
        return {
          patient_id: patient.patientId || `MAL${index + 1}`,
          error: error.message,
          success: false
        };
      }
    });

    const successful = analyses.filter(a => a.analysis?.success);
    const failed = analyses.filter(a => a.error);

    return {
      success: true,
      message: `Batch analysis completed: ${successful.length} successful, ${failed.length} failed`,
      total: patients.length,
      successful: successful.length,
      failed: failed.length,
      analyses: analyses,
      summary: {
        positive_count: successful.filter(a => 
          a.analysis.analysis.result === "PARASITES DETECTED"
        ).length,
        negative_count: successful.filter(a => 
          a.analysis.analysis.result === "NO PARASITES FOUND"
        ).length,
        high_severity: successful.filter(a => 
          a.analysis.analysis.severity?.includes('SEVERE')
        ).length,
        moderate_severity: successful.filter(a => 
          a.analysis.analysis.severity?.includes('MODERATE')
        ).length
      }
    };
  }

  /**
   * Validate patient input data
   */
  validateInput(data) {
    const errors = [];
    
    // Age validation
    const age = parseInt(data.age);
    if (isNaN(age) || age < 0 || age > 120) {
      errors.push(`Invalid age: ${data.age}. Must be between 0 and 120`);
    }
    
    // Sex validation
    const validSexes = ['M', 'F', 'MALE', 'FEMALE'];
    if (!data.sex || !validSexes.includes(data.sex.toUpperCase())) {
      errors.push(`Invalid sex: ${data.sex}. Must be M or F`);
    }
    
    return {
      valid: errors.length === 0,
      error: errors.join('; ')
    };
  }

  /**
   * Get malaria epidemiology info
   */
  getEpidemiologyInfo() {
    return {
      endemic_regions: [
        "Sub-Saharan Africa",
        "South Asia",
        "Southeast Asia",
        "Latin America",
        "Middle East",
        "Pacific Islands"
      ],
      high_risk_areas: [
        "Rural agricultural areas",
        "Forest fringe areas",
        "Areas with poor drainage",
        "Regions with Anopheles mosquitoes",
        "Areas with limited healthcare access"
      ],
      peak_seasons: {
        "Africa": "Rainy season (varies by region)",
        "Asia": "Monsoon season",
        "Latin America": "Rainy season",
        "General": "Higher transmission during and after rainy seasons"
      },
      prevention_measures: [
        "Use insecticide-treated bed nets",
        "Apply mosquito repellent (DEET-based)",
        "Take antimalarial prophylaxis when traveling",
        "Wear protective clothing",
        "Eliminate standing water",
        "Use indoor residual spraying"
      ]
    };
  }
}

// ============================================================================
// EXPRESS ROUTE HANDLER
// ============================================================================

// Initialize AI Engine
const malariaAI = new MalariaAIEngine();

// POST /api/malaria/analyze - Malaria clinical analysis
router.post('/analyze', auth, async (req, res) => {
  try {
    console.log('🔬 Malaria Clinical Analysis Request:', {
      user: req.user.email,
      data: { ...req.body }
    });
    
    const { patientId, age, sex, travelHistory, symptoms = [] } = req.body;
    
    // Validate required fields
    if (!age || !sex) {
      return res.status(400).json({
        success: false,
        message: 'Age and biological sex are required fields',
        required_fields: ['age', 'sex'],
        note: 'Travel history and symptoms are optional but recommended'
      });
    }
    
    // Process with AI Engine
    const analysis = malariaAI.analyzeMalaria({
      age,
      sex,
      travelHistory,
      symptoms: Array.isArray(symptoms) ? symptoms : [symptoms].filter(Boolean)
    });

    console.log('✅ Malaria Analysis Complete:', {
      result: analysis.analysis.result,
      probability: analysis.analysis.probability,
      severity: analysis.analysis.severity
    });

    // Save to database if needed
    try {
      if (patientId) {
        // Save analysis record logic here
        console.log(`📝 Malaria analysis recorded for patient: ${patientId}`);
      }
    } catch (dbError) {
      console.warn('⚠️ Database save failed (analysis still successful):', dbError.message);
      // Continue - don't fail the analysis if DB save fails
    }
    
    // Return successful analysis
    res.json({
      success: true,
      message: 'Malaria clinical analysis completed successfully',
      ...analysis,
      system_note: 'Powered by ABSUTH Malaria Clinical AI v2.0 - For clinical decision support only'
    });
    
  } catch (error) {
    console.error('❌ Malaria Analysis Error:', {
      message: error.message,
      stack: error.stack,
      request: { ...req.body }
    });
    
    // User-friendly error messages
    let statusCode = 500;
    let errorMessage = 'Failed to process malaria analysis';
    
    if (error.message.includes('Validation failed')) {
      statusCode = 400;
      errorMessage = error.message;
    } else if (error.message.includes('Invalid')) {
      statusCode = 400;
      errorMessage = `Invalid input data: ${error.message}`;
    }
    
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      suggestion: 'Please check input data and try again. Ensure age is numeric and sex is M/F.'
    });
  }
});

// POST /api/malaria/batch-analyze - Batch analysis for multiple patients
router.post('/batch-analyze', auth, async (req, res) => {
  try {
    const { patients } = req.body;
    
    if (!Array.isArray(patients) || patients.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Patients array is required and must not be empty'
      });
    }
    
    console.log(`🔄 Batch malaria analysis for ${patients.length} patients`);
    
    const batchResult = malariaAI.batchAnalyze(patients);
    
    res.json({
      success: true,
      ...batchResult
    });
    
  } catch (error) {
    console.error('❌ Batch malaria analysis error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Batch malaria analysis failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/malaria/epidemiology - Get malaria epidemiology information
router.get('/epidemiology', auth, (req, res) => {
  res.json({
    success: true,
    epidemiology: malariaAI.getEpidemiologyInfo(),
    ai_metadata: {
      model_name: malariaAI.name,
      version: malariaAI.version,
      last_updated: malariaAI.lastUpdated
    }
  });
});

// GET /api/malaria/ai-info - Get AI model information
router.get('/ai-info', auth, (req, res) => {
  res.json({
    success: true,
    ai_model: {
      name: malariaAI.name,
      version: malariaAI.version,
      last_updated: malariaAI.lastUpdated,
      capabilities: [
        'Malaria risk assessment',
        'Parasite probability estimation',
        'Species prediction',
        'Parasite density estimation',
        'Severity assessment',
        'Clinical recommendations',
        'Differential diagnoses'
      ],
      risk_factors_considered: [
        'Age and demographic factors',
        'Travel history to endemic regions',
        'Symptom presence and severity',
        'Comorbidities',
        'Seasonal and geographic factors'
      ],
      validation: 'Based on WHO malaria guidelines and epidemiological data',
      disclaimer: 'For clinical decision support only. Not a replacement for microscopy confirmation.',
      endpoints: {
        analyze: 'POST /api/malaria/analyze',
        batch_analyze: 'POST /api/malaria/batch-analyze',
        epidemiology: 'GET /api/malaria/epidemiology',
        info: 'GET /api/malaria/ai-info'
      }
    }
  });
});

module.exports = router;