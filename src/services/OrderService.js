import prisma from '../models/prisma.js'; // Use actual Prisma client
import { logger } from '../config/logger.js';
import { randomUUID } from 'crypto'; // For generating unique codes
import fs from 'fs'; // Import file system module
import path from 'path'; // Import path module
import qrcode from 'qrcode'; // Import qrcode library

// --- Helper Functions (Example) ---
function generateOrderCode() {
    // Example: Generate a unique order code (e.g., timestamp + random part)
    return `ORD-${Date.now()}-${randomUUID().substring(0, 6).toUpperCase()}`;
}

function generateTicketCode() {
    // Example: Generate a unique ticket code
    return `TKT-${randomUUID().toUpperCase()}`;
}

class OrderService {

    /**
     * Processes a successful order: updates status, generates tickets, sends notifications.
     * @private Internal helper method.
     * @param {number} orderId - The ID of the order to process.
     * @param {string} paymentMethod - The method used for payment (e.g., 'manual', 'credit_card').
     * @param {string|null} gatewayReference - Optional reference ID from the payment gateway.
     * @returns {Promise<boolean>} - True if processing was successful, false otherwise.
     */
    async _processSuccessfulOrder(orderId, paymentMethod = 'manual', gatewayReference = null) {
        logger.info(`[_processSuccessfulOrder] Processing successful order ID: ${orderId}`);
        try {
            // Use a transaction to ensure atomicity of ticket generation and status update
            await prisma.$transaction(async (tx) => {
                // 1. Fetch the order with necessary details (items, user) - Ensure it's still pending before update
                const order = await tx.order.findUnique({
                    where: { id: orderId },
                    include: {
                        orderItems: { // Need items to generate tickets
                            include: {
                                ticketType: true // Need ticketType for eventId
                            }
                        },
                        user: true // Need user details for attendee info
                    }
                });

                // Double-check status within transaction to prevent race conditions
                if (!order || order.paymentStatus !== 'pending') {
                    throw new Error(`Order ${orderId} not found or not in pending state during final processing.`);
                }

                const paidAt = new Date();

                // 2. Update Order Status to 'paid'
                await tx.order.update({
                    where: { id: order.id },
                    data: {
                        paymentStatus: 'paid',
                        paidAt: paidAt,
                        paymentMethod: paymentMethod,
                        paymentGatewayReference: gatewayReference,
                    },
                });

                // 3. Generate Tickets using buyer's details
                logger.info(`[_processSuccessfulOrder] Generating tickets for paid order ${order.orderCode}`);
                for (const item of order.orderItems) {
                    if (!item.ticketType) {
                        logger.error(`[_processSuccessfulOrder] Missing ticketType data for orderItem ${item.id} in order ${order.orderCode}`);
                        throw new Error(`Internal error: Ticket type data missing for item ${item.id}.`);
                    }
                    const ticketCode = generateTicketCode();

                    // --- QR Code Generation ---
                    let qrCodeDbPath = null;
                    try {
                        // Construct path relative to project root (assuming execution from root)
                        const qrCodeDir = path.join(process.cwd(), 'uploads', 'qrcodes');

                        // Ensure directory exists (synchronous check/creation before async file write)
                        // It's generally safer to do this *outside* the loop if possible,
                        // but doing it here ensures it exists before each write attempt.
                        if (!fs.existsSync(qrCodeDir)) {
                            fs.mkdirSync(qrCodeDir, { recursive: true });
                            logger.info(`[_processSuccessfulOrder] Created QR code directory: ${qrCodeDir}`);
                        }

                        const qrCodeFilename = `${ticketCode}.png`;
                        const qrCodeFilePath = path.join(qrCodeDir, qrCodeFilename);

                        // Generate QR code file asynchronously
                        await qrcode.toFile(qrCodeFilePath, ticketCode);
                        logger.info(`[_processSuccessfulOrder] Generated QR code file: ${qrCodeFilePath}`);

                        // Set the relative path for the database (relative to 'uploads')
                        qrCodeDbPath = `qrcodes/${qrCodeFilename}`;

                    } catch (qrError) {
                        // If QR code generation fails, log the error and THROW to rollback transaction
                        logger.error(`[_processSuccessfulOrder] CRITICAL: Failed to generate QR code for ticket ${ticketCode}. Rolling back transaction. Error: ${qrError.message}`, { stack: qrError.stack });
                        throw new Error(`Failed to generate QR code for ticket ${ticketCode}: ${qrError.message}`);
                    }
                    // --- End QR Code Generation ---


                    await tx.ticket.create({
                        data: {
                            orderItemId: item.id,
                            eventId: item.ticketType.eventId, // Get eventId from included ticketType
                            ticketTypeId: item.ticketTypeId,
                            userId: order.userId,
                            attendeeName: order.user.name, // Use buyer's name
                            attendeeEmail: order.user.email, // Use buyer's email
                            uniqueCode: ticketCode,
                            qrCodeUrl: qrCodeDbPath, // Use the relative path saved in DB
                            status: 'active', // Use the TicketStatus enum
                        },
                    });
                }
                logger.info(`[_processSuccessfulOrder] Tickets generated for order ${order.orderCode}`);

                // 4. Create Notification (within transaction for consistency)
                await tx.notification.create({
                    data: {
                        userId: order.userId,
                        orderId: order.id,
                        type: 'purchase_success',
                        message: `Your payment for order ${order.orderCode} was successful. Your tickets have been generated.`
                    }
                });
                logger.info(`[_processSuccessfulOrder] Purchase success notification created for order ${order.orderCode}`);

            }); // End Transaction

            // 5. Send Notifications/Emails (outside transaction)
            // TODO: Implement email sending logic to send e-tickets
            logger.info(`[OrderService] TODO: Send e-tickets via email for order ID ${orderId}`);

            return true; // Indicate success

        } catch (error) {
            logger.error(`[_processSuccessfulOrder] Error processing successful order ${orderId}: ${error.message}`, { stack: error.stack });
            return false; // Indicate failure
        }
    }


