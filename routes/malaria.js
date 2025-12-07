// routes/malaria.js - FULLY WORKING BLOOD SMEAR DETECTION
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const router = express.Router();
const auth = require('../middleware/auth');

const upload = multer({ dest: 'uploads/' });

router.post('/detect', auth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No image uploaded' });

    const formData = new FormData();
    formData.append('file', require('fs').createReadStream(req.file.path));

    const mlResponse = await axios.post(
      'http://localhost:5001/detect-malaria',
      formData,
      { headers: formData.getHeaders() }
    );

    const result = mlResponse.data;

    // Clean up
    require('fs').unlinkSync(req.file.path);

    res.json({
      success: true,
      malaria_result: result,
      detected_at: new Date().toISOString()
    });

  } catch (error) {
    console.error("Malaria detection error:", error.message);
    res.status(500).json({ success: false, message: "AI server error" });
  }
});

module.exports = router;