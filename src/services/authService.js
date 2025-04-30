import prisma from '../models/prisma.js'; // Adjusted path based on file structure
import jwt from 'jsonwebtoken';
import { jwtSecret, jwtExpiresIn } from '../config/auth.js';
import { logger } from '../config/logger.js';
import { hashPassword, verifyPassword } from '../utils/passwordUtils.js'; // Import centralized functions

// Removed PBKDF2 Configuration constants - now reside in passwordUtils.js
// Removed internal _hashPassword and _verifyPassword methods

class AuthService {
    // Internal helper methods _hashPassword and _verifyPassword removed

    /**
     * Authenticates a user based on email and password.
     * @param {string} email - User's email.
     * @param {string} password - User's password.
     * @returns {Promise<object>} - Contains success status, message, and token if successful.
     */
    async login(email, password) {
        try {
            logger.info(`Login attempt for email: ${email}`);

            // Find user only if active and not soft-deleted
            const user = await prisma.user.findUnique({
                where: { email: email, deletedAt: null }, // Add deletedAt check
            });

            if (!user || !user.password_salt) { // Check for user and salt (user check now implicitly checks deletedAt)
                logger.warn(`Login failed: User not found or missing salt for email ${email}`);
                return { success: false, status: 401, message: 'Invalid email or password' };
            }

            // Verify password using centralized utility function
            const isPasswordValid = verifyPassword(password, user.password, user.password_salt);

            if (!isPasswordValid) {
                logger.warn(`Login failed: Incorrect password for email ${email}`);
                return { success: false, status: 401, message: 'Invalid email or password' };
            }

            // --- Check if user is active ---
            if (!user.is_active) {
                    logger.warn(`Login failed: User account not active for email ${email}`);
                    return { success: false, status: 403, message: 'Account not activated' };
            }


            // Generate JWT token
            const payload = {
                id: user.id,
                role: user.role,
            };
            const token = jwt.sign(payload, jwtSecret, { expiresIn: jwtExpiresIn });

            logger.info(`Login successful for user ${user.id} (Email: ${email})`);
            return {
                success: true,
                status: 200,
                message: 'Login successful',
                token: token,
                user: { // Return user details (exclude password and salt)
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                }
            };

        } catch (error) {
            logger.error('Error during login process:', { error: error.message, email: email });
            return { success: false, status: 500, message: 'Internal server error during login' };
        }
    }

    /**
     * Registers a new user.
     * @param {object} userData - User data (name, email, password, phone_number, role).
     * @returns {Promise<object>} - Contains success status, data (new user), and message.
     */
    async register(userData) {
        const { name, email, password, phone_number } = userData;
        try {
            logger.info(`Registration attempt for email: ${email}`);

            // Check if email exists for an *active* user
            const existingUser = await prisma.user.findUnique({
                where: { email: email, deletedAt: null }, // Add deletedAt check
            });

            if (existingUser) {
                logger.warn(`Registration failed: Email ${email} already exists.`);
                return { success: false, status: 400, message: 'Email already exists' };
            }

            // Hash the password and generate salt using centralized utility function
            const { hash: hashedPassword, salt: passwordSalt } = hashPassword(password);

            const newUser = await prisma.user.create({
                data: {
                    name,
                    email,
                    password: hashedPassword,
                    password_salt: passwordSalt, // Store the salt
                    phone_number,
                    role: 'user',
                    is_active: false, // Consider setting to false for email verification flow
                },
                select: { // Exclude password and salt from response
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    is_active: true,
                    created_at: true
                }
            });

            logger.info(`User registered successfully: ${newUser.id} (Email: ${email})`);
            return { success: true, status: 201, message: 'User registered successfully', data: newUser };

        } catch (error) {
            logger.error('Error during registration process:', { error: error.message, email: email });
            return { success: false, status: 500, message: 'Internal server error during registration' };
        }
    }
}

export default new AuthService();
