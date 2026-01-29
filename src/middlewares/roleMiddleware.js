import { get } from 'node:http';
import { logger } from '../config/logger.js'; // Optional: for logging
import prisma from '../models/prisma.js';

/**
 * Middleware factory to check if the authenticated user has one of the allowed roles.
 * Assumes `authMiddleware` has already populated `req.user`.
 * @param {string[]} allowedRoles - An array of role names allowed to access the route.
 * @returns {function} Express middleware function.
 */
const roleMiddleware = (allowedRoles) => {
    return async (req, res, next) => {
        // Ensure req.user and req.user.role exist (populated by authMiddleware)
        
        if(!req.user){
            logger.warn('user unauthenticated try to access protected route.', { path: req.path });
            return  res.status(401).json({ message: 'Unauthorized: Authentication required to access this resource.' });
        }
        
        try {
            const { role } = await prisma.user.findUnique({
                where: { id: req.user.sub },
                select: { role: true }
            });
        
        // req.user.role = role.role;
            if (!role) {
                logger.error('Role check failed: User or role not found on request object. Ensure authMiddleware runs first.', { path: req.path });
                return res.status(403).json({ message: 'Forbidden: You do not have permission to access this resource.' });
            }

            // Check if the user's role is included in the allowed roles array
            // Case-insensitive comparison might be useful depending on how roles are stored/compared
            if (allowedRoles.some(role => role.toLowerCase() === role.toLowerCase())) {
                logger.info(`Role access granted for user ${req.user.id} (Role: ${role}) to route requiring roles: [${allowedRoles.join(', ')}]`, { path: req.path });
                return next(); // User has the required role, proceed
            } else {
                logger.warn(`Role access denied for user ${req.user.id} (Role: ${role}). Required roles: [${allowedRoles.join(', ')}]`, { path: req.path });
                return res.status(403).json({ message: 'Forbidden: You do not have permission to access this resource.' });
            }
        }catch (error) {
            logger.error('Error fetching user role from database:', { error: error.message, path: req.path });
            return res.status(500).json({ message: 'Internal server error while verifying user role.' });
        }
    };
};

export default roleMiddleware;
