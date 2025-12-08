// routes/malaria.js - Malaria Detection using YOUR TFLite model
const express = require('express');
const multer = require('multer');
const tf = require('@tensorflow/tfjs-node');
const fs = require('fs');
const router = express.Router();
const auth = require('../middleware/auth');

const upload = multer({ dest: 'uploads/' });

// Load TFLite model once
let interpreter;
(async () => {
  const modelPath = 'file://./models/malaria_lite.tflite';
  interpreter = await tf.node.tfLiteInterpreter(modelPath);
  console.log("TFLite Malaria model loaded!");
})();

router.post('/detect', auth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No image' });

    // Read and preprocess image
    const imageBuffer = fs.readFileSync(req.file.path);
    const tensor = tf.node.decodeImage(imageBuffer)
      .resizeNearestNeighbor([224, 224])
      .toFloat()
      .div(tf.scalar(255.0))
      .expandDims();

    // Run inference
    const inputIndex = interpreter.getInputIndex('serving_default_input_1');
    const outputIndex = interpreter.getOutputIndex('StatefulPartitionedCall');
    
    interpreter.setTensor(inputIndex, tensor);
    interpreter.run();
    const output = interpreter.getTensor(outputIndex);
    const prediction = output.dataSync()[0];

    const result = prediction > 0.5 ? "Parasitized" : "Uninfected";
    const confidence = prediction > 0.5 ? prediction : 1 - prediction;

    // Clean up
    fs.unlinkSync(req.file.path);
    tf.dispose([tensor, output]);

    res.json({
      success: true,
      malaria_detection: {
        result,
        confidence: Number(confidence.toFixed(4)),
        parasite_probability: Number(prediction.toFixed(4)),
        recommendation: result === "Parasitized"
          ? "URGENT: Start ACT treatment + Confirm with microscopy"
          : "No malaria parasites detected"
      }
    });
 }
  catch (error) {
    console.error("Malaria AI error:", error);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ success: false, message: "Malaria detection failed" });
  }
});

module.exports = router;