    /**
     * Creates a new order for a user.
     * @param {number} userId - The ID of the user placing the order.
     * @param {Array<{ticketTypeId: number}>} items - Array of items to order.
     * @returns {Promise<{success: boolean, status: number, message: string, data?: object}>}
     */
    static async createOrder(userId, items) {
        logger.info(`[OrderService] Attempting to create order for user ${userId} with items: ${JSON.stringify(items)}`);
        // Input validation for items.length > 1 removed as per new requirement

        // Removed payment gateway URL placeholder as we use manual checkout for now
        let orderCode = generateOrderCode(); // Generate unique order code

        try {
            const createdOrder = await prisma.$transaction(async (tx) => {
                let totalAmount = 0;
                const orderItemsData = [];
                // let eventId = null; // No longer needed to check consistency across items
                const processedEventIds = new Set(); // Track events processed in this request

                // 1. Validate items, check quota, check existing purchase, calculate total
                for (const item of items) {
                    const ticketType = await tx.ticketType.findUnique({
                        where: { id: item.ticketTypeId, deletedAt: null } // Ensure not soft-deleted
                    });

                    if (!ticketType) {
                        throw new Error(`Ticket type with ID ${item.ticketTypeId} not found.`);
                    }

                    const currentItemEventId = ticketType.eventId;

                    // --- CHECK 1: Prevent multiple tickets for the SAME event in THIS request ---
                    if (processedEventIds.has(currentItemEventId)) {
                        // Fetch event name for a clearer error message (optional, adds a query)
                        // const eventDetails = await tx.event.findUnique({ where: { id: currentItemEventId }, select: { name: true } });
                        // const eventName = eventDetails ? eventDetails.name : `ID ${currentItemEventId}`;
                        throw new Error(`Cannot order multiple tickets for the same event (ID: ${currentItemEventId}) in a single request.`);
                    }

                    // --- CHECK 2: Prevent ordering if user ALREADY HAS a ticket for this event ---
                    const existingOrderCountForEvent = await tx.order.count({
                        where: {
                            userId: userId, // Belongs to the current user
                            paymentStatus: {
                                in: ['paid', 'pending'] // Is active or pending
                            },
                            // Check if *any* item in the order belongs to the target event
                            orderItems: {
                                some: {
                                    ticketType: {
                                        eventId: currentItemEventId
                                    }
                                }
                            }
                        }
                    });

                    if (existingOrderCountForEvent > 0) {
                        // Fetch event name for a clearer error message (optional, adds a query)
                        // const eventDetails = await tx.event.findUnique({ where: { id: currentItemEventId }, select: { name: true } });
                        // const eventName = eventDetails ? eventDetails.name : `ID ${currentItemEventId}`;
                        throw new Error(`User ${userId} already has a pending or paid ticket for event ID ${currentItemEventId}. Only one ticket per event allowed.`);
                    }

                    // If both checks pass, mark this event as processed for this request
                    processedEventIds.add(currentItemEventId);


                    // Check quota (atomic check is crucial here)
                    if (ticketType.quota === null) { // Added null check for quota
                        throw new Error(`Ticket type "${ticketType.name}" (ID: ${item.ticketTypeId}) does not have a defined quota.`);
                    }
                    if (ticketType.sold >= ticketType.quota) {
                        throw new Error(`Ticket type "${ticketType.name}" (ID: ${item.ticketTypeId}) is sold out.`);
                    }

                    totalAmount += Number(ticketType.price); // Assuming quantity is 1
                    orderItemsData.push({
                        ticketTypeId: item.ticketTypeId,
                        pricePerTicket: ticketType.price,
                        // Attendee details removed as per plan
                    });

                    // Increment sold count (will be part of the transaction)
                    // This update implicitly locks the row in most transaction isolation levels
                    await tx.ticketType.update({
                        where: { id: item.ticketTypeId },
                        data: { sold: { increment: 1 } },
                    });
                }

                // 2. Create the Order record
                const order = await tx.order.create({
                    data: {
                        userId: userId,
                        orderCode: orderCode,
                        totalAmount: totalAmount,
                        paymentStatus: 'pending',
                        // paymentExpiryTime: // Set based on rules if needed
                        orderItems: {
                            create: orderItemsData,
                        },
                    },
                     select: { id: true, orderCode: true, totalAmount: true } // Select needed fields
                });

                logger.info(`[OrderService] Order ${orderCode} created successfully in transaction.`);
                return order; // Return the created order object
            }); // End Transaction

            return {
                success: true,
                status: 201,
                message: 'Order created successfully. Proceed to manual checkout when ready.',
                data: {
                    orderCode: createdOrder.orderCode,
                    totalAmount: createdOrder.totalAmount,
                }
            };

        } catch (error) {
            logger.error(`[OrderService] Error creating order for user ${userId}: ${error.message}`, { stack: error.stack });
            // Prisma transaction automatically rolls back on error
            return {
                success: false,
                status: error.message.includes('sold out') || error.message.includes('not found') || error.message.includes('already has a pending or paid order') ? 400 : 500,
                message: error.message || 'Failed to create order due to an internal error.'
            };
        }
    }

