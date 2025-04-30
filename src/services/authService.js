import prisma from '../models/prisma.js'; // Adjusted path based on file structure
import jwt from 'jsonwebtoken';
import { jwtSecret, jwtExpiresIn } from '../config/auth.js';
import { logger } from '../config/logger.js';
import CryptoJS from 'crypto-js'; // Import crypto-js

// PBKDF2 Configuration (adjust iterations as needed for security/performance balance)
const PBKDF2_ITERATIONS = 10000; // Higher is generally better, but slower
const KEY_SIZE = 512 / 32; // 512 bits output
const SALT_SIZE = 128 / 8; // 128 bits salt

class AuthService {
    /**
     * Hashes a password using PBKDF2 with a generated salt.
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
     * Verifies a password against a stored hash and salt using PBKDF2.
     * @param {string} password - The plain text password to verify.
     * @param {string} storedHashHex - The stored password hash (hex string).
     * @param {string} storedSaltHex - The stored salt (hex string).
     * @returns {boolean} - True if the password matches, false otherwise.
     */
    _verifyPassword(password, storedHashHex, storedSaltHex) {
        const salt = CryptoJS.enc.Hex.parse(storedSaltHex);
        const hash = CryptoJS.PBKDF2(password, salt, {
            keySize: KEY_SIZE,
            iterations: PBKDF2_ITERATIONS
        });
        const computedHashHex = hash.toString(CryptoJS.enc.Hex);
        return computedHashHex === storedHashHex;
    }

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

            // Verify password using crypto-js PBKDF2
            const isPasswordValid = this._verifyPassword(password, user.password, user.password_salt);

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

            // Hash the password and generate salt using crypto-js PBKDF2
            const { hash: hashedPassword, salt: passwordSalt } = this._hashPassword(password);

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
