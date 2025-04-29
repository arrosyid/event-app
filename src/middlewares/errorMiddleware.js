import multer from 'multer';
import { logger, errorLogger as winstonErrorLogger } from '../config/logger.js'; // Import base logger and Winston error logger middleware

// Middleware to handle Multer-specific errors first
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        logger.warn(`Multer error during upload for route ${req.path}: ${err.code} - ${err.message}`);
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: `File size limit exceeded. Max size: ${process.env.MAX_FILE_SIZE_MB || '5'}MB.`
            });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
             // Use the custom message from the fileFilter if available
            return res.status(400).json({
                success: false,
                message: err.message || "Invalid file type. Only images are allowed."
            });
        }
        // Handle other potential Multer errors
        return res.status(400).json({
            success: false,
            message: `File upload error: ${err.message}`
        });
    }
    // If it's not a Multer error, pass it to the next error handler
    next(err);
};


// General error handling middleware (should be placed last)
const handleGenericError = (err, req, res, next) => {
    // Log the error using the base logger instance for detailed info
    logger.error('Unhandled error:', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        // Add any other relevant context
    });

    // Determine status code - default to 500 if not set
    const statusCode = err.statusCode || 500;

    // Send a generic error response to the client
    // Avoid sending stack traces or sensitive details in production
    res.status(statusCode).json({
        success: false,
        message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
        // Optionally include stack in development
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
};

// Export the handlers
// Note: Winston's errorLogger should be added separately in app.js *before* handleGenericError
// if you want it to log errors automatically before they reach the final handler.
export { handleMulterError, handleGenericError, winstonErrorLogger };