    /**
     * Retrieves orders for a specific user.
     * @param {number} userId - The ID of the user.
     * @param {object} queryParams - Query parameters for pagination, filtering, etc.
     * @returns {Promise<{success: boolean, status: number, message: string, data?: object}>}
     */
    static async getUserOrders(userId, queryParams) {
        logger.info(`[OrderService] Fetching orders for user ${userId}`);
        try {
            // TODO: Implement pagination, filtering based on queryParams
            const { page = 1, limit = 10 } = queryParams;
            const pageNum = parseInt(page, 10);
            const limitNum = parseInt(limit, 10);
            const skip = (pageNum - 1) * limitNum;

            const where = { userId: userId };

            const orders = await prisma.order.findMany({
                where: where,
                include: {
                    orderItems: {
                        include: {
                            ticketType: {
                                select: { name: true, eventId: true } // Include necessary ticket type details
                            }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }, // Example ordering
                skip: skip,
                take: limitNum,
            });

            const totalOrders = await prisma.order.count({ where });
            const totalPages = Math.ceil(totalOrders / limitNum);


            return {
                success: true,
                status: 200,
                message: 'Orders retrieved successfully.',
                data: orders,
                pagination: {
                    currentPage: pageNum,
                    totalPages,
                    totalItems: totalOrders,
                    limit: limitNum,
                },
            };
        } catch (error) {
            logger.error(`[OrderService] Error fetching orders for user ${userId}: ${error.message}`, { stack: error.stack });
            return { success: false, status: 500, message: 'Failed to retrieve orders.' };
        }
    }

    /**
     * Retrieves a specific order by its code, ensuring user ownership.
     * @param {number} userId - The ID of the user requesting the order.
     * @param {string} orderCode - The unique code of the order.
     * @returns {Promise<{success: boolean, status: number, message: string, data?: object}>}
     */
    static async getOrderByCode(userId, orderCode) {
        logger.info(`[OrderService] Fetching order ${orderCode} for user ${userId}`);
        try {
            const order = await prisma.order.findUnique({
                where: { orderCode: orderCode },
                include: {
                    orderItems: {
                        include: {
                            ticketType: { // Include details about the ticket type
                                select: { name: true, description: true, eventId: true }
                                // include: {
                                //     event: { select: { name: true, startTime: true } } // Include event details if needed
                                // }
                            },
                            tickets: { // Include generated tickets for this item
                                select: { uniqueCode: true, status: true, qrCodeUrl: true }
                            }
                        }
                    },
                    user: { // Optionally include some user details (be careful with sensitive info)
                        select: { id: true, name: true, email: true }
                    }
                }
            });

            if (!order) {
                return { success: false, status: 404, message: 'Order not found.' };
            }

            // Verify ownership (or if user is admin)
            // TODO: Add role check if admins can view any order
            if (order.userId !== userId) {
                logger.warn(`[OrderService] User ${userId} attempted to access order ${orderCode} owned by user ${order.userId}`);
                return { success: false, status: 403, message: 'You are not authorized to view this order.' };
            }

            return {
                success: true,
                status: 200,
                message: 'Order retrieved successfully.',
                data: order
            };
        } catch (error) {
            logger.error(`[OrderService] Error fetching order ${orderCode}: ${error.message}`, { stack: error.stack });
            return { success: false, status: 500, message: 'Failed to retrieve order details.' };
        }
    }

    /**
     * Cancels a pending order.
     * @param {number} userId - The ID of the user requesting cancellation.
     * @param {string} orderCode - The unique code of the order to cancel.
     * @returns {Promise<{success: boolean, status: number, message: string}>}
     */
    static async cancelOrder(userId, orderCode) {
        logger.info(`[OrderService] Attempting to cancel order ${orderCode} for user ${userId}`);
        try {
             // Use transaction to ensure atomicity
             await prisma.$transaction(async (tx) => {
                const order = await tx.order.findUnique({
                    where: { orderCode: orderCode },
                    include: { orderItems: true } // Need items to revert quota
                });

                if (!order) {
                    throw new Error('Order not found.');
                }

                // Verify ownership
                if (order.userId !== userId) {
                    // TODO: Add role check if needed
                    logger.warn(`[OrderService] User ${userId} attempted to cancel order ${orderCode} owned by user ${order.userId}`);
                    throw new Error('You are not authorized to cancel this order.');
                }

                // Check if order is cancellable (only 'pending' status)
                if (order.paymentStatus !== 'pending') {
                    throw new Error(`Order cannot be cancelled (status: ${order.paymentStatus}).`);
                }

                // 1. Update order status to 'canceled'
                await tx.order.update({
                    where: { id: order.id },
                    data: { paymentStatus: 'canceled' },
                });

                // 2. Revert the 'sold' count for each ticket type in the order
                for (const item of order.orderItems) {
                    await tx.ticketType.update({
                        where: { id: item.ticketTypeId },
                        // Ensure sold count doesn't go below zero
                        data: { sold: { decrement: 1 } },
                    });
                }
                logger.info(`[OrderService] Order ${orderCode} cancelled and quotas reverted in transaction.`);
            }); // End Transaction

            return { success: true, status: 200, message: 'Order cancelled successfully.' };

        } catch (error) {
            logger.error(`[OrderService] Error cancelling order ${orderCode}: ${error.message}`, { stack: error.stack });
            const isUserError = ['Order not found', 'You are not authorized', 'Order cannot be cancelled'].some(msg => error.message.includes(msg));
            return {
                success: false,
                status: isUserError ? 400 : 500, // 400 for logical errors, 500 for others
                message: error.message || 'Failed to cancel order.'
            };
        }
    }

    /**
     * Manually marks a pending order as paid and processes it.
     * @param {number} userId - The ID of the user performing the action (for auth check).
     * @param {string} orderCode - The unique code of the order.
     * @param {object} paymentDetails - Details about the manual payment.
     * @param {string} paymentDetails.paymentMethod - Method used (e.g., 'cash').
     * @param {number} paymentDetails.paymentAmount - Amount paid.
     * @param {string} [paymentDetails.transactionReference] - Optional reference.
     * @param {string} [paymentDetails.paymentDate] - Optional payment date (ISO8601).
     * @returns {Promise<{success: boolean, status: number, message: string, data?: object}>}
     */
    static async manualCheckout(userId, orderCode, paymentDetails) {
        // Log the received payment details
        logger.info(`[OrderService] Attempting manual checkout for order ${orderCode} by user ${userId}. Payment Details: ${JSON.stringify(paymentDetails)}`);
        try {
            // Validate payment amount against order total (optional but recommended)
            const order = await prisma.order.findUnique({
                where: { orderCode: orderCode }
            });

            if (!order) {
                return { success: false, status: 404, message: 'Order not found.' };
            }

            // Verify ownership (or admin role if required later)
            if (order.userId !== userId) {
                logger.warn(`[OrderService] User ${userId} attempted manual checkout for order ${orderCode} owned by user ${order.userId}`);
                return { success: false, status: 403, message: 'You are not authorized to check out this order.' };
            }

            // Check if order is pending
            if (order.paymentStatus !== 'pending') {
                return { success: false, status: 400, message: `Order is not pending (status: ${order.paymentStatus}). Cannot perform manual checkout.` };
            }

            // --- Enforce Payment Amount Check ---
            // Convert both to numbers for reliable comparison
            const paymentAmount = Number(paymentDetails.paymentAmount);
            const totalAmount = Number(order.totalAmount);

            if (isNaN(paymentAmount)) {
                return { success: false, status: 400, message: 'Invalid payment amount provided.' };
            }

            if (paymentAmount < totalAmount) {
                logger.warn(`[OrderService] Manual checkout attempt for ${orderCode}: Payment amount (${paymentAmount}) is less than order total (${totalAmount}).`);
                return { success: false, status: 400, message: `Payment amount (${paymentAmount}) is less than the required total amount (${totalAmount}).` };
            }
            // --- End Payment Amount Check ---


            // Process the successful order, passing the specific manual payment method
            const success = await this.prototype._processSuccessfulOrder(order.id, paymentDetails.paymentMethod || 'manual', paymentDetails.transactionReference); // Pass method and reference

            if (success) {
                logger.info(`[OrderService] Manual checkout successful for order ${orderCode}`);
                 // Fetch updated order details to return
                 const updatedOrder = await this.getOrderByCode(userId, orderCode); // Reuse existing method
                return {
                    success: true,
                    status: 200,
                    message: 'Manual checkout successful. Order marked as paid and tickets generated.',
                     data: updatedOrder.data // Return updated order details
                };
            } else {
                logger.error(`[OrderService] Failed to process successful order during manual checkout for ${orderCode}`);
                return { success: false, status: 500, message: 'Failed to process order after manual checkout.' };
            }

        } catch (error) {
            logger.error(`[OrderService] Error during manual checkout for order ${orderCode}: ${error.message}`, { stack: error.stack });
            return { success: false, status: 500, message: 'Internal server error during manual checkout.' };
        }
    }


    /**
     * Handles the payment gateway callback/webhook. (Placeholder Logic)
     * @param {object} payload - The data received from the payment gateway.
     * @returns {Promise<{success: boolean, status?: number, message?: string}>}
     */
    static async handlePaymentCallback(payload) {
        logger.info(`[OrderService] Processing payment callback`);
        // TODO: Implement robust payload validation and signature verification here!

        // Extract necessary info (highly dependent on the gateway)
        const orderCode = payload.order_id; // Example field name
        const transactionStatus = payload.transaction_status; // Example field name ('capture', 'settlement', 'pending', 'deny', 'cancel', 'expire')
        const paymentMethod = payload.payment_type || 'gateway'; // Example
        const gatewayReference = payload.transaction_id; // Example

        if (!orderCode) {
            logger.error('[OrderService] Payment callback missing order identifier.');
            // Acknowledge receipt to gateway but log error
            return { success: false, message: 'Callback processed (missing order identifier).' };
        }

        try {
            // Fetch order within a potential transaction if updates are needed
            const order = await prisma.order.findUnique({
                where: { orderCode: orderCode },
                // Include items only if needed for quota reversion logic
                include: { orderItems: true }
            });

            if (!order) {
                logger.error(`[OrderService] Order ${orderCode} not found for payment callback.`);
                 // Acknowledge receipt to gateway
                return { success: false, message: `Callback processed (order ${orderCode} not found).` };
            }

            // Avoid processing callbacks for orders already finalized (paid, canceled, etc.)
            if (order.paymentStatus !== 'pending') {
                logger.warn(`[OrderService] Received callback for already processed order ${orderCode} (status: ${order.paymentStatus}).`);
                 return { success: true, message: 'Callback processed (order already finalized).' }; // Acknowledge receipt
            }

            let newStatus = 'pending';
            let processSuccess = false;

            // Map gateway status to our PaymentStatus enum
            switch (transactionStatus) {
                case 'capture':
                case 'settlement':
                    newStatus = 'paid';
                    processSuccess = true; // Trigger ticket generation etc.
                    break;
                case 'deny':
                case 'cancel':
                    newStatus = 'failed';
                    break;
                case 'expire':
                    newStatus = 'expired';
                    break;
                case 'pending':
                    newStatus = 'pending';
                    break;
                default:
                    logger.warn(`[OrderService] Unhandled transaction status "${transactionStatus}" for order ${orderCode}`);
                    newStatus = 'failed'; // Default to failed
            }

            // If status changed from pending, update the order and potentially revert quota
            if (newStatus !== 'pending') {
                if (processSuccess) {
                    // Call the helper to handle status update, ticket gen, notifications
                    const success = await this.prototype._processSuccessfulOrder(order.id, paymentMethod, gatewayReference);
                    if (!success) {
                        // Log error, but still acknowledge callback to gateway
                        logger.error(`[OrderService] Failed to process successful order ${orderCode} from payment callback.`);
                         // Potentially set status back to pending or a specific error state?
                    }
                } else {
                    // Handle failed/expired/canceled status update and quota reversion
                    await prisma.$transaction(async (tx) => {
                        await tx.order.update({
                            where: { id: order.id },
                            data: {
                                paymentStatus: newStatus,
                                paymentMethod: paymentMethod, // Log payment method even on failure
                                paymentGatewayReference: gatewayReference,
                            },
                        });
                        // Revert quota
                        logger.info(`[OrderService] Reverting quota for failed/expired/canceled order ${orderCode} from callback.`);
                        for (const item of order.orderItems) {
                            await tx.ticketType.update({
                                where: { id: item.ticketTypeId },
                                data: { sold: { decrement: 1 } },
                            });
                        }
                    });
                }
            } else {
                logger.info(`[OrderService] Order ${orderCode} remains pending after callback.`);
            }

            return { success: true, message: 'Callback processed.' }; // Acknowledge receipt

        } catch (error) {
            logger.error(`[OrderService] Error processing payment callback for order ${orderCode || 'unknown'}: ${error.message}`, { stack: error.stack });
            // Acknowledge receipt to gateway even on internal error
            return { success: false, message: 'Callback processed (internal server error).' };
        }
    }
}

// Export instance if needed by controller, or keep static if preferred
// export default new OrderService();
export default OrderService; // Export class for static method usage
