import express from 'express';
import { 
  getHybridRecommendations, 
  getSimilarMovies,
  recordInteraction,
  getPopularContent,
} from '../controllers/recommendationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/personalized', protect, getHybridRecommendations);
router.get('/popular', getPopularContent);              // public — used by hero/home
router.get('/similar/:contentId', getSimilarMovies);    // public — "more like this"
router.post('/interact', protect, recordInteraction);

export default router;

