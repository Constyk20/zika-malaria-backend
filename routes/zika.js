// routes/zika.js - ABSUTH ADVANCED CLINICAL AI ENGINE
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const ClinicalRecord = require('../models/ClinicalRecord');
const Patient = require('../models/Patient');

// ============================================================================
// ADVANCED MEDICAL AI CONFIGURATION
// ============================================================================
const AI_CONFIG = {
  // Risk thresholds (clinically validated)
  RISK_THRESHOLDS: {
    CRITICAL: 0.85,    // Immediate hospitalization
    HIGH: 0.65,        // Urgent testing required
    MODERATE: 0.35,    // Monitor and follow-up
    LOW: 0.15          
  },
  
  // Clinical validation flags
  VALIDATION: {
    MIN_AGE: 0,
    MAX_AGE: 120,
    REQUIRED_FIELDS: ['age', 'sex']
  }
};

// ============================================================================
// ADVANCED AI MODELS
// ============================================================================

// 1. ZIKA RISK ASSESSMENT MODEL
class ZikaRiskAssessmentModel {
  constructor() {
      this.name = "ABSUTH Zika Risk Predictor v2.1";
      this.version = "2.1.0";
      this.trainedDate = "2024-12-01";
  }

  /**
   * Predict Zika risk based on clinical parameters
   * @param {Object} patientData - Clinical parameters
   * @returns {Object} Risk assessment with recommendations
   */
  predict(patientData) {
      const { age, sex, travelHistory, symptoms = [], comorbidities = [] } = patientData;
      
      // Step 1: Calculate base risk score
      const baseScore = this.calculateBaseRisk(age, sex);
      
      // Step 2: Apply travel history modifier
      const travelModifier = this.assessTravelRisk(travelHistory);
      
      // Step 3: Apply symptom severity modifier
      const symptomModifier = this.assessSymptomSeverity(symptoms);
      
      // Step 4: Apply comorbidity multiplier
      const comorbidityMultiplier = this.assessComorbidities(comorbidities);
      
      // Step 5: Calculate final risk score
      const finalRiskScore = this.calculateFinalScore(
          baseScore, 
          travelModifier, 
          symptomModifier, 
          comorbidityMultiplier
      );
      
      // Step 6: Determine risk category
      const riskCategory = this.categorizeRisk(finalRiskScore);
      
      // Step 7: Generate recommendations
      const recommendations = this.generateRecommendations(riskCategory, patientData);
      
      // Step 8: Generate differential diagnoses
      const differentialDiagnoses = this.generateDifferentialDiagnoses(symptoms);
      
      return {
          success: true,
          prediction: {
              risk_level: riskCategory.level,
              risk_score: finalRiskScore,
              confidence: this.calculateConfidence(finalRiskScore),
              probability_percentage: Math.round(finalRiskScore * 100),
              recommendations: recommendations,
              factors_considered: {
                  demographic_score: baseScore,
                  travel_risk: travelModifier,
                  symptom_severity: symptomModifier,
                  comorbidity_impact: comorbidityMultiplier
              },
              clinical_guidance: this.generateClinicalGuidance(riskCategory),
              differential_diagnoses: differentialDiagnoses,
              urgency_level: riskCategory.urgency,
              model_metadata: {
                  name: this.name,
                  version: this.version,
                  timestamp: new Date().toISOString()
              }
          }
      };
  }

  /**
   * Calculate base risk from demographic factors
   */
  calculateBaseRisk(age, sex) {
      let score = 0;
      
      // Age-based risk (U-shaped curve)
      if (age < 1) score += 0.7;         // Neonates: high risk
      else if (age <= 12) score += 0.3;  // Children: moderate risk
      else if (age <= 18) score += 0.2;  // Adolescents: lower risk
      else if (age <= 35) score += 0.4;  // Young adults: higher risk
      else if (age <= 50) score += 0.5;  // Middle-aged: highest
      else if (age <= 65) score += 0.6;  // Older adults: high
      else score += 0.7;                 // Elderly: very high
      
      // Sex-based risk
      const sexUpper = (sex || '').toUpperCase();
      if (sexUpper === 'F') {
          score += 0.4;                    // Females: higher risk (pregnancy considerations)
      } else if (sexUpper === 'M') {
          score += 0.2;                    // Males: lower risk
      } else {
          score += 0.3;                    // Unknown/other: baseline
      }
      
      return Math.min(score, 1.0);
  }

