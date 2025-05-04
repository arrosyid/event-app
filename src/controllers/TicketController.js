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

    /**
     * @description Get specific ticket details by unique code
     * @route GET /api/v1/tickets/:uniqueCode
     * @access Private (Owner or Admin)
     */
    static async getTicketByCode(req, res, next) {
        const { uniqueCode } = req.params;
        const user = req.user; // Contains id and role from authMiddleware

        if (!user) {
            logger.warn('[TicketController] User context not found in request for getTicketByCode');
            return res.status(401).json({ success: false, message: 'Authentication required.' });
        }

        try {
            logger.info(`[TicketController] Request received for getting ticket by code ${uniqueCode} for user ${user.id}`);
            const result = await TicketService.getTicketByCode(uniqueCode, user);
            res.status(result.status || 200).json(result);
        } catch (error) {
            logger.error(`[TicketController] Error getting ticket by code ${uniqueCode}: ${error.message}`, { stack: error.stack });
            next(error);
        }
    }

    /**
     * @description Check-in a ticket by unique code
     * @route POST /api/v1/tickets/:uniqueCode/checkin
     * @access Private (Admin)
     */
    static async checkInTicket(req, res, next) {
        const { uniqueCode } = req.params;
        const adminUserId = req.user.id; // Admin user ID from auth middleware

        if (!adminUserId) {
            // Should be caught by auth/role middleware, but good to double-check
            logger.warn('[TicketController] Admin User ID not found in request for checkInTicket');
            return res.status(401).json({ success: false, message: 'Authentication required (Admin).' });
        }

        try {
            logger.info(`[TicketController] Request received to check-in ticket ${uniqueCode} by admin ${adminUserId}`);
            const result = await TicketService.checkInTicket(uniqueCode, adminUserId);
            res.status(result.status || 200).json(result);
        } catch (error) {
            logger.error(`[TicketController] Error checking in ticket ${uniqueCode}: ${error.message}`, { stack: error.stack });
            next(error);
        }
    }
}

export default TicketController;
