
// import multer from "multer";
// import path from "path";

// // Define allowed file types
// const allowedFileTypes = ["video/mp4", "video/mov", "video/avi", "video/mkv"];

// // Configure storage
// const storage = multer.diskStorage({
//     destination: function (req, file, cb) {
//         cb(null, "./public/temp"); // Save files temporarily
//     },
//     filename: function (req, file, cb) {
//         cb(null, file.originalname); // Use original file name
//     },
// });

// // File filter to allow only specific video formats
// const fileFilter = (req, file, cb) => {
//     if (allowedFileTypes.includes(file.mimetype)) {
//         cb(null, true); // Accept the file
//     } else {
//         cb(new Error("Unsupported file type. Only video files are allowed."), false); // Reject the file
//     }
// };

// // Configure Multer
// const upload = multer({
//     storage,
//     fileFilter,
//     limits: {
//         fileSize: 100 * 1024 * 1024, // Limit file size to 100MB
//     },
// });

// export { upload };

import multer from "multer";
import path from "path";

// Define allowed file types (videos, images, PDFs)
const allowedFileTypes = [
    "video/mp4", "video/mov", "video/avi", "video/mkv",
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "application/pdf"
];

// Configure storage (disk storage for now)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "./public/temp"); // Save files temporarily
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
    },
});

// File filter for different formats
const fileFilter = (req, file, cb) => {
    if (allowedFileTypes.includes(file.mimetype)) {
        cb(null, true); // Accept the file
    } else {
        cb(new Error("Unsupported file type. Only videos, images, and PDFs are allowed."), false); // Reject the file
    }
};

// Configure Multer
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024, // Limit file size to 100MB
    },
});

export { upload };