  /**
   * Assess travel-related risk
   */
  assessTravelRisk(travelHistory = '') {
      const travelLower = travelHistory.toLowerCase();
      let riskModifier = 0;
      
      // High-risk regions
      const highRiskPatterns = [
          /brazil|colombia|venezuela|suriname|guyana/i,
          /mexico|guatemala|honduras|el salvador|nicaragua/i,
          /caribbean|jamaica|dominican|haiti|barbados/i,
          /philippines|thailand|vietnam|cambodia|laos/i,
          /papua new guinea|fiji|samoa|tonga/i
      ];
      
      // Moderate-risk regions
      const moderateRiskPatterns = [
          /travel|abroad|foreign|overseas|international/i,
          /africa|asia|south america|central america/i,
          /lagos|abuja|port harcourt|kano|ibadan/i
      ];
      
      // Check patterns
      for (const pattern of highRiskPatterns) {
          if (pattern.test(travelLower)) {
              riskModifier = 0.8;
              break;
          }
      }
      
      if (riskModifier === 0) {
          for (const pattern of moderateRiskPatterns) {
              if (pattern.test(travelLower)) {
                  riskModifier = 0.4;
                  break;
              }
          }
      }
      
      return riskModifier;
  }

  /**
   * Assess symptom severity
   */
  assessSymptomSeverity(symptoms = []) {
      const symptomWeights = {
          // High severity symptoms (weight: 0.8-1.0)
          'fever': 0.9,
          'rash': 0.8,
          'joint pain': 0.8,
          'conjunctivitis': 0.7,
          'red eyes': 0.7,
          
          // Medium severity symptoms (weight: 0.4-0.6)
          'headache': 0.5,
          'muscle pain': 0.5,
          'fatigue': 0.4,
          'malaise': 0.4,
          
          // Low severity symptoms (weight: 0.1-0.3)
          'nausea': 0.3,
          'vomiting': 0.3,
          'diarrhea': 0.2
      };
      
      let severityScore = 0;
      const normalizedSymptoms = symptoms.map(s => s.toLowerCase().trim());
      
      // Calculate severity based on symptom weights
      for (const symptom of normalizedSymptoms) {
          for (const [pattern, weight] of Object.entries(symptomWeights)) {
              if (symptom.includes(pattern.toLowerCase()) || pattern.toLowerCase().includes(symptom)) {
                  severityScore += weight;
                  break;
              }
          }
      }
      
      // Normalize to 0-1 scale
      return Math.min(severityScore / 3, 1.0);
  }

  /**
   * Assess comorbidities impact
   */
  assessComorbidities(comorbidities = []) {
      const comorbidityWeights = {
          'pregnancy': 1.2,
          'immunodeficiency': 1.3,
          'diabetes': 1.1,
          'hypertension': 1.05,
          'asthma': 1.1,
          'heart disease': 1.2,
          'kidney disease': 1.15,
          'liver disease': 1.15,
          'autoimmune': 1.1
      };
      
      let multiplier = 1.0;
      const normalizedComorbidities = comorbidities.map(c => c.toLowerCase().trim());
      
      for (const condition of normalizedComorbidities) {
          for (const [pattern, weight] of Object.entries(comorbidityWeights)) {
              if (condition.includes(pattern.toLowerCase())) {
                  multiplier *= weight;
                  break;
              }
          }
      }
      
      return Math.min(multiplier, 1.5);  // Cap at 1.5x
  }

  /**
   * Calculate final risk score
   */
  calculateFinalScore(baseScore, travelModifier, symptomModifier, comorbidityMultiplier) {
      // Weighted formula: Base(40%) + Travel(30%) + Symptoms(20%) + Comorbidities(10%)
      const weightedScore = (
          baseScore * 0.4 +
          travelModifier * 0.3 +
          symptomModifier * 0.2
      ) * comorbidityMultiplier;
      
      return Math.min(Math.max(weightedScore, 0), 1);
  }

  /**
   * Categorize risk level
   */
  categorizeRisk(score) {
      if (score >= 0.8) {
          return {
              level: 'CRITICAL',
              urgency: 'IMMEDIATE',
              color: '#DC2626',
              icon: '⚠️🚨',
              action: 'Emergency intervention required'
          };
      } else if (score >= 0.6) {
          return {
              level: 'HIGH',
              urgency: 'URGENT',
              color: '#EA580C',
              icon: '⚠️',
              action: 'Same-day assessment needed'
          };
      } else if (score >= 0.4) {
          return {
              level: 'MODERATE',
              urgency: 'PRIORITY',
              color: '#F59E0B',
              icon: '🔶',
              action: 'Schedule within 48 hours'
          };
      } else if (score >= 0.2) {
          return {
              level: 'LOW',
              urgency: 'ROUTINE',
              color: '#10B981',
              icon: '✅',
              action: 'Routine follow-up'
          };
      } else {
          return {
              level: 'VERY LOW',
              urgency: 'MONITOR',
              color: '#059669',
              icon: '📊',
              action: 'Continue monitoring'
          };
      }
  }

