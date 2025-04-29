import { httpRequestDurationMicroseconds } from '../config/metrics.js';
import { logger } from '../config/logger.js'; // Optional: for logging

/**
 * Middleware to record the duration of HTTP requests for Prometheus monitoring.
 */
const metricsMiddleware = (req, res, next) => {
    const start = Date.now(); // Use Date.now() for high-resolution time

    // Hook into the 'finish' event of the response object
    res.on('finish', () => {
        try {
            const duration = (Date.now() - start) / 1000; // Duration in seconds
            const route = req.route?.path || req.path; // Get matched route path if available, otherwise use req.path
            const statusCode = res.statusCode;

            // Observe the duration with labels
            httpRequestDurationMicroseconds
                .labels(req.method, route, statusCode)
                .observe(duration);

            logger.debug(`Metrics recorded for ${req.method} ${route} ${statusCode} - ${duration.toFixed(4)}s`);
        } catch (error) {
            // Avoid crashing the app if metrics recording fails
            logger.error('Failed to record HTTP request metrics:', { error: error.message, path: req.path });
        }
    });

    // Proceed to the next middleware/handler
    next();
};

export default metricsMiddleware;
