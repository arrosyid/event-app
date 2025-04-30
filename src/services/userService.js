import prisma from '../models/prisma.js'; // Adjusted path
import { getAsync, setAsync, delAsync } from '../config/redis.js';
import { logger } from '../config/logger.js';
import CryptoJS from 'crypto-js'; // Import crypto-js

// PBKDF2 Configuration (should match AuthService)
const PBKDF2_ITERATIONS = 10000;
const KEY_SIZE = 512 / 32;
const SALT_SIZE = 128 / 8;

class UserService {

    /**
     * Hashes a password using PBKDF2 with a generated salt.
     * (Helper function, could be moved to a shared utility)
     * @param {string} password - The plain text password.
     * @returns {{hash: string, salt: string}} - The hashed password and the salt used, both as hex strings.
     */
    _hashPassword(password) {
        const salt = CryptoJS.lib.WordArray.random(SALT_SIZE);
        const hash = CryptoJS.PBKDF2(password, salt, {
            keySize: KEY_SIZE,
            iterations: PBKDF2_ITERATIONS
        });
        return {
            hash: hash.toString(CryptoJS.enc.Hex),
            salt: salt.toString(CryptoJS.enc.Hex)
        };
    }


    /**
     * Gets users based on the requesting user's role.
     * Admins get all users (cached), regular users get their own profile.
     * @param {number} requestingUserId - The ID of the user making the request.
     * @param {string} requestingUserRole - The role of the user making the request.
     * @returns {Promise<object>} - Contains success status, data (user or users), and message.
     */
    async getUsers(requestingUserId, requestingUserRole) {
        try {
            // Select fields excluding password, salt, and deletedAt (unless needed for admin view)
            const selectFields = { id: true, name: true, email: true, role: true, is_active: true, avatar: true, created_at: true, updated_at: true };

            if (requestingUserRole.toLowerCase() === 'admin') {
                const ALL_USERS_CACHE_KEY = 'users:all'; // Define cache key locally
                const USER_CACHE_TTL = 60; // Define TTL locally
                let cachedUsers = await getAsync(ALL_USERS_CACHE_KEY);
                if (cachedUsers) {
                    logger.info('Cache hit for all users.');
                    return { success: true, data: JSON.parse(cachedUsers) };
                }

                logger.info('Cache miss for all active users. Fetching from DB.');
                // Fetch only active users
                const users = await prisma.user.findMany({
                    where: { deletedAt: null }, // Filter out soft-deleted users
                    select: selectFields
                });
                await setAsync(ALL_USERS_CACHE_KEY, USER_CACHE_TTL, JSON.stringify(users));
                return { success: true, data: users };

            } else {
                // Fetch user only if not soft-deleted
                const user = await prisma.user.findUnique({
                    where: { id: requestingUserId, deletedAt: null }, // Check for soft delete
                    select: selectFields
                });
                if (!user) {
                    logger.warn(`Active user not found with ID: ${requestingUserId}`);
                    return { success: false, status: 404, message: 'User not found or has been deleted' };
                }
                return { success: true, data: user };
            }
        } catch (error) {
            logger.error('Error fetching users:', { error: error.message, userId: requestingUserId, role: requestingUserRole });
            return { success: false, status: 500, message: 'Internal server error fetching users' };
        }
    }

