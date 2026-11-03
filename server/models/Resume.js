import mongoose from 'mongoose';

const resumeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    fileName: { type: String, required: true },
    fileMimeType: { type: String, required: true },
    extractedText: { type: String, required: true },
    parsedSkills: [{ type: String }],
    parsedProjects: [{ title: String, summary: String, technologies: [String] }],
    experienceSummary: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('Resume', resumeSchema);
