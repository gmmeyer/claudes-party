import winston from 'winston';
import * as path from 'path';
import { app } from 'electron';

// Get the user data directory for log files
const getLogPath = (): string => {
  try {
    return path.join(app.getPath('userData'), 'logs');
  } catch {
    // Fallback if app is not ready yet
    return path.join(process.cwd(), 'logs');
  }
};

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  })
);

// Custom format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
  })
);

// Create the logger instance
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  transports: [
    // Console transport - always enabled
    new winston.transports.Console({
      format: consoleFormat,
    }),
  ],
});

// Add file transport after app is ready
let fileTransportAdded = false;

export function initializeFileLogging(): void {
  if (fileTransportAdded) return;

  try {
    const logPath = getLogPath();

    // Add file transport for errors
    logger.add(
      new winston.transports.File({
        filename: path.join(logPath, 'error.log'),
        level: 'error',
        format: fileFormat,
        maxsize: 5 * 1024 * 1024, // 5MB
        maxFiles: 3,
      })
    );

    // Add file transport for combined logs
    logger.add(
      new winston.transports.File({
        filename: path.join(logPath, 'combined.log'),
        format: fileFormat,
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 3,
      })
    );

    fileTransportAdded = true;
    logger.info('File logging initialized', { logPath });
  } catch (error) {
    logger.warn('Failed to initialize file logging', { error });
  }
}

// Export convenience methods
export const log = {
  debug: (message: string, meta?: Record<string, unknown>) => logger.debug(message, meta),
  info: (message: string, meta?: Record<string, unknown>) => logger.info(message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => logger.warn(message, meta),
  error: (message: string, meta?: Record<string, unknown>) => logger.error(message, meta),
};

export default logger;
