import { validationResult } from 'express-validator';
import OrderService from '../services/OrderService.js'; // Import service
import { logger } from '../config/logger.js'; // Assuming logger exists

class OrderController {
    /**
     * @description Create a new order
     * @route POST /api/v1/orders
     * @access Private (User)
     */
    static async createOrder(req, res, next) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const userId = req.user.id; // Assuming authMiddleware attaches user
        const { items } = req.body; // items: [{ ticketTypeId: number }] - Simplified based on plan
        console.log("userId: ", userId);

        try {
            logger.info(`Creating order for user ${userId} with items: ${JSON.stringify(items)}`);
            // --- Service Call ---
            const result = await OrderService.createOrder(userId, items);
            res.status(result.status || 201).json(result);
            // --- End Service Call ---

        } catch (error) {
            logger.error(`Error creating order for user ${userId}: ${error.message}`, { stack: error.stack });
            next(error); // Pass error to the centralized error handler
        }
    }

    /**
     * @description Get all orders (Admin only)
     * @route GET /api/v1/orders/all
     * @access Private (Admin)
     */
    static async getAllOrders(req, res, next) {
        // No validation needed here unless query params require it
        try {
            logger.info(`Fetching all orders (admin request)`);
            // --- Service Call ---
            // Pass query params for pagination/filtering/sorting
            const result = await OrderService.getAllOrders(req.query);
            res.status(result.status || 200).json(result);
            // --- End Service Call ---

        } catch (error) {
            logger.error(`Error fetching all orders: ${error.message}`, { stack: error.stack });
            next(error);
        }
    }

    /**
     * @description Get orders for the logged-in user
     * @route GET /api/v1/orders
     * @access Private (User)
     */
    static async getUserOrders(req, res, next) {
        const userId = req.user.id;

        try {
            logger.info(`Fetching orders for user ${userId}`);
            // --- Service Call ---
            const result = await OrderService.getUserOrders(userId, req.query); // Pass query params if needed for pagination/filtering
            res.status(result.status || 200).json(result);
            // --- End Service Call ---

        } catch (error) {
            logger.error(`Error fetching orders for user ${userId}: ${error.message}`, { stack: error.stack });
            next(error);
        }
    }

    /**
     * @description Get a specific order by its code
     * @route GET /api/v1/orders/:orderCode
     * @access Private (User - Own Order) / Admin?
     */
    static async getOrderByCode(req, res, next) {
        const errors = validationResult(req); // Check if validation is set up for params
        if (!errors.isEmpty()) {
            // This might not work if validation targets body and code is in params
            // Consider param validation middleware in routes if needed
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const userId = req.user.id;
        const userRole = req.user.role; // Extract user role
        const { orderCode } = req.params; // Assuming orderCode is a URL parameter

        try {
            logger.info(`Fetching order ${orderCode} for user ${userId} (Role: ${userRole})`);
            // --- Service Call ---
            // Pass userRole to the service method
            const result = await OrderService.getOrderByCode(userId, orderCode, userRole);
            res.status(result.status || 200).json(result);
            // --- End Service Call ---

        } catch (error) {
            logger.error(`Error fetching order ${orderCode} for user ${userId}: ${error.message}`, { stack: error.stack });
            next(error);
        }
    }

    /**
     * @description Cancel a pending order
     * @route POST /api/v1/orders/:orderCode/cancel
     * @access Private (User - Own Order)
     */
    static async cancelOrder(req, res, next) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const userId = req.user.id;
        const { orderCode } = req.params;

        try {
            logger.info(`Attempting to cancel order ${orderCode} for user ${userId}`);
            // --- Service Call ---
            const result = await OrderService.cancelOrder(userId, orderCode);
            res.status(result.status || 200).json(result);
            // --- End Service Call ---

        } catch (error) {
            logger.error(`Error cancelling order ${orderCode} for user ${userId}: ${error.message}`, { stack: error.stack });
            next(error);
        }
    }

    /**
     * @description Handle incoming payment gateway webhook/callback
     * @route POST /api/v1/orders/payment-callback
     * @access Public (Webhook - Requires specific verification)
     */
    static async handlePaymentCallback(req, res, next) {
        const payload = req.body; // Raw payload from the gateway
        // TODO: Implement signature verification specific to the payment gateway

        try {
            logger.info(`Received payment callback: ${JSON.stringify(payload)}`);
            // --- Service Call ---
            const result = await OrderService.handlePaymentCallback(payload);
            // Respond to the gateway appropriately based on result.status
            // Send 200 OK even if processing failed internally, unless the gateway requires specific error codes.
            res.status(200).json({ message: result.message || 'Callback processed.' });
            // --- End Service Call ---

        } catch (error) {
            logger.error(`Error handling payment callback: ${error.message}`, { payload: payload, stack: error.stack });
            // Avoid passing internal errors directly to the gateway if possible
            // Send a generic error response to the gateway
            res.status(500).json({ message: 'Internal server error processing callback.' });
            // Optionally use next(error) if internal logging/monitoring handles it
        }
    }

    /**
     * @description Manually mark a pending order as paid (for testing/manual processing)
     * @route POST /api/v1/orders/:orderCode/checkout-manual
     * @access Private (User - Own Order) / Admin?
     */
    static async manualCheckout(req, res, next) {
        const errors = validationResult(req); // Checks param validation from route
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const userId = req.user.id;
        const { orderCode } = req.params;
        // Extract payment details from the request body
        const paymentDetails = {
            paymentMethod: req.body.paymentMethod,
            paymentAmount: req.body.paymentAmount,
            transactionReference: req.body.transactionReference,
            paymentDate: req.body.paymentDate,
        };

        try {
            logger.info(`Attempting manual checkout for order ${orderCode} by user ${userId} with details: ${JSON.stringify(paymentDetails)}`);
            // --- Service Call ---
            // Pass paymentDetails to the service method
            const result = await OrderService.manualCheckout(userId, orderCode, paymentDetails);
            res.status(result.status || 200).json(result);
            // --- End Service Call ---

        } catch (error) {
            logger.error(`Error during manual checkout for order ${orderCode}: ${error.message}`, { stack: error.stack });
            next(error);
        }
    }
}

export default OrderController;
