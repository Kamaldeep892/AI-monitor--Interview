import InterviewSession from '../models/InterviewSession.js';
import InterviewQuestion from '../models/InterviewQuestion.js';
import ProctoringEvent from '../models/ProctoringEvent.js';
import Resume from '../models/Resume.js';
import UserProgress from '../models/UserProgress.js';
import {
  generateNextInterviewQuestion,
  evaluateCandidateAnswer,
  generateSessionReport,
} from '../services/geminiService.js';

const syncUserProgress = async (userId) => {
  const sessions = await InterviewSession.find({ user: userId, status: 'completed' }).populate('questions');
  if (sessions.length === 0) return;

  const total = sessions.length;
  const avg = Number((sessions.reduce((acc, s) => acc + (s.overallScore || 0), 0) / total).toFixed(1));
  const seconds = sessions.reduce((acc, s) => acc + (s.durationSeconds || 0), 0);

  let skillLevel = 'Beginner';
  if (avg >= 8.5 && total >= 5) skillLevel = 'Interview Ready';
  else if (avg >= 7.5) skillLevel = 'Advanced';
  else if (avg >= 6.0) skillLevel = 'Proficient';
  else if (avg >= 4.5) skillLevel = 'Developing';

  await UserProgress.findOneAndUpdate(
    { user: userId },
    { totalInterviewsCompleted: total, averageScore: avg, totalPracticeSeconds: seconds, skillLevel },
    { upsert: true }
  );
};

export const startInterviewSession = async (req, res, next) => {
  try {
    const {
      jobRole,
      experienceLevel,
      interviewType,
      difficulty,
      totalQuestions = 5,
      preferredLanguage = 'English',
      resumeId = null,
    } = req.body;

    let resumeContext = '';
    if (resumeId) {
      const resumeDoc = await Resume.findOne({ _id: resumeId, user: req.user._id });
      if (resumeDoc) resumeContext = resumeDoc.extractedText;
    }

    const aiQ = await generateNextInterviewQuestion({
      jobRole,
      experienceLevel,
      interviewType,
      difficulty,
      preferredLanguage,
      previousQAPairs: [],
      resumeContext,
    });

    const session = await InterviewSession.create({
      user: req.user._id,
      jobRole,
      experienceLevel,
      interviewType,
      difficulty,
      totalQuestions: Number(totalQuestions),
      preferredLanguage,
      resumeId,
      currentQuestionIndex: 0,
      proctoring: {
        consentProvided: true,
        consentTimestamp: new Date(),
      },
    });

    const qDoc = await InterviewQuestion.create({
      session: session._id,
      questionIndex: 0,
      questionText: aiQ.questionText,
      topic: aiQ.topic,
      difficulty: aiQ.difficulty || difficulty,
      hint: aiQ.hint,
      isFollowUp: false,
    });

    session.questions.push(qDoc._id);
    await session.save();

    res.status(201).json({ success: true, session, currentQuestion: qDoc });
  } catch (err) {
    next(err);
  }
};

export const submitAnswerAndAdvance = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { questionId, userAnswer, timeTakenSeconds = 30 } = req.body;

    const session = await InterviewSession.findOne({ _id: sessionId, user: req.user._id }).populate('questions');
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

    const qDoc = await InterviewQuestion.findById(questionId);
    if (!qDoc) return res.status(404).json({ success: false, message: 'Question not found' });

    const evaluation = await evaluateCandidateAnswer({
      jobRole: session.jobRole,
      experienceLevel: session.experienceLevel,
      questionText: qDoc.questionText,
      topic: qDoc.topic,
      userAnswer,
    });

    qDoc.userAnswer = userAnswer;
    qDoc.timeTakenSeconds = Number(timeTakenSeconds);
    qDoc.isAnswered = true;
    qDoc.evaluation = evaluation;
    await qDoc.save();

    session.durationSeconds += Number(timeTakenSeconds);
    const answeredCount = session.questions.filter((q) =>
      q._id.toString() === questionId ? true : q.isAnswered
    ).length;

    let nextQDoc = null;
    if (answeredCount < session.totalQuestions) {
      let resumeContext = '';
      if (session.resumeId) {
        const resumeDoc = await Resume.findById(session.resumeId);
        if (resumeDoc) resumeContext = resumeDoc.extractedText;
      }
      const questionsList = await InterviewQuestion.find({ session: session._id }).sort('questionIndex');
      const prevPairs = questionsList.map((q) => ({
        questionText: q.questionText,
        userAnswer: q.userAnswer,
        score: q.evaluation?.score,
      }));

      const nextAIQ = await generateNextInterviewQuestion({
        jobRole: session.jobRole,
        experienceLevel: session.experienceLevel,
        interviewType: session.interviewType,
        difficulty: session.difficulty,
        preferredLanguage: session.preferredLanguage,
        previousQAPairs: prevPairs,
        resumeContext,
      });

      nextQDoc = await InterviewQuestion.create({
        session: session._id,
        questionIndex: answeredCount,
        questionText: nextAIQ.questionText,
        topic: nextAIQ.topic,
        difficulty: nextAIQ.difficulty || session.difficulty,
        hint: nextAIQ.hint,
        isFollowUp: Boolean(nextAIQ.isFollowUp),
      });

      session.questions.push(nextQDoc._id);
      session.currentQuestionIndex = answeredCount;
      await session.save();
    } else {
      await finalizeSession(session);
    }

    res.json({
      success: true,
      evaluation,
      isCompleted: !nextQDoc,
      nextQuestion: nextQDoc,
      sessionId: session._id,
    });
  } catch (err) {
    next(err);
  }
};

