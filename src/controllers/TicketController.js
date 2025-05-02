import TicketService from '../services/TicketService.js';
import { logger } from '../config/logger.js';

class TicketController {

    /**
     * @description Get all paid tickets (Admin only)
     * @route GET /api/v1/tickets/paid
     * @access Private (Admin)
     */
    static async listAllPaidTickets(req, res, next) {
        try {
            logger.info('[TicketController] Request received for listing all paid tickets (Admin)');
            // Pass query parameters for pagination
            const result = await TicketService.listAllPaidTickets(req.query);
            res.status(result.status || 200).json(result);
        } catch (error) {
            logger.error(`[TicketController] Error listing all paid tickets: ${error.message}`, { stack: error.stack });
            next(error); // Pass to global error handler
        }
    }

    /**
     * @description Get paid tickets for the logged-in user
     * @route GET /api/v1/tickets/my
     * @access Private (User)
     */
    static async listMyPaidTickets(req, res, next) {
        const userId = req.user.id; // Get user ID from auth middleware
        if (!userId) {
            // This should ideally be caught by authMiddleware, but double-check
            logger.warn('[TicketController] User ID not found in request for listMyPaidTickets');
            return res.status(401).json({ success: false, message: 'Authentication required.' });
        }

        try {
            logger.info(`[TicketController] Request received for listing paid tickets for user ${userId}`);
            // Pass user ID and query parameters for pagination
            const result = await TicketService.listUserPaidTickets(userId, req.query);
            res.status(result.status || 200).json(result);
        } catch (error) {
            logger.error(`[TicketController] Error listing paid tickets for user ${userId}: ${error.message}`, { stack: error.stack });
            next(error); // Pass to global error handler
        }
    }
}

export default TicketController;
