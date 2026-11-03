import mongoose from 'mongoose';

const evaluationSchema = new mongoose.Schema(
  {
    score: { type: Number, default: 0 },
    technicalAccuracy: { type: Number, default: 0 },
    communicationSkills: { type: Number, default: 0 },
    answerRelevance: { type: Number, default: 0 },
    problemSolving: { type: Number, default: 0 },
    confidenceClarity: { type: Number, default: 0 },
    completeness: { type: Number, default: 0 },
    strengths: [{ type: String }],
    weaknesses: [{ type: String }],
    missingPoints: [{ type: String }],
    improvementSuggestions: [{ type: String }],
    improvedSampleAnswer: { type: String, default: '' },
    conceptsToStudy: [{ type: String }],
  },
  { _id: false }
);

const interviewQuestionSchema = new mongoose.Schema(
  {
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewSession', required: true, index: true },
    questionIndex: { type: Number, required: true },
    questionText: { type: String, required: true },
    topic: { type: String, required: true },
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Medium' },
    hint: { type: String, default: '' },
    isFollowUp: { type: Boolean, default: false },
    userAnswer: { type: String, default: '' },
    timeTakenSeconds: { type: Number, default: 0 },
    isAnswered: { type: Boolean, default: false },
    evaluation: { type: evaluationSchema, default: () => ({}) },
  },
  { timestamps: true }
);

export default mongoose.model('InterviewQuestion', interviewQuestionSchema);
