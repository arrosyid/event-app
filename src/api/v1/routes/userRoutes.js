import express from 'express';
import UserController, {
    userIdParamValidation,
    createUserValidation,
    updateUserValidation
} from '../../../controllers/userController.js'; // Corrected path
import authMiddleware from '../../../middlewares/authMiddleware.js'; // Corrected path
import roleMiddleware from '../../../middlewares/roleMiddleware.js'; // Corrected path
import upload from '../../../config/multer.js'; // Corrected path
import { handleMulterError } from '../../../middlewares/errorMiddleware.js'; // Corrected path

const router = express.Router();

// --- Protected Routes ---
// Apply authorization middleware to all routes in this file
router.use(authMiddleware);

/**
 * @route   GET /api/v1/users
 * @desc    Get users (all for admin, self for user)
 * @access  Private (Admin, User) - Controller handles logic based on role
 */
router.get('/', 
    roleMiddleware(['admin', 'user']),
    UserController.getUsers
);

/**
 * @route   POST /api/v1/users
 * @desc    Create a new user
 * @access  Private (Admin only)
 */
router.post(
    '/',
    roleMiddleware(['admin']), // Only admins can create users
    upload.single('avatar'),   // Handle single file upload named 'avatar'
    handleMulterError,         // Handle Multer errors specifically after upload attempt
    createUserValidation,      // Validate request body
    UserController.createUser
);

/**
 * @route   PUT /api/v1/users/:id
 * @desc    Update a user
 * @access  Private (Admin or Owner) - Controller handles authorization check
 */
router.put(
    '/:id',
    roleMiddleware(['admin', 'user']), // Auth check done in controller for owner logic
    upload.single('avatar'),
    handleMulterError,
    updateUserValidation, // Validates both param and body
    UserController.updateUser
);

/**
 * @route   PUT /api/v1/users/change-role/:id
 * @desc    Change user role
 * @access  Private (Admin only - assumed)
 */
router.put(
    '/change-role/:id',
    roleMiddleware(['admin']), // Only admins can change roles
    userIdParamValidation,     // Validate the ID parameter
    UserController.changeUserRole
);

/**
 * @route   PATCH /api/v1/users/activate/:id
 * @desc    Activate a user account
 * @access  Private (Admin only - assumed, adjust roleMiddleware if needed)
 */
router.patch(
    '/activate/:id',
    roleMiddleware(['admin']), // Example: Restrict activation to admins
    userIdParamValidation,     // Validate the ID parameter
    UserController.activateUser
);

/**
 * @route   DELETE /api/v1/users/:id
 * @desc    Delete a user
 * @access  Private (Admin only - assumed, adjust roleMiddleware if needed)
 */
router.delete(
    '/:id',
    roleMiddleware(['admin']), // Example: Restrict deletion to admins
    userIdParamValidation,     // Validate the ID parameter
    UserController.deleteUser
);


export default router;
