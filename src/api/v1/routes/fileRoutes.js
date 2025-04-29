import express from 'express';
import FileController, { filenameParamValidation } from '../../../controllers/fileController.js'; // Corrected path
import authMiddleware from '../../../middlewares/authMiddleware.js'; // Corrected path
import upload from '../../../config/multer.js'; // Corrected path
import { handleMulterError } from '../../../middlewares/errorMiddleware.js'; // Corrected path

const router = express.Router();

/**
 * @route   POST /api/v1/files/upload
 * @desc    Upload a file (requires authentication)
 * @access  Private
 */
router.post(
    '/upload',
    authMiddleware,           // Ensure user is logged in to upload
    upload.single('file'),    // Handle single file upload named 'file'
    handleMulterError,        // Handle Multer errors specifically
    FileController.uploadFile // Controller method after successful upload
);

/**
 * @route   GET /api/v1/files/:filename
 * @desc    Get (download/view) an uploaded file
 * @access  Public (or Private if files should be protected)
 *          Note: If access needs to be restricted (e.g., only owners can view certain files),
 *          you would add authMiddleware and potentially custom logic in the controller/service.
 *          For simplicity based on original code, keeping it public for now.
 */
router.get(
    '/:filename',
    filenameParamValidation, // Validate filename format
    FileController.getFile
);

export default router;
