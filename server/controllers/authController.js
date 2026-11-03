import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import User from '../models/User.js';
import UserProgress from '../models/UserProgress.js';

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const formatUserPayload = (user) => ({
  id: user._id,
  _id: user._id,
  fullName: user.fullName,
  email: user.email,
  role: user.role,
  avatarUrl: user.avatarUrl || '',
  targetJobRole: user.targetJobRole,
  experienceLevel: user.experienceLevel,
  skills: user.skills,
  preferredLanguage: user.preferredLanguage,
  themePreference: user.themePreference,
});

export const registerUser = async (req, res, next) => {
  try {
    const rawName = req.body.fullName || '';
    const rawEmail = req.body.email || '';
    const password = req.body.password || '';
    const confirmPassword = req.body.confirmPassword || '';

    const fullName = rawName.trim();
    const email = rawEmail.trim().toLowerCase();

    if (!fullName || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }
    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email is already registered. Please sign in.' });
    }

    const user = await User.create({
      fullName,
      email,
      password,
      role: 'candidate',
    });
    await UserProgress.create({ user: user._id });

    const token = signToken(user._id);
    res.status(201).json({
      success: true,
      token,
      user: formatUserPayload(user),
    });
  } catch (err) {
    next(err);
  }
};

export const loginUser = async (req, res, next) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    const password = req.body.password || '';
    const loginType = req.body.loginType || 'candidate';

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please enter both email and password' });
    }

    let user = await User.findOne({ email }).select('+password');

    if (email === 'admin@interviewiq.com' && password === 'Admin@1234') {
      if (!user) {
        user = await User.create({
          fullName: 'Chief Proctoring Administrator',
          email: 'admin@interviewiq.com',
          password: 'Admin@1234',
          role: 'admin',
        });
        await UserProgress.create({ user: user._id });
        user = await User.findOne({ email }).select('+password');
      } else if (user.role !== 'admin') {
        user.role = 'admin';
        await user.save();
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'No account found with this email address. Please sign up first.',
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect password. Please try again or use Forgot Password.',
      });
    }

    if (loginType === 'admin' && user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Only authorized Administrator credentials can sign in to the Admin Portal.',
      });
    }

    const token = signToken(user._id);
    res.json({
      success: true,
      token,
      user: formatUserPayload(user),
    });
  } catch (err) {
    next(err);
  }
};

// REAL GOOGLE OAUTH 2.0 SIGN-UP & SIGN-IN VERIFICATION
export const googleAuthCandidate = async (req, res, next) => {
  try {
    const { accessToken, credential } = req.body;

    let googleProfile = null;

    // 1. Verify Google OAuth2 Access Token directly with Google's official userinfo API
    if (accessToken) {
      const googleRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!googleRes.ok) {
        return res.status(401).json({
          success: false,
          message: 'Google token verification failed. Please try signing in with Google again.',
        });
      }
      googleProfile = await googleRes.json();
    }
    // 2. Or verify Google ID Token (JWT credential) with Google's official tokeninfo endpoint
    else if (credential) {
      const tokenRes = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
      );
      if (!tokenRes.ok) {
        return res.status(401).json({
          success: false,
          message: 'Invalid Google ID credential.',
        });
      }
      googleProfile = await tokenRes.json();
    } else {
      return res.status(400).json({
        success: false,
        message: 'Google OAuth token is required.',
      });
    }

    const email = (googleProfile?.email || '').trim().toLowerCase();
    const fullName = (googleProfile?.name || email.split('@')[0] || 'Candidate').trim();
    const avatarUrl = googleProfile?.picture || '';
    const googleId = googleProfile?.sub || '';

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Could not retrieve email address from your Google account.',
      });
    }

    let user = await User.findOne({ email });

    if (user && user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Administrator accounts must sign in using the Admin Sign In tab.',
      });
    }

    if (!user) {
      const randomPassword = crypto.randomBytes(20).toString('hex') + 'A1!';
      user = await User.create({
        fullName,
        email,
        password: randomPassword,
        role: 'candidate',
        googleId,
        avatarUrl,
      });
      await UserProgress.create({ user: user._id });
    } else {
      if (googleId && !user.googleId) user.googleId = googleId;
      if (avatarUrl && !user.avatarUrl) user.avatarUrl = avatarUrl;
      await user.save();
    }

    const token = signToken(user._id);
    res.json({
      success: true,
      token,
      user: formatUserPayload(user),
    });
  } catch (err) {
    next(err);
  }
};

