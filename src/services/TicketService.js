import prisma from '../models/prisma.js';
import { logger } from '../config/logger.js';

// Helper to construct full URL
const constructQrCodeUrl = (relativePath) => {
    if (!relativePath) return null;
    const baseUrl = process.env.APP_BASE_URL;
    if (!baseUrl) {
        logger.warn('[TicketService] APP_BASE_URL environment variable is not set. Cannot construct full QR code URL.');
        return null; // Or return relative path, depending on desired behavior
    }
    // Ensure no double slashes between base URL and relative path
    return `${baseUrl.replace(/\/$/, '')}/uploads/${relativePath.replace(/^\//, '')}`;
};

class TicketService {

    /**
     * Lists all paid tickets (Admin access).
     * @param {object} queryParams - Query parameters for pagination.
     * @param {number} [queryParams.page=1] - Current page number.
     * @param {number} [queryParams.limit=10] - Items per page.
     * @returns {Promise<{success: boolean, status: number, message: string, data?: object[], pagination?: object}>}
     */
    static async listAllPaidTickets(queryParams) {
        logger.info('[TicketService] Fetching all paid tickets (Admin)');
        try {
            const { page = 1, limit = 10 } = queryParams;
            const pageNum = parseInt(page, 10);
            const limitNum = parseInt(limit, 10);
            const skip = (pageNum - 1) * limitNum;

            const where = {
                orderItem: {
                    order: {
                        paymentStatus: 'paid'
                    }
                },
                deletedAt: null // Ensure ticket is not soft-deleted
            };

            const tickets = await prisma.ticket.findMany({
                where: where,
                include: {
                    event: { select: { id: true, name: true, startTime: true } },
                    user: { select: { id: true, name: true, email: true } }, // Ticket owner
                    ticketType: { select: { id: true, name: true } },
                    orderItem: {
                        select: {
                            order: { select: { orderCode: true, paidAt: true } }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip: skip,
                take: limitNum,
            });

            const totalTickets = await prisma.ticket.count({ where });
            const totalPages = Math.ceil(totalTickets / limitNum);

            // Construct full QR code URLs
            const ticketsWithFullUrls = tickets.map(ticket => ({
                ...ticket,
                qrCodeUrl: constructQrCodeUrl(ticket.qrCodeUrl)
            }));

            return {
                success: true,
                status: 200,
                message: 'All paid tickets retrieved successfully.',
                data: ticketsWithFullUrls,
                pagination: {
                    currentPage: pageNum,
                    totalPages,
                    totalItems: totalTickets,
                    limit: limitNum,
                },
            };
        } catch (error) {
            logger.error(`[TicketService] Error fetching all paid tickets: ${error.message}`, { stack: error.stack });
            return { success: false, status: 500, message: 'Failed to retrieve paid tickets.' };
        }
    }

    /**
     * Lists paid tickets for a specific user.
     * @param {number} userId - The ID of the user whose tickets to fetch.
     * @param {object} queryParams - Query parameters for pagination.
     * @param {number} [queryParams.page=1] - Current page number.
     * @param {number} [queryParams.limit=10] - Items per page.
     * @returns {Promise<{success: boolean, status: number, message: string, data?: object[], pagination?: object}>}
     */
    static async listUserPaidTickets(userId, queryParams) {
        logger.info(`[TicketService] Fetching paid tickets for user ${userId}`);
        try {
            const { page = 1, limit = 10 } = queryParams;
            const pageNum = parseInt(page, 10);
            const limitNum = parseInt(limit, 10);
            const skip = (pageNum - 1) * limitNum;

            const where = {
                userId: userId, // Filter by user ID
                orderItem: {
                    order: {
                        paymentStatus: 'paid'
                    }
                },
                deletedAt: null // Ensure ticket is not soft-deleted
            };

            const tickets = await prisma.ticket.findMany({
                where: where,
                include: {
                    event: { select: { id: true, name: true, startTime: true, location: true } },
                    ticketType: { select: { id: true, name: true } },
                    orderItem: {
                        select: {
                            order: { select: { orderCode: true, paidAt: true } }
                        }
                    }
                    // No need to include user again as we are filtering by userId
                },
                orderBy: { createdAt: 'desc' },
                skip: skip,
                take: limitNum,
            });

            const totalTickets = await prisma.ticket.count({ where });
            const totalPages = Math.ceil(totalTickets / limitNum);

            // Construct full QR code URLs
            const ticketsWithFullUrls = tickets.map(ticket => ({
                ...ticket,
                qrCodeUrl: constructQrCodeUrl(ticket.qrCodeUrl)
            }));

            return {
                success: true,
                status: 200,
                message: 'User paid tickets retrieved successfully.',
                data: ticketsWithFullUrls,
                pagination: {
                    currentPage: pageNum,
                    totalPages,
                    totalItems: totalTickets,
                    limit: limitNum,
                },
            };
        } catch (error) {
            logger.error(`[TicketService] Error fetching paid tickets for user ${userId}: ${error.message}`, { stack: error.stack });
            return { success: false, status: 500, message: 'Failed to retrieve user paid tickets.' };
        }
    }
}

export default TicketService;
