import express from 'express';
import { uploadAndAnalyzeResume, getUserResumes } from '../controllers/resumeController.js';
import { protect } from '../middleware/authMiddleware.js';
import { uploadResume } from '../middleware/uploadMiddleware.js';
import { aiRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();
router.use(protect);
router.post('/analyze', aiRateLimiter, uploadResume.single('resume'), uploadAndAnalyzeResume);
router.get('/', getUserResumes);

export default router;
