import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  Video,
  Monitor,
  Eye,
  Send,
  RefreshCw,
  PlayCircle,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  X,
  Clock,
  FileCheck2,
} from 'lucide-react';
import AppShell from '../components/Layout/AppShell';
import RecordedVideoPlayer from '../components/Video/RecordedVideoPlayer';
import api from '../services/api';
import { socket } from '../services/socket';

const BACKEND_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(
  /\/api\/?$/,
  ''
);

export default function AdminProctoringDashboard() {
  const navigate = useNavigate();
  const [liveSessions, setLiveSessions] = useState([]);
  const [liveFrames, setLiveFrames] = useState({});
  const [liveScreenFrames, setLiveScreenFrames] = useState({});
  const [dbSessions, setDbSessions] = useState([]);
  const [recentEvents, setRecentEvents] = useState([]);
  const [stats, setStats] = useState({});
  const [filterFlagged, setFilterFlagged] = useState(false);

  // Full Candidate Verification & HD Video Modal State
  const [inspectSession, setInspectSession] = useState(null);
  const [inspectEvents, setInspectEvents] = useState([]);
  const [loadingInspect, setLoadingInspect] = useState(false);

  // 2-Step Delete Permission Modal State
  const [deleteTarget, setDeleteTarget] = useState(null); // { session, step: 1 | 2 }
  const [deleting, setDeleting] = useState(false);

  const fetchOverview = async () => {
    try {
      const { data } = await api.get('/proctoring/admin/overview');
      setDbSessions(data.sessions || []);
      setRecentEvents(data.recentEvents || []);
      setStats(data.stats || {});
    } catch (err) {
      console.error('Admin overview error:', err);
    }
  };

  useEffect(() => {
    fetchOverview();

    if (!socket.connected) socket.connect();
    socket.emit('admin:join_monitor');

    socket.on('admin:active_sessions_sync', (sessionsList) => {
      setLiveSessions(sessionsList || []);
    });

    socket.on('admin:session_started', (newSession) => {
      setLiveSessions((prev) => [
        newSession,
        ...prev.filter((s) => s.sessionId !== newSession.sessionId),
      ]);
    });

    // Receive BOTH Live Webcam Frame AND Live Screen Share Frame
    socket.on('admin:video_frame', ({ sessionId, frame, screenFrame }) => {
      if (!sessionId) return;
      if (frame) {
        setLiveFrames((prev) => ({ ...prev, [sessionId]: frame }));
      }
      if (screenFrame) {
        setLiveScreenFrames((prev) => ({ ...prev, [sessionId]: screenFrame }));
      }
    });

    socket.on('admin:telemetry_update', (updated) => {
      setLiveSessions((prev) => {
        const exists = prev.some((s) => s.sessionId === updated.sessionId);
        if (!exists) return [updated, ...prev];
        return prev.map((s) => (s.sessionId === updated.sessionId ? { ...s, ...updated } : s));
      });
    });

    socket.on('admin:session_ended', ({ sessionId }) => {
      setLiveSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
      fetchOverview();
    });

    socket.on('admin:recording_ready', () => {
      fetchOverview();
    });

    socket.on('proctoring:violation_alert', (payload) => {
      setRecentEvents((prev) => [
        {
          ...payload.event,
          candidate: payload.candidate,
          session: payload.sessionSummary,
        },
        ...prev,
      ]);
      fetchOverview();
    });

    return () => {
      socket.off('admin:active_sessions_sync');
      socket.off('admin:session_started');
      socket.off('admin:video_frame');
      socket.off('admin:telemetry_update');
      socket.off('admin:session_ended');
      socket.off('admin:recording_ready');
      socket.off('proctoring:violation_alert');
    };
  }, []);

  const openFullCandidateVerification = async (sessionObj) => {
    setInspectSession(sessionObj);
    setLoadingInspect(true);
    try {
      const { data } = await api.get(`/proctoring/sessions/${sessionObj._id}/report`);
      setInspectSession(data.session);
      setInspectEvents(data.events || []);
    } catch (err) {
      console.error('Failed to load full candidate report:', err);
    } finally {
      setLoadingInspect(false);
    }
  };

  const handleAdminVerdictChange = async (sessionId, adminReviewVerdict) => {
    try {
      const { data } = await api.patch(`/proctoring/admin/sessions/${sessionId}/verdict`, {
        adminReviewVerdict,
      });
      setDbSessions((prev) =>
        prev.map((s) => (s._id === sessionId ? { ...s, proctoring: data.session.proctoring } : s))
      );
      if (inspectSession && inspectSession._id === sessionId) {
        setInspectSession((prev) => ({ ...prev, proctoring: data.session.proctoring }));
      }
    } catch {
      alert('Failed to update verification verdict');
    }
  };

  // 2-Step Permission Delete Handler
  const initiateDeleteSession = (sessionObj) => {
    setDeleteTarget({ session: sessionObj, step: 1 });
  };

  const confirmFinalDeleteSession = async () => {
    if (!deleteTarget?.session) return;
    setDeleting(true);
    try {
      const targetId = deleteTarget.session._id;
      await api.delete(`/proctoring/admin/sessions/${targetId}`);
      setDbSessions((prev) => prev.filter((s) => s._id !== targetId));
      setRecentEvents((prev) =>
        prev.filter((ev) => (ev.session?._id || ev.session) !== targetId)
      );
      if (inspectSession?._id === targetId) {
        setInspectSession(null);
      }
      setDeleteTarget(null);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete session');
    } finally {
      setDeleting(false);
    }
  };

  const sendCandidateWarning = (sessionId) => {
    const message = window.prompt(
      'Enter real-time proctoring notice to display on candidate screen:',
      'Admin Warning: Please do not switch browser tabs or exit full-screen mode.'
    );
    if (!message) return;
    socket.emit('admin:send_candidate_notice', {
      sessionId,
      message,
      severity: 'high',
    });
  };

  const handleEventStatusChange = async (eventId, reviewStatus) => {
    try {
      await api.patch(`/proctoring/admin/events/${eventId}`, { reviewStatus });
      setRecentEvents((prev) =>
        prev.map((ev) => (ev._id === eventId ? { ...ev, reviewStatus } : ev))
      );
    } catch {
      alert('Failed to update event status');
    }
  };

  const displayedSessions = filterFlagged
    ? dbSessions.filter((s) => s.proctoring?.flaggedForManualReview)
    : dbSessions;

  return (
    <AppShell title="Admin Control Center: Live Webcam + Screen Share Monitor & Candidate Qualification">
      {/* =====================================================================
          2-STEP PERMISSION DELETE CONFIRMATION MODAL (Asks Permission Twice!)
      ===================================================================== */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-obsidian-950/90 backdrop-blur-md flex items-center justify-center p-6">
          <div className="max-w-md w-full p-7 rounded-3xl bg-obsidian-900 border border-rose-500/40 shadow-2xl space-y-5 text-white">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold uppercase">
                {deleteTarget.step === 1
                  ? 'Permission 1 of 2 • First Confirmation'
                  : 'Permission 2 of 2 • Final Irreversible Confirmation'}
              </span>
              <button
                onClick={() => setDeleteTarget(null)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20"
              >
                <X size={16} />
              </button>
            </div>

            {deleteTarget.step === 1 ? (
              <>
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-8 h-8 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-lg font-bold">
                      Delete Candidate Interview Session?
                    </h3>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      Kya aap sach mein <strong>{deleteTarget.session.user?.fullName || 'Candidate'}</strong> ({deleteTarget.session.jobRole}) ka interview record delete karna chahte hain?
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setDeleteTarget(null)}
                    className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setDeleteTarget({ ...deleteTarget, step: 2 })}
                    className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-obsidian-950 text-xs font-extrabold"
                  >
                    Yes, Proceed to 2nd Permission →
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <Trash2 className="w-8 h-8 text-rose-500 shrink-0 mt-0.5 animate-bounce" />
                  <div>
                    <h3 className="text-lg font-bold text-rose-400">
                      Final Permission (2/2): Permanent Delete!
                    </h3>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      Yeh dusri aur aakhri permission hai. Confirm karne par{' '}
                      <strong>{deleteTarget.session.user?.fullName || 'Candidate'}</strong> ka{' '}
                      <strong>HD Recorded Video + Voice</strong>, <strong>Full Q&amp;A Report</strong>, aur{' '}
                      <strong>Proctoring Logs</strong> humesha ke liye delete ho jayenge.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setDeleteTarget(null)}
                    className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold"
                  >
                    Cancel &amp; Keep Record
                  </button>
                  <button
                    disabled={deleting}
                    onClick={confirmFinalDeleteSession}
                    className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold shadow-lg shadow-rose-600/30"
                  >
                    {deleting ? 'Deleting Permanently...' : 'Confirm Final Delete (2/2)'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          FULL CANDIDATE REPORT + HD VIDEO & VOICE VERIFICATION MODAL
      ===================================================================== */}
      {inspectSession && (
        <div className="fixed inset-0 z-40 bg-obsidian-950/90 backdrop-blur-lg flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="max-w-5xl w-full max-h-[92vh] overflow-y-auto p-6 sm:p-8 rounded-3xl bg-obsidian-900 border border-white/15 shadow-2xl space-y-6 text-white">
            {/* Modal Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4 sticky top-0 bg-obsidian-900 z-10">
              <div>
                <span className="text-xs font-bold uppercase text-violet-400">
                  Complete Candidate Verification &amp; HD Video Audit
                </span>
                <h2 className="text-xl font-extrabold mt-0.5">
                  {inspectSession.user?.fullName || 'Candidate'} ({inspectSession.user?.email}) —{' '}
                  {inspectSession.jobRole}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => initiateDeleteSession(inspectSession)}
                  className="px-3.5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-1.5"
                >
                  <Trash2 size={14} /> Delete Candidate Record
                </button>
                <button
                  onClick={() => setInspectSession(null)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* 1. HD Recorded Video + Voice Player */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-7 space-y-2">
                <h4 className="text-xs font-bold uppercase text-rose-400 flex items-center gap-1.5">
                  <PlayCircle size={15} /> HD 720p Recorded Interview Video + Candidate Voice
                </h4>
                <RecordedVideoPlayer recordingUrl={inspectSession.recordingUrl} autoPlay={true} />
              </div>

              {/* 2. Proctoring Counts & Admin Qualification / Disqualification Decision */}
              <div className="lg:col-span-5 space-y-4">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-slate-400">
                      Overall AI Evaluation Score
                    </span>
                    <span className="text-2xl font-extrabold text-emerald-400">
                      {inspectSession.overallScore}/10
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    AI Hiring Verdict:{' '}
                    <strong className="text-violet-300">
                      {inspectSession.aiSummaryReport?.hiringRecommendation || 'Completed'}
                    </strong>
                  </p>

                  {/* Admin Qualify / Disqualify Decision (Visible immediately to Candidate!) */}
                  <div className="pt-2 border-t border-white/10">
                    <span className="text-[11px] font-bold uppercase text-slate-400 block mb-2">
                      Final Admin Decision (Sent to Candidate):
                    </span>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      {[
                        ['cleared', 'Qualify (Pass)', 'bg-emerald-600 text-white'],
                        ['requires_followup', 'Hold / Review', 'bg-amber-500 text-obsidian-950'],
                        ['invalidated', 'Disqualify', 'bg-rose-600 text-white'],
                      ].map(([verdictKey, label, activeClass]) => (
                        <button
                          key={verdictKey}
                          onClick={() => handleAdminVerdictChange(inspectSession._id, verdictKey)}
                          className={`py-2 px-2 rounded-xl font-bold transition ${
                            inspectSession.proctoring?.adminReviewVerdict === verdictKey
                              ? activeClass
                              : 'bg-white/5 text-slate-300 hover:bg-white/10'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Exact Violation Counters */}
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                    <span className="text-slate-400 block">Tab Switched</span>
                    <strong className="text-base text-amber-300">
                      {inspectSession.proctoring?.tabSwitchCount || 0} times
                    </strong>
                  </div>
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30">
                    <span className="text-slate-400 block">Fullscreen Exited</span>
                    <strong className="text-base text-rose-300">
                      {inspectSession.proctoring?.fullscreenExitCount || 0} times
                    </strong>
                  </div>
                  <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30">
                    <span className="text-slate-400 block">Screen Share Drops</span>
                    <strong className="text-base text-indigo-300">
                      {inspectSession.proctoring?.screenShareDropCount || 0} times
                    </strong>
                  </div>
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30">
                    <span className="text-slate-400 block">Face / Camera Alerts</span>
                    <strong className="text-base text-rose-300">
                      {(inspectSession.proctoring?.faceMissingCount || 0) +
                        (inspectSession.proctoring?.multipleFacesCount || 0)}{' '}
                      times
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Executive AI Summary */}
            {inspectSession.aiSummaryReport?.executiveSummary && (
              <div className="p-4 rounded-2xl bg-violet-500/10 border border-violet-500/30 text-xs space-y-1">
                <h4 className="font-bold uppercase text-violet-300">Executive AI Summary</h4>
                <p className="text-slate-200 leading-relaxed">
                  {inspectSession.aiSummaryReport.executiveSummary}
                </p>
              </div>
            )}

            {/* 4. Full Question-by-Question Spoken Transcript & AI Rubric Verification */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold uppercase tracking-wider text-emerald-400">
                Complete Question &amp; Spoken Answer Verification ({inspectSession.questions?.length || 0} Questions)
              </h4>
              {loadingInspect ? (
                <p className="text-xs text-slate-400">Loading full question transcript...</p>
              ) : (
                inspectSession.questions?.map((q, idx) => (
                  <div
                    key={q._id || idx}
                    className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-white">
                        Q{idx + 1} [{q.topic}]: {q.questionText}
                      </span>
                      <span className="px-3 py-1 rounded-lg bg-violet-600/30 text-violet-300 font-bold">
                        Score: {q.evaluation?.score || 0}/10
                      </span>
                    </div>
                    <p className="text-slate-300 bg-obsidian-950 p-3 rounded-xl border border-white/5">
                      <strong className="text-indigo-300">Candidate Spoken Answer:</strong>{' '}
                      {q.userAnswer || 'Not answered'}
                    </p>
                    {q.evaluation?.improvedSampleAnswer && (
                      <p className="text-emerald-300 bg-emerald-500/10 p-3 rounded-xl">
                        <strong>Ideal Expected Answer:</strong> {q.evaluation.improvedSampleAnswer}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* 5. Timestamped Proctoring Violation Log */}
            {inspectEvents.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase text-amber-400">
                  Timestamped Violation History ({inspectEvents.length} Events)
                </h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {inspectEvents.map((ev) => (
                    <div
                      key={ev._id}
                      className="p-2.5 rounded-xl bg-obsidian-950 border border-white/10 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-amber-400 mr-2">[{ev.eventType}]</span>
                        <span className="text-slate-300">{ev.description}</span>
                      </div>
                      <span className="text-slate-400 font-mono text-[11px]">
                        {new Date(ev.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Top Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        <div className="p-5 rounded-2xl bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-white/10">
          <span className="text-xs font-semibold uppercase text-emerald-400">
            Live Ongoing Interviews
          </span>
          <p className="text-3xl font-extrabold mt-1">{liveSessions.length}</p>
          <p className="text-xs text-slate-400 mt-1">Dual Live Webcam + Screen Share</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-white/10">
          <span className="text-xs font-semibold uppercase text-rose-400">
            Flagged for Cheating Review
          </span>
          <p className="text-3xl font-extrabold mt-1">{stats.flaggedSessionsCount || 0}</p>
          <p className="text-xs text-slate-400 mt-1">High tab-switch / FS exits</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-white/10">
          <span className="text-xs font-semibold uppercase text-amber-400">
            Total Violations Logged
          </span>
          <p className="text-3xl font-extrabold mt-1">{recentEvents.length}</p>
          <p className="text-xs text-slate-400 mt-1">Timestamped in MongoDB</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-white/10">
          <span className="text-xs font-semibold uppercase text-violet-400">
            Total Candidate Reports
          </span>
          <p className="text-3xl font-extrabold mt-1">{dbSessions.length}</p>
          <p className="text-xs text-slate-400 mt-1">With HD Video + Voice</p>
        </div>
      </div>

      {/* Section 1: Dual Live Candidate Webcam + Live Screen Share Streams */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            Live Candidate Webcam &amp; Screen Share Streams ({liveSessions.length})
          </h2>
          <button
            onClick={fetchOverview}
            className="px-3 py-1.5 rounded-xl bg-violet-500/15 text-violet-400 text-xs font-semibold flex items-center gap-1.5"
          >
            <RefreshCw size={14} /> Refresh Data
          </button>
        </div>

        {liveSessions.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {liveSessions.map((live) => {
              const currentWebcamFrame = liveFrames[live.sessionId] || live.latestSnapshot;
              const currentScreenFrame =
                liveScreenFrames[live.sessionId] || live.latestScreenSnapshot;

              return (
                <div
                  key={live.sessionId}
                  className="p-5 rounded-3xl bg-white dark:bg-obsidian-900 border border-violet-500/40 shadow-xl space-y-4"
                >
                  {/* Side-by-Side Live Webcam + Live Screen Share */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Live Webcam Stream */}
                    <div className="relative aspect-video rounded-2xl overflow-hidden bg-obsidian-950 border border-emerald-500/30 flex items-center justify-center">
                      {currentWebcamFrame ? (
                        <img
                          src={currentWebcamFrame}
                          alt={`${live.fullName} Webcam`}
                          className="w-full h-full object-cover scale-x-[-1]"
                        />
                      ) : (
                        <div className="text-xs text-slate-500 flex flex-col items-center gap-1">
                          <Video size={20} className="text-emerald-400 animate-pulse" />
                          <span>Connecting Webcam...</span>
                        </div>
                      )}
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" /> LIVE CAM
                      </span>
                    </div>

                    {/* Live Screen Share Stream */}
                    <div className="relative aspect-video rounded-2xl overflow-hidden bg-obsidian-950 border border-indigo-500/30 flex items-center justify-center">
                      {currentScreenFrame ? (
                        <img
                          src={currentScreenFrame}
                          alt={`${live.fullName} Screen`}
                          className="w-full h-full object-contain bg-black"
                        />
                      ) : (
                        <div className="text-xs text-slate-500 flex flex-col items-center gap-1">
                          <Monitor size={20} className="text-indigo-400 animate-pulse" />
                          <span>Connecting Screen Share...</span>
                        </div>
                      )}
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center gap-1">
                        <Monitor size={10} /> LIVE SCREEN
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm">{live.fullName || 'Candidate'}</p>
                      <p className="text-xs text-slate-400">
                        {live.jobRole} • Question {(live.currentQuestionIndex || 0) + 1}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 text-xs font-bold">
                      Total Flags: {live.violationCount || 0}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                    <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300">
                      <span className="block text-[10px] text-slate-400">Tab Switches</span>
                      <strong className="text-sm">{live.tabSwitchCount || 0}</strong>
                    </div>
                    <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300">
                      <span className="block text-[10px] text-slate-400">FS Exits</span>
                      <strong className="text-sm">{live.fullscreenExitCount || 0}</strong>
                    </div>
                    <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300">
                      <span className="block text-[10px] text-slate-400">Screen Drops</span>
                      <strong className="text-sm">{live.screenShareDropCount || 0}</strong>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      onClick={() => handleAdminVerdictChange(live.sessionId, 'cleared')}
                      className="flex-1 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1"
                    >
                      <CheckCircle2 size={13} /> Qualify
                    </button>
                    <button
                      onClick={() => handleAdminVerdictChange(live.sessionId, 'invalidated')}
                      className="flex-1 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 text-xs font-bold flex items-center justify-center gap-1"
                    >
                      <XCircle size={13} /> Disqualify
                    </button>
                    <button
                      onClick={() => sendCandidateWarning(live.sessionId)}
                      className="flex-1 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-semibold flex items-center justify-center gap-1"
                    >
                      <Send size={13} /> Alert
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 rounded-2xl bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-white/10 text-center text-xs text-slate-400">
            Abhi koi live interview nahi chal raha hai. Niche har candidate ka Full Report, Qualify/Disqualify buttons, HD Recorded Video+Voice, aur 2-Step Delete options maujood hain.
          </div>
        )}
      </div>

      {/* Section 2: All Candidate Full Reports, Qualify/Disqualify Buttons, HD Video+Voice Verification, & 2-Step Delete */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 p-6 rounded-2xl bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h3 className="font-bold text-base">
              All Candidate Full Reports &amp; Qualification Decisions ({displayedSessions.length})
            </h3>
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={filterFlagged}
                onChange={(e) => setFilterFlagged(e.target.checked)}
                className="rounded text-violet-600"
              />
              Show Only Flagged Candidates
            </label>
          </div>

          <div className="space-y-4">
            {displayedSessions.map((sess) => {
              const verdict = sess.proctoring?.adminReviewVerdict || 'unreviewed';
              return (
                <div
                  key={sess._id}
                  className="p-5 rounded-2xl border border-slate-200 dark:border-white/10 space-y-3 hover:border-violet-500/40 transition"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-base">{sess.user?.fullName || 'Candidate'}</p>
                        <span className="text-xs text-slate-400">({sess.user?.email})</span>
                        {sess.proctoring?.flaggedForManualReview && (
                          <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-400 text-[10px] font-bold uppercase">
                            Flagged for Review
                          </span>
                        )}
                        {verdict === 'cleared' && (
                          <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[11px] font-extrabold uppercase">
                            QUALIFIED (Selected)
                          </span>
                        )}
                        {verdict === 'invalidated' && (
                          <span className="px-2.5 py-0.5 rounded-md bg-rose-500/20 border border-rose-500/40 text-rose-400 text-[11px] font-extrabold uppercase">
                            DISQUALIFIED (Rejected)
                          </span>
                        )}
                        {verdict === 'requires_followup' && (
                          <span className="px-2.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[11px] font-extrabold uppercase">
                            UNDER REVIEW
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Role: <strong className="text-slate-200">{sess.jobRole}</strong> • Type:{' '}
                        {sess.interviewType} • Overall AI Score:{' '}
                        <strong className="text-emerald-400">{sess.overallScore}/10</strong> •{' '}
                        {new Date(sess.createdAt).toLocaleString()}
                      </p>
                    </div>

                    {/* Action Buttons: Qualify | Disqualify | Verify Full Report + HD Video | 2-Step Delete */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => handleAdminVerdictChange(sess._id, 'cleared')}
                        className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition ${
                          verdict === 'cleared'
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                            : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        <CheckCircle2 size={14} /> Qualify
                      </button>

                      <button
                        onClick={() => handleAdminVerdictChange(sess._id, 'invalidated')}
                        className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition ${
                          verdict === 'invalidated'
                            ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                            : 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        <XCircle size={14} /> Disqualify
                      </button>

                      <button
                        onClick={() => openFullCandidateVerification(sess)}
                        className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md"
                      >
                        <FileCheck2 size={14} /> Verify Report &amp; Video
                      </button>

                      <button
                        onClick={() => initiateDeleteSession(sess)}
                        className="px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 text-xs font-bold flex items-center gap-1"
                        title="Delete Candidate Interview (2-Step Confirmation)"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </div>

                  {/* Exact Counts of Tab Switch, Fullscreen Exit, Screen Drops, Face Alerts */}
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs pt-1">
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                      <span className="text-[10px] uppercase text-slate-400 block">Tab Switched</span>
                      <strong className="text-sm text-amber-400">
                        {sess.proctoring?.tabSwitchCount || 0} times
                      </strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                      <span className="text-[10px] uppercase text-slate-400 block">
                        Fullscreen Exited
                      </span>
                      <strong className="text-sm text-rose-400">
                        {sess.proctoring?.fullscreenExitCount || 0} times
                      </strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                      <span className="text-[10px] uppercase text-slate-400 block">Screen Drops</span>
                      <strong className="text-sm text-indigo-400">
                        {sess.proctoring?.screenShareDropCount || 0} times
                      </strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                      <span className="text-[10px] uppercase text-slate-400 block">Face Alerts</span>
                      <strong className="text-sm text-rose-300">
                        {(sess.proctoring?.faceMissingCount || 0) +
                          (sess.proctoring?.multipleFacesCount || 0)}{' '}
                        times
                      </strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                      <span className="text-[10px] uppercase text-slate-400 block">Questions</span>
                      <strong className="text-sm text-emerald-400">
                        {sess.questions?.filter((q) => q.isAnswered).length || 0} /{' '}
                        {sess.totalQuestions}
                      </strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                      <span className="text-[10px] uppercase text-slate-400 block">Video Status</span>
                      <strong className="text-sm text-violet-400">
                        {sess.recordingUrl ? 'HD Ready' : 'No Video'}
                      </strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Real-Time Suspicious Event Stream */}
        <div className="lg:col-span-4 p-6 rounded-2xl bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-white/10">
          <h3 className="font-bold text-base mb-4 flex items-center gap-2">
            <ShieldAlert size={18} className="text-amber-400" /> Timestamped Violation Log
          </h3>
          <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
            {recentEvents.map((ev) => (
              <div
                key={ev._id}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-400">{ev.eventType}</span>
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Clock size={11} /> {new Date(ev.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-300">{ev.description}</p>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-400">
                    Candidate: <strong>{ev.candidate?.fullName || 'User'}</strong>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleEventStatusChange(ev._id, 'dismissed_benign')}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        ev.reviewStatus === 'dismissed_benign'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-emerald-500/15 text-emerald-400'
                      }`}
                    >
                      Benign
                    </button>
                    <button
                      onClick={() => handleEventStatusChange(ev._id, 'confirmed_violation')}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        ev.reviewStatus === 'confirmed_violation'
                          ? 'bg-rose-500 text-white'
                          : 'bg-rose-500/15 text-rose-400'
                      }`}
                    >
                      Confirm Flag
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
