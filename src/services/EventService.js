import prisma from '../models/prisma.js';
import { logger } from '../config/logger.js';

// Helper function to select fields excluding sensitive ones if needed later
const selectEventFields = {
    id: true,
    userId: true, // creatorId
    name: true,
    description: true,
    startTime: true,
    endTime: true,
    location: true,
    locationDetails: true,
    posterImageUrl: true,
    category: true,
    capacity: true,
    status: true,
    createdAt: true,
    updatedAt: true,
    // TODO:Include TicketTypes by default when fetching a single event
    // ticketTypes: { select: { id: true, name: true, price: true, quantity: true, saleStartDate: true, saleEndDate: true } }
};

const selectTicketTypeFields = {
    id: true,
    eventId: true,
    name: true,
    price: true,
    quantity: true,
    saleStartDate: true,
    saleEndDate: true,
    description: true,
    createdAt: true,
    updatedAt: true,
};


class EventService {

    /**
     * List events with filtering, sorting, and pagination.
     * @param {object} queryParams - Contains search, sort, filter, pagination options.
     * @returns {Promise<object>} - Contains success status, data (events list, pagination info), and message.
     */
    async listEvents(queryParams) {
        const {
            page = 1,
            limit = 10,
            search = '',
            sort = 'startTime', // Default sort field
            order = 'asc',      // Default sort order
            category = '',
            status = '',
            date = ''           // Expecting YYYY-MM-DD format
        } = queryParams;

        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const skip = (pageNum - 1) * limitNum;

        const where = {};
        if (search) {
            where.OR = [
                { name: { contains: search } },
                { description: { contains: search } },
                { location: { contains: search } },
            ];
        }
        if (category) {
            where.category = category;
        }
        if (status) {
            where.status = status;
        }
        // Always filter out soft-deleted events
        where.deletedAt = null;

        if (date) {
            try {
                const startDate = new Date(date);
                startDate.setUTCHours(0, 0, 0, 0); // Start of the day in UTC
                const endDate = new Date(startDate);
                endDate.setUTCDate(startDate.getUTCDate() + 1); // Start of the next day in UTC

                where.startTime = {
                    gte: startDate,
                    lt: endDate,
                };
            } catch (e) {
                logger.warn(`Invalid date format received: ${date}`);
                // Optionally return an error or ignore the date filter
            }
        }

        // Define allowed sort fields to prevent arbitrary sorting
        const allowedSortFields = ['name', 'startTime', 'createdAt', 'category', 'status'];
        const sortField = allowedSortFields.includes(sort) ? sort : 'startTime';
        const sortOrder = order === 'desc' ? 'desc' : 'asc';

        try {
            const events = await prisma.event.findMany({
                where, // deletedAt: null is already included here
                select: selectEventFields, // Select specific fields
                skip,
                take: limitNum,
                orderBy: {
                    [sortField]: sortOrder,
                },
            });

            // Count only non-deleted events matching the criteria
            const totalEvents = await prisma.event.count({ where }); // where already includes deletedAt: null
            const totalPages = Math.ceil(totalEvents / limitNum);

            logger.info(`Fetched ${events.length} active events (Page ${pageNum}/${totalPages})`);
            return {
                success: true,
                data: events,
                pagination: {
                    currentPage: pageNum,
                    totalPages,
                    totalEvents,
                    limit: limitNum,
                },
            };
        } catch (error) {
            logger.error('Error listing events:', { error: error.message, queryParams });
            return { success: false, status: 500, message: 'Internal server error listing events' };
        }
    }

    /**
     * Get a single event by its ID, including its ticket types.
     * @param {number} eventId - The ID of the event.
     * @returns {Promise<object>} - Contains success status, data (event), and message.
     */
    async getEventById(eventId) {
        try {
            // Fetch only if not soft-deleted
            const event = await prisma.event.findUnique({
                where: { id: eventId, deletedAt: null },
                select: {
                    ...selectEventFields,
                    ticketTypes: { // Include only non-deleted ticket types
                        where: { deletedAt: null },
                        select: selectTicketTypeFields
                    }
                }
            });

            if (!event) {
                logger.warn(`Event not found with ID: ${eventId}`);
                return { success: false, status: 404, message: 'Event not found' };
            }

            logger.info(`Fetched event details for ID: ${eventId}`);
            return { success: true, data: event };
        } catch (error) {
            logger.error('Error fetching event by ID:', { error: error.message, eventId });
            return { success: false, status: 500, message: 'Internal server error fetching event' };
        }
    }

