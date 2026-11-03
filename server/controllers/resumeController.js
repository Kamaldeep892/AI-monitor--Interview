import Resume from '../models/Resume.js';
import ResumeAnalysis from '../models/ResumeAnalysis.js';
import { extractTextFromBuffer } from '../services/resumeParserService.js';
import { analyzeResumeWithAI } from '../services/geminiService.js';

export const uploadAndAnalyzeResume = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Upload a PDF or DOCX file' });
    const targetJobRole = req.body.targetJobRole || req.user.targetJobRole || 'Full Stack Developer';

    const text = await extractTextFromBuffer(req.file.buffer, req.file.mimetype);
    if (!text || text.length < 50) {
      return res.status(400).json({ success: false, message: 'Unable to extract text from document.' });
    }

    const aiAnalysis = await analyzeResumeWithAI({ resumeText: text, targetJobRole });

    const resumeDoc = await Resume.create({
      user: req.user._id,
      fileName: req.file.originalname,
      fileMimeType: req.file.mimetype,
      extractedText: text,
      parsedSkills: aiAnalysis.extractedSkills,
      parsedProjects: aiAnalysis.parsedProjects,
      experienceSummary: aiAnalysis.experienceSummary,
    });

    const analysisDoc = await ResumeAnalysis.create({
      user: req.user._id,
      resume: resumeDoc._id,
      targetJobRole,
      overallScore: aiAnalysis.overallScore,
      atsCompatibilityScore: aiAnalysis.atsCompatibilityScore,
      keywordMatchPercentage: aiAnalysis.keywordMatchPercentage,
      extractedSkills: aiAnalysis.extractedSkills,
      missingKeywords: aiAnalysis.missingKeywords,
      formattingFeedback: aiAnalysis.formattingFeedback,
      grammarSuggestions: aiAnalysis.grammarSuggestions,
      bulletPointImprovements: aiAnalysis.bulletPointImprovements,
      roleRecommendations: aiAnalysis.roleRecommendations,
    });

    res.status(201).json({ success: true, resume: resumeDoc, analysis: analysisDoc });
  } catch (err) {
    next(err);
  }
};

export const getUserResumes = async (req, res, next) => {
  try {
    const resumes = await Resume.find({ user: req.user._id }).sort({ createdAt: -1 });
    const latestAnalysis = await ResumeAnalysis.findOne({ user: req.user._id }).sort({ createdAt: -1 }).populate('resume');
    res.json({ success: true, resumes, latestAnalysis });
  } catch (err) {
    next(err);
  }
};
