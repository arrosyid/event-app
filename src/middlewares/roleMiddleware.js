import { logger } from '../config/logger.js'; // Optional: for logging

/**
 * Middleware factory to check if the authenticated user has one of the allowed roles.
 * Assumes `authMiddleware` has already populated `req.user`.
 * @param {string[]} allowedRoles - An array of role names allowed to access the route.
 * @returns {function} Express middleware function.
 */
const roleMiddleware = (allowedRoles) => {
    return (req, res, next) => {
        // Ensure req.user and req.user.role exist (populated by authMiddleware)
        if (!req.user || !req.user.role) {
            logger.error('Role check failed: User or role not found on request object. Ensure authMiddleware runs first.', { path: req.path });
            return res.status(500).json({ message: 'Internal Server Error: User role not determined.' });
        }

        const userRole = req.user.role;

        // Check if the user's role is included in the allowed roles array
        // Case-insensitive comparison might be useful depending on how roles are stored/compared
        if (allowedRoles.some(role => role.toLowerCase() === userRole.toLowerCase())) {
            logger.debug(`Role access granted for user ${req.user.id} (Role: ${userRole}) to route requiring roles: [${allowedRoles.join(', ')}]`, { path: req.path });
            return next(); // User has the required role, proceed
        } else {
            logger.warn(`Role access denied for user ${req.user.id} (Role: ${userRole}). Required roles: [${allowedRoles.join(', ')}]`, { path: req.path });
            return res.status(403).json({ message: 'Forbidden: You do not have permission to access this resource.' });
        }
    };
};

export default roleMiddleware;
