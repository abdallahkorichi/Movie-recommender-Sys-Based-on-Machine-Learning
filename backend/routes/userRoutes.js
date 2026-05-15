import express from 'express';
import { getUserProfile, toggleWatchLater } from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/profile', protect, getUserProfile);
router.post('/watch-later', protect, toggleWatchLater);

export default router;
