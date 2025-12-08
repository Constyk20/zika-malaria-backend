// routes/malaria.js - Malaria Detection (model in routes/models/)
const express = require('express');
const multer = require('multer');
const tf = require('@tensorflow/tfjs-node');
const fs = require('fs');
const sharp = require('sharp');
const router = express.Router();
const auth = require('../middleware/auth');

const upload = multer({ dest: 'uploads/' });

// Load TFLite model from routes/models/
let interpreter;
(async () => {
  const modelPath = 'file://./routes/models/malaria_lite.tflite';
  interpreter = await tf.node.loadSavedModel(modelPath);
  console.log('TFLite Malaria model loaded from routes/models/');
})();

router.post('/detect', auth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No image' });

    const imageBuffer = fs.readFileSync(req.file.path);
    const processedImage = await sharp(imageBuffer)
      .resize(224, 224)
      .toFormat('jpeg')
      .toBuffer();

    const tensor = tf.node.decodeImage(processedImage)
      .expandDims(0)
      .div(255.0);

    const prediction = interpreter.predict({ 'input': tensor });
    const predData = await prediction['output'].data();
    const probability = predData[0];

    const result = probability > 0.5 ? "Parasitized" : "Uninfected";
    const confidence = probability > 0.5 ? probability : 1 - probability;

    fs.unlinkSync(req.file.path);
    tensor.dispose();

    res.json({
      success: true,
      malaria_detection: {
        result,
        confidenceчат: Number(confidence.toFixed(4)),
        parasite_probability: Number(probability.toFixed(4)),
        recommendation: result === "Parasitized"
          ? "URGENT: Start ACT treatment"
          : "No malaria parasites"
      }
    });
  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path);
    console.error("Malaria AI error:", error);
    res.status(500).json({ success: false, message: "Detection failed" });
  }
});

module.exports = router;