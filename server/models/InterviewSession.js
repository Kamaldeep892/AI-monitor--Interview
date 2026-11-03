import mongoose from 'mongoose';

const interviewSessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    jobRole: { type: String, required: true },
    experienceLevel: { type: String, required: true },
    interviewType: {
      type: String,
      enum: ['Technical', 'HR', 'Behavioral', 'Mixed', 'Resume-Based'],
      required: true,
    },
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Medium' },
    totalQuestions: { type: Number, required: true, default: 5 },
    timeLimitMinutes: { type: Number, required: true, default: 15 },
    preferredLanguage: { type: String, default: 'English' },
    resumeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Resume', default: null },
    questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'InterviewQuestion' }],
    currentQuestionIndex: { type: Number, default: 0 },
    status: { type: String, enum: ['in-progress', 'completed', 'abandoned'], default: 'in-progress' },
    overallScore: { type: Number, default: 0 },
    categoryScores: {
      technical: { type: Number, default: 0 },
      communication: { type: Number, default: 0 },
      problemSolving: { type: Number, default: 0 },
      confidence: { type: Number, default: 0 },
    },
    durationSeconds: { type: Number, default: 0 },
    recordingUrl: { type: String, default: '' },
    recordingPublicId: { type: String, default: '' },
    recordingUploadedAt: { type: Date },
    proctoring: {
      consentProvided: { type: Boolean, default: false },
      consentTimestamp: { type: Date },
      totalViolations: { type: Number, default: 0 },
      tabSwitchCount: { type: Number, default: 0 },
      windowBlurCount: { type: Number, default: 0 },
      fullscreenExitCount: { type: Number, default: 0 },
      screenShareDropCount: { type: Number, default: 0 },
      faceMissingCount: { type: Number, default: 0 },
      multipleFacesCount: { type: Number, default: 0 },
      cameraDropCount: { type: Number, default: 0 },
      micDropCount: { type: Number, default: 0 },
      audioAnomalyCount: { type: Number, default: 0 },
      warningLevel: {
        type: String,
        enum: ['normal', 'warning_1', 'warning_2', 'high_priority_alert', 'flagged_for_review'],
        default: 'normal',
      },
      flaggedForManualReview: { type: Boolean, default: false },
      adminReviewVerdict: {
        type: String,
        enum: ['unreviewed', 'cleared', 'requires_followup', 'invalidated'],
        default: 'unreviewed',
      },
      proctoringSummaryNotes: { type: String, default: '' },
    },
    aiSummaryReport: {
      executiveSummary: { type: String, default: '' },
      topStrengths: [{ type: String }],
      criticalGaps: [{ type: String }],
      recommendedTopics: [{ type: String }],
      hiringRecommendation: { type: String, default: 'Pending' },
      proctoringIntegrityNote: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

export default mongoose.model('InterviewSession', interviewSessionSchema);
