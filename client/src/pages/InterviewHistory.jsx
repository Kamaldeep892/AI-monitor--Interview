import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Eye, CheckCircle2, XCircle, Clock } from 'lucide-react';
import AppShell from '../components/Layout/AppShell';
import api from '../services/api';
import { socket } from '../services/socket';
import { useAuth } from '../context/AuthContext';

export default function InterviewHistory() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);

  const load = async () => {
    const { data } = await api.get('/interviews/history');
    setSessions(data.sessions || []);
  };

  useEffect(() => {
    load();

    if (!socket.connected) socket.connect();
    if (user?.id || user?._id) {
      socket.emit('candidate:subscribe_verdicts', { candidateId: user?.id || user?._id });
    }

    const handleVerdictUpdate = (payload) => {
      setSessions((prev) =>
        prev.map((s) =>
          s._id === payload.sessionId
            ? {
                ...s,
                proctoring: {
                  ...(s.proctoring || {}),
                  adminReviewVerdict: payload.adminReviewVerdict,
                },
              }
            : s
        )
      );
    };

    socket.on('candidate:verdict_updated', handleVerdictUpdate);
    socket.on('candidate:verdict_broadcast', handleVerdictUpdate);

    return () => {
      socket.off('candidate:verdict_updated', handleVerdictUpdate);
      socket.off('candidate:verdict_broadcast', handleVerdictUpdate);
    };
  }, [user]);

  const handleDelete = async (id) => {
    await api.delete(`/interviews/${id}`);
    load();
  };

  const renderVerdictBadge = (verdict) => {
    if (verdict === 'cleared') {
      return (
        <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-extrabold flex items-center gap-1">
          <CheckCircle2 size={13} /> QUALIFIED BY ADMIN
        </span>
      );
    }
    if (verdict === 'invalidated') {
      return (
        <span className="px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 text-xs font-extrabold flex items-center gap-1">
          <XCircle size={13} /> DISQUALIFIED BY ADMIN
        </span>
      );
    }
    if (verdict === 'requires_followup') {
      return (
        <span className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-bold flex items-center gap-1">
          <Clock size={13} /> UNDER ADMIN REVIEW
        </span>
      );
    }
    return (
      <span className="px-3 py-1 rounded-full bg-slate-500/10 border border-slate-500/20 text-slate-400 text-xs font-semibold">
        Pending Admin Verification
      </span>
    );
  };

  return (
    <AppShell title="Interview History & Official Qualification Status">
      <div className="space-y-4">
        {sessions.map((s) => {
          const verdict = s.proctoring?.adminReviewVerdict || 'unreviewed';
          return (
            <div
              key={s._id}
              className={`p-5 rounded-2xl bg-white dark:bg-obsidian-900 border flex flex-wrap justify-between items-center gap-4 transition ${
                verdict === 'cleared'
                  ? 'border-emerald-500/40'
                  : verdict === 'invalidated'
                  ? 'border-rose-500/40'
                  : 'border-slate-200 dark:border-white/10'
              }`}
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <p className="font-bold text-base">
                    {s.jobRole} • {s.interviewType}
                  </p>
                  {renderVerdictBadge(verdict)}
                </div>
                <p className="text-xs text-slate-400">
                  {new Date(s.createdAt).toLocaleString()} • {s.difficulty} • Status: {s.status}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-3.5 py-1.5 rounded-xl bg-violet-500/15 text-violet-400 font-bold text-sm">
                  AI Score: {s.overallScore}/10
                </span>
                <Link
                  to={`/interview-report/${s._id}`}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-violet-500/20"
                  title="View Full Report"
                >
                  <Eye size={16} />
                </Link>
                <button
                  onClick={() => handleDelete(s._id)}
                  className="p-2 rounded-xl text-rose-400 hover:bg-rose-500/10"
                  title="Delete Session"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}

        {sessions.length === 0 && (
          <div className="p-8 rounded-2xl bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-white/10 text-center text-xs text-slate-400">
            No interview sessions completed yet. Start a Live Video Interview to see your AI score and Admin qualification status here!
          </div>
        )}
      </div>
    </AppShell>
  );
}
