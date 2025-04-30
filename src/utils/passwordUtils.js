import CryptoJS from 'crypto-js';
import { logger } from '../config/logger.js'; // Optional: for logging errors if needed

// PBKDF2 Configuration
const PBKDF2_ITERATIONS = 10000; // Keep consistent with previous implementation
const KEY_SIZE = 512 / 32; // 512 bits output
const SALT_SIZE = 128 / 8; // 128 bits salt

/**
 * Hashes a password using PBKDF2 with a generated salt.
 * @param {string} password - The plain text password.
 * @returns {{hash: string, salt: string}} - The hashed password and the salt used, both as hex strings.
 * @throws {Error} If hashing fails.
 */
export function hashPassword(password) {
    try {
        const salt = CryptoJS.lib.WordArray.random(SALT_SIZE);
        const hash = CryptoJS.PBKDF2(password, salt, {
            keySize: KEY_SIZE,
            iterations: PBKDF2_ITERATIONS
        });
        return {
            hash: hash.toString(CryptoJS.enc.Hex),
            salt: salt.toString(CryptoJS.enc.Hex)
        };
    } catch (error) {
        logger.error('Password hashing failed:', error);
        throw new Error('Failed to hash password');
    }
}

/**
 * Verifies a password against a stored hash and salt using PBKDF2.
 * @param {string} password - The plain text password to verify.
 * @param {string} storedHashHex - The stored password hash (hex string).
 * @param {string} storedSaltHex - The stored salt (hex string).
 * @returns {boolean} - True if the password matches, false otherwise.
 * @throws {Error} If verification fails due to invalid input or other errors.
 */
export function verifyPassword(password, storedHashHex, storedSaltHex) {
    try {
        if (!password || !storedHashHex || !storedSaltHex) {
            logger.warn('Password verification skipped: Missing password, hash, or salt.');
            return false; // Or throw an error if this case shouldn't happen
        }
        const salt = CryptoJS.enc.Hex.parse(storedSaltHex);
        const hash = CryptoJS.PBKDF2(password, salt, {
            keySize: KEY_SIZE,
            iterations: PBKDF2_ITERATIONS
        });
        const computedHashHex = hash.toString(CryptoJS.enc.Hex);
        return computedHashHex === storedHashHex;
    } catch (error) {
        logger.error('Password verification failed:', error);
        // Avoid leaking specific crypto errors
        throw new Error('Password verification failed');
    }
}
