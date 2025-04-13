import { verifyAdmin } from '../middlewares/adminMiddleware.js';
import {getAllUsers, createUser, makeAdmin, getCurrentUser, getDashboardStats, getAllVideos, toggleUserStatus, deleteUserAccount, deleteVideo, deleteBulkVideos, uploadVideo} from '../controllers/admin.controller.js'
import multer from "multer"; // Import multer
import { upload } from "../middlewares/multer.middleware.js";
import { Router } from 'express';

const router = Router(); 

router.route('/make-admin').post(makeAdmin)

router.use(verifyAdmin);

router.route("/upload-video").post(
    upload.single("video"), // Use Multer middleware to handle single file upload
    uploadVideo
);

// Error handling middleware for Multer errors
router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        // Handle Multer errors (e.g., file size exceeded)
        return res.status(400).json(
            new ApiResponse(400, null, err.message)
        );
    } else if (err) {
        // Handle other errors
        return res.status(500).json(
            new ApiResponse(500, null, err.message)
        );
    }
    next();
});

router.route('/stats').get(getDashboardStats);
router.route('/videos').get(getAllVideos);
router.route('/videos/:videoId').delete(deleteVideo);
router.route("/current-admin").post(getCurrentUser)


router.route("/bulk-delete").delete(deleteBulkVideos); // Assign the correct controller


// --- User Management Routes ---
router.route('/users').get(getAllUsers);
router.route('/users/:userId/status').patch(toggleUserStatus); // PATCH is suitable for toggling a status
router.route('/users/:userId').delete(deleteUserAccount);




export default router;