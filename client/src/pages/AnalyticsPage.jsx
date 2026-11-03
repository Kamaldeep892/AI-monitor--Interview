import React, { useEffect, useState } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import AppShell from '../components/Layout/AppShell';
import api from '../services/api';

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [loadingRoadmap, setLoadingRoadmap] = useState(false);

  useEffect(() => {
    api.get('/analytics/overview').then((res) => setData(res.data));
  }, []);

  const handleGenerateRoadmap = async () => {
    setLoadingRoadmap(true);
    try {
      const res = await api.post('/analytics/roadmap');
      setData((prev) => ({
        ...prev,
        progress: { ...prev.progress, aiLearningRoadmap: res.data.roadmap },
      }));
    } finally {
      setLoadingRoadmap(false);
    }
  };

  const roadmap = data?.progress?.aiLearningRoadmap;

  return (
    <AppShell title="Performance Analytics & AI Learning Roadmap">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="p-6 rounded-2xl bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-white/10">
          <h3 className="font-bold text-base mb-3 text-emerald-400">Strongest Demonstrated Skills</h3>
          <div className="flex flex-wrap gap-2">
            {data?.progress?.strongestSkills?.length > 0 ? (
              data.progress.strongestSkills.map((s) => (
                <span
                  key={s}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-400 text-xs font-semibold"
                >
                  {s}
                </span>
              ))
            ) : (
              <p className="text-xs text-slate-400">Complete more sessions to classify top skills.</p>
            )}
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-white/10">
          <h3 className="font-bold text-base mb-3 text-amber-400">Focus Areas for Improvement</h3>
          <div className="flex flex-wrap gap-2">
            {data?.progress?.weakestSkills?.length > 0 ? (
              data.progress.weakestSkills.map((s) => (
                <span
                  key={s}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-400 text-xs font-semibold"
                >
                  {s}
                </span>
              ))
            ) : (
              <p className="text-xs text-slate-400">No weak skill patterns flagged yet.</p>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 rounded-3xl bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Sparkles className="text-violet-400" size={20} /> Personalized AI Learning Roadmap
            </h3>
            <p className="text-xs text-slate-400">
              Synthesized directly from your past answer evaluations and missed technical concepts.
            </p>
          </div>
          <button
            onClick={handleGenerateRoadmap}
            disabled={loadingRoadmap}
            className="px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold flex items-center gap-2"
          >
            <RefreshCw size={14} className={loadingRoadmap ? 'animate-spin' : ''} />
            {loadingRoadmap ? 'Synthesizing...' : 'Refresh AI Roadmap'}
          </button>
        </div>

        {roadmap?.topicsToStudy?.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5">
              <h4 className="font-bold text-violet-400 uppercase mb-2">Priority Topics to Study</h4>
              <ul className="list-disc pl-4 space-y-1.5">
                {roadmap.topicsToStudy.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5">
              <h4 className="font-bold text-indigo-400 uppercase mb-2">
                Communication & Delivery Tips
              </h4>
              <ul className="list-disc pl-4 space-y-1.5">
                {roadmap.communicationTips.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            Click "Refresh AI Roadmap" to generate a personalized study plan from your
            interview history.
          </p>
        )}
      </div>
    </AppShell>
  );
}
