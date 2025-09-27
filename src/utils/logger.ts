import winston from 'winston';

const logLevel = process.env.LOG_LEVEL || 'info';
const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

// Create logger instance
export const logger = winston.createLogger({
  level: isTest ? 'silent' : logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'campaign-manager',
    version: process.env.npm_package_version,
    environment: process.env.NODE_ENV
  },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: isProduction ?
        winston.format.json() :
        winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
    })
  ]
});

// Add file transports in production
if (isProduction) {
  logger.add(new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    maxsize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
    tailable: true
  }));

  logger.add(new winston.transports.File({
    filename: 'logs/combined.log',
    maxsize: 10 * 1024 * 1024, // 10MB
    maxFiles: 10,
    tailable: true
  }));
}

// Helper function to create child loggers with context
export function createChildLogger(context: Record<string, any>) {
  return logger.child(context);
}

// Performance logger for timing operations
export function createPerformanceLogger(operation: string) {
  const start = Date.now();

  return {
    finish: (metadata?: Record<string, any>) => {
      const duration = Date.now() - start;
      logger.info('Operation completed', {
        operation,
        duration,
        ...metadata
      });
      return duration;
    },
    error: (error: Error, metadata?: Record<string, any>) => {
      const duration = Date.now() - start;
      logger.error('Operation failed', {
        operation,
        duration,
        error: error.message,
        stack: error.stack,
        ...metadata
      });
      return duration;
    }
  };
}