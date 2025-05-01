import EventService from '../services/EventService.js';
import { body, query, param, validationResult } from 'express-validator';
import { logger } from '../config/logger.js';

// --- Validation Rules ---

// Validation for GET /events query parameters
const listEventsValidation = [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer').toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100').toInt(),
    query('search').optional().isString().trim(),
    query('sort').optional().isString().trim().isIn(['name', 'startTime', 'createdAt', 'category', 'status']).withMessage('Invalid sort field'),
    query('order').optional().isString().trim().isIn(['asc', 'desc']).withMessage('Order must be asc or desc'),
    query('category').optional().isString().trim(),
    query('status').optional().isString().trim(),
    query('date').optional().isISO8601().withMessage('Date must be in YYYY-MM-DD format'), // Checks for YYYY-MM-DD
];

// Validation for URL parameter :eventId
const eventIdParamValidation = [
    param('eventId').isInt({ min: 1 }).withMessage('Event ID must be a positive integer').toInt(),
];

// Validation for URL parameter :ticketTypeId
const ticketTypeIdParamValidation = [
    param('ticketTypeId').isInt({ min: 1 }).withMessage('Ticket Type ID must be a positive integer').toInt(),
];

// Validation for POST /events body
const createEventValidation = [
    body('name').notEmpty().withMessage('Event name is required').trim(),
    body('description').notEmpty().withMessage('Description is required').trim(),
    body('startTime').isISO8601().withMessage('Start time must be a valid ISO 8601 date').toDate(),
    body('endTime').isISO8601().withMessage('End time must be a valid ISO 8601 date').toDate()
        .custom((value, { req }) => {
            if (value <= req.body.startTime) {
                throw new Error('End time must be after start time');
            }
            return true;
        }),
    body('location').notEmpty().withMessage('Location is required').trim(),
    body('locationDetails').optional().isString().trim(),
    body('posterImageUrl').optional().isURL().withMessage('Poster image URL must be a valid URL'),
    body('category').optional().isString().trim(),
    body('capacity').isInt({ min: 0 }).withMessage('Capacity must be a non-negative integer').toInt(),
    body('status').optional().isString().trim().isIn(['draft', 'published', 'completed', 'cancelled']).withMessage('Invalid status value'),
    // Add validation for optional ticketTypes array
    body('ticketTypes').optional().isArray().withMessage('Ticket types must be an array'),
    // Validate each object in the ticketTypes array
    body('ticketTypes.*.name').notEmpty().withMessage('Ticket type name is required').trim(),
    body('ticketTypes.*.price').isFloat({ min: 0 }).withMessage('Ticket type price must be a non-negative number').toFloat(),
    body('ticketTypes.*.quantity').isInt({ min: 0 }).withMessage('Ticket type quantity must be a non-negative integer').toInt(),
    body('ticketTypes.*.saleStartDate').isISO8601().withMessage('Ticket type sale start date must be a valid ISO 8601 date').toDate(),
    body('ticketTypes.*.saleEndDate').isISO8601().withMessage('Ticket type sale end date must be a valid ISO 8601 date').toDate()
        .custom((value, { req, path }) => {
            // Get the index of the current ticket type being validated
            const index = parseInt(path.match(/\[(\d+)\]/)[1], 10);
            const startDate = req.body.ticketTypes[index].saleStartDate;
            // Ensure dates are comparable (they should be Date objects due to .toDate())
            if (startDate && value <= startDate) {
                throw new Error('Ticket type sale end date must be after sale start date');
            }
            return true;
        }),
    body('ticketTypes.*.description').optional({ nullable: true }).isString().trim(),
];

// Validation for PUT /events/:eventId body (similar to create, but optional)
const updateEventValidation = [
    // eventId is validated separately by eventIdParamValidation middleware
    body('name').optional().notEmpty().withMessage('Event name cannot be empty').trim(),
    body('description').optional().notEmpty().withMessage('Description cannot be empty').trim(),
    body('startTime').optional().isISO8601().withMessage('Start time must be a valid ISO 8601 date').toDate(),
    body('endTime').optional().isISO8601().withMessage('End time must be a valid ISO 8601 date').toDate(),
    // Add custom validation for endTime > startTime if both are provided in update
    body('location').optional().notEmpty().withMessage('Location cannot be empty').trim(),
    body('locationDetails').optional({ nullable: true }).isString().trim(), // Allow null/empty string
    body('posterImageUrl').optional({ nullable: true }).isURL().withMessage('Poster image URL must be a valid URL'),
    body('category').optional({ nullable: true }).isString().trim(),
    body('capacity').optional().isInt({ min: 0 }).withMessage('Capacity must be a non-negative integer').toInt(),
    body('status').optional().isString().trim().isIn(['draft', 'published', 'completed', 'cancelled']).withMessage('Invalid status value'),
];

// Validation for POST /events/:eventId/ticket-types body
const createTicketTypeValidation = [
    // eventId is validated separately
    body('name').notEmpty().withMessage('Ticket type name is required').trim(),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a non-negative number').toFloat(),
    body('quantity').isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer').toInt(),
    body('saleStartDate').isISO8601().withMessage('Sale start date must be a valid ISO 8601 date').toDate(),
    body('saleEndDate').isISO8601().withMessage('Sale end date must be a valid ISO 8601 date').toDate()
        .custom((value, { req }) => {
            if (value <= req.body.saleStartDate) {
                throw new Error('Sale end date must be after sale start date');
            }
            return true;
        }),
    body('description').optional({ nullable: true }).isString().trim(),
];

