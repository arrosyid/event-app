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

    /**
     * Retrieves ticket details by unique code, accessible by owner or admin.
     * @param {string} uniqueCode - The unique code of the ticket.
     * @param {object} user - The authenticated user object ({ id, role }).
     * @returns {Promise<{success: boolean, status: number, message: string, data?: object}>}
     */

    static async getTicketByCode(uniqueCode, user) {
        logger.info(`[TicketService] Fetching ticket by code ${uniqueCode} for user ${user.id}`);
        try {
            const ticket = await prisma.ticket.findUnique({
                where: { uniqueCode: uniqueCode, deletedAt: null }, // Ensure not soft-deleted
                include: {
                    event: { select: { id: true, name: true, startTime: true, location: true, status: true } },
                    user: { select: { id: true, name: true, email: true } }, // Ticket owner
                    ticketType: { select: { id: true, name: true, price: true } },
                    orderItem: {
                        select: {
                            order: { select: { orderCode: true, paidAt: true } }
                        }
                    }
                }
            });

            if (!ticket) {
                logger.warn(`[TicketService] Ticket with code ${uniqueCode} not found.`);
                return { success: false, status: 404, message: 'Ticket not found.' };
            }

            // Authorization check: Owner or Admin
            if (ticket.userId !== user.id && user.role !== 'admin') {
                logger.warn(`[TicketService] User ${user.id} (role: ${user.role}) unauthorized to access ticket ${uniqueCode} owned by ${ticket.userId}.`);
                return { success: false, status: 403, message: 'Forbidden. You do not have permission to view this ticket.' };
            }

            // Construct full QR code URL
            const ticketWithFullUrl = {
                ...ticket,
                qrCodeUrl: constructQrCodeUrl(ticket.qrCodeUrl)
            };

            logger.info(`[TicketService] Ticket ${uniqueCode} retrieved successfully for user ${user.id}.`);
            return { success: true, status: 200, message: 'Ticket retrieved successfully.', data: ticketWithFullUrl };

        } catch (error) {
            logger.error(`[TicketService] Error fetching ticket by code ${uniqueCode}: ${error.message}`, { stack: error.stack });
            return { success: false, status: 500, message: 'Failed to retrieve ticket details.' };
        }
    }

    /**
     * Checks in a ticket, accessible only by admin.
     * Validates check-in time window and event status.
     * @param {string} uniqueCode - The unique code of the ticket to check in.
     * @param {number} adminUserId - The ID of the admin performing the check-in.
     * @returns {Promise<{success: boolean, status: number, message: string, data?: object}>}
     */
    static async checkInTicket(uniqueCode, adminUserId) {
        logger.info(`[TicketService] Attempting check-in for ticket ${uniqueCode} by admin ${adminUserId}`);
        try {
            const ticket = await prisma.ticket.findUnique({
                where: { uniqueCode: uniqueCode, deletedAt: null }, // Ensure not soft-deleted
                include: {
                    event: { // Include event details for validation
                        select: { id: true, name: true, startTime: true, status: true }
                    }
                }
            });

            if (!ticket) {
                logger.warn(`[TicketService] Check-in failed: Ticket ${uniqueCode} not found.`);
                return { success: false, status: 404, message: 'Ticket not found.' };
            }

            // 1. Validate Event Status (must be 'published' or similar active state)
            //    Using 'published' as agreed. Adjust if your active status is different.
            if (ticket.event.status !== 'published') {
                logger.warn(`[TicketService] Check-in failed for ticket ${uniqueCode}: Event '${ticket.event.name}' status is '${ticket.event.status}', not 'published'.`);
                return { success: false, status: 400, message: `Check-in failed: Event is not active (Status: ${ticket.event.status}).` };
            }

            // 2. Validate Check-in Time Window (1 hour before event starts)
            const now = new Date();
            const eventStartTime = new Date(ticket.event.startTime);
            const checkinStartTime = new Date(eventStartTime.getTime() - 60 * 60 * 1000); // 1 hour before


            if (now < checkinStartTime) {
                logger.warn(`[TicketService] Check-in failed for ticket ${uniqueCode}: Check-in window not yet open (Event starts at ${eventStartTime.toISOString()}, Check-in starts at ${checkinStartTime.toISOString()}).`);
                // Provide a user-friendly time format if possible
                const options = { timeZone: 'asia/jakarta', hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' };
                const formattedCheckinStart = checkinStartTime.toLocaleString('id-ID', options);
                return { success: false, status: 400, message: `Check-in belum dibuka. Check-in dapat dilakukan mulai ${formattedCheckinStart}. waktu ${options.timeZone}.` };
            }

            // 3. Validate Ticket Status (must not be already checked_in)
            if (ticket.status === 'checked_in') {
                logger.warn(`[TicketService] Check-in failed for ticket ${uniqueCode}: Already checked in at ${ticket.checkInTime?.toISOString()}.`);
                return { success: false, status: 400, message: 'Check-in failed: Tiket ini sudah di check-in sebelumnya.' };
            }

            // All validations passed, proceed with update
            const updatedTicket = await prisma.ticket.update({
                where: { id: ticket.id }, // Use primary key for update
                data: {
                    status: 'checked_in',
                    checkInTime: now,
                    checkedInByUserId: adminUserId
                },
                select: { // Select fields needed for response/notification
                    id: true,
                    uniqueCode: true,
                    status: true,
                    checkInTime: true,
                    checkedInByUserId: true,
                    userId: true, // Needed for notification
                    eventId: true // Needed for notification
                }
            });

            logger.info(`[TicketService] Ticket ${uniqueCode} successfully checked in by admin ${adminUserId}.`);

            // Create notification for the user (Optional but recommended)
            try {
                await prisma.notification.create({
                    data: {
                        userId: updatedTicket.userId,
                        eventId: updatedTicket.eventId,
                        type: 'checkin_success', // Ensure this type exists in your NotificationType enum
                        message: `Tiket Anda (${updatedTicket.uniqueCode}) untuk event '${ticket.event.name}' berhasil di check-in.`,
                        isRead: false,
                    }
                });
                logger.info(`[TicketService] Check-in success notification created for user ${updatedTicket.userId} regarding ticket ${uniqueCode}.`);
            } catch (notificationError) {
                // Log the error but don't fail the check-in process itself
                logger.error(`[TicketService] Failed to create check-in notification for ticket ${uniqueCode}: ${notificationError.message}`, { stack: notificationError.stack });
            }

            return {
                success: true,
                status: 200,
                message: 'Ticket checked in successfully.',
                data: {
                    uniqueCode: updatedTicket.uniqueCode,
                    status: updatedTicket.status,
                    checkInTime: updatedTicket.checkInTime,
                    checkedInByUserId: updatedTicket.checkedInByUserId
                }
            };

        } catch (error) {
            logger.error(`[TicketService] Error checking in ticket ${uniqueCode}: ${error.message}`, { stack: error.stack });
            return { success: false, status: 500, message: 'Failed to check in ticket.' };
        }
    }
}

export default TicketService;
