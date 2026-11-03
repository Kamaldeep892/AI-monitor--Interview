import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: ['candidate', 'admin'], default: 'candidate' },
    googleId: { type: String, default: '' },
    avatarUrl: { type: String, default: '' },
    targetJobRole: { type: String, default: 'Full Stack Developer' },
    experienceLevel: {
      type: String,
      enum: ['Fresher', '0–1 Year', '1–3 Years', '3–5 Years', '5+ Years'],
      default: 'Fresher',
    },
    skills: [{ type: String }],
    preferredLanguage: { type: String, default: 'English' },
    themePreference: { type: String, enum: ['dark', 'light'], default: 'dark' },
    resetPasswordOtp: { type: String, select: false },
    resetPasswordOtpExpire: { type: Date, select: false },
    resetPasswordOtpVerified: { type: Boolean, default: false, select: false },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model('User', userSchema);
