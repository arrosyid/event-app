import FileService from '../services/fileService.js';
import { param, validationResult } from 'express-validator';
import { logger } from '../config/logger.js';
import path from 'path'; // Needed for sending file

// Validation rules
const filenameParamValidation = [
    param('filename').notEmpty().withMessage('Filename is required').trim()
        // Add more specific validation if needed (e.g., regex for allowed characters)
        .not().contains('..').withMessage('Invalid characters in filename'), // Basic directory traversal prevention
];

class FileController {

    /**
     * POST /api/v1/files/upload
     * Handles file uploads (actual upload handled by Multer middleware).
     * Returns the filename of the uploaded file.
     */
    async uploadFile(req, res, next) {
        try {
            if (!req.file) {
                logger.warn('Upload attempt failed: No file received.');
                return res.status(400).json({ success: false, message: 'No file uploaded.' });
            }

            const filename = req.file.filename;
            logger.info(`File uploaded successfully: ${filename}`);

            // Construct the URL for the uploaded file
            const protocol = req.protocol || 'http';
            const host = req.get('host');
            const fileUrl = host ? `${protocol}://${host}/api/v1/files/${filename}` : `/api/v1/files/${filename}`;


            res.status(201).json({
                success: true,
                message: 'File uploaded successfully',
                filename: filename,
                url: fileUrl // Provide the URL to access the file
            });
        } catch (error) {
            logger.error('Error in FileController uploadFile:', { error: error.message });
            next(error);
        }
    }

    /**
     * GET /api/v1/files/:filename
     * Retrieves and serves an uploaded file.
     */
    async getFile(req, res, next) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const filename = req.params.filename;
            const result = await FileService.getFilePath(filename);

            if (result.success) {
                // Send the file
                // Consider setting appropriate Cache-Control headers
                res.sendFile(result.path, (err) => {
                    if (err) {
                        logger.error(`Error sending file ${filename}:`, { error: err.message });
                        // Avoid sending response if headers already sent
                        if (!res.headersSent) {
                             next(err); // Pass error to generic handler
                        }
                    } else {
                        logger.info(`Successfully served file: ${filename}`);
                    }
                });
            } else {
                // Service handles not found, invalid filename etc.
                res.status(result.status).json({
                    success: false,
                    message: result.message
                });
            }
        } catch (error) {
            logger.error('Error in FileController getFile:', { error: error.message });
            next(error);
        }
    }
}

export { filenameParamValidation };
export default new FileController();