    /**
     * Create a new event, optionally including its ticket types in a transaction.
     * @param {object} eventData - Data for the new event, potentially including a `ticketTypes` array.
     * @param {number} creatorUserId - The ID of the user creating the event (Admin).
     * @returns {Promise<object>} - Contains success status, data (new event with ticket types), and message.
     */
    async createEvent(eventData, creatorUserId) {
        // Separate event data from ticket type data
        const { ticketTypes, ...basicEventData } = eventData;
        const { name, description, startTime, endTime, location, locationDetails, posterImageUrl, category, capacity, status } = basicEventData;

        try {
            // check ticketTypes quantity > capacity
            if (ticketTypes.reduce((total, { quantity }) => total + quantity, 0) > capacity) {
                return { success: false, status: 400, message: 'Total ticket types quantity cannot be greater than event capacity' };
            }

            const result = await prisma.$transaction(async (tx) => {
                // 1. Create the Event
                const newEvent = await tx.event.create({
                    data: {
                        name,
                        description,
                        startTime: new Date(startTime),
                        endTime: new Date(endTime),
                        location,
                        locationDetails,
                        posterImageUrl,
                        category,
                        capacity: parseInt(capacity, 10),
                        status: status || 'draft',
                        userId: creatorUserId,
                    },
                    // Select basic fields initially, we'll fetch with relations later
                    select: { id: true }
                });

                // 2. Create Ticket Types if provided
                if (ticketTypes && Array.isArray(ticketTypes) && ticketTypes.length > 0) {
                    for (const ttData of ticketTypes) {
                        await tx.ticketType.create({
                            data: {
                                eventId: newEvent.id, // Link to the created event
                                name: ttData.name,
                                price: parseFloat(ttData.price),
                                quantity: parseInt(ttData.quantity, 10),
                                saleStartDate: new Date(ttData.saleStartDate),
                                saleEndDate: new Date(ttData.saleEndDate),
                                description: ttData.description,
                                quota: parseInt(ttData.quantity, 10),
                                sold: 0
                            }
                        });
                    }
                }

                // 3. Return the ID of the newly created event
                return newEvent.id;
            });

            // After transaction succeeds, fetch the complete event data including non-deleted ticket types
            const completeEvent = await prisma.event.findUnique({
                where: { id: result, deletedAt: null }, // Ensure the event itself wasn't somehow deleted mid-process (unlikely but safe)
                select: {
                    ...selectEventFields,
                    ticketTypes: { // Explicitly include only non-deleted ticket types here
                        where: { deletedAt: null },
                        select: selectTicketTypeFields
                    }
                }
            });

            logger.info(`Event and ${ticketTypes?.length || 0} ticket types created successfully by user ${creatorUserId}: ${completeEvent.id}`);
            return { success: true, status: 201, data: completeEvent };

        } catch (error) {
            logger.error('Error creating event with ticket types:', {
                error: error.message,
                userId: creatorUserId,
                eventData: basicEventData // Log only basic data, not potentially large ticketTypes array
            });
            // Handle specific Prisma errors if needed (e.g., unique constraints, transaction errors)
            return { success: false, status: 500, message: 'Internal server error creating event' };
        }
    }

    /**
     * Update an existing event.
     * @param {number} eventId - The ID of the event to update.
     * @param {object} updateData - Data to update.
     * @param {number} requestingUserId - ID of the user making the request (for auth checks).
     * @returns {Promise<object>} - Contains success status, data (updated event), and message.
     */
    async updateEvent(eventId, updateData, requestingUserId) {
        // Destructure only the fields allowed to be updated
        const { name, description, startTime, endTime, location, locationDetails, posterImageUrl, category, capacity, status } = updateData;

        try {
            // Check if event exists and is not soft-deleted
            const event = await prisma.event.findUnique({ where: { id: eventId, deletedAt: null } });
            if (!event) {
                return { success: false, status: 404, message: 'Event not found or has been deleted' };
            }
            // Add authorization check if needed:
            // if (event.userId !== requestingUserId && req.user.role !== 'superadmin') { // Example check
            //     return { success: false, status: 403, message: 'Forbidden: Not authorized to update this event' };
            // }

            const dataToUpdate = {};
            if (name !== undefined) dataToUpdate.name = name;
            if (description !== undefined) dataToUpdate.description = description;
            if (startTime !== undefined) dataToUpdate.startTime = new Date(startTime);
            if (endTime !== undefined) dataToUpdate.endTime = new Date(endTime);
            if (location !== undefined) dataToUpdate.location = location;
            if (locationDetails !== undefined) dataToUpdate.locationDetails = locationDetails;
            if (posterImageUrl !== undefined) dataToUpdate.posterImageUrl = posterImageUrl;
            if (category !== undefined) dataToUpdate.category = category;
            if (capacity !== undefined) dataToUpdate.capacity = parseInt(capacity, 10);
            if (status !== undefined) dataToUpdate.status = status;

            if (Object.keys(dataToUpdate).length === 0) {
                return { success: false, status: 400, message: 'No valid fields provided for update' };
            }

            // Update only if not soft-deleted
            const updatedEvent = await prisma.event.update({
                where: { id: eventId, deletedAt: null },
                data: dataToUpdate,
                select: selectEventFields,
            });

            logger.info(`Active event updated successfully by user ${requestingUserId}: ${eventId}`);
            return { success: true, data: updatedEvent };
        } catch (error) {
            logger.error('Error updating event:', { error: error.message, eventId, userId: requestingUserId });
            return { success: false, status: 500, message: 'Internal server error updating event' };
        }
    }

