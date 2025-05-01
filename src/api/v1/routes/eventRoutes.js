import express from 'express';
import EventController, {
    listEventsValidation,
    eventIdParamValidation,
    ticketTypeIdParamValidation,
    createEventValidation,
    updateEventValidation,
    createTicketTypeValidation,
    updateTicketTypeValidation,
} from '../../../controllers/EventController.js'; // Adjust path as needed
import authMiddleware from '../../../middlewares/authMiddleware.js'; // Adjust path as needed
import roleMiddleware from '../../../middlewares/roleMiddleware.js'; // Adjust path as needed

const router = express.Router();

// --- Public Routes ---

/**
 * @route   GET /api/v1/events
 * @desc    List events with filtering, sorting, pagination
 * @access  Public
 */
router.get(
    '/', 
    listEventsValidation, 
    EventController.listEvents
);

/**
 * @route   GET /api/v1/events/:eventId
 * @desc    Get details of a single event
 * @access  Public
 */
router.get(
    '/:eventId', 
    eventIdParamValidation, 
    EventController.getEventById
);


// --- Admin Only Routes ---
// Apply auth and admin role middleware for create, update, delete operations

/**
 * @route   POST /api/v1/events
 * @desc    Create a new event
 * @access  Private (Admin only)
 */
router.post(
    '/',
    authMiddleware,
    roleMiddleware(['admin']), // Only admins can create
    createEventValidation,
    EventController.createEvent
);

/**
 * @route   PUT /api/v1/events/:eventId
 * @desc    Update an existing event
 * @access  Private (Admin only)
 */
router.put(
    '/:eventId',
    authMiddleware,
    roleMiddleware(['admin']), // Only admins can update
    eventIdParamValidation,    // Validate ID in URL
    updateEventValidation,     // Validate body
    EventController.updateEvent
);

/**
 * @route   DELETE /api/v1/events/:eventId
 * @desc    Delete an event
 * @access  Private (Admin only)
 */
router.delete(
    '/:eventId',
    authMiddleware,
    roleMiddleware(['admin']), // Only admins can delete
    eventIdParamValidation,    // Validate ID in URL
    EventController.deleteEvent
);


// --- Ticket Type Routes (Admin Only) ---

/**
 * @route   POST /api/v1/events/:eventId/ticket-types
 * @desc    Create a new ticket type for an event
 * @access  Private (Admin only)
 */
router.post(
    '/:eventId/ticket-types',
    authMiddleware,
    roleMiddleware(['admin']),
    eventIdParamValidation,       // Validate event ID
    createTicketTypeValidation,   // Validate body
    EventController.createTicketType
);

/**
 * @route   PUT /api/v1/events/:eventId/ticket-types/:ticketTypeId
 * @desc    Update a ticket type
 * @access  Private (Admin only)
 */
router.put(
    '/:eventId/ticket-types/:ticketTypeId',
    authMiddleware,
    roleMiddleware(['admin']),
    eventIdParamValidation,       // Validate event ID
    ticketTypeIdParamValidation,  // Validate ticket type ID
    updateTicketTypeValidation,   // Validate body
    EventController.updateTicketType
);

/**
 * @route   DELETE /api/v1/events/:eventId/ticket-types/:ticketTypeId
 * @desc    Delete a ticket type
 * @access  Private (Admin only)
 */
router.delete(
    '/:eventId/ticket-types/:ticketTypeId',
    authMiddleware,
    roleMiddleware(['admin']),
    eventIdParamValidation,       // Validate event ID
    ticketTypeIdParamValidation,  // Validate ticket type ID
    EventController.deleteTicketType
);


export default router;
