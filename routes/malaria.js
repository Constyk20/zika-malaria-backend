// routes/malaria.js - BLOOD SMEAR DETECTION (Render + FastAPI Compatible)
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const auth = require('../middleware/auth');

// Temporary upload folder
const upload = multer({ dest: 'uploads/' });

// POST /api/malaria/detect - Upload blood smear image
router.post('/detect', auth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image uploaded' });
    }

    // Read file as base64 (most reliable for Render → FastAPI)
    const imagePath = req.file.path;
    const imageBase64 = fs.readFileSync(imagePath, { encoding: 'base64' });

    // Call your FastAPI AI engine
    const aiResponse = await axios.post(
      `${process.env.PYTHON_AI_URL || 'http://localhost:5001'}/detect-malaria`,
      {
        file: imageBase64  // FastAPI expects base64 string
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      }
    );

    // Clean up uploaded file
    fs.unlinkSync(imagePath);

    res.json({
      success: true,
      malaria_result: aiResponse.data.malaria_detection || aiResponse.data,
      detected_at: new Date().toISOString(),
      uploaded_file: req.file.originalname
    });

  } catch (error) {
    // Clean up even on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.error("Malaria detection error:", error.message);
    res.status(500).json({
      success: false,
      message: error.response?.data || error.message || "AI service unavailable"
    });
  }
});

module.exports = router;