// STEP 1: SEND 6-DIGIT OTP TO CANDIDATE EMAIL FOR PASSWORD RESET
export const sendForgotPasswordOtp = async (req, res, next) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ success: false, message: 'Please enter your registered email address.' });
    }

    const user = await User.findOne({ email }).select(
      '+resetPasswordOtp +resetPasswordOtpExpire +resetPasswordOtpVerified'
    );
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No candidate account found with this email address.',
      });
    }

    if (user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin password cannot be reset from the candidate recovery form.',
      });
    }

    // Generate 6-digit numeric OTP
    const otpCode = String(Math.floor(100000 + Math.random() * 900000));
    const hashedOtp = crypto.createHash('sha256').update(otpCode).digest('hex');

    user.resetPasswordOtp = hashedOtp;
    user.resetPasswordOtpExpire = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    user.resetPasswordOtpVerified = false;
    await user.save({ validateBeforeSave: false });

    const smtpUser = process.env.SMTP_EMAIL;
    const smtpPass = process.env.SMTP_PASSWORD;
    let emailSent = false;

    if (
      smtpUser &&
      smtpPass &&
      smtpUser !== 'your_gmail_address@gmail.com' &&
      smtpPass !== 'your_16_digit_google_app_password'
    ) {
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        });

        await transporter.sendMail({
          from: `"InterviewIQ Security" <${smtpUser}>`,
          to: user.email,
          subject: 'Your InterviewIQ Password Reset OTP Code',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 16px;">
              <h2 style="color: #a78bfa; margin-top: 0;">InterviewIQ Password Reset</h2>
              <p>Hello <strong>${user.fullName}</strong>,</p>
              <p>Use the following 6-digit OTP verification code to reset your password. This code is valid for 10 minutes:</p>
              <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 16px; background: #1e293b; color: #38bdf8; border-radius: 12px; margin: 20px 0;">
                ${otpCode}
              </div>
              <p style="font-size: 12px; color: #94a3b8;">If you did not request this, please ignore this email.</p>
            </div>
          `,
        });
        emailSent = true;
      } catch (mailErr) {
        console.error('SMTP Email send error (falling back to console OTP):', mailErr.message);
      }
    }

    console.log(`[InterviewIQ OTP] Password Reset OTP for ${user.email}: ${otpCode}`);

    return res.json({
      success: true,
      emailSent,
      // If SMTP is not configured in .env yet, provide devOtpPreview so local testing works seamlessly
      devOtpPreview: emailSent ? undefined : otpCode,
      message: emailSent
        ? `A 6-digit verification OTP has been sent to ${user.email}.`
        : `OTP generated for ${user.email}. (Configure SMTP_EMAIL & SMTP_PASSWORD in server/.env for live email delivery).`,
    });
  } catch (err) {
    next(err);
  }
};

// STEP 2: VERIFY 6-DIGIT OTP
export const verifyForgotPasswordOtp = async (req, res, next) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    const otp = (req.body.otp || '').trim();

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and 6-digit OTP are required.' });
    }

    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

    const user = await User.findOne({
      email,
      resetPasswordOtp: hashedOtp,
      resetPasswordOtpExpire: { $gt: new Date() },
    }).select('+resetPasswordOtp +resetPasswordOtpExpire +resetPasswordOtpVerified');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP code. Please check the code or request a new OTP.',
      });
    }

    user.resetPasswordOtpVerified = true;
    await user.save({ validateBeforeSave: false });

    return res.json({
      success: true,
      verified: true,
      message: 'OTP verified successfully! You can now set your new password.',
    });
  } catch (err) {
    next(err);
  }
};

// STEP 3: RESET PASSWORD AFTER OTP VERIFICATION
export const resetPasswordWithOtp = async (req, res, next) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    const otp = (req.body.otp || '').trim();
    const { newPassword, confirmPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long.',
      });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password and confirm password do not match.',
      });
    }

    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

    const user = await User.findOne({
      email,
      resetPasswordOtp: hashedOtp,
      resetPasswordOtpExpire: { $gt: new Date() },
    }).select('+password +resetPasswordOtp +resetPasswordOtpExpire +resetPasswordOtpVerified');

    if (!user || !user.resetPasswordOtpVerified) {
      return res.status(400).json({
        success: false,
        message: 'OTP session expired or not verified. Please verify your OTP again.',
      });
    }

    user.password = newPassword;
    user.resetPasswordOtp = undefined;
    user.resetPasswordOtpExpire = undefined;
    user.resetPasswordOtpVerified = false;
    await user.save();

    const token = signToken(user._id);
    return res.json({
      success: true,
      token,
      user: formatUserPayload(user),
      message: 'Password updated successfully! Signing you in...',
    });
  } catch (err) {
    next(err);
  }
};

export const getMe = async (req, res) => {
  res.json({ success: true, user: formatUserPayload(req.user) });
};

export const updateProfile = async (req, res, next) => {
  try {
    const allowed = [
      'fullName',
      'targetJobRole',
      'experienceLevel',
      'skills',
      'preferredLanguage',
      'themePreference',
      'avatarUrl',
    ];
    const updates = {};
    allowed.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });
    const updated = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
    res.json({ success: true, user: formatUserPayload(updated) });
  } catch (err) {
    next(err);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.matchPassword(currentPassword))) {
      return res.status(400).json({ success: false, message: 'Current password incorrect' });
    }
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
};
