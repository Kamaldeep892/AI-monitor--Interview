import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, CheckCircle2, AlertTriangle, Sparkles, Play, FileText } from 'lucide-react';
import AppShell from '../components/Layout/AppShell';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function ResumeAnalyzer() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [targetJobRole, setTargetJobRole] = useState(user?.targetJobRole || 'Full Stack Developer');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [resumeDoc, setResumeDoc] = useState(null);

  useEffect(() => {
    api.get('/resumes').then(({ data }) => {
      if (data.latestAnalysis) {
        setAnalysis(data.latestAnalysis);
        setResumeDoc(data.latestAnalysis.resume);
      }
    });
  }, []);

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('resume', file);
      formData.append('targetJobRole', targetJobRole);

      const { data } = await api.post('/resumes/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setAnalysis(data.analysis);
      setResumeDoc(data.resume);
    } catch (err) {
      alert(err.response?.data?.message || 'Resume analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const startResumeBasedInterview = async () => {
    if (!resumeDoc) return;
    const { data } = await api.post('/interviews/start', {
      jobRole: targetJobRole,
      experienceLevel: user?.experienceLevel || 'Fresher',
      interviewType: 'Resume-Based',
      difficulty: 'Medium',
      totalQuestions: 5,
      resumeId: resumeDoc._id,
    });
    navigate(`/interview/${data.session._id}`);
  };

  return (
    <AppShell title="AI Resume Analyzer & ATS Scanner">
      <form
        onSubmit={handleAnalyze}
        className="p-6 rounded-2xl bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-white/10 mb-8 grid grid-cols-1 md:grid-cols-12 gap-4 items-center"
      >
        <div className="md:col-span-4">
          <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">
            Target Job Role
          </label>
          <input
            type="text"
            value={targetJobRole}
            onChange={(e) => setTargetJobRole(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-white/10 text-sm"
          />
        </div>

        <div className="md:col-span-5">
          <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">
            Upload Resume (PDF or DOCX, Max 5MB)
          </label>
          <input
            type="file"
            accept=".pdf,.docx"
            onChange={(e) => setFile(e.target.files[0])}
            className="w-full text-xs file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-violet-600/15 file:text-violet-400 file:font-semibold"
          />
        </div>

        <div className="md:col-span-3 pt-5">
          <button
            type="submit"
            disabled={loading || !file}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2"
          >
            <UploadCloud size={16} />
            {loading ? 'Analyzing...' : 'Scan Resume'}
          </button>
        </div>
      </form>

      {analysis && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 p-6 rounded-2xl bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-white/10 flex flex-col items-center text-center">
            <h3 className="font-bold text-base self-start mb-4">ATS Analysis Score</h3>

            <div className="relative w-48 h-48 flex items-center justify-center my-4">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  stroke="currentColor"
                  strokeWidth="12"
                  className="text-slate-200 dark:text-white/10"
                  fill="transparent"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  stroke="url(#atsGrad)"
                  strokeWidth="12"
                  strokeDasharray={314}
                  strokeDashoffset={314 - (314 * (analysis.atsCompatibilityScore || 0)) / 100}
                  strokeLinecap="round"
                  fill="transparent"
                />
                <defs>
                  <linearGradient id="atsGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#8B5CF6" />
                    <stop offset="100%" stopColor="#4F46E5" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-extrabold">{analysis.atsCompatibilityScore}%</span>
                <span className="text-xs text-slate-400 font-semibold">ATS Score</span>
              </div>
            </div>

            <p className="font-bold text-base mt-2 flex items-center gap-1.5">
              <FileText size={16} className="text-violet-400" />
              {resumeDoc?.fileName || 'Uploaded Resume'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Overall Quality Score: <strong>{analysis.overallScore}/100</strong>
            </p>

            <button
              onClick={startResumeBasedInterview}
              className="mt-6 w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-violet-600/25"
            >
              <Play size={16} /> Start Resume-Based Mock Interview
            </button>
          </div>

          <div className="lg:col-span-7 space-y-6">
            <div className="p-6 rounded-2xl bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-white/10">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-sm">Keyword Match ({analysis.targetJobRole})</span>
                <span className="text-sm font-bold text-violet-400">
                  {analysis.keywordMatchPercentage}%
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-600 to-indigo-500"
                  style={{ width: `${analysis.keywordMatchPercentage}%` }}
                />
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-white/10 space-y-2.5">
              <h3 className="font-bold text-sm mb-3">Formatting & ATS Feedback</h3>
              {analysis.formattingFeedback?.map((item, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl flex items-center gap-3 text-xs font-medium ${
                    item.status === 'pass'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-amber-500/10 text-amber-400'
                  }`}
                >
                  {item.status === 'pass' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                  <span>{item.message}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="p-5 rounded-2xl bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-white/10">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 mb-3">
                  Extracted Skills
                </h4>
                <div className="flex flex-wrap gap-2">
                  {analysis.extractedSkills?.map((skill) => (
                    <span
                      key={skill}
                      className="px-3 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-medium"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-white/10">
                <h4 className="font-bold text-xs uppercase tracking-wider text-amber-400 mb-3">
                  Missing High-Value Keywords
                </h4>
                <div className="flex flex-wrap gap-2">
                  {analysis.missingKeywords?.map((kw) => (
                    <span
                      key={kw}
                      className="px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-medium"
                    >
                      + {kw}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-white/10 space-y-4">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Sparkles size={16} className="text-violet-400" /> AI Bullet Point Improvements
              </h3>
              {analysis.bulletPointImprovements?.map((b, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 space-y-2 text-xs">
                  <p className="text-rose-400 line-through">Original: {b.original}</p>
                  <p className="text-emerald-400 font-semibold">Improved: {b.improved}</p>
                  <p className="text-slate-400 italic">{b.impactExplanation}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
