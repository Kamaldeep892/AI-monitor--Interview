import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Video, FileSearch, Sparkles, Award, Flame, Clock, CheckCircle2, XCircle } from 'lucide-react';
import AppShell from '../components/Layout/AppShell';
import api from '../services/api';
import { socket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import { stopAllInterviewMediaStreams } from '../services/screenShareStore';

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [liveDecisionBanner, setLiveDecisionBanner] = useState(null);

  const loadOverview = () => {
    api.get('/analytics/overview').then((res) => setData(res.data));
  };

  useEffect(() => {
    stopAllInterviewMediaStreams();
    loadOverview();

    if (!socket.connected) socket.connect();
    if (user?.id || user?._id) {
      socket.emit('candidate:subscribe_verdicts', { candidateId: user?.id || user?._id });
    }

    const handleVerdictUpdate = (payload) => {
      setLiveDecisionBanner(payload);
      loadOverview();
    };

    socket.on('candidate:verdict_updated', handleVerdictUpdate);
    socket.on('candidate:verdict_broadcast', handleVerdictUpdate);

    return () => {
      socket.off('candidate:verdict_updated', handleVerdictUpdate);
      socket.off('candidate:verdict_broadcast', handleVerdictUpdate);
    };
  }, [user]);

  const stats = data?.stats || {};

  return (
    <AppShell title={`Welcome back, ${user?.fullName?.split(' ')[0] || 'Candidate'} 👋`}>
      {/* Real-Time Admin Qualification / Disqualification Notification Banner */}
      {liveDecisionBanner && (
        <div
          className={`mb-6 p-4 rounded-2xl border flex items-center justify-between text-xs font-bold ${
            liveDecisionBanner.adminReviewVerdict === 'cleared'
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
              : liveDecisionBanner.adminReviewVerdict === 'invalidated'
              ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
              : 'bg-amber-500/20 border-amber-500/40 text-amber-300'
          }`}
        >
          <span>
            Official Admin Update for {liveDecisionBanner.jobRole}:{' '}
            {liveDecisionBanner.adminReviewVerdict === 'cleared'
              ? 'CONGRATULATIONS! You have been QUALIFIED by the Administrator!'
              : liveDecisionBanner.adminReviewVerdict === 'invalidated'
              ? 'NOTICE: Your interview session has been DISQUALIFIED by the Administrator.'
              : 'Your interview status has been updated to Under Review.'}
          </span>
          <button onClick={() => setLiveDecisionBanner(null)} className="underline ml-4">
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {[
          { label: 'Interviews Completed', value: stats.totalInterviews || 0, icon: Video },
          { label: 'Average AI Score', value: `${stats.averageScore || 0}/10`, icon: Award },
          { label: 'Practice Hours', value: `${stats.totalHours || 0} hrs`, icon: Clock },
          { label: 'Readiness Level', value: stats.skillLevel || 'Beginner', icon: Flame },
        ].map((c) => (
          <div
            key={c.label}
            className="p-5 rounded-2xl bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-white/10 flex items-center justify-between"
          >
            <div>
              <p className="text-xs text-slate-400">{c.label}</p>
              <p className="text-2xl font-extrabold mt-1">{c.value}</p>
            </div>
            <div className="p-3 rounded-xl bg-violet-500/10 text-violet-400">
              <c.icon className="w-6 h-6" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <Link
          to="/mock-interview"
          className="p-6 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-lg"
        >
          <Video className="w-8 h-8 mb-3" />
          <h3 className="font-bold text-lg">Start Live AI Video Interview</h3>
          <p className="text-xs text-violet-100 mt-1">
            Full-screen proctored video, screen share &amp; voice session with Gemini AI.
          </p>
        </Link>
        <Link
          to="/resume-analyzer"
          className="p-6 rounded-2xl bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-white/10"
        >
          <FileSearch className="w-8 h-8 text-violet-400 mb-3" />
          <h3 className="font-bold text-lg">Analyze Resume ATS</h3>
          <p className="text-xs text-slate-400 mt-1">
            Upload PDF/DOCX to get ATS score, missing skills, and tailored questions.
          </p>
        </Link>
        <Link
          to="/question-generator"
          className="p-6 rounded-2xl bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-white/10"
        >
          <Sparkles className="w-8 h-8 text-emerald-400 mb-3" />
          <h3 className="font-bold text-lg">Question Bank Generator</h3>
          <p className="text-xs text-slate-400 mt-1">
            Generate role-specific questions with ideal answers and evaluation criteria.
          </p>
        </Link>
      </div>

      {/* Recent Interviews & Admin Qualification Status */}
      {data?.recentSessions?.length > 0 && (
        <div className="p-6 rounded-2xl bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-white/10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-base">
              Recent Interviews &amp; Official Admin Qualification Status
            </h3>
            <Link to="/interview-history" className="text-xs text-violet-400 hover:underline">
              View All →
            </Link>
          </div>
          <div className="space-y-3">
            {data.recentSessions.map((s) => {
              const verdict = s.proctoring?.adminReviewVerdict || 'unreviewed';
              return (
                <Link
                  key={s._id}
                  to={`/interview-report/${s._id}`}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 hover:border-violet-500/40 transition"
                >
                  <div>
                    <p className="font-bold text-sm">
                      {s.jobRole} ({s.interviewType})
                    </p>
                    <p className="text-xs text-slate-400">
                      {new Date(s.createdAt).toLocaleString()} • AI Score: {s.overallScore}/10
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {verdict === 'cleared' && (
                      <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-extrabold flex items-center gap-1">
                        <CheckCircle2 size={13} /> QUALIFIED
                      </span>
                    )}
                    {verdict === 'invalidated' && (
                      <span className="px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 text-xs font-extrabold flex items-center gap-1">
                        <XCircle size={13} /> DISQUALIFIED
                      </span>
                    )}
                    {verdict === 'requires_followup' && (
                      <span className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-bold">
                        UNDER REVIEW
                      </span>
                    )}
                    {verdict === 'unreviewed' && (
                      <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-400 text-xs">
                        Awaiting Admin Decision
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </AppShell>
  );
}