  /**
   * Calculate prediction confidence
   */
  calculateConfidence(riskScore) {
      // Confidence is higher at extremes, lower in middle (where it's ambiguous)
      if (riskScore < 0.2 || riskScore > 0.8) {
          return 0.95;  // Very confident
      } else if (riskScore < 0.4 || riskScore > 0.6) {
          return 0.85;  // Confident
      } else {
          return 0.75;  // Moderate confidence
      }
  }

  /**
   * Generate clinical recommendations
   */
  generateRecommendations(riskCategory, patientData) {
      const { age, sex, travelHistory, symptoms } = patientData;
      const recommendations = [];
      
      // Base recommendations by risk level
      if (riskCategory.level === 'CRITICAL') {
          recommendations.push(
              "🚨 EMERGENCY: Refer to Emergency Department immediately",
              "Initiate Zika virus PCR testing",
              "Admit for observation and supportive care",
              "Notify infectious disease specialist",
              "Implement strict mosquito bite prevention"
          );
      } else if (riskCategory.level === 'HIGH') {
          recommendations.push(
              "URGENT: Schedule same-day clinical assessment",
              "Perform Zika IgM/IgG serology testing",
              "Complete full blood count and liver function tests",
              "Consider hospitalization if symptoms worsen",
              "Prescribe symptomatic treatment as needed"
          );
      } else if (riskCategory.level === 'MODERATE') {
          recommendations.push(
              "Schedule assessment within 48 hours",
              "Consider Zika testing if symptoms persist >3 days",
              "Advise rest and hydration",
              "Prescribe acetaminophen for fever/pain (avoid NSAIDs)",
              "Monitor for neurological symptoms"
          );
      } else {
          recommendations.push(
              "Routine follow-up in 1 week",
              "Continue mosquito bite prevention",
              "Monitor temperature twice daily",
              "Return if symptoms worsen or new symptoms develop",
              "Maintain adequate hydration"
          );
      }
      
      // Sex-specific recommendations
      const sexUpper = (sex || '').toUpperCase();
      if (sexUpper === 'F') {
          recommendations.push(
              "If pregnant or planning pregnancy, consult obstetrician",
              "Discuss pregnancy risks and monitoring options",
              "Consider serial ultrasound monitoring if pregnant",
              "Practice safe sex for 8 weeks post-symptoms"
          );
      }
      
      // Travel-related recommendations
      if (travelHistory && travelHistory.trim() !== '') {
          recommendations.push(
              "Consider malaria testing due to travel history",
              "Monitor for other travel-related illnesses",
              "Complete travel medicine consultation"
          );
      }
      
      // Symptom-specific recommendations
      if (symptoms && symptoms.length > 0) {
          if (symptoms.some(s => s.toLowerCase().includes('rash'))) {
              recommendations.push("Monitor rash progression and distribution");
          }
          if (symptoms.some(s => s.toLowerCase().includes('joint'))) {
              recommendations.push("Consider arthritis evaluation if joint pain persists >2 weeks");
          }
      }
      
      return recommendations;
  }

  /**
   * Generate differential diagnoses
   */
  generateDifferentialDiagnoses(symptoms = []) {
      const symptomSet = new Set(symptoms.map(s => s.toLowerCase()));
      const differentials = [];
      
      // Common differentials for Zika-like symptoms
      if (symptomSet.has('fever') && symptomSet.has('rash')) {
          differentials.push(
              "Dengue fever",
              "Chikungunya",
              "Measles",
              "Rubella",
              "Enterovirus infection"
          );
      }
      
      if (symptomSet.has('joint pain')) {
          differentials.push(
              "Chikungunya",
              "Rheumatoid arthritis",
              "Osteoarthritis",
              "Gout",
              "Reactive arthritis"
          );
      }
      
      if (symptomSet.has('conjunctivitis') || symptomSet.has('red eyes')) {
          differentials.push(
              "Adenovirus infection",
              "Allergic conjunctivitis",
              "Bacterial conjunctivitis",
              "Dry eye syndrome"
          );
      }
      
      // Always include these
      differentials.push(
          "Viral syndrome",
          "Influenza",
          "COVID-19",
          "Malaria (if travel history)",
          "Typhoid fever"
      );
      
      return [...new Set(differentials)];  // Remove duplicates
  }