    /**
     * Delete an event.
     * @param {number} eventId - The ID of the event to delete.
     * @param {number} requestingUserId - ID of the user making the request.
     * @returns {Promise<object>} - Contains success status and message.
     */
    async deleteEvent(eventId, requestingUserId) { // Now implements soft delete
        try {
            // Check if event exists and is not already soft-deleted
            const event = await prisma.event.findUnique({ where: { id: eventId, deletedAt: null } });
            if (!event) {
                return { success: false, status: 404, message: 'Event not found or already deleted' };
            }
            // Add authorization check if needed

            const now = new Date();
            // Use a transaction to soft delete the event and its related ticket types
            await prisma.$transaction(async (tx) => {
                // Soft delete related TicketTypes first
                await tx.ticketType.updateMany({
                    where: {
                        eventId: eventId,
                        deletedAt: null, // Only soft delete active ones
                    },
                    data: { deletedAt: now },
                });

                // Soft delete the Event itself
                await tx.event.update({
                    where: { id: eventId }, // No need for deletedAt: null here, already checked above
                    data: { deletedAt: now },
                });
            });

            logger.info(`Event soft-deleted successfully by user ${requestingUserId}: ${eventId}`);
            return { success: true, status: 200, message: 'Event deleted successfully' };
        } catch (error) {
            logger.error('Error soft-deleting event:', { error: error.message, eventId, userId: requestingUserId });
            return { success: false, status: 500, message: 'Internal server error deleting event' };
        }
    }

    // --- Ticket Type Methods ---

    /**
     * Create a new ticket type for an event.
     * @param {number} eventId - The ID of the event.
     * @param {object} ticketTypeData - Data for the new ticket type.
     * @param {number} requestingUserId - ID of the user making the request.
     * @returns {Promise<object>} - Contains success status, data (new ticket type), and message.
     */
    async createTicketType(eventId, ticketTypeData, requestingUserId) {
        const { name, price, quantity, saleStartDate, saleEndDate, description } = ticketTypeData;
        try {
            // Check if parent event exists and is not soft-deleted
            const event = await prisma.event.findUnique({ 
                where: { id: eventId, deletedAt: null },
                select: {
                    ...selectEventFields,
                    ticketTypes: { // Include only non-deleted ticket types
                        where: { deletedAt: null },
                        select: selectTicketTypeFields
                    }
                }
            });
            if (!event) {
                return { success: false, status: 404, message: 'Event not found or has been deleted' };
            }
            
            // check capacity > quantity + all quantity ticket types
            if (event.capacity < event.ticketTypes.reduce((total, { quantity }) => total + quantity, 0) + parseInt(quantity, 10)) {
                return { success: false, status: 400, message: 'Total ticket types quantity cannot be greater than event capacity' };
            }

            const newTicketType = await prisma.ticketType.create({
                data: {
                    eventId,
                    name,
                    price: parseFloat(price), // Ensure price is float/decimal
                    quantity: parseInt(quantity, 10),
                    saleStartDate: new Date(saleStartDate),
                    saleEndDate: new Date(saleEndDate),
                    description,
                    quota: parseInt(quantity, 10),
                    sold: 0,
                },
                select: selectTicketTypeFields,
            });

            logger.info(`Ticket type created successfully by user ${requestingUserId} for event ${eventId}: ${newTicketType.id}`);
            return { success: true, status: 201, data: newTicketType };
        } catch (error) {
            logger.error('Error creating ticket type:', { error: error.message, eventId, userId: requestingUserId });
            return { success: false, status: 500, message: 'Internal server error creating ticket type' };
        }
    }

