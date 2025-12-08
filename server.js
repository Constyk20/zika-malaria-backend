require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');

const app = express();

// Middleware
app.use(cors({
  origin: '*', // In production, specify your Flutter app domain
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token']
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'ACTIVE',
    service: 'ABSUTH Backend API',
    version: '2.0',
    endpoints: {
      auth: '/api/auth',
      patients: '/api/patients',
      zika: '/api/zika',
      malaria: '/api/malaria'
    },
    pythonAI: process.env.PYTHON_AI_URL || 'Not configured',
    mongoStatus: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/patients', require('./routes/patients'));
app.use('/api/zika', require('./routes/zika'));
app.use('/api/malaria', require('./routes/malaria'));


// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  console.error('Stack:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// MongoDB connection with improved error handling
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected successfully');
    console.log('✅ Database:', mongoose.connection.name);
    console.log('✅ Host:', mongoose.connection.host);
    console.log('✅ Port:', mongoose.connection.port);
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.error('❌ MongoDB URI used:', process.env.MONGO_URI ? 'Present (hidden for security)' : 'Missing');
    process.exit(1);
  }
};

// MongoDB connection event handlers
mongoose.connection.on('error', err => {
  console.error('❌ MongoDB connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected');
});

// Handle application termination
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('👋 MongoDB connection closed through app termination');
  process.exit(0);
});

const PORT = process.env.PORT || 5000;

// Start server after DB connection
const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`🚀 Backend server running on http://localhost:${PORT}`);
      console.log(`🔗 Python AI URL: ${process.env.PYTHON_AI_URL || 'NOT SET'}`);
      console.log(`📱 Ready for Flutter connections`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();