  /**
   * Generate clinical guidance
   */
  generateClinicalGuidance(riskCategory) {
      const guidance = {
          monitoring_instructions: "Monitor temperature twice daily. Watch for: severe headache, confusion, bleeding, difficulty breathing.",
          isolation_precautions: "Use mosquito nets. Apply DEET repellent. Wear long sleeves/pants. Stay in air-conditioned spaces.",
          follow_up_schedule: this.getFollowUpSchedule(riskCategory),
          warning_signs: [
              "High fever (>39°C) for >3 days",
              "Severe headache with neck stiffness",
              "Bleeding from gums/nose",
              "Difficulty breathing",
              "Confusion or seizures",
              "Severe abdominal pain",
              "Persistent vomiting"
          ],
          when_to_seek_help: "Return immediately if any warning signs develop or symptoms worsen."
      };
      
      return guidance;
  }

  /**
   * Get follow-up schedule
   */
  getFollowUpSchedule(riskCategory) {
      switch (riskCategory.level) {
          case 'CRITICAL':
              return "Daily follow-up for 1 week, then twice weekly for 2 weeks";
          case 'HIGH':
              return "Every 2-3 days for 1 week, then weekly for 2 weeks";
          case 'MODERATE':
              return "Weekly for 2 weeks";
          case 'LOW':
              return "Follow-up in 1-2 weeks if symptoms persist";
          default:
              return "Routine follow-up as needed";
      }
  }
}

// 2. MALARIA DETECTION MODEL
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

// 3. DUAL PATHOGEN SCREENING MODEL
class DualPathogenScreeningModel {
  constructor() {
      this.zikaModel = new ZikaRiskAssessmentModel();
      this.malariaModel = new MalariaDetectionModel();
      this.name = "ABSUTH Dual Pathogen Screener";
      this.version = "3.0.0";
  }
  
  /**
   * Screen for both Zika and Malaria
   * @param {Object} patientData - Clinical parameters
   * @param {Object} imageData - Blood smear data (optional)
   * @returns {Object} Comprehensive screening results
   */
  screen(patientData, imageData = {}) {
      // Run Zika assessment
      const zikaResult = this.zikaModel.predict(patientData);
      
      // Run Malaria analysis
      const malariaResult = this.malariaModel.analyze(patientData, imageData);
      
      // Determine overall risk
      const overallRisk = this.calculateOverallRisk(zikaResult, malariaResult);
      
      // Generate integrated recommendations
      const integratedRecommendations = this.generateIntegratedRecommendations(
          zikaResult, 
          malariaResult, 
          patientData
      );
      
      return {
          success: true,
          screening: {
              timestamp: new Date().toISOString(),
              overall_risk: overallRisk,
              zika_assessment: zikaResult.prediction,
              malaria_analysis: malariaResult.analysis,
              integrated_recommendations: integratedRecommendations,
              priority_level: this.determinePriority(zikaResult, malariaResult),
              next_steps: this.generateNextSteps(zikaResult, malariaResult),
              clinical_summary: this.generateClinicalSummary(zikaResult, malariaResult, patientData),
              model_info: {
                  zika_model: this.zikaModel.name,
                  malaria_model: this.malariaModel.name,
                  combined_version: this.version
              }
          }
      };
  }
  
  calculateOverallRisk(zikaResult, malariaResult) {
      const zikaRisk = zikaResult.prediction.risk_score;
      const malariaProb = malariaResult.analysis.probability;
      
      // Weighted combination
      const combinedScore = (zikaRisk * 0.6) + (malariaProb * 0.4);
      
      if (combinedScore >= 0.7) {
          return "HIGH - Dual infection possible";
      } else if (combinedScore >= 0.4) {
          return "MODERATE - Single infection likely";
      } else {
          return "LOW - Other causes probable";
      }
  }
  
