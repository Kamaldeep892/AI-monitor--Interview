import React, { useState, useEffect } from 'react';
import { Sparkles, Bookmark, Eye, EyeOff, Trash2 } from 'lucide-react';
import AppShell from '../components/Layout/AppShell';
import api from '../services/api';

export default function QuestionGenerator({ savedView = false }) {
  const [jobRole, setJobRole] = useState('Full Stack Developer');
  const [experienceLevel, setExperienceLevel] = useState('1–3 Years');
  const [category, setCategory] = useState('Technical');
  const [difficulty, setDifficulty] = useState('Medium');
  const [count, setCount] = useState(5);
  const [questions, setQuestions] = useState([]);
  const [revealed, setRevealed] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (savedView) {
      api.get('/questions/saved').then(({ data }) => setQuestions(data.questions || []));
    }
  }, [savedView]);

  const handleGenerate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/questions/generate', {
        jobRole,
        experienceLevel,
        category,
        difficulty,
        count,
      });
      setQuestions(data.questions || []);
      setRevealed({});
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (q) => {
    await api.post('/questions/saved', { jobRole, category, ...q });
    alert('Question saved to personal bank!');
  };

  const handleDeleteSaved = async (id) => {
    await api.delete(`/questions/saved/${id}`);
    setQuestions((prev) => prev.filter((item) => item._id !== id));
  };

  return (
    <AppShell title={savedView ? 'Saved Question Bank' : 'AI Interview Question Generator'}>
      {!savedView && (
        <form
          onSubmit={handleGenerate}
          className="p-6 rounded-2xl bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-white/10 mb-8 grid grid-cols-1 sm:grid-cols-5 gap-4 items-end"
        >
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Job Role</label>
            <input
              value={jobRole}
              onChange={(e) => setJobRole(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-white/10 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-white/10 text-sm"
            >
              {['Technical', 'System Design', 'Behavioral', 'HR'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Difficulty</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-white/10 text-sm"
            >
              {['Easy', 'Medium', 'Hard'].map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Count</label>
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-white/10 text-sm"
            >
              {[5, 10].map((n) => (
                <option key={n} value={n}>
                  {n} Questions
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold text-sm flex items-center justify-center gap-2"
          >
            <Sparkles size={16} />
            {loading ? 'Generating...' : 'Generate'}
          </button>
        </form>
      )}

      <div className="space-y-4">
        {questions.map((q, idx) => (
          <div
            key={q._id || idx}
            className="p-6 rounded-2xl bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-white/10 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-violet-500/15 text-violet-400 text-xs font-bold">
                  {q.topic}
                </span>
                <span className="text-xs text-slate-400">{q.difficulty}</span>
              </div>
              {savedView ? (
                <button onClick={() => handleDeleteSaved(q._id)} className="text-rose-400 hover:text-rose-300">
                  <Trash2 size={16} />
                </button>
              ) : (
                <button
                  onClick={() => handleSave(q)}
                  className="text-xs font-semibold text-violet-400 hover:underline flex items-center gap-1"
                >
                  <Bookmark size={14} /> Save Question
                </button>
              )}
            </div>

            <h3 className="font-bold text-base">{q.question}</h3>
            <p className="text-xs text-slate-400">
              <strong>Why interviewers ask this:</strong> {q.interviewerIntent}
            </p>

            <button
              onClick={() => setRevealed((r) => ({ ...r, [idx]: !r[idx] }))}
              className="text-xs font-semibold text-indigo-400 flex items-center gap-1.5 pt-1"
            >
              {revealed[idx] ? <EyeOff size={14} /> : <Eye size={14} />}
              {revealed[idx] ? 'Hide Sample Answer' : 'Reveal Key Points & Sample Answer'}
            </button>

            {revealed[idx] && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 space-y-2 text-xs mt-2">
                <p className="font-semibold text-violet-300">Expected Key Points:</p>
                <ul className="list-disc pl-4 space-y-1">
                  {q.expectedKeyPoints?.map((pt, i) => (
                    <li key={i}>{pt}</li>
                  ))}
                </ul>
                <p className="font-semibold text-emerald-400 pt-2">Sample Answer:</p>
                <p className="leading-relaxed">{q.sampleAnswer}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </AppShell>
  );
}
