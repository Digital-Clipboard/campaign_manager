import express, { Express } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import winston from 'winston';
import campaignRoutes from './routes/campaigns';
import { errorHandler } from './utils/errorHandler';

// Load environment variables
dotenv.config();

// Configure logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Initialize Express app
const app: Express = express();
const port = parseInt(process.env.SERVICE_PORT || '8002');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'campaign-manager',
    timestamp: new Date().toISOString(),
    gemini_configured: !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE')
  });
});

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    service: 'Digital Campaign Manager',
    version: '1.0.0',
    description: 'AI-powered campaign management and optimization system',
    endpoints: {
      health: '/health',
      campaigns: '/api/v1/campaigns',
      create: '/api/v1/campaigns/create',
      analyze: '/api/v1/campaigns/analyze',
      optimize: '/api/v1/campaigns/optimize',
      list: '/api/v1/campaigns/list'
    }
  });
});

// API routes
app.use('/api/v1/campaigns', campaignRoutes);

// Error handling
app.use(errorHandler);

// Start server
app.listen(port, '0.0.0.0', () => {
  logger.info(`Campaign Manager running on port ${port}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);

  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
    logger.warn('⚠️  Gemini API key not configured. Please set GEMINI_API_KEY in .env file');
    logger.warn('Get your API key from: https://aistudio.google.com/app/apikey');
  } else {
    logger.info('✅ Gemini API configured');
  }
});

export default app;