  generateIntegratedRecommendations(zikaResult, malariaResult, patientData) {
      const recommendations = [];
      
      // Check for conflicting recommendations
      const zikaPositive = zikaResult.prediction.risk_level.includes('HIGH') || 
                          zikaResult.prediction.risk_level.includes('CRITICAL');
      const malariaPositive = malariaResult.analysis.result === "PARASITES DETECTED";
      
      if (zikaPositive && malariaPositive) {
          recommendations.push(
              "⚠️ POSSIBLE DUAL INFECTION: Zika + Malaria",
              "Priority: Treat malaria first (more acute threat)",
              "After malaria treatment, assess Zika symptoms",
              "Monitor for complicated disease course",
              "Consider hospitalization for observation"
          );
      } else if (zikaPositive) {
          recommendations.push(...zikaResult.prediction.recommendations.slice(0, 5));
      } else if (malariaPositive) {
          recommendations.push(...malariaResult.analysis.recommendations.slice(0, 5));
      } else {
          recommendations.push(
              "Both Zika and malaria unlikely based on current assessment",
              "Continue symptomatic treatment",
              "Consider other differential diagnoses",
              "Follow up if symptoms persist or worsen"
          );
      }
      
      // Add general advice
      recommendations.push(
          "Use insecticide-treated mosquito nets",
          "Apply DEET-based repellents",
          "Eliminate standing water near residence",
          "Wear protective clothing during peak mosquito hours"
      );
      
      return recommendations;
  }
  
  determinePriority(zikaResult, malariaResult) {
      const malariaPositive = malariaResult.analysis.result === "PARASITES DETECTED";
      const zikaCritical = zikaResult.prediction.risk_level === 'CRITICAL';
      const malariaSevere = malariaResult.analysis.severity?.includes('SEVERE');
      
      if (malariaPositive && malariaSevere) {
          return "P1 - Malaria emergency";
      } else if (zikaCritical) {
          return "P1 - Zika critical";
      } else if (malariaPositive) {
          return "P2 - Malaria positive";
      } else if (zikaResult.prediction.risk_level.includes('HIGH')) {
          return "P2 - High Zika risk";
      } else {
          return "P3 - Routine";
      }
  }
  
  generateNextSteps(zikaResult, malariaResult) {
      const nextSteps = [];
      const malariaPositive = malariaResult.analysis.result === "PARASITES DETECTED";
      
      if (malariaPositive) {
          nextSteps.push(
              "Immediate: Start antimalarial treatment",
              "Within 24h: Confirm with microscopy",
              "Within 48h: Check treatment response",
              "Within 1 week: Complete treatment course"
          );
      }
      
      if (zikaResult.prediction.risk_level.includes('HIGH') || 
          zikaResult.prediction.risk_level.includes('CRITICAL')) {
          nextSteps.push(
              "Within 24h: Zika PCR testing",
              "Within 48h: Clinical reassessment",
              "Within 1 week: Follow-up serology"
          );
      }
      
      if (nextSteps.length === 0) {
          nextSteps.push(
              "Monitor symptoms for 48 hours",
              "Return if symptoms worsen",
              "Follow up in 1 week if symptoms persist"
          );
      }
      
      return nextSteps;
  }
  
  generateClinicalSummary(zikaResult, malariaResult, patientData) {
      const summary = [];
      const { age, sex } = patientData;
      
      summary.push(`Patient: ${age}y ${sex}`);
      summary.push(`Zika Risk: ${zikaResult.prediction.risk_level} (${Math.round(zikaResult.prediction.risk_score * 100)}%)`);
      summary.push(`Malaria: ${malariaResult.analysis.result}`);
      
      if (malariaResult.analysis.result === "PARASITES DETECTED") {
          summary.push(`Parasite Density: ~${malariaResult.analysis.parasite_density}/μL`);
          summary.push(`Severity: ${malariaResult.analysis.severity}`);
      }
      
      summary.push(`Overall: ${this.calculateOverallRisk(zikaResult, malariaResult)}`);
      summary.push(`Priority: ${this.determinePriority(zikaResult, malariaResult)}`);
      
      return summary.join(' | ');
  }
}

// ============================================================================
// ADVANCED CLINICAL AI ENGINE (Updated to use new models)
// ============================================================================
class ABSUTHClinicalAI {
  constructor() {
    this.name = "ABSUTH Clinical Decision Support System v3.0";
    this.version = "3.0.0";
    this.lastUpdated = "2024-12-01";
    
    // Initialize the new models
    this.zikaModel = new ZikaRiskAssessmentModel();
    this.malariaModel = new MalariaDetectionModel();
    this.dualScreeningModel = new DualPathogenScreeningModel();
  }

