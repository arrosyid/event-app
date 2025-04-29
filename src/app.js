// Buat event, atur kapasitas, generate e-ticket, dan validasi check-in.


import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

// --- Configurations ---
import { corsMiddleware, corsOptions } from './config/cors.js'; // Import middleware and options
import rateLimiter from './config/rateLimit.js';
import { logger, requestLogger, errorLogger as winstonErrorLogger } from './config/logger.js'; // Import base logger and middleware

// --- Middleware ---
import metricsMiddleware from './middlewares/metricsMiddleware.js';
import { handleGenericError } from './middlewares/errorMiddleware.js'; // Import only the generic handler

// --- Routes ---
import apiV1Router from './api/v1/routes/index.js';
import MiscController from './controllers/miscController.js'; // For root /chat route

// --- Setup ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../'); // Go up one level from src
const uploadsPath = path.join(projectRoot, 'uploads');

const app = express();
const httpServer = http.createServer(app);

// --- Global Middleware ---
app.use(corsMiddleware); // Apply CORS
app.use(rateLimiter); // Apply rate limiting
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(requestLogger); // Log HTTP requests (Winston)
app.use(metricsMiddleware); // Record request metrics

// --- Static Files ---
// Serve files from the 'uploads' directory (e.g., avatars)
// Make sure this path is correct relative to where the app runs
app.use('/uploads', express.static(uploadsPath));
logger.info(`Serving static files from ${uploadsPath} at /uploads`);

// --- API Routes ---
app.use('/api/v1', apiV1Router);
logger.info('Mounted API v1 routes at /api/v1');


app.get('/', (req, res) => {
    res.send('Hello, Back-end!');
});

// --- Root HTML Route (for chat example) ---
// Consider moving this if it's not part of the core API
app.get('/chat', MiscController.getChatHtml);

// --- Error Handling Middleware ---
// Winston error logger should come after routes but before the final handler
app.use(winstonErrorLogger);
// Final generic error handler
app.use(handleGenericError);


// --- Start Server ---
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
    // Note: Original code had HTTPS setup commented out. Add back if needed.
});

// --- Exports (Optional, for testing) ---
export { app, httpServer };