    /**
     * Updates an existing user.
     * @param {number} userId - The ID of the user to update.
     * @param {object} updateData - Data to update (name, email, password, role).
     * @param {string|null} avatarFilename - The new avatar filename, or null if not changed.
     * @returns {Promise<object>} - Contains success status, data (updated user), and message.
     */
    async updateUser(userId, updateData, avatarFilename) {
        const { name, email, password } = updateData;
        try {
            // Find user only if not soft-deleted
            const user = await prisma.user.findUnique({ where: { id: userId, deletedAt: null } });
            if (!user) {
                logger.warn(`User update failed: Active user not found with ID ${userId}`);
                return { success: false, status: 404, message: 'User not found or has been deleted' };
            }

            // Check for email conflict among *active* users only
            if (email && email !== user.email) {
                const existingEmail = await prisma.user.findUnique({ where: { email, deletedAt: null } });
                if (existingEmail) {
                    logger.warn(`User update failed: Email ${email} already exists for another user.`);
                    return { success: false, status: 400, message: 'Email already exists' };
                }
            }

            const dataToUpdate = { name, email };

            // Hash password using crypto-js if it's being updated
            if (password) {
                const { hash: hashedPassword, salt: passwordSalt } = this._hashPassword(password);
                dataToUpdate.password = hashedPassword;
                dataToUpdate.password_salt = passwordSalt; // Store the new salt
            }

            if (avatarFilename !== undefined) {
                dataToUpdate.avatar = avatarFilename;
            }

            // Add updated_at timestamp
            dataToUpdate.updated_at = new Date();

            // Update only if not soft-deleted
            const updatedUser = await prisma.user.update({
                where: { id: userId, deletedAt: null },
                data: dataToUpdate,
                // Select fields excluding password, salt, and deletedAt
                select: { id: true, name: true, email: true, role: true, is_active: true, avatar: true, created_at: true, updated_at: true }
            });

            logger.info(`User updated successfully: ${userId}`);
            // Invalidate caches
            const ALL_USERS_CACHE_KEY = 'users:all'; // Define cache key locally
            await delAsync(ALL_USERS_CACHE_KEY);
            await delAsync(`user:${userId}`);

            return { success: true, data: updatedUser };

        } catch (error) {
            logger.error('Error updating user:', { error: error.message, userId: userId });
            return { success: false, status: 500, message: 'Internal server error updating user' };
        }
    }

    
    /**
     * Changes the role of a user.
     * @param {number} userId - The ID of the user to change role.
     * @param {string} role - The new role (admin or user).
     * @returns {Promise<object>} - Contains success status and message.
     */
    async changeUserRole(userId, role) {
        try {
            // Check if user exists and is active before changing role
            const user = await prisma.user.findUnique({ where: { id: userId, deletedAt: null } });
            if (!user) {
                logger.warn(`Change role failed: Active user not found with ID ${userId}`);
                return { success: false, status: 404, message: 'User not found or has been deleted' };
            }

            await prisma.user.update({
                where: { id: userId, deletedAt: null }, // Ensure we only update active user
                data: { role: role.toLowerCase(), updated_at: new Date() } // Also update timestamp
            });

            logger.info(`Active user role changed successfully: ${userId} to ${role}`);
            // Invalidate caches
            const ALL_USERS_CACHE_KEY = 'users:all'; // Define cache key locally
            await delAsync(ALL_USERS_CACHE_KEY);
            await delAsync(`user:${userId}`);

            return { success: true, message: 'User role changed successfully' };

        } catch (error) {
            logger.error('Error changing user role:', { error: error.message, userId: userId });
            return { success: false, status: 500, message: 'Internal server error changing user role' };
        }
    }

    /**
     * Activates a user account.
     * @param {number} userId - The ID of the user to activate.
     * @returns {Promise<object>} - Contains success status and message.
     */
    async activateUser(userId) {
        try {
            // Check if user exists and is active before activating (though activating an active user is idempotent)
            const user = await prisma.user.findUnique({ where: { id: userId, deletedAt: null } });
            if (!user) {
                logger.warn(`User activation failed: Active user not found with ID ${userId}`);
                return { success: false, status: 404, message: 'User not found or has been deleted' };
            }

            // Update only if not soft-deleted
            await prisma.user.update({
                where: { id: userId, deletedAt: null },
                data: { is_active: true, updated_at: new Date() },
            });

            logger.info(`Active user activated successfully: ${userId}`);
            // Invalidate caches
            const ALL_USERS_CACHE_KEY = 'users:all'; // Define cache key locally
            await delAsync(ALL_USERS_CACHE_KEY);
            await delAsync(`user:${userId}`);

            return { success: true, message: 'User activated successfully' };

        } catch (error) {
            logger.error('Error activating user:', { error: error.message, userId: userId });
            return { success: false, status: 500, message: 'Internal server error activating user' };
        }
    }

    /**
     * Deletes a user.
     * @param {number} userId - The ID of the user to delete.
     * @returns {Promise<object>} - Contains success status and message.
     */
    async deleteUser(userId) { // Now implements soft delete
        try {
            // Check if user exists and is not already soft-deleted
            const user = await prisma.user.findUnique({ where: { id: userId, deletedAt: null } });
            if (!user) {
                logger.warn(`User deletion failed: Active user not found with ID ${userId}`);
                return { success: false, status: 404, message: 'User not found or already deleted' };
            }

            // Soft delete the user
            await prisma.user.update({
                where: { id: userId }, // Already checked that deletedAt is null above
                data: { deletedAt: new Date(), is_active: false }, // Also mark as inactive
            });

            logger.info(`User soft-deleted successfully: ${userId}`);
            // Invalidate caches
            const ALL_USERS_CACHE_KEY = 'users:all'; // Define cache key locally
            await delAsync(ALL_USERS_CACHE_KEY);
            await delAsync(`user:${userId}`); // Invalidate specific user cache if exists

            return { success: true, message: 'User deleted successfully' };

        } catch (error) {
            // P2003 (Foreign key constraint) is less likely with soft delete, but keep general error handling
            logger.error('Error soft-deleting user:', { error: error.message, userId: userId });
            return { success: false, status: 500, message: 'Internal server error deleting user' };
        }
    }
}

export default new UserService();