    /**
     * Update an existing ticket type.
     * @param {number} eventId - The ID of the event.
     * @param {number} ticketTypeId - The ID of the ticket type to update.
     * @param {object} updateData - Data to update.
     * @param {number} requestingUserId - ID of the user making the request.
     * @returns {Promise<object>} - Contains success status, data (updated ticket type), and message.
     */
    async updateTicketType(eventId, ticketTypeId, updateData, requestingUserId) {
        const { name, price, quantity, saleStartDate, saleEndDate, description } = updateData;
        try {
            // Check if ticket type exists, belongs to the correct event, and is not soft-deleted
            const ticketType = await prisma.ticketType.findUnique({
                where: { id: ticketTypeId, eventId: eventId, deletedAt: null },
            });
            if (!ticketType) {
                return { success: false, status: 404, message: 'Ticket type not found, does not belong to this event, or has been deleted' };
            }

            // Check if parent event exists and is not soft-deleted
            const event = await prisma.event.findUnique({ 
                where: { id: eventId, deletedAt: null },
                select: {
                    ...selectEventFields,
                    ticketTypes: { // Include only non-deleted ticket types
                        where: { deletedAt: null },
                        select: selectTicketTypeFields
                    }
                }
            });
            if (!event) {
                return { success: false, status: 404, message: 'Event not found or has been deleted' };
            }
            
            // check capacity > quantity + all quantity ticket types except the one being updated
            const allTicketTypesQuantity = event.ticketTypes.reduce((total, { quantity }) => total + quantity, 0) - ticketType.quantity;
            if (event.capacity < allTicketTypesQuantity + parseInt(quantity, 10)) {
                return { success: false, status: 400, message: 'Total ticket types quantity cannot be greater than event capacity' };
            }
            
            const dataToUpdate = {};
            if (name !== undefined) dataToUpdate.name = name;
            if (price !== undefined) dataToUpdate.price = parseFloat(price);
            if (quantity !== undefined) dataToUpdate.quantity = parseInt(quantity, 10);
            if (saleStartDate !== undefined) dataToUpdate.saleStartDate = new Date(saleStartDate);
            if (saleEndDate !== undefined) dataToUpdate.saleEndDate = new Date(saleEndDate);
            if (description !== undefined) dataToUpdate.description = description;
            if (quantity !== undefined) dataToUpdate.quota = parseInt(quantity, 10) - ticketType.sold;

            if (dataToUpdate.quota < 0) {
                return { success: false, status: 400, message: 'Total ticket types quantity cannot be greater than event capacity' };
            }

            if (Object.keys(dataToUpdate).length === 0) {
                return { success: false, status: 400, message: 'No valid fields provided for update' };
            }

            // Update only if not soft-deleted
            const updatedTicketType = await prisma.ticketType.update({
                where: { id: ticketTypeId, deletedAt: null }, // Ensure we don't update a deleted one
                data: dataToUpdate,
                select: selectTicketTypeFields,
            });

            logger.info(`Active ticket type updated successfully by user ${requestingUserId}: ${ticketTypeId}`);
            return { success: true, data: updatedTicketType };
        } catch (error) {
            logger.error('Error updating ticket type:', { error: error.message, ticketTypeId, userId: requestingUserId });
            return { success: false, status: 500, message: 'Internal server error updating ticket type' };
        }
    }

    /**
     * Delete a ticket type.
     * @param {number} eventId - The ID of the event.
     * @param {number} ticketTypeId - The ID of the ticket type to delete.
     * @param {number} requestingUserId - ID of the user making the request.
     * @returns {Promise<object>} - Contains success status and message.
     */
    async deleteTicketType(eventId, ticketTypeId, requestingUserId) { // Now implements soft delete
        try {
            // Check if ticket type exists, belongs to the event, and is not already soft-deleted
            const ticketType = await prisma.ticketType.findUnique({
                where: { id: ticketTypeId, eventId: eventId, deletedAt: null }
            });
            if (!ticketType) {
                return { success: false, status: 404, message: 'Ticket type not found, does not belong to this event, or already deleted' };
            }

            // Soft delete the TicketType
            await prisma.ticketType.update({
                where: { id: ticketTypeId }, // No need for deletedAt: null here, already checked above
                data: { deletedAt: new Date() },
            });

            logger.info(`Ticket type soft-deleted successfully by user ${requestingUserId}: ${ticketTypeId}`);
            return { success: true, status: 200, message: 'Ticket type deleted successfully' };
        } catch (error) {
            logger.error('Error soft-deleting ticket type:', { error: error.message, ticketTypeId, userId: requestingUserId });
            return { success: false, status: 500, message: 'Internal server error deleting ticket type' };
        }
    }
}

export default new EventService();
