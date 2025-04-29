import UserService from '../services/userService.js';
import { body, param, validationResult } from 'express-validator';
import { logger } from '../config/logger.js';

// Helper function to construct full avatar URL
const getFullAvatarUrl = (req, filename) => {
    if (!filename) return null;
    // Ensure req.protocol and req.get('host') are available
    const protocol = req.protocol || 'http'; // Default to http if protocol not detected
    const host = req.get('host');
    if (!host) {
        logger.warn('Could not determine host to construct avatar URL.');
        return `/api/v1/files/${filename}`; // Fallback relative path
    }
    return `${protocol}://${host}/api/v1/files/${filename}`;
};

// Helper function to format user data (add full avatar URL)
const formatUserResponse = (req, user) => {
    if (!user) return null;
    if (Array.isArray(user)) {
        return user.map(u => ({
            ...u,
            avatar: getFullAvatarUrl(req, u.avatar)
        }));
    } else {
        return {
            ...user,
            avatar: getFullAvatarUrl(req, user.avatar)
        };
    }
};

// Validation rules
const userIdParamValidation = [
    param('id').isInt({ min: 1 }).withMessage('User ID must be a positive integer'),
];

const createUserValidation = [
    body('name').notEmpty().withMessage('Name is required').trim(),
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
    body('role').isIn(['admin', 'user']).withMessage('Role must be either "admin" or "user"'),
    // Note: Avatar validation is handled by Multer middleware
];

const updateUserValidation = [
    param('id').isInt({ min: 1 }).withMessage('User ID must be a positive integer'),
    body('name').optional().notEmpty().withMessage('Name cannot be empty').trim(),
    body('email').optional().isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').optional().isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
];


class UserController {

    /**
     * GET /api/v1/users
     * Gets users based on role (all for admin, self for user).
     */
    async getUsers(req, res, next) {
        try {
            // req.user is populated by authMiddleware
            const requestingUserId = req.user.id;
            const requestingUserRole = req.user.role;

            const result = await UserService.getUsers(requestingUserId, requestingUserRole);

            if (result.success) {
                res.status(200).json({
                    success: true,
                    data: formatUserResponse(req, result.data) // Format avatar URLs
                });
            } else {
                // Service layer handles not found, etc.
                res.status(result.status || 500).json({
                    success: false,
                    message: result.message
                });
            }
        } catch (error) {
            logger.error('Error in UserController getUsers:', { error: error.message });
            next(error);
        }
    }

    /**
     * POST /api/v1/users
     * Creates a new user (admin only). Handles avatar upload.
     */
    async createUser(req, res, next) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const userData = req.body;
            const avatarFile = req.file; // Uploaded file info from Multer

            const result = await UserService.createUser(userData, avatarFile?.filename);

            if (result.success) {
                res.status(result.status).json({
                    success: true,
                    data: formatUserResponse(req, result.data) // Format avatar URL
                });
            } else {
                res.status(result.status).json({
                    success: false,
                    message: result.message
                });
            }
        } catch (error) {
            logger.error('Error in UserController createUser:', { error: error.message });
            next(error);
        }
    }

    /**
     * PUT /api/v1/users/:id
     * Updates a user (admin or owner). Handles avatar upload.
     */
    async updateUser(req, res, next) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const userIdToUpdate = parseInt(req.params.id);
            const requestingUserId = req.user.id;
            const requestingUserRole = req.user.role;

            // Authorization: Allow admin or user updating their own profile
            if (requestingUserRole.toLowerCase() !== 'admin' && requestingUserId !== userIdToUpdate) {
                logger.warn(`Authorization failed: User ${requestingUserId} attempting to update user ${userIdToUpdate}`);
                return res.status(403).json({ success: false, message: 'Forbidden: You can only update your own profile.' });
            }

            const updateData = req.body;
            const avatarFile = req.file; // New avatar file info, if uploaded

            // Pass undefined if no file was uploaded, null if explicitly removing?
            // Service layer needs to handle this logic. Pass filename or undefined.
            const avatarFilename = avatarFile ? avatarFile.filename : undefined;

            const result = await UserService.updateUser(userIdToUpdate, updateData, avatarFilename);

            if (result.success) {
                res.status(200).json({
                    success: true,
                    data: formatUserResponse(req, result.data) // Format avatar URL
                });
            } else {
                res.status(result.status).json({
                    success: false,
                    message: result.message
                });
            }
        } catch (error) {
            logger.error('Error in UserController updateUser:', { error: error.message });
            next(error);
        }
    }

    /**
     * PUT /api/v1/users/change-role/:id
     * change role a user (admin only - assumed).
     */
    async changeUserRole(req, res, next) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        try {
            const userIdToChangeRole = parseInt(req.params.id);
            const { role } = req.body;
            const result = await UserService.changeUserRole(userIdToChangeRole, role);

            if (result.success) {
                res.status(200).json({
                    success: true,
                    message: result.message
                });
            } else {
                res.status(result.status).json({
                    success: false,
                    message: result.message
                });
            }
        } catch (error) {
            logger.error('Error in UserController changeUserRole:', { error: error.message });
            next(error);
        }
    }

    /**
     * PATCH /api/v1/users/activate/:id
     * Activates a user (admin only - assumed).
     */
    async activateUser(req, res, next) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        try {
            const userIdToActivate = parseInt(req.params.id);
            const result = await UserService.activateUser(userIdToActivate);

            if (result.success) {
                res.status(200).json({
                    success: true,
                    message: result.message
                });
            } else {
                res.status(result.status).json({
                    success: false,
                    message: result.message
                });
            }
        } catch (error) {
            logger.error('Error in UserController activateUser:', { error: error.message });
            next(error);
        }
    }

    /**
     * DELETE /api/v1/users/:id
     * Deletes a user (admin only - assumed).
     */
    async deleteUser(req, res, next) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        try {
            const userIdToDelete = parseInt(req.params.id);
            const result = await UserService.deleteUser(userIdToDelete);

            if (result.success) {
                res.status(200).json({ // Or 204 No Content
                    success: true,
                    message: result.message
                });
            } else {
                res.status(result.status).json({
                    success: false,
                    message: result.message
                });
            }
        } catch (error) {
            logger.error('Error in UserController deleteUser:', { error: error.message });
            next(error);
        }
    }
}

export {
    userIdParamValidation,
    createUserValidation,
    updateUserValidation
};
export default new UserController();
