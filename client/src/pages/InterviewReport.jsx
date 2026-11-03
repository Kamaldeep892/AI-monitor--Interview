import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ShieldAlert, CheckCircle2, XCircle, AlertTriangle, Clock, Video } from 'lucide-react';
import AppShell from '../components/Layout/AppShell';
import RecordedVideoPlayer from '../components/Video/RecordedVideoPlayer';
import api from '../services/api';
import { socket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import { stopAllInterviewMediaStreams } from '../services/screenShareStore';

const BACKEND_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(
  /\/api\/?$/,
  ''
);

export default function InterviewReport() {
  const { sessionId } = useParams();
  const { user } = useAuth();
  const [session, setSession] = useState(null);
  const [proctoringEvents, setProctoringEvents] = useState([]);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    // Ensure webcam, mic, and screen share hardware are 100% turned off on the report screen
    stopAllInterviewMediaStreams();

    api.get(`/interviews/${sessionId}`).then(({ data }) => {
      setSession(data.session);
      setProctoringEvents(data.proctoringEvents || []);
    });

    if (!socket.connected) socket.connect();
    if (user?.id || user?._id) {
      socket.emit('candidate:subscribe_verdicts', { candidateId: user?.id || user?._id });
    }

    const handleVerdictUpdate = (payload) => {
      if (payload.sessionId === sessionId) {
        setSession((prev) =>
          prev
            ? {
                ...prev,
                proctoring: {
                  ...(prev.proctoring || {}),
                  adminReviewVerdict: payload.adminReviewVerdict,
                  proctoringSummaryNotes: payload.proctoringSummaryNotes,
                },
              }
            : prev
        );
      }
    };

    socket.on('candidate:verdict_updated', handleVerdictUpdate);
    socket.on('candidate:verdict_broadcast', handleVerdictUpdate);

    return () => {
      socket.off('candidate:verdict_updated', handleVerdictUpdate);
      socket.off('candidate:verdict_broadcast', handleVerdictUpdate);
    };
  }, [sessionId, user]);

  if (!session) return <AppShell title="Interview Report">Loading report...</AppShell>;

  const proc = session.proctoring || {};
  const adminVerdict = proc.adminReviewVerdict || 'unreviewed';

  return (
    <AppShell
      title={
        isAdmin
          ? 'Admin Audit: Recorded Video+Voice, Proctoring Logs & AI Evaluation'
          : 'Your AI Interview Performance & Qualification Status'
      }
    >
      {/* Prominent Official Admin Qualification / Disqualification Banner for Both Candidate & Admin */}
      {adminVerdict === 'cleared' && (
        <div className="mb-6 p-5 rounded-3xl bg-emerald-500/15 border-2 border-emerald-500/50 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-emerald-500/30">
              <CheckCircle2 size={26} />
            </div>
            <div>
              <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
                Official Administrator Decision • QUALIFIED
              </span>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Congratulations! Your Interview Has Been Verified &amp; Qualified by the Administrator.
              </h3>
            </div>
          </div>
          <span className="px-4 py-2 rounded-2xl bg-emerald-500 text-white text-xs font-extrabold uppercase shrink-0">
            QUALIFIED ✓
          </span>
        </div>
      )}

      {adminVerdict === 'invalidated' && (
        <div className="mb-6 p-5 rounded-3xl bg-rose-500/15 border-2 border-rose-500/50 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-rose-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-rose-600/30">
              <XCircle size={26} />
            </div>
            <div>
              <span className="text-xs font-extrabold uppercase tracking-wider text-rose-400">
                Official Administrator Decision • DISQUALIFIED
              </span>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Your Interview Session Has Been Disqualified by the Administrator After Proctoring Review.
              </h3>
            </div>
          </div>
          <span className="px-4 py-2 rounded-2xl bg-rose-600 text-white text-xs font-extrabold uppercase shrink-0">
            DISQUALIFIED ✕
          </span>
        </div>
      )}

      {adminVerdict === 'requires_followup' && (
        <div className="mb-6 p-5 rounded-3xl bg-amber-500/15 border-2 border-amber-500/50 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center text-obsidian-950 shrink-0">
              <AlertTriangle size={26} />
            </div>
            <div>
              <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                Official Administrator Status • UNDER REVIEW
              </span>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Your Interview Session is Currently Under Manual Review by the Administrator.
              </h3>
            </div>
          </div>
          <span className="px-4 py-2 rounded-2xl bg-amber-500 text-obsidian-950 text-xs font-extrabold uppercase shrink-0">
            UNDER REVIEW
          </span>
        </div>
      )}

      <div className="p-6 rounded-3xl bg-gradient-to-r from-obsidian-900 to-indigo-950 text-white mb-6 flex flex-wrap justify-between items-center gap-4">
        <div>
          <span className="text-xs uppercase tracking-widest text-violet-300">
            {session.interviewType} Session • {session.difficulty}
          </span>
          <h2 className="text-2xl font-bold mt-1">
            {session.jobRole}{' '}
            {isAdmin && session.user?.fullName ? `— ${session.user.fullName}` : ''}
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            AI Recommendation:{' '}
            <strong>{session.aiSummaryReport?.hiringRecommendation || 'Pending'}</strong> • Admin
            Verdict:{' '}
            <strong
              className={
                adminVerdict === 'cleared'
                  ? 'text-emerald-400'
                  : adminVerdict === 'invalidated'
                  ? 'text-rose-400'
                  : 'text-amber-300'
              }
            >
              {adminVerdict === 'cleared'
                ? 'QUALIFIED'
                : adminVerdict === 'invalidated'
                ? 'DISQUALIFIED'
                : adminVerdict === 'requires_followup'
                ? 'UNDER REVIEW'
                : 'AWAITING ADMIN VERIFICATION'}
            </strong>
          </p>
        </div>
        <div className="text-right">
          <span className="text-4xl font-extrabold text-violet-400">{session.overallScore}/10</span>
          <span className="block text-xs text-slate-300">Overall AI Score</span>
        </div>
      </div>

      {/* STRICT ADMIN-ONLY SECTION: Recorded Interview Video+Voice Player & Violation Counts */}
      {isAdmin && (
        <div className="p-6 rounded-2xl bg-white dark:bg-obsidian-900 border border-rose-500/30 mb-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold text-sm uppercase text-rose-400 flex items-center gap-2">
              <ShieldAlert size={18} /> Admin-Only Proctoring &amp; Recorded Video+Voice Audit
            </h3>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold ${
                proc.flaggedForManualReview
                  ? 'bg-rose-500/20 text-rose-400'
                  : 'bg-emerald-500/20 text-emerald-400'
              }`}
            >
              {proc.flaggedForManualReview
                ? 'Flagged for Admin Review'
                : 'Standard Integrity Status'}
            </span>
          </div>

          <div className="space-y-2 max-w-3xl">
            <h4 className="text-xs font-bold uppercase text-slate-400 flex items-center gap-1.5">
              <Video size={14} className="text-rose-400" /> Recorded Candidate Interview Video (With Voice)
            </h4>
            <RecordedVideoPlayer recordingUrl={session.recordingUrl} autoPlay={false} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5">
              <span className="text-slate-400 block">Total Flags</span>
              <strong className="text-base">{proc.totalViolations || 0}</strong>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5">
              <span className="text-slate-400 block">Tab Switched</span>
              <strong className="text-base text-amber-400">{proc.tabSwitchCount || 0} times</strong>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5">
              <span className="text-slate-400 block">Full-Screen Exited</span>
              <strong className="text-base text-rose-400">
                {proc.fullscreenExitCount || 0} times
              </strong>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5">
              <span className="text-slate-400 block">Screen Share Drops</span>
              <strong className="text-base text-indigo-400">
                {proc.screenShareDropCount || 0} times
              </strong>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5">
              <span className="text-slate-400 block">Face / Camera Alerts</span>
              <strong className="text-base">
                {(proc.faceMissingCount || 0) + (proc.multipleFacesCount || 0)} times
              </strong>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5">
              <span className="text-slate-400 block">Audio Anomalies</span>
              <strong className="text-base">{proc.audioAnomalyCount || 0}</strong>
            </div>
          </div>

          {proctoringEvents.length > 0 && (
            <div className="pt-2">
              <h4 className="text-xs font-bold uppercase text-slate-400 mb-2">
                Complete Timestamped Violation Timeline ({proctoringEvents.length} events)
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {proctoringEvents.map((ev) => (
                  <div
                    key={ev._id}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-white/10 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-amber-400 mr-2">[{ev.eventType}]</span>
                      <span>{ev.description}</span>
                    </div>
                    <span className="text-slate-400 font-mono text-[11px] flex items-center gap-1 shrink-0">
                      <Clock size={12} /> {new Date(ev.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Executive AI Performance Summary */}
      {session.aiSummaryReport?.executiveSummary && (
        <div className="p-6 rounded-2xl bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-white/10 mb-6">
          <h3 className="font-bold text-sm uppercase text-violet-400 mb-2 flex items-center gap-1.5">
            <CheckCircle2 size={16} /> Executive AI Performance Evaluation
          </h3>
          <p className="text-sm leading-relaxed">{session.aiSummaryReport.executiveSummary}</p>
        </div>
      )}

      {/* Question-by-Question Transcript & Rubric Breakdown */}
      <div className="space-y-4">
        {session.questions?.map((q, idx) => (
          <div
            key={q._id}
            className="p-6 rounded-2xl bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-white/10 space-y-3"
          >
            <div className="flex justify-between">
              <span className="font-bold text-sm">
                Q{idx + 1} [{q.topic}]: {q.questionText}
              </span>
              <span className="px-3 py-1 rounded-lg bg-violet-500/15 text-violet-400 text-xs font-bold">
                {q.evaluation?.score || 0}/10
              </span>
            </div>
            <p className="text-xs text-slate-400">
              <strong>Spoken Answer Transcript:</strong> {q.userAnswer || 'No response recorded'}
            </p>
            {q.evaluation?.improvedSampleAnswer && (
              <p className="text-xs text-emerald-400 bg-emerald-500/10 p-3 rounded-xl">
                <strong>Ideal Sample Answer:</strong> {q.evaluation.improvedSampleAnswer}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 flex gap-4">
        {!isAdmin && (
          <Link to="/interview-history" className="text-sm text-violet-400 hover:underline">
            ← Back to Interview History
          </Link>
        )}
        {isAdmin && (
          <Link to="/admin/proctoring" className="text-sm text-rose-400 font-bold hover:underline">
            ← Return to Admin Proctoring Center
          </Link>
        )}
      </div>
    </AppShell>
  );
}
