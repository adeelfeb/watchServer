import { verifyAdmin } from '../middlewares/adminMiddleware.js';
import {getAllUsers, createUser, makeAdmin, getDashboardStats, getAllVideos, toggleUserStatus, deleteUserAccount, deleteVideo, deleteBulkVideos} from '../controllers/admin.controller.js'

import { Router } from 'express';

const router = Router();

router.route('/make-admin').post(makeAdmin)

router.use(verifyAdmin);
router.route('/stats').get(getDashboardStats);
router.route('/videos').get(getAllVideos);
router.route('/videos/:videoId').delete(deleteVideo);


router.route("/bulk-delete").delete(deleteBulkVideos); // Assign the correct controller


// --- User Management Routes ---
router.route('/users').get(getAllUsers);
router.route('/users/:userId/status').patch(toggleUserStatus); // PATCH is suitable for toggling a status
router.route('/users/:userId').delete(deleteUserAccount);




export default router;