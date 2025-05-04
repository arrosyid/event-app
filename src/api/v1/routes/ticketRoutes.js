import express from 'express';
import { param, validationResult } from 'express-validator'; // Import validation tools
import TicketController from '../../../controllers/TicketController.js';
import authMiddleware from '../../../middlewares/authMiddleware.js';
import roleMiddleware from '../../../middlewares/roleMiddleware.js';
// import { handleValidationErrors } from '../../../middlewares/errorMiddleware.js'; // Import validation error handler
import { handleMulterError } from '../../../middlewares/errorMiddleware.js'; // Corrected path

const router = express.Router();

// Validation middleware for uniqueCode parameter
const validateUniqueCode = [
    param('uniqueCode').notEmpty().withMessage('Ticket unique code is required.'),
    // handleValidationErrors // Use the centralized handler
    handleMulterError
];

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

// GET /api/v1/tickets/:uniqueCode - Get specific ticket details (Owner or Admin)
router.get(
    '/:uniqueCode',
    authMiddleware, // Ensure user is logged in
    validateUniqueCode, // Validate the uniqueCode parameter
    TicketController.getTicketByCode
);

// POST /api/v1/tickets/:uniqueCode/checkin - Check-in a ticket (Admin only)
router.post(
    '/:uniqueCode/checkin',
    authMiddleware,
    roleMiddleware(['admin']), // Ensure only admins can access
    validateUniqueCode, // Validate the uniqueCode parameter
    TicketController.checkInTicket
);


export default router;