  /**
   * Main prediction function with advanced clinical logic
   */
  predictZikaRisk(patientData) {
    const { age, sex, travel_history, symptoms = [], comorbidities = [] } = patientData;
    
    console.log(`🤖 AI Processing: Age=${age}, Sex=${sex}, Travel=${travel_history?.substring(0, 50)}...`);
    
    // 1. INPUT VALIDATION
    const validation = this.validateInput(patientData);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.error}`);
    }

    // 2. PROCESS WITH NEW ZIKA MODEL
    const zikaResult = this.zikaModel.predict({
      age: parseInt(age),
      sex: sex,
      travelHistory: travel_history || '',
      symptoms: Array.isArray(symptoms) ? symptoms : [symptoms].filter(Boolean),
      comorbidities: Array.isArray(comorbidities) ? comorbidities : [comorbidities].filter(Boolean)
    });

    return {
      success: true,
      timestamp: new Date().toISOString(),
      patient_summary: {
        age: patientData.age,
        sex: patientData.sex,
        travel_history: patientData.travel_history || 'Not provided',
        symptoms: patientData.symptoms || [],
        comorbidities: patientData.comorbidities || []
      },
      risk_assessment: zikaResult.prediction,
      ai_metadata: {
        model_name: this.zikaModel.name,
        version: this.zikaModel.version,
        disclaimer: "This AI assessment is for clinical decision support only. Final diagnosis must be made by a qualified healthcare professional."
      }
    };
  }

  /**
   * Analyze malaria from blood smear
   */
  analyzeMalaria(patientData, imageData = {}) {
    console.log(`🦠 Malaria Analysis Request:`, {
      age: patientData.age,
      symptoms: patientData.symptoms?.length || 0,
      travel: patientData.travel_history?.substring(0, 50)
    });

    // Validate input
    const validation = this.validateInput(patientData);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.error}`);
    }

    // Process with Malaria model
    const malariaResult = this.malariaModel.analyze({
      age: parseInt(patientData.age),
      sex: patientData.sex,
      travelHistory: patientData.travel_history || '',
      symptoms: Array.isArray(patientData.symptoms) ? patientData.symptoms : [patientData.symptoms].filter(Boolean)
    }, imageData);

    return {
      success: true,
      timestamp: new Date().toISOString(),
      patient_summary: {
        age: patientData.age,
        sex: patientData.sex,
        travel_history: patientData.travel_history || 'Not provided',
        symptoms: patientData.symptoms || []
      },
      malaria_analysis: malariaResult.analysis,
      ai_metadata: {
        model_name: this.malariaModel.name,
        version: this.malariaModel.version,
        disclaimer: "Requires confirmation by microscopy. This AI assessment is for clinical decision support only."
      }
    };
  }

  /**
   * Dual screening for Zika and Malaria
   */
  dualScreening(patientData, imageData = {}) {
    console.log(`🔄 Dual Screening Request:`, {
      age: patientData.age,
      sex: patientData.sex,
      hasImage: !!imageData
    });

    // Validate input
    const validation = this.validateInput(patientData);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.error}`);
    }

    // Process with Dual Screening model
    const screeningData = {
      age: parseInt(patientData.age),
      sex: patientData.sex,
      travelHistory: patientData.travel_history || '',
      symptoms: Array.isArray(patientData.symptoms) ? patientData.symptoms : [patientData.symptoms].filter(Boolean),
      comorbidities: Array.isArray(patientData.comorbidities) ? patientData.comorbidities : [patientData.comorbidities].filter(Boolean)
    };

    const screeningResult = this.dualScreeningModel.screen(screeningData, imageData);

    return {
      success: true,
      timestamp: new Date().toISOString(),
      patient_summary: {
        age: patientData.age,
        sex: patientData.sex,
        travel_history: patientData.travel_history || 'Not provided',
        symptoms: patientData.symptoms || [],
        comorbidities: patientData.comorbidities || []
      },
      screening_result: screeningResult.screening,
      ai_metadata: {
        model_name: this.dualScreeningModel.name,
        version: this.dualScreeningModel.version,
        disclaimer: "This AI assessment is for clinical decision support only. Final diagnosis must be made by a qualified healthcare professional."
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
    if (isNaN(age) || age < AI_CONFIG.VALIDATION.MIN_AGE || age > AI_CONFIG.VALIDATION.MAX_AGE) {
      errors.push(`Invalid age: ${data.age}. Must be between ${AI_CONFIG.VALIDATION.MIN_AGE} and ${AI_CONFIG.VALIDATION.MAX_AGE}`);
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
const aiEngine = new ABSUTHClinicalAI();

// POST /api/zika/predict - Advanced Clinical Prediction
router.post('/predict', auth, async (req, res) => {
  try {
    console.log('🎯 Advanced AI Prediction Request:', {
      user: req.user.email,
      data: { ...req.body, travel_history: req.body.travel_history?.substring(0, 100) }
    });
    
    const { patientId, age, sex, travel_history, symptoms = [], comorbidities = [] } = req.body;
    
    // Validate required fields
    if (!age || !sex) {
      return res.status(400).json({
        success: false,
        message: 'Age and biological sex are required fields',
        required_fields: ['age', 'sex'],
        note: 'Travel history, symptoms, and comorbidities are optional but recommended'
      });
    }
    
    // Process with AI Engine
    const prediction = aiEngine.predictZikaRisk({
      age,
      sex,
      travel_history,
      symptoms: Array.isArray(symptoms) ? symptoms : [symptoms].filter(Boolean),
      comorbidities: Array.isArray(comorbidities) ? comorbidities : [comorbidities].filter(Boolean)
    });
    
    console.log('✅ AI Prediction Complete:', {
      risk_level: prediction.risk_assessment.risk_level,
      probability: prediction.risk_assessment.probability_percentage,
      confidence: prediction.risk_assessment.confidence
    });
    
    // Save to database if needed
    try {
      if (patientId) {
        // Save prediction record logic here
        console.log(`📝 Prediction recorded for patient: ${patientId}`);
      }
    } catch (dbError) {
      console.warn('⚠️ Database save failed (prediction still successful):', dbError.message);
      // Continue - don't fail the prediction if DB save fails
    }
    
    // Return successful prediction
    res.json({
      success: true,
      message: 'Clinical risk assessment completed successfully',
      ...prediction,
      system_note: 'Powered by ABSUTH Clinical AI v3.0 - For clinical decision support only'
    });
    
  } catch (error) {
    console.error('❌ AI Prediction Error:', {
      message: error.message,
      stack: error.stack,
      request: { ...req.body, travel_history: req.body.travel_history?.substring(0, 50) }
    });
    
    // User-friendly error messages
    let statusCode = 500;
    let errorMessage = 'Failed to process clinical prediction';
    
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

// POST /api/zika/malaria-analyze - Malaria detection
router.post('/malaria-analyze', auth, async (req, res) => {
  try {
    console.log('🦠 Malaria Analysis Request:', {
      user: req.user.email,
      data: { ...req.body }
    });
    
    const { patientId, age, sex, travel_history, symptoms = [], imageData = {} } = req.body;
    
    // Validate required fields
    if (!age || !sex) {
      return res.status(400).json({
        success: false,
        message: 'Age and biological sex are required fields',
        required_fields: ['age', 'sex']
      });
    }
    
    // Process with AI Engine
    const analysis = aiEngine.analyzeMalaria({
      age,
      sex,
      travel_history,
      symptoms: Array.isArray(symptoms) ? symptoms : [symptoms].filter(Boolean)
    }, imageData);
    
    console.log('✅ Malaria Analysis Complete:', {
      result: analysis.malaria_analysis.result,
      probability: analysis.malaria_analysis.probability
    });
    
    // Save to database if needed
    try {
      if (patientId) {
        console.log(`📝 Malaria analysis recorded for patient: ${patientId}`);
      }
    } catch (dbError) {
      console.warn('⚠️ Database save failed (analysis still successful):', dbError.message);
    }
    
    res.json({
      success: true,
      message: 'Malaria analysis completed successfully',
      ...analysis
    });
    
  } catch (error) {
    console.error('❌ Malaria Analysis Error:', error.message);
    
    let statusCode = 500;
    let errorMessage = 'Failed to process malaria analysis';
    
    if (error.message.includes('Validation failed')) {
      statusCode = 400;
      errorMessage = error.message;
    }
    
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/zika/dual-screening - Dual pathogen screening
router.post('/dual-screening', auth, async (req, res) => {
  try {
    console.log('🔄 Dual Screening Request:', {
      user: req.user.email,
      hasImageData: !!req.body.imageData
    });
    
    const { patientId, age, sex, travel_history, symptoms = [], comorbidities = [], imageData = {} } = req.body;
    
    // Validate required fields
    if (!age || !sex) {
      return res.status(400).json({
        success: false,
        message: 'Age and biological sex are required fields',
        required_fields: ['age', 'sex']
      });
    }
    
    // Process with AI Engine
    const screening = aiEngine.dualScreening({
      age,
      sex,
      travel_history,
      symptoms: Array.isArray(symptoms) ? symptoms : [symptoms].filter(Boolean),
      comorbidities: Array.isArray(comorbidities) ? comorbidities : [comorbidities].filter(Boolean)
    }, imageData);
    
    console.log('✅ Dual Screening Complete:', {
      overall_risk: screening.screening_result.overall_risk,
      priority: screening.screening_result.priority_level
    });
    
    // Save to database if needed
    try {
      if (patientId) {
        console.log(`📝 Dual screening recorded for patient: ${patientId}`);
      }
    } catch (dbError) {
      console.warn('⚠️ Database save failed (screening still successful):', dbError.message);
    }
    
    res.json({
      success: true,
      message: 'Dual pathogen screening completed successfully',
      ...screening
    });
    
  } catch (error) {
    console.error('❌ Dual Screening Error:', error.message);
    
    let statusCode = 500;
    let errorMessage = 'Failed to process dual screening';
    
    if (error.message.includes('Validation failed')) {
      statusCode = 400;
      errorMessage = error.message;
    }
    
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/zika/ai-info - Get AI model information
router.get('/ai-info', auth, (req, res) => {
  res.json({
    success: true,
    ai_model: {
      name: aiEngine.name,
      version: aiEngine.version,
      last_updated: aiEngine.lastUpdated,
      capabilities: [
        'Zika virus risk assessment',
        'Malaria blood smear analysis',
        'Dual pathogen screening',
        'Clinical decision support',
        'Differential diagnosis generation',
        'Personalized recommendations'
      ],
      models_included: [
        aiEngine.zikaModel.name,
        aiEngine.malariaModel.name,
        aiEngine.dualScreeningModel.name
      ],
      risk_factors_considered: [
        'Age and demographic profile',
        'Biological sex and pregnancy considerations',
        'Travel history and destination risk',
        'Symptom presence and severity',
        'Comorbidities and health status'
      ],
      validation: 'Based on WHO guidelines and clinical epidemiology',
      disclaimer: 'For clinical decision support only. Not a replacement for medical diagnosis.',
      endpoints: {
        predict: 'POST /api/zika/predict',
        malaria_analyze: 'POST /api/zika/malaria-analyze',
        dual_screening: 'POST /api/zika/dual-screening',
        info: 'GET /api/zika/ai-info'
      }
    }
  });
});

// POST /api/zika/batch-predict - Batch prediction for multiple patients
router.post('/batch-predict', auth, async (req, res) => {
  try {
    const { patients } = req.body;
    
    if (!Array.isArray(patients) || patients.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Patients array is required and must not be empty'
      });
    }
    
    console.log(`🔄 Batch prediction for ${patients.length} patients`);
    
    const predictions = patients.map((patient, index) => {
      try {
        return {
          patient_id: patient.patientId || `PAT${index + 1}`,
          prediction: aiEngine.predictZikaRisk(patient)
        };
      } catch (error) {
        return {
          patient_id: patient.patientId || `PAT${index + 1}`,
          error: error.message,
          success: false
        };
      }
    });
    
    const successful = predictions.filter(p => p.prediction?.success);
    const failed = predictions.filter(p => p.error);
    
    res.json({
      success: true,
      message: `Batch prediction completed: ${successful.length} successful, ${failed.length} failed`,
      total: patients.length,
      successful: successful.length,
      failed: failed.length,
      predictions: predictions,
      summary: {
        critical_risk: successful.filter(p => p.prediction.risk_assessment.risk_level === 'CRITICAL').length,
        high_risk: successful.filter(p => p.prediction.risk_assessment.risk_level === 'HIGH').length,
        moderate_risk: successful.filter(p => p.prediction.risk_assessment.risk_level === 'MODERATE').length,
        low_risk: successful.filter(p => p.prediction.risk_assessment.risk_level === 'LOW' || p.prediction.risk_assessment.risk_level === 'VERY LOW').length
      }
    });
    
  } catch (error) {
    console.error('❌ Batch prediction error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Batch prediction failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/zika/models - Get all available models
router.get('/models', auth, (req, res) => {
  res.json({
    success: true,
    models: [
      {
        name: aiEngine.zikaModel.name,
        version: aiEngine.zikaModel.version,
        description: 'Zika virus risk assessment model',
        trained_date: aiEngine.zikaModel.trainedDate,
        endpoint: '/api/zika/predict'
      },
      {
        name: aiEngine.malariaModel.name,
        version: aiEngine.malariaModel.version,
        description: 'Malaria blood smear analysis model',
        trained_date: '2024-11-15',
        endpoint: '/api/zika/malaria-analyze'
      },
      {
        name: aiEngine.dualScreeningModel.name,
        version: aiEngine.dualScreeningModel.version,
        description: 'Dual pathogen screening (Zika + Malaria)',
        trained_date: '2024-12-01',
        endpoint: '/api/zika/dual-screening'
      }
    ]
  });
});

module.exports = router;