import mongoose from 'mongoose';

const savedQuestionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    jobRole: { type: String, required: true },
    category: { type: String, required: true },
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], required: true },
    topic: { type: String, required: true },
    question: { type: String, required: true },
    interviewerIntent: { type: String, required: true },
    expectedKeyPoints: [{ type: String }],
    sampleAnswer: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.model('SavedQuestion', savedQuestionSchema);
