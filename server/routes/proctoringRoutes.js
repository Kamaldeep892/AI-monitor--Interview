import express from 'express';
import {
  logProctoringEvent,
  uploadSessionRecording,
  recordProctoringConsent,
  getAdminDashboardOverview,
  getSessionProctoringReport,
  updateProctoringEventReview,
  updateSessionAdminVerdict,
  deleteSessionByAdmin,
} from '../controllers/proctoringController.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';
import { uploadRecording } from '../middleware/uploadMiddleware.js';

const router = express.Router();
router.use(protect);

// Candidate Session Endpoints
router.post('/sessions/:sessionId/consent', recordProctoringConsent);
router.post('/sessions/:sessionId/events', logProctoringEvent);
router.post(
  '/sessions/:sessionId/recording',
  uploadRecording.single('recording'),
  uploadSessionRecording
);

// STRICT ADMIN-ONLY Endpoints
router.get('/sessions/:sessionId/report', adminOnly, getSessionProctoringReport);
router.get('/admin/overview', adminOnly, getAdminDashboardOverview);
router.patch('/admin/events/:eventId', adminOnly, updateProctoringEventReview);
router.patch('/admin/sessions/:sessionId/verdict', adminOnly, updateSessionAdminVerdict);
router.delete('/admin/sessions/:sessionId', adminOnly, deleteSessionByAdmin);

export default router;
