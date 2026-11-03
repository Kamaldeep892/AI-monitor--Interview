import express from 'express';
import {
  registerUser,
  loginUser,
  googleAuthCandidate,
  sendForgotPasswordOtp,
  verifyForgotPasswordOtp,
  resetPasswordWithOtp,
  getMe,
  updateProfile,
  changePassword,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/google', googleAuthCandidate);
router.post('/forgot-password/send-otp', sendForgotPasswordOtp);
router.post('/forgot-password/verify-otp', verifyForgotPasswordOtp);
router.post('/forgot-password/reset', resetPasswordWithOtp);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/password', protect, changePassword);

export default router;
