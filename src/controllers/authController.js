import AuthService from '../services/authService.js';
import { body, validationResult } from 'express-validator';
import { logger } from '../config/logger.js';

// Validation rules for login
const loginValidationRules = [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
];

// Validation rules for registration
const registerValidationRules = [
    body('name').notEmpty().withMessage('Name is required').trim().escape(),
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'), // Adjusted based on previous file state
    body('phone_number').notEmpty().withMessage('Phone number is required').trim().escape(),
];

class AuthController {
    /**
     * Handles user login requests.
     * POST /Login
     */
    async login(req, res, next) {
        // 1. Validate input
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.warn('Login validation failed:', { errors: errors.array(), body: req.body });
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;

        try {
            // 2. Call AuthService to attempt login
            const result = await AuthService.login(email, password);

            // 3. Send response based on service result
            if (result.success) {
                const { token, user } = result;
                res.status(result.status).json({
                    success: true,
                    message: result.message,
                    token: token,
                    user: user
                });
            } else {
                res.status(result.status).json({
                    success: false,
                    message: result.message
                });
            }
        } catch (error) {
            logger.error('Unexpected error in AuthController login:', { error: error.message, stack: error.stack });
            next(error);
        }
    }

    /**
     * Handles user registration requests.
     * POST /Register
     */
    async register(req, res, next) {
        // 1. Validate input
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.warn('Registration validation failed:', { errors: errors.array(), body: req.body });
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, email, password, phone_number } = req.body;

        try {
            // 2. Call AuthService to attempt registration
            const result = await AuthService.register({ name, email, password, phone_number });

            // 3. Send response based on service result
            res.status(result.status).json({
                success: result.success,
                message: result.message,
                data: result.data // Send back created user data (excluding password)
            });

        } catch (error) {
            logger.error('Unexpected error in AuthController register:', { error: error.message, stack: error.stack });
            next(error);
        }
    }

    /**
     * Handles user logout requests.
     * POST /Logout
     * Note: Since JWT is stateless, this mainly signals the client to discard the token.
     */
    async logout(req, res, next) {
        try {
            // No server-side action needed for stateless JWT logout
            // The client is responsible for discarding the token.
            logger.info(`User logged out: ${req.user?.id}`); // Log if user info is available
            res.status(200).json({ success: true, message: 'Logout successful' });
        } catch (error) {
            logger.error('Error during logout:', { error: error.message, userId: req.user?.id });
            next(error);
        }
    }
}

// Export validation rules
export { loginValidationRules, registerValidationRules };
export default new AuthController();
