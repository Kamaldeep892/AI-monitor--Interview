import rateLimit from 'express-rate-limit';

export const aiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 45,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many AI requests from this IP. Please wait a few minutes and try again.',
  },
});
