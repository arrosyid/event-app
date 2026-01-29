import jwt from 'jsonwebtoken';
import { jwtSecret } from '../config/auth.js';
import { logger } from '../config/logger.js'; // Optional: for logging

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
        logger.warn('user unauthenticated try to access protected route.', { path: req.path });
        return  res.status(401).json({ message: 'Unauthorized: Authentication required to access this resource.' });
    }

    try {
        const decoded = jwt.verify(token, jwtSecret);
        // Attach user information (payload) to the request object
        req.user = decoded; // Contains { id, role } or whatever was signed
        logger.info(`User authenticated: ${req.user.id} (Role: ${req.user.role})`, { path: req.path });
        next();
    } catch (err) {
        // if (err.name === 'TokenExpiredError') {
        //     logger.error('Authentication failed: Token expired.', { error: err.message, path: req.path, user: req.user });
        //     return res.status(401).json({ message: 'Unauthorized: Token expired' });
        // }
        logger.error('Authentication failed: Invalid or expired token.', { error: err.message, path: req.path });
        return res.status(401).json({ message: 'Unauthorized: Invalid token' });
    }
};

export default authMiddleware;
