import express from 'express';
import {
  startInterviewSession,
  submitAnswerAndAdvance,
  endInterviewEarly,
  getSessionDetails,
  getInterviewHistory,
  deleteInterviewSession,
} from '../controllers/interviewController.js';
import { protect } from '../middleware/authMiddleware.js';
import { aiRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();
router.use(protect);
router.post('/start', aiRateLimiter, startInterviewSession);
router.post('/:sessionId/answer', aiRateLimiter, submitAnswerAndAdvance);
router.post('/:sessionId/end', endInterviewEarly);
router.get('/history', getInterviewHistory);
router.get('/:sessionId', getSessionDetails);
router.delete('/:sessionId', deleteInterviewSession);

export default router;
