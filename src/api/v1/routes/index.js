import express from 'express';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import fileRoutes from './fileRoutes.js';
import eventRoutes from './eventRoutes.js'; // Import event routes
import orderRoutes from './orderRoutes.js'; // Import order routes
import ticketRoutes from './ticketRoutes.js'; // Import ticket routes
import miscRoutes from './miscRoutes.js';

const router = express.Router();

// Mount specific routers
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/files', fileRoutes);
router.use('/events', eventRoutes); // Mount event routes
router.use('/orders', orderRoutes); // Mount order routes
router.use('/tickets', ticketRoutes); // Mount ticket routes

// Mount miscellaneous routes at the base of /api/v1
// Note: If miscRoutes has conflicting root paths with authRoutes, adjust accordingly
router.use('/', miscRoutes);

export default router;
