import express from 'express';
import { getDashboardAndAnalytics, refreshLearningRoadmap } from '../controllers/analyticsController.js';
import { protect } from '../middleware/authMiddleware.js';
import { aiRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();
router.use(protect);
router.get('/overview', getDashboardAndAnalytics);
router.post('/roadmap', aiRateLimiter, refreshLearningRoadmap);

export default router;