// Validation for PUT /events/:eventId/ticket-types/:ticketTypeId body
const updateTicketTypeValidation = [
    // eventId and ticketTypeId validated separately
    body('name').optional().notEmpty().withMessage('Ticket type name cannot be empty').trim(),
    body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a non-negative number').toFloat(),
    body('quantity').optional().isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer').toInt(),
    body('saleStartDate').optional().isISO8601().withMessage('Sale start date must be a valid ISO 8601 date').toDate(),
    body('saleEndDate').optional().isISO8601().withMessage('Sale end date must be a valid ISO 8601 date').toDate(),
    // Add custom validation for saleEndDate > saleStartDate if both are provided
    body('description').optional({ nullable: true }).isString().trim(),
];


// --- Controller Class ---

class EventController {

    /**
     * GET /events
     * List events with filtering, sorting, pagination.
     */
    async listEvents(req, res, next) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        try {
            const result = await EventService.listEvents(req.query);
            if (result.success) {
                res.status(200).json(result); // Includes data and pagination
            } else {
                // Service layer should provide appropriate status
                res.status(result.status || 500).json({ success: false, message: result.message });
            }
        } catch (error) {
            logger.error('Error in EventController listEvents:', { error: error.message });
            next(error);
        }
    }

    /**
     * GET /events/:eventId
     * Get a single event by ID.
     */
    async getEventById(req, res, next) {
        const errors = validationResult(req); // Checks param validation
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        try {
            const eventId = req.params.eventId;
            const result = await EventService.getEventById(eventId);
            if (result.success) {
                res.status(200).json(result);
            } else {
                res.status(result.status).json({ success: false, message: result.message });
            }
        } catch (error) {
            logger.error('Error in EventController getEventById:', { error: error.message });
            next(error);
        }
    }

    /**
     * POST /events
     * Create a new event.
     */
    async createEvent(req, res, next) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        try {
            const creatorUserId = req.user.id; // From authMiddleware
            const result = await EventService.createEvent(req.body, creatorUserId);
            if (result.success) {
                res.status(result.status).json(result);
            } else {
                res.status(result.status).json({ success: false, message: result.message });
            }
        } catch (error) {
            logger.error('Error in EventController createEvent:', { error: error.message });
            next(error);
        }
    }

    /**
     * PUT /events/:eventId
     * Update an existing event.
     */
    async updateEvent(req, res, next) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        try {
            const eventId = req.params.eventId;
            const requestingUserId = req.user.id; // From authMiddleware
            const result = await EventService.updateEvent(eventId, req.body, requestingUserId);
            if (result.success) {
                res.status(200).json(result);
            } else {
                res.status(result.status).json({ success: false, message: result.message });
            }
        } catch (error) {
            logger.error('Error in EventController updateEvent:', { error: error.message });
            next(error);
        }
    }

    /**
     * DELETE /events/:eventId
     * Delete an event.
     */
    async deleteEvent(req, res, next) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        try {
            const eventId = req.params.eventId;
            const requestingUserId = req.user.id; // From authMiddleware
            const result = await EventService.deleteEvent(eventId, requestingUserId);
            if (result.success) {
                res.status(result.status).json({ success: true, message: result.message });
            } else {
                res.status(result.status).json({ success: false, message: result.message });
            }
        } catch (error) {
            logger.error('Error in EventController deleteEvent:', { error: error.message });
            next(error);
        }
    }

    // --- Ticket Type Controller Methods ---

    /**
     * POST /events/:eventId/ticket-types
     * Create a ticket type for an event.
     */
    async createTicketType(req, res, next) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        try {
            const eventId = req.params.eventId;
            const requestingUserId = req.user.id; // From authMiddleware
            const result = await EventService.createTicketType(eventId, req.body, requestingUserId);
            if (result.success) {
                res.status(result.status).json(result);
            } else {
                res.status(result.status).json({ success: false, message: result.message });
            }
        } catch (error) {
            logger.error('Error in EventController createTicketType:', { error: error.message });
            next(error);
        }
    }

    /**
     * PUT /events/:eventId/ticket-types/:ticketTypeId
     * Update a ticket type.
     */
    async updateTicketType(req, res, next) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        try {
            const { eventId, ticketTypeId } = req.params;
            const requestingUserId = req.user.id; // From authMiddleware
            const result = await EventService.updateTicketType(eventId, ticketTypeId, req.body, requestingUserId);
            if (result.success) {
                res.status(200).json(result);
            } else {
                res.status(result.status).json({ success: false, message: result.message });
            }
        } catch (error) {
            logger.error('Error in EventController updateTicketType:', { error: error.message });
            next(error);
        }
    }

    /**
     * DELETE /events/:eventId/ticket-types/:ticketTypeId
     * Delete a ticket type.
     */
    async deleteTicketType(req, res, next) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        try {
            const { eventId, ticketTypeId } = req.params;
            const requestingUserId = req.user.id; // From authMiddleware
            const result = await EventService.deleteTicketType(eventId, ticketTypeId, requestingUserId);
            if (result.success) {
                res.status(result.status).json({ success: true, message: result.message });
            } else {
                res.status(result.status).json({ success: false, message: result.message });
            }
        } catch (error) {
            logger.error('Error in EventController deleteTicketType:', { error: error.message });
            next(error);
        }
    }
}

// Export validation rules and controller instance
export {
    listEventsValidation,
    eventIdParamValidation,
    ticketTypeIdParamValidation,
    createEventValidation,
    updateEventValidation,
    createTicketTypeValidation,
    updateTicketTypeValidation,
};
export default new EventController();
