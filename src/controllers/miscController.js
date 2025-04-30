// import { getAsync, setAsync } from '../config/redis.js'; 
import { register as metricsRegister } from '../config/metrics.js';
import { logger } from '../config/logger.js';

class MiscController {
    /**
     * GET /api/v1/metrics
     * Serves Prometheus metrics.
     */
    async getMetrics(req, res, next) {
        try {
            res.set('Content-Type', metricsRegister.contentType);
            res.end(await metricsRegister.metrics());
            logger.debug('Served Prometheus metrics.');
        } catch (error) {
            logger.error('Error serving metrics:', { error: error.message });
            // Avoid sending JSON response here as content type is already set
            res.status(500).end(error.message); // Send plain text error
            // Or pass to next(error) if generic handler can manage different content types
        }
    }

    /**
     * GET /api/v1/large-data (Placeholder/Example)
     * Demonstrates streaming large data (original implementation was incomplete).
     */
    streamLargeData(req, res, next) {
        // This is a placeholder. The original 'Collection.find().cursor()' suggests a database
        // interaction (likely MongoDB) which isn't set up here.
        // Replace with actual data streaming logic if needed.
        logger.info('Received request for /large-data (placeholder)');
        res.setHeader('Content-Type', 'application/json');
        res.write('[');
        // Simulate streaming some data
        for (let i = 0; i < 5; i++) {
            if (i > 0) res.write(',');
            res.write(JSON.stringify({ id: i, message: `Item ${i}` }));
        }
        res.write(']');
        res.end();
    }
}

export default new MiscController();
