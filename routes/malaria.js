const express = require('express');
const router = express.Router();
const axios = require('axios');
const FormData = require('form-data');
const multer = require('multer');
const auth = require('../middleware/auth');
const MalariaRecord = require('../models/MalariaRecord');

// Configure multer for image upload
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

const AI_SERVER_URL = process.env.PYTHON_AI_URL || 'https://zika-ai-engine.onrender.com';

// POST /api/malaria/detect - Detect malaria from blood smear
router.post('/detect', auth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file uploaded'
      });
    }

    console.log('📤 Sending image to AI server...');
    console.log('Image size:', req.file.size, 'bytes');

    // Create form data
    const formData = new FormData();
    formData.append('file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });

    // Call Python AI server
    const aiResponse = await axios.post(
      `${AI_SERVER_URL}/detect-malaria`,
      formData,
      {
        headers: {
          ...formData.getHeaders()
        },
        timeout: 60000, // 60 second timeout for image processing
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    console.log('✅ AI malaria detection response received');

    const detection = aiResponse.data.malaria_detection;

    // Save malaria detection record
    const record = new MalariaRecord({
      detectedBy: req.user.id,
      result: detection.result,
      confidence: detection.confidence,
      parasiteProbability: detection.parasite_probability,
      recommendation: detection.recommendation,
      imageSize: req.file.size,
      imageName: req.file.originalname,
      timestamp: new Date()
    });
    await record.save();
    console.log('✅ Malaria record saved');

    res.json({
      success: true,
      message: 'Malaria detection completed',
      malaria_detection: detection,
      recordId: record._id
    });

  } catch (error) {
    console.error('❌ Malaria detection error:', error.message);

    if (error.response) {
      console.error('AI Server Response:', error.response.data);
    }

    res.status(500).json({
      success: false,
      message: 'Malaria detection failed',
      error: error.message,
      details: error.response?.data || 'Could not connect to AI server'
    });
  }
});

// GET /api/malaria/history - Get detection history
router.get('/history', auth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;

    const records = await MalariaRecord.find({ detectedBy: req.user.id })
      .sort({ timestamp: -1 })
      .skip(offset)
      .limit(limit);

    const total = await MalariaRecord.countDocuments({ detectedBy: req.user.id });

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

// GET /api/malaria/stats - Get detection statistics
router.get('/stats', auth, async (req, res) => {
  try {
    const totalDetections = await MalariaRecord.countDocuments({
      detectedBy: req.user.id
    });

    const parasitizedCount = await MalariaRecord.countDocuments({
      detectedBy: req.user.id,
      result: 'Parasitized'
    });

    const uninfectedCount = totalDetections - parasitizedCount;

    res.json({
      success: true,
      stats: {
        total: totalDetections,
        parasitized: parasitizedCount,
        uninfected: uninfectedCount,
        infectionRate: totalDetections > 0 
          ? ((parasitizedCount / totalDetections) * 100).toFixed(1) 
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

module.exports = router;