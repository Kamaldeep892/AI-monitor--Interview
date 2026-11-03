import express from 'express';
import { generateQuestions, saveFavoriteQuestion, getSavedQuestions, deleteSavedQuestion } from '../controllers/questionController.js';
import { protect } from '../middleware/authMiddleware.js';
import { aiRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();
router.use(protect);
router.post('/generate', aiRateLimiter, generateQuestions);
router.post('/saved', saveFavoriteQuestion);
router.get('/saved', getSavedQuestions);
router.delete('/saved/:id', deleteSavedQuestion);

export default router;
