import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadDir = 'uploads/';

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir); // Folder tujuan
    },
    filename: (req, file, cb) => {
        // Generate a unique filename: timestamp + original extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Filter file types (allow only images)
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const mimetype = allowedTypes.test(file.mimetype);
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        // Reject file with a specific error message for the error handler
        cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Only image files (JPEG, PNG, GIF) are allowed!'), false);
    }
};

// Configure upload middleware instance
const upload = multer({
    storage: storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE_MB || '5') * 1024 * 1024 // Max file size (default 5MB)
    },
    fileFilter: fileFilter,
});

export default upload;