const finalizeSession = async (session) => {
  const answered = await InterviewQuestion.find({ session: session._id, isAnswered: true });
  const proctoringEvents = await ProctoringEvent.find({ session: session._id }).sort({ timestamp: 1 });

  if (answered.length > 0) {
    const c = answered.length;
    const avg = (k) => Number((answered.reduce((acc, q) => acc + (q.evaluation?.[k] || 0), 0) / c).toFixed(1));
    session.overallScore = avg('score');
    session.categoryScores = {
      technical: avg('technicalAccuracy'),
      communication: avg('communicationSkills'),
      problemSolving: avg('problemSolving'),
      confidence: avg('confidenceClarity'),
    };
    const aiReport = await generateSessionReport({
      jobRole: session.jobRole,
      experienceLevel: session.experienceLevel,
      qaList: answered,
    });

    const totalEvents = proctoringEvents.length;
    const integrityNote =
      totalEvents === 0
        ? 'No suspicious browser, camera, or audio anomalies were recorded during this live video session.'
        : `${totalEvents} automated monitoring signal(s) were logged during this session (Tab/Focus shifts: ${
            session.proctoring?.tabSwitchCount || 0
          }, Full-screen exits: ${session.proctoring?.fullscreenExitCount || 0}, Camera/Face alerts: ${
            (session.proctoring?.faceMissingCount || 0) + (session.proctoring?.multipleFacesCount || 0)
          }). Automated signals are advisory indicators only and require human administrator review before drawing conclusions.`;

    session.aiSummaryReport = {
      ...aiReport,
      proctoringIntegrityNote: integrityNote,
    };
  }
  session.status = 'completed';
  await session.save();
  await syncUserProgress(session.user);
};

export const endInterviewEarly = async (req, res, next) => {
  try {
    const session = await InterviewSession.findOne({ _id: req.params.sessionId, user: req.user._id });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    await finalizeSession(session);
    res.json({ success: true, session });
  } catch (err) {
    next(err);
  }
};

export const getSessionDetails = async (req, res, next) => {
  try {
    const session = await InterviewSession.findOne({ _id: req.params.sessionId })
      .populate('user', 'fullName email targetJobRole experienceLevel')
      .populate({
        path: 'questions',
        options: { sort: { questionIndex: 1 } },
      });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

    const isAdmin = req.user && req.user.role === 'admin';
    const proctoringEvents = isAdmin
      ? await ProctoringEvent.find({ session: session._id }).sort({ timestamp: 1 })
      : [];

    res.json({
      success: true,
      session,
      proctoringEvents,
    });
  } catch (err) {
    next(err);
  }
};

export const getInterviewHistory = async (req, res, next) => {
  try {
    const { jobRole, interviewType } = req.query;
    const filter = { user: req.user._id };
    if (jobRole && jobRole !== 'All') filter.jobRole = jobRole;
    if (interviewType && interviewType !== 'All') filter.interviewType = interviewType;

    const sessions = await InterviewSession.find(filter).sort({ createdAt: -1 }).populate('questions');
    res.json({ success: true, sessions });
  } catch (err) {
    next(err);
  }
};

export const deleteInterviewSession = async (req, res, next) => {
  try {
    const session = await InterviewSession.findOneAndDelete({ _id: req.params.sessionId, user: req.user._id });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    await InterviewQuestion.deleteMany({ session: session._id });
    await ProctoringEvent.deleteMany({ session: session._id });
    await syncUserProgress(req.user._id);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    next(err);
  }
};
