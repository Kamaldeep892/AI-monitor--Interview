import InterviewSession from '../models/InterviewSession.js';
import InterviewQuestion from '../models/InterviewQuestion.js';
import UserProgress from '../models/UserProgress.js';
import { generateLearningRecommendations } from '../services/geminiService.js';

export const getDashboardAndAnalytics = async (req, res, next) => {
  try {
    const userId = req.user._id;
    let progress = await UserProgress.findOne({ user: userId });
    if (!progress) progress = await UserProgress.create({ user: userId });

    const allSessions = await InterviewSession.find({ user: userId }).sort({ createdAt: 1 });
    const completed = allSessions.filter((s) => s.status === 'completed');
    const completionRate = allSessions.length > 0 ? Math.round((completed.length / allSessions.length) * 100) : 0;

    const performanceTrend = completed.slice(-10).map((s, idx) => ({
      sessionLabel: `S${idx + 1}`,
      date: new Date(s.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      overall: Number(((s.overallScore || 0) * 10).toFixed(0)),
      technical: Number((((s.categoryScores?.technical || 0)) * 10).toFixed(0)),
      communication: Number((((s.categoryScores?.communication || 0)) * 10).toFixed(0)),
    }));

    const count = completed.length || 1;
    const sumCat = (key) => completed.reduce((acc, s) => acc + (s.categoryScores?.[key] || 0), 0);
    const radarMetrics = [
      { subject: 'Technical', score: Math.round((sumCat('technical') / count) * 10) },
      { subject: 'Communication', score: Math.round((sumCat('communication') / count) * 10) },
      { subject: 'Problem Solving', score: Math.round((sumCat('problemSolving') / count) * 10) },
      { subject: 'Confidence', score: Math.round((sumCat('confidence') / count) * 10) },
      { subject: 'Completion', score: completionRate },
    ];

    res.json({
      success: true,
      progress,
      completionRate,
      performanceTrend,
      radarMetrics,
      recentSessions: completed.slice(-5).reverse(),
    });
  } catch (err) {
    next(err);
  }
};

export const refreshLearningRoadmap = async (req, res, next) => {
  try {
    const userId = req.user._id;
    let progress = await UserProgress.findOne({ user: userId });
    if (!progress) progress = await UserProgress.create({ user: userId });

    const recent = await InterviewQuestion.find({ isAnswered: true }).sort({ createdAt: -1 }).limit(10);
    const concepts = [...new Set(recent.flatMap((q) => q.evaluation?.conceptsToStudy || []))].slice(0, 6);

    const roadmap = await generateLearningRecommendations({
      targetJobRole: req.user.targetJobRole,
      weakestSkills: progress.weakestSkills || [],
      recentMissedConcepts: concepts,
    });

    progress.aiLearningRoadmap = { ...roadmap, lastUpdated: new Date() };
    await progress.save();

    res.json({ success: true, roadmap: progress.aiLearningRoadmap });
  } catch (err) {
    next(err);
  }
};
