import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { logger } from '../config/logger.js';

// Resolve the uploads directory relative to this file's location
// __dirname is not available in ES modules by default
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.resolve(__dirname, '../../uploads'); // Go up two levels from src/services to the project root, then into uploads

class FileService {

    /**
     * Gets the full path to an uploaded file and checks if it exists.
     * @param {string} filename - The name of the file.
     * @returns {Promise<object>} - Contains success status, path (if found), and message.
     */
    async getFilePath(filename) {
        try {
            if (!filename || typeof filename !== 'string' || filename.includes('..')) {
                logger.warn(`Attempt to access invalid filename: ${filename}`);
                return { success: false, status: 400, message: 'Invalid filename provided' };
            }

            const filePath = path.join(uploadDir, filename);

            // Security check: Ensure the resolved path is still within the intended upload directory
            if (!filePath.startsWith(uploadDir)) {
                 logger.error(`Potential directory traversal attempt: ${filename} resolved to ${filePath}`);
                 return { success: false, status: 400, message: 'Invalid filename' };
            }

            // Check if file exists using async fs promises
            await fs.promises.access(filePath, fs.constants.R_OK); // Check read access
            logger.info(`File found: ${filename} at path ${filePath}`);
            return { success: true, path: filePath };

        } catch (error) {
            if (error.code === 'ENOENT') {
                logger.warn(`File not found: ${filename}`);
                return { success: false, status: 404, message: 'File not found' };
            } else {
                logger.error('Error accessing file path:', { error: error.message, filename: filename });
                return { success: false, status: 500, message: 'Internal server error accessing file' };
            }
        }
    }

    // Potential future methods:
    // async deleteFile(filename) { ... }
    // async listFiles() { ... }
}

export default new FileService();
