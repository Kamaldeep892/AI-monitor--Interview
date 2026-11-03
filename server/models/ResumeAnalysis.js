import mongoose from 'mongoose';

const resumeAnalysisSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    resume: { type: mongoose.Schema.Types.ObjectId, ref: 'Resume', required: true },
    targetJobRole: { type: String, required: true },
    overallScore: { type: Number, required: true },
    atsCompatibilityScore: { type: Number, required: true },
    keywordMatchPercentage: { type: Number, required: true },
    extractedSkills: [{ type: String }],
    missingKeywords: [{ type: String }],
    formattingFeedback: [
      {
        status: { type: String, enum: ['pass', 'warning'] },
        message: String,
      },
    ],
    grammarSuggestions: [{ type: String }],
    bulletPointImprovements: [
      {
        original: String,
        improved: String,
        impactExplanation: String,
      },
    ],
    roleRecommendations: [{ type: String }],
  },
  { timestamps: true }
);

export default mongoose.model('ResumeAnalysis', resumeAnalysisSchema);
