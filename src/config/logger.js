import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import expressWinston from 'express-winston';

// Configure Winston logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info', // Use environment variable for level
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new DailyRotateFile({
            filename: 'logs/app-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '14d',
            level: 'info' // Log info level and above to file
        }),
        // Optionally add console transport for development
        // new winston.transports.Console({
        //     format: winston.format.combine(
        //         winston.format.colorize(),
        //         winston.format.simple()
        //     ),
        //     level: 'debug' // Log debug level and above to console
        // })
    ],
    exitOnError: false, // Do not exit on handled exceptions
});

// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        ),
        level: 'debug'
    }));
}


// Middleware for logging HTTP requests
const requestLogger = expressWinston.logger({
    winstonInstance: logger,
    meta: true, // Log metadata (req, res)
    msg: "HTTP {{req.method}} {{req.url}} {{res.statusCode}} {{res.responseTime}}ms",
    expressFormat: false, // Use custom msg format
    colorize: process.env.NODE_ENV !== 'production', // Colorize logs in non-production
    ignoreRoute: function (req, res) { return false; } // Ignore specific routes if needed
});

// Middleware for logging errors
const errorLogger = expressWinston.errorLogger({
    winstonInstance: logger,
    meta: true,
    msg: "Error {{err.message}}",
    colorize: process.env.NODE_ENV !== 'production'
});

export { logger, requestLogger, errorLogger };
