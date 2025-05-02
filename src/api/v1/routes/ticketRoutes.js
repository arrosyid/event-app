import express from 'express';
import TicketController from '../../../controllers/TicketController.js';
import authMiddleware from '../../../middlewares/authMiddleware.js';
import roleMiddleware from '../../../middlewares/roleMiddleware.js'; // Assuming roleMiddleware exists and works

const router = express.Router();

// GET /api/v1/tickets/paid - Get all paid tickets (Admin only)
router.get(
    '/paid',
    authMiddleware,
    roleMiddleware(['admin']), // Ensure only admins can access
    TicketController.listAllPaidTickets
);

// GET /api/v1/tickets/my - Get paid tickets for the logged-in user
router.get(
    '/my',
    authMiddleware, // Ensure user is logged in
    TicketController.listMyPaidTickets
);

// Add other ticket-related routes here if needed (e.g., get specific ticket, check-in)

export default router;
