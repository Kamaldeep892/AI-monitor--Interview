import fs from 'fs';
import path from 'path';
import cloudinary, { isCloudinaryConfigured } from '../config/cloudinary.js';
import ProctoringEvent from '../models/ProctoringEvent.js';
import InterviewSession from '../models/InterviewSession.js';
import InterviewQuestion from '../models/InterviewQuestion.js';

export const computeWarningEscalation = (totalViolations) => {
  if (totalViolations === 0) return { warningLevel: 'normal', flaggedForManualReview: false };
  if (totalViolations === 1) return { warningLevel: 'warning_1', flaggedForManualReview: false };
  if (totalViolations === 2) return { warningLevel: 'warning_2', flaggedForManualReview: false };
  if (totalViolations <= 4) return { warningLevel: 'high_priority_alert', flaggedForManualReview: true };
  return { warningLevel: 'flagged_for_review', flaggedForManualReview: true };
};

export const logProctoringEvent = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { eventType, description, severity = 'medium', durationSeconds = 0, metadata = {} } = req.body;

    const session = await InterviewSession.findById(sessionId).populate('user', 'fullName email');
    if (!session) {
      return res.status(404).json({ success: false, message: 'Interview session not found' });
    }

    const eventDoc = await ProctoringEvent.create({
      candidate: req.user._id,
      session: sessionId,
      eventType,
      description,
      severity,
      durationSeconds,
      metadata,
      timestamp: new Date(),
    });

    if (!session.proctoring) session.proctoring = {};
    session.proctoring.totalViolations = (session.proctoring.totalViolations || 0) + 1;

    if (eventType === 'TAB_SWITCH') {
      session.proctoring.tabSwitchCount = (session.proctoring.tabSwitchCount || 0) + 1;
    } else if (eventType === 'WINDOW_BLUR') {
      session.proctoring.windowBlurCount = (session.proctoring.windowBlurCount || 0) + 1;
      session.proctoring.tabSwitchCount = (session.proctoring.tabSwitchCount || 0) + 1;
    } else if (eventType === 'FULLSCREEN_EXIT') {
      session.proctoring.fullscreenExitCount = (session.proctoring.fullscreenExitCount || 0) + 1;
    } else if (eventType === 'SCREEN_SHARE_STOPPED' || eventType === 'INVALID_SCREEN_SURFACE') {
      session.proctoring.screenShareDropCount = (session.proctoring.screenShareDropCount || 0) + 1;
    } else if (eventType === 'NO_FACE_DETECTED') {
      session.proctoring.faceMissingCount = (session.proctoring.faceMissingCount || 0) + 1;
    } else if (eventType === 'MULTIPLE_FACES_DETECTED') {
      session.proctoring.multipleFacesCount = (session.proctoring.multipleFacesCount || 0) + 1;
    } else if (eventType === 'CAMERA_DISABLED') {
      session.proctoring.cameraDropCount = (session.proctoring.cameraDropCount || 0) + 1;
    } else if (eventType === 'MICROPHONE_DISABLED') {
      session.proctoring.micDropCount = (session.proctoring.micDropCount || 0) + 1;
    } else if (eventType === 'SUSPICIOUS_AUDIO') {
      session.proctoring.audioAnomalyCount = (session.proctoring.audioAnomalyCount || 0) + 1;
    }

    const escalation = computeWarningEscalation(session.proctoring.totalViolations);
    session.proctoring.warningLevel = escalation.warningLevel;
    session.proctoring.flaggedForManualReview =
      escalation.flaggedForManualReview || severity === 'critical';

    await session.save();

    const io = req.app.get('io');
    if (io) {
      io.to('admin_monitors').emit('proctoring:violation_alert', {
        event: eventDoc,
        candidate: {
          id: session.user?._id,
          fullName: session.user?.fullName,
          email: session.user?.email,
        },
        sessionSummary: {
          sessionId: session._id,
          jobRole: session.jobRole,
          interviewType: session.interviewType,
          totalViolations: session.proctoring.totalViolations,
          tabSwitchCount: session.proctoring.tabSwitchCount,
          fullscreenExitCount: session.proctoring.fullscreenExitCount,
          screenShareDropCount: session.proctoring.screenShareDropCount,
          warningLevel: session.proctoring.warningLevel,
          flaggedForManualReview: session.proctoring.flaggedForManualReview,
        },
      });
    }

    res.status(201).json({
      success: true,
      event: eventDoc,
      proctoringStatus: session.proctoring,
    });
  } catch (err) {
    next(err);
  }
};

