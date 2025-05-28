const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const conversionRoutes = require('./routes/conversion');
const configRoutes = require('./routes/config');
const { errorHandler, logError } = require('./middleware/errorHandler');
const { authenticateUser } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"]
    }
  }
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// Health check endpoint (before auth check)
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    mode: 'hybrid', // Both API and Web Interface
    endpoints: {
      web: ['/', '/setup', '/converter'],
      api: ['/api/config/*', '/api/auth/*', '/api/convert/*']
    }
  });
});

// API routes (higher priority)
app.use('/api/config', configRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/convert', authenticateUser, conversionRoutes);

// Serve static files for web interface
app.use(express.static(path.join(__dirname, 'public'), {
  index: false, // Don't auto-serve index.html
  setHeaders: (res, filePath) => {
    // Cache static assets for 1 hour
    if (filePath.endsWith('.css') || filePath.endsWith('.js')) {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  }
}));

// Web interface routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/setup', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'setup.html'));
});

app.get('/setup.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'setup.html'));
});

app.get('/converter', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'converter.html'));
});

app.get('/converter.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'converter.html'));
});

// API-only 404 handler for /api/* routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ 
    error: 'API endpoint not found',
    path: req.originalUrl,
    method: req.method,
    availableEndpoints: [
      'GET /api/config/status',
      'POST /api/config/test',
      'POST /api/config/save',
      'GET /api/auth/google',
      'GET /api/auth/callback',
      'GET /api/auth/user',
      'POST /api/convert/markdown-to-doc',
      'GET /api/convert/history'
    ]
  });
});

// Catch-all for non-API routes (serve index.html for SPA)
app.get('*', (req, res) => {
  // If it looks like an API request, return JSON error
  if (req.path.startsWith('/api/') || req.headers.accept?.includes('application/json')) {
    return res.status(404).json({ 
      error: 'Endpoint not found',
      path: req.originalUrl,
      method: req.method,
      suggestion: 'Check available endpoints at /health'
    });
  }
  
  // Otherwise serve the main page (SPA fallback)
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global error handler
app.use(errorHandler);

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Unhandled rejection and exception handling
process.on('unhandledRejection', (reason, promise) => {
  logError('Unhandled Rejection', { reason, promise });
});

process.on('uncaughtException', (error) => {
  logError('Uncaught Exception', error);
  process.exit(1);
});

app.listen(PORT, () => {
  console.log(`🚀 Markdown to Google Docs API server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});