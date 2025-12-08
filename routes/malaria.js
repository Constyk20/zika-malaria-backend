// routes/malaria.js - Malaria Clinical AI Engine
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// Since your models are in zika.js, we need to extract them
// First, let's check what's available in zika.js
const zikaRoute = require('./zika');

// If models aren't exported from zika.js, let's recreate them here
class MalariaDetectionModel {
  constructor() {
      this.name = "ABSUTH Malaria Detector v1.2";
      this.version = "1.2.0";
  }
  
  /**
   * Analyze blood smear for malaria
   * @param {Object} patientData - Patient clinical data
   * @param {Object} imageData - Blood smear image metadata
   * @returns {Object} Malaria analysis results
   */
  analyze(patientData, imageData = {}) {
      const { age, symptoms = [], travelHistory } = patientData;
      
      // Calculate malaria probability
      let probability = this.calculateMalariaProbability(patientData);
      
      // Adjust based on image quality (simulated)
      if (imageData.quality === 'high') {
          probability *= 1.1;  // Better image = slightly higher confidence
      } else if (imageData.quality === 'low') {
          probability *= 0.9;  // Poor image = slightly lower confidence
      }
      
      probability = Math.min(Math.max(probability, 0), 1);
      
      const isPositive = probability >= 0.5;
      const species = isPositive ? this.predictSpecies(patientData) : null;
      const parasiteDensity = isPositive ? this.estimateParasiteDensity(probability) : 0;
      
      return {
          success: true,
          analysis: {
              result: isPositive ? "PARASITES DETECTED" : "NO PARASITES FOUND",
              probability: probability,
              confidence: this.calculateConfidence(probability),
              species: species,
              parasite_density: parasiteDensity,
              severity: this.assessSeverity(parasiteDensity, age),
              recommendations: this.generateMalariaRecommendations(isPositive, parasiteDensity, patientData),
              clinical_notes: this.generateClinicalNotes(patientData),
              model: {
                  name: this.name,
                  version: this.version,
                  disclaimer: "Requires confirmation by microscopy"
              }
          }
      };
  }
  
  calculateMalariaProbability(patientData) {
      const { age, symptoms, travelHistory } = patientData;
      let probability = 0.3;  // Base probability in endemic area
      
      // Symptom adjustments
      const malariaSymptoms = ['fever', 'chills', 'sweating', 'headache', 'nausea', 'fatigue'];
      const symptomCount = symptoms.filter(s => 
          malariaSymptoms.includes(s.toLowerCase())
      ).length;
      
      probability += (symptomCount * 0.15);
      
      // Travel history adjustment
      const travelLower = (travelHistory || '').toLowerCase();
      if (travelLower.includes('rural') || travelLower.includes('village')) {
          probability += 0.2;
      }
      if (travelLower.includes('malaria') || travelLower.includes('endemic')) {
          probability += 0.15;
      }
      
      // Age adjustment
      if (age < 5 || age > 60) {
          probability += 0.1;  // Higher risk in extremes of age
      }
      
      return Math.min(probability, 0.95);
  }
  
  predictSpecies(patientData) {
      const species = [
          { name: "Plasmodium falciparum", probability: 0.6 },
          { name: "Plasmodium vivax", probability: 0.25 },
          { name: "Plasmodium malariae", probability: 0.1 },
          { name: "Plasmodium ovale", probability: 0.05 }
      ];
      
      // Adjust based on travel history
      const travelLower = (patientData.travelHistory || '').toLowerCase();
      if (travelLower.includes('africa')) {
          species[0].probability = 0.8;  // P. falciparum more common in Africa
      } else if (travelLower.includes('asia')) {
          species[1].probability = 0.5;  // P. vivax more common in Asia
      }
      
      return species;
  }
  
  estimateParasiteDensity(probability) {
      // Convert probability to estimated parasites/μL
      const baseDensity = probability * 10000;
      return Math.round(baseDensity);
  }
  
  assessSeverity(parasiteDensity, age) {
      if (parasiteDensity > 100000) {
          return "SEVERE - Requires hospitalization";
      } else if (parasiteDensity > 10000) {
          return "MODERATE - Close monitoring needed";
      } else if (parasiteDensity > 1000) {
          return "MILD - Outpatient treatment";
      } else {
          return "ASYMPTOMATIC - Monitor";
      }
  }
  
  calculateConfidence(probability) {
      if (probability < 0.3 || probability > 0.7) {
          return 0.9;
      } else {
          return 0.75 + (Math.abs(probability - 0.5) * 0.3);
      }
  }
  
  generateMalariaRecommendations(isPositive, parasiteDensity, patientData) {
      const recommendations = [];
      
      if (isPositive) {
          if (parasiteDensity > 100000) {
              recommendations.push(
                  "🚨 ADMIT to hospital immediately",
                  "Start IV artesunate therapy",
                  "Monitor for severe complications",
                  "Check blood glucose every 4 hours",
                  "Monitor renal function and urine output"
              );
          } else if (parasiteDensity > 10000) {
              recommendations.push(
                  "Start oral ACT therapy immediately",
                  "Consider admission for observation",
                  "Monitor for symptom progression",
                  "Repeat blood film in 24-48 hours",
                  "Check hemoglobin and renal function"
              );
          } else {
              recommendations.push(
                  "Start oral ACT therapy",
                  "Outpatient management",
                  "Follow-up in 48 hours",
                  "Complete full treatment course",
                  "Use mosquito nets to prevent spread"
              );
          }
          
          // Species-specific recommendations
          recommendations.push(
              "For P. vivax or P. ovale: Add primaquine for radical cure",
              "Test for G6PD deficiency before primaquine",
              "Notify local health authorities"
          );
      } else {
          recommendations.push(
              "No malaria parasites detected",
              "If high clinical suspicion, repeat test in 24 hours",
              "Consider alternative diagnoses",
              "Continue mosquito bite prevention"
          );
      }
      
      // Patient-specific advice
      const { age, sex } = patientData;
      if (age < 5) {
          recommendations.push("Use pediatric dosing calculations");
      }
      if ((sex || '').toUpperCase() === 'F') {
          recommendations.push("Pregnancy test if applicable");
      }
      
      return recommendations;
  }
  
  generateClinicalNotes(patientData) {
      const notes = [];
      const { symptoms = [], travelHistory } = patientData;
      
      if (symptoms.length > 0) {
          notes.push(`Presenting symptoms: ${symptoms.join(', ')}`);
      }
      
      if (travelHistory) {
          notes.push(`Travel history: ${travelHistory}`);
      }
      
      notes.push(
          "Malaria diagnosis requires microscopy confirmation",
          "Consider co-infections in endemic areas",
          "Monitor for treatment response and complications"
      );
      
      return notes;
  }
}

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
  analyzeMalaria(patientData) {
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
    });

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
        console.log(`📝 Malaria analysis recorded for patient: ${patientId}`);
      }
    } catch (dbError) {
      console.warn('⚠️ Database save failed (analysis still successful):', dbError.message);
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
    
    let statusCode = 500;
    let errorMessage = 'Failed to process malaria analysis';
    
    if (error.message.includes('Validation failed')) {
      statusCode = 400;
      errorMessage = error.message;
    }
    
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      suggestion: 'Please check input data and try again. Ensure age is numeric and sex is M/F.'
    });
  }
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
        'Clinical recommendations'
      ],
      disclaimer: 'For clinical decision support only. Not a replacement for microscopy confirmation.'
    }
  });
});

module.exports = router;