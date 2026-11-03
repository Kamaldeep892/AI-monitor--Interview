import SavedQuestion from '../models/SavedQuestion.js';
import { generateQuestionBank } from '../services/geminiService.js';

export const generateQuestions = async (req, res, next) => {
  try {
    const { jobRole = 'Full Stack Developer', experienceLevel = '1–3 Years', category = 'Technical', difficulty = 'Medium', count = 5 } = req.body;
    const questions = await generateQuestionBank({ jobRole, experienceLevel, category, difficulty, count: Math.min(Number(count), 15) });
    res.json({ success: true, questions });
  } catch (err) {
    next(err);
  }
};

export const saveFavoriteQuestion = async (req, res, next) => {
  try {
    const saved = await SavedQuestion.create({ user: req.user._id, ...req.body });
    res.status(201).json({ success: true, savedQuestion: saved });
  } catch (err) {
    next(err);
  }
};

export const getSavedQuestions = async (req, res, next) => {
  try {
    const questions = await SavedQuestion.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, questions });
  } catch (err) {
    next(err);
  }
};

export const deleteSavedQuestion = async (req, res, next) => {
  try {
    await SavedQuestion.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    res.json({ success: true, message: 'Question removed' });
  } catch (err) {
    next(err);
  }
};
