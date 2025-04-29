// import { getAsync, setAsync } from '../config/redis.js'; 
import { register as metricsRegister } from '../config/metrics.js';
import EncryptionService from '../utils/EncryptionService.js';
import { logger } from '../config/logger.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Resolve paths relative to the project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Assuming project root is two levels up from src/controllers
const projectRoot = path.resolve(__dirname, '../../');
const chatHtmlPath = path.join(projectRoot, 'index.html'); // Path to the chat HTML file

// Instantiate encryption service (consider passing secret from env vars)
const encryptionService = new EncryptionService();

class MiscController {

    /**
     * GET /api/v1/
     * Root endpoint welcome message.
     */
    getRoot(req, res) {
        const origin = req.headers['origin'] || req.headers['host'] || 'unknown origin';
        const message = origin.includes("localhost")
            ? 'Hello, Modular Backend! (from localhost)'
            : `Hello, Bolo! (from ${origin})`;
        res.status(200).send(message);
    }

    /**
     * GET /api/v1/redis-test
     * Tests Redis connection by setting and getting a key.
     */
    // async testRedis(req, res, next) {
    //     const testKey = 'redis:test';
    //     const testValue = 'Hello from Redis!';
    //     try {
    //         await setAsync(testKey, 60, testValue); // Set with 60s TTL
    //         const value = await getAsync(testKey);
    //         if (value === testValue) {
    //             logger.info('Redis test successful.');
    //             res.status(200).json({ success: true, message: 'Redis connection successful!', value: value });
    //         } else {
    //             logger.warn('Redis test failed: Value mismatch or key expired.');
    //             res.status(500).json({ success: false, message: 'Redis test failed: Could not retrieve set value.' });
    //         }
    //     } catch (error) {
    //         logger.error('Error during Redis test:', { error: error.message });
    //         next(error); // Pass to error handler
    //     }
    // }

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
     * GET /api/v1/grant-access
     * Simple endpoint protected by auth/role middleware.
     */
    grantAccess(req, res) {
        // Logic is primarily handled by authMiddleware and roleMiddleware
        logger.info(`Access granted for user ${req.user.id} to /grant-access`);
        res.status(200).json({
            success: true,
            message: 'Access granted',
            user: req.user // Show decoded user info from token
        });
    }

    /**
     * GET /chat (Note: This might be better served statically or have its own route outside /api/v1)
     * Serves the chat HTML file.
     */
    getChatHtml(req, res, next) {
        try {
            // Check if file exists before sending
            if (fs.existsSync(chatHtmlPath)) {
                res.sendFile(chatHtmlPath);
            } else {
                logger.error(`Chat HTML file not found at: ${chatHtmlPath}`);
                res.status(404).send('Chat interface not found.');
            }
        } catch (error) {
             logger.error('Error serving chat HTML:', { error: error.message });
             next(error);
        }
    }

    /**
     * POST /api/v1/secure-data
     * Encrypts data sent in the request body.
     */
    secureData(req, res, next) {
        try {
            const { data } = req.body;
            if (data === undefined || data === null) {
                return res.status(400).json({ success: false, message: 'Missing "data" field in request body.' });
            }

            logger.info(`Encrypting data...`); // Avoid logging the actual sensitive data
            const encrypted = encryptionService.encrypt(String(data));
            logger.info(`Data encrypted successfully.`);

            res.status(200).json({
                success: true,
                message: 'Data encrypted successfully',
                encryptedData: encrypted // Return the encrypted data
            });
        } catch (error) {
            logger.error('Error in secureData endpoint:', { error: error.message });
            next(error);
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

    // --- Simple Math Test Routes ---

    /** GET /api/v1/tambah */
    add(req, res) {
        res.send(`Hasil Tambah: ${20 + 10}`);
    }

    /** GET /api/v1/kurang */
    subtract(req, res) {
         // Original had addition, let's make it subtraction
        res.send(`Hasil Kurang: ${20 - 10}`);
    }

    /** GET /api/v1/bagi/:a/:b */
    divide(req, res) {
        const a = parseFloat(req.params.a);
        const b = parseFloat(req.params.b);

        if (isNaN(a) || isNaN(b)) {
            return res.status(400).send("Parameters must be numbers.");
        }
        if (b === 0) {
            return res.status(400).send("Cannot divide by zero.");
        }
        res.send(`Hasil Bagi: ${a / b}`);
    }
}

export default new MiscController();
