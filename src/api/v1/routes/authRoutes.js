import express from 'express';
import AuthController, { loginValidationRules, registerValidationRules } from '../../../controllers/authController.js';
import authMiddleware from '../../../middlewares/authMiddleware.js'; // Import auth middleware
// Import any necessary middleware (e.g., rate limiting might apply here)
// import rateLimiter from '../../config/rateLimit.js';

const router = express.Router();

/**
 * @route   POST /Login
 * @desc    Authenticate user and get token
 * @access  Public
 */
router.post(
    '/Login', // Corrected path
    // apply rateLimiter, // Optional: Apply rate limiting specifically to login
    loginValidationRules, // Apply validation rules
    AuthController.login   // Call the controller method
);

/**
 * @route   POST /Register
 * @desc    Register a new user
 * @access  Public
 */
router.post(
    '/Register', // Corrected path
    registerValidationRules, // Apply registration validation rules
    AuthController.register  // Call the register controller method
);

/**
 * @route   POST /Logout
 * @desc    Logs out the current user (client-side token discard)
 * @access  Private
 */
router.post(
    '/Logout',
    authMiddleware, // Requires user to be authenticated
    AuthController.logout
);


// Add other auth routes here if needed (e.g., /refresh-token)

export default router;
