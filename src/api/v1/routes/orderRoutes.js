import express from 'express';
import { body, param } from 'express-validator'; // Import param
import OrderController from '../../../controllers/OrderController.js';
import authMiddleware from '../../../middlewares/authMiddleware.js';
import roleMiddleware from '../../../middlewares/roleMiddleware.js'; // Ensure this is imported and uncommented

const router = express.Router();

// --- Validation Rules ---
const createOrderValidation = [
    body('items').isArray({ min: 1 }).withMessage('Order must contain at least one item.'),
    // Only validate ticketTypeId per item now
    body('items.*.ticketTypeId').isInt({ gt: 0 }).withMessage('Invalid ticketTypeId in items.'),
];

// Validation for :orderCode URL parameter
const orderCodeParamValidation = [
    param('orderCode').notEmpty().isString().withMessage('Order code parameter is required.'),
];

// Validation for manual checkout body
const manualCheckoutValidation = [
    body('paymentMethod').notEmpty().isString().withMessage('Payment method is required.'),
    body('paymentAmount').notEmpty().isNumeric().withMessage('Payment amount must be a number.'),
    body('transactionReference').optional().isString().withMessage('Transaction reference must be a string.'),
    body('paymentDate').optional().isISO8601().withMessage('Invalid payment date format (should be ISO8601).'),
];


// --- Routes ---

// POST /api/v1/orders - Create a new order
router.post(
    '/',
    authMiddleware, // User must be logged in
    createOrderValidation,
    OrderController.createOrder
);

// GET /api/v1/orders - Get orders for the logged-in user
router.get(
    '/',
    authMiddleware,
    OrderController.getUserOrders
);

// GET /api/v1/orders/all - Get orders for the logged-in user
router.get(
    '/all',
    authMiddleware,
    roleMiddleware(['admin']), // Keep admin role check
    OrderController.getAllOrders // Use the new controller method
);

// GET /api/v1/orders/:orderCode - Get specific order details
router.get(
    '/:orderCode',
    authMiddleware,
    orderCodeParamValidation, // Corrected validation
    OrderController.getOrderByCode
);

// POST /api/v1/orders/:orderCode/cancel - Cancel a pending order
router.post(
    '/:orderCode/cancel',
    authMiddleware,
    orderCodeParamValidation, // Corrected validation
    OrderController.cancelOrder
);

// POST /api/v1/orders/:orderCode/checkout-manual - Manually mark order as paid
router.post(
    '/:orderCode/checkout-manual',
    authMiddleware,
    orderCodeParamValidation,
    manualCheckoutValidation, // Add body validation
    OrderController.manualCheckout
);

// POST /api/v1/orders/payment-callback - Webhook for payment gateway
// Note: Authentication for webhooks is typically handled differently (e.g., signature verification)
// and might not use the standard authMiddleware.
router.post(
    '/payment-callback',
    OrderController.handlePaymentCallback // Add specific webhook validation/auth middleware if needed
);

export default router;
