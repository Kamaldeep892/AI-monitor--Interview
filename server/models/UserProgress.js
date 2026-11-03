import mongoose from 'mongoose';

const userProgressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    totalInterviewsCompleted: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 },
    totalPracticeSeconds: { type: Number, default: 0 },
    skillLevel: {
      type: String,
      enum: ['Beginner', 'Developing', 'Proficient', 'Advanced', 'Interview Ready'],
      default: 'Beginner',
    },
    strongestSkills: [{ type: String }],
    weakestSkills: [{ type: String }],
    aiLearningRoadmap: {
      topicsToStudy: [{ type: String }],
      technicalConcepts: [{ type: String }],
      communicationTips: [{ type: String }],
      practicePrompts: [{ type: String }],
      lastUpdated: Date,
    },
  },
  { timestamps: true }
);

export default mongoose.model('UserProgress', userProgressSchema);