export const uploadSessionRecording = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    if (!req.file || req.file.size === 0) {
      return res.status(400).json({ success: false, message: 'No valid video recording file received' });
    }

    const session = await InterviewSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    const localUrl = `/uploads/recordings/${req.file.filename}`;
    let finalRecordingUrl = localUrl;
    let publicId = '';

    // Upload HD Video + Voice to Cloudinary if Cloudinary credentials are configured
    if (isCloudinaryConfigured()) {
      try {
        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
          resource_type: 'video',
          folder: 'interviewiq_recordings',
          public_id: `interview_${sessionId}_${Date.now()}`,
        });

        if (uploadResult?.secure_url) {
          finalRecordingUrl = uploadResult.secure_url;
          publicId = uploadResult.public_id || '';
        }
      } catch (cloudErr) {
        console.error('Cloudinary video upload warning (serving from local disk instead):', cloudErr.message);
      }
    }

    session.recordingUrl = finalRecordingUrl;
    session.recordingPublicId = publicId;
    session.recordingUploadedAt = new Date();
    await session.save();

    const io = req.app.get('io');
    if (io) {
      io.to('admin_monitors').emit('admin:recording_ready', {
        sessionId: session._id,
        recordingUrl: finalRecordingUrl,
      });
    }

    res.status(201).json({
      success: true,
      recordingUrl: finalRecordingUrl,
      localRecordingUrl: localUrl,
      recordingPublicId: publicId,
      session,
    });
  } catch (err) {
    next(err);
  }
};

export const recordProctoringConsent = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const session = await InterviewSession.findOne({ _id: sessionId, user: req.user._id });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

    if (!session.proctoring) session.proctoring = {};
    session.proctoring.consentProvided = true;
    session.proctoring.consentTimestamp = new Date();
    await session.save();

    res.json({ success: true, proctoring: session.proctoring });
  } catch (err) {
    next(err);
  }
};

export const getAdminDashboardOverview = async (req, res, next) => {
  try {
    const sessions = await InterviewSession.find()
      .populate('user', 'fullName email targetJobRole experienceLevel')
      .populate({ path: 'questions', options: { sort: { questionIndex: 1 } } })
      .sort({ createdAt: -1 })
      .limit(100);

    const recentEvents = await ProctoringEvent.find()
      .populate('candidate', 'fullName email')
      .populate('session', 'jobRole interviewType status')
      .sort({ timestamp: -1 })
      .limit(200);

    const activeSessions = sessions.filter((s) => s.status === 'in-progress');
    const flaggedSessions = sessions.filter((s) => s.proctoring?.flaggedForManualReview);

    res.json({
      success: true,
      stats: {
        totalSessions: sessions.length,
        activeSessionsCount: activeSessions.length,
        flaggedSessionsCount: flaggedSessions.length,
        totalEventsLogged: recentEvents.length,
      },
      sessions,
      recentEvents,
    });
  } catch (err) {
    next(err);
  }
};

export const getSessionProctoringReport = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const session = await InterviewSession.findById(sessionId)
      .populate('user', 'fullName email targetJobRole experienceLevel')
      .populate({ path: 'questions', options: { sort: { questionIndex: 1 } } });

    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

    const events = await ProctoringEvent.find({ session: sessionId }).sort({ timestamp: 1 });

    res.json({
      success: true,
      session,
      events,
    });
  } catch (err) {
    next(err);
  }
};

export const updateProctoringEventReview = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { reviewStatus, adminNotes } = req.body;

    const event = await ProctoringEvent.findByIdAndUpdate(
      eventId,
      { reviewStatus, adminNotes },
      { new: true }
    );
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    res.json({ success: true, event });
  } catch (err) {
    next(err);
  }
};

export const updateSessionAdminVerdict = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { adminReviewVerdict, proctoringSummaryNotes } = req.body;

    const session = await InterviewSession.findById(sessionId).populate('user', 'fullName email');
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

    if (!session.proctoring) session.proctoring = {};
    if (adminReviewVerdict) session.proctoring.adminReviewVerdict = adminReviewVerdict;
    if (proctoringSummaryNotes !== undefined) {
      session.proctoring.proctoringSummaryNotes = proctoringSummaryNotes;
    }
    await session.save();

    const io = req.app.get('io');
    if (io) {
      const verdictPayload = {
        sessionId: session._id,
        jobRole: session.jobRole,
        interviewType: session.interviewType,
        adminReviewVerdict: session.proctoring.adminReviewVerdict,
        proctoringSummaryNotes: session.proctoring.proctoringSummaryNotes,
        updatedAt: new Date().toISOString(),
      };
      io.to(`session_${session._id}`).emit('candidate:verdict_updated', verdictPayload);
      if (session.user?._id) {
        io.to(`candidate_${session.user._id}`).emit('candidate:verdict_updated', verdictPayload);
      }
      io.emit('candidate:verdict_broadcast', verdictPayload);
    }

    res.json({ success: true, session });
  } catch (err) {
    next(err);
  }
};

export const deleteSessionByAdmin = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const session = await InterviewSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    if (session.recordingPublicId && isCloudinaryConfigured()) {
      try {
        await cloudinary.uploader.destroy(session.recordingPublicId, {
          resource_type: 'video',
        });
      } catch (cloudDelErr) {
        console.error('Failed to delete video from Cloudinary:', cloudDelErr.message);
      }
    }

    if (session.recordingUrl && session.recordingUrl.startsWith('/uploads/')) {
      const filePath = path.join(process.cwd(), session.recordingUrl.replace(/^\//, ''));
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.error('Failed to delete local recording file:', e.message);
        }
      }
    }

    await InterviewQuestion.deleteMany({ session: session._id });
    await ProctoringEvent.deleteMany({ session: session._id });
    await InterviewSession.findByIdAndDelete(session._id);

    res.json({
      success: true,
      message: 'Candidate interview session, Cloudinary video, and proctoring logs permanently deleted.',
    });
  } catch (err) {
    next(err);
  }
};
