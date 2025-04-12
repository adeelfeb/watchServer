import { verifyAdmin } from '../middlewares/adminMiddleware.js';
import {getAllUsers, createUser, makeAdmin, getDashboardStats, getAllVideos, toggleUserStatus, deleteUserAccount,} from '../controllers/admin.controller.js'

import { Router } from 'express';

const router = Router();

router.route('/make-admin').post(makeAdmin)


router.route('/stats').get(verifyAdmin, getDashboardStats);
router.route('/videos').get(verifyAdmin, getAllVideos);

// --- User Management Routes ---
router.route('/users').get(verifyAdmin, getAllUsers);
router.route('/users/:userId/status').patch(toggleUserStatus); // PATCH is suitable for toggling a status
router.route('/users/:userId').delete(deleteUserAccount);




export default router;