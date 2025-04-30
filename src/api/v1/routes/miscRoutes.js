import express from 'express';
import MiscController from '../../../controllers/miscController.js';
const router = express.Router();
/**
 * @route   GET /api/v1/metrics
 * @desc    Get Prometheus metrics
 * @access  Public (usually)
 */
router.get('/metrics', MiscController.getMetrics);

export default router;
