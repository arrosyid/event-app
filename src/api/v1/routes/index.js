import express from 'express';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import fileRoutes from './fileRoutes.js';
import miscRoutes from './miscRoutes.js';

const router = express.Router();

// Mount specific routers
router.use('/auth', authRoutes);       // Mount auth routes directly under /api/v1
router.use('/users', userRoutes);
router.use('/files', fileRoutes);

// Mount miscellaneous routes at the base of /api/v1
// Note: If miscRoutes has conflicting root paths with authRoutes, adjust accordingly
router.use('/', miscRoutes);

export default router;
