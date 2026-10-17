import winston from 'winston';
import 'winston-daily-rotate-file';

// 1. File Format: Pure JSON for server logs (Splunk/Datadog ready)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }), // Automatically grabs the full stack trace!
  winston.format.json()
);

// 2. Console Format: Beautiful, colorful, readable output for your local IDE
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `[${timestamp}] ${level}: ${message}`;
    
    // Print metadata (User ID, IP, URL) cleanly
    if (Object.keys(meta).length > 0) {
        log += `\n   ↳ Context: ${JSON.stringify(meta)}`;
    }
    
    // Print the stack trace in red if it crashed
    if (stack) {
        log += `\n   ↳ StackTrace: \n${stack}`;
    }
    return log;
  })
);

const logger = winston.createLogger({
  level: 'info',
  transports: [
    // Rotate ERROR logs daily, keep for 14 days
    new winston.transports.DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error', // ONLY errors go here
      maxFiles: '14d',
      format: fileFormat,
    }),
    // Rotate ALL logs daily, keep for 14 days
    new winston.transports.DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d', // Everything (info, warn, error) goes here
      format: fileFormat,
    }),
  ],
});

// If we are developing locally, ALSO print it beautifully to the terminal
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
  }));
}

export default logger;
