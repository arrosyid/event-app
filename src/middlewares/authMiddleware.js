import jwt from 'jsonwebtoken';
import { jwtSecret } from '../config/auth.js';
import { logger } from '../config/logger.js'; // Optional: for logging

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
        logger.warn('Authentication attempt failed: No token provided.', { path: req.path });
        return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }

    try {
        const decoded = jwt.verify(token, jwtSecret);
        // Attach user information (payload) to the request object
        req.user = decoded; // Contains { id, role } or whatever was signed
        logger.info(`User authenticated: ${req.user.id} (Role: ${req.user.role})`, { path: req.path });
        next();
    } catch (err) {
        logger.error('Authentication failed: Invalid token.', { error: err.message, path: req.path });
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Unauthorized: Token expired' });
        }
        return res.status(403).json({ message: 'Forbidden: Invalid token' });
    }
};

export default authMiddleware;
