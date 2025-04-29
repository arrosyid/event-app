import express from 'express';
import MiscController from '../../../controllers/miscController.js';
import authMiddleware from '../../../middlewares/authMiddleware.js';
import roleMiddleware from '../../../middlewares/roleMiddleware.js';
import { param } from 'express-validator'; // For math route validation

const router = express.Router();

/**
 * @route   GET /api/v1/
 * @desc    Root API endpoint
 * @access  Public
 */
router.get('/', MiscController.getRoot);

/**
 * @route   GET /api/v1/redis-test
 * @desc    Test Redis connection
 * @access  Public (or restrict if needed)
 */
// router.get('/redis-test', MiscController.testRedis);

/**
 * @route   GET /api/v1/metrics
 * @desc    Get Prometheus metrics
 * @access  Public (usually)
 */
router.get('/metrics', MiscController.getMetrics);

/**
 * @route   GET /api/v1/grant-access
 * @desc    Test endpoint requiring specific roles
 * @access  Private (Admin, User)
 */
router.get(
    '/grant-access',
    authMiddleware,
    roleMiddleware(['admin', 'user']), // Roles defined in original code
    MiscController.grantAccess
);

/**
 * @route   POST /api/v1/secure-data
 * @desc    Encrypt provided data
 * @access  Public (or Private if needed)
 */
router.post('/secure-data', MiscController.secureData);

/**
 * @route   GET /api/v1/large-data
 * @desc    Placeholder for streaming large data
 * @access  Public (or Private)
 */
router.get('/large-data', MiscController.streamLargeData);


// --- Simple Math Test Routes ---

/** @route GET /api/v1/tambah */
router.get('/tambah', MiscController.add);

/** @route GET /api/v1/kurang */
router.get('/kurang', MiscController.subtract);

/** @route GET /api/v1/bagi/:a/:b */
const divideValidation = [
    param('a').isFloat().withMessage('Parameter "a" must be a number'),
    param('b').isFloat().withMessage('Parameter "b" must be a number')
];
router.get('/bagi/:a/:b', divideValidation, MiscController.divide);


// Note: The '/chat' route serving HTML is handled separately in app.js or a dedicated root router

export default router;
