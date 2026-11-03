import React from 'react';
import { Link } from 'react-router-dom';
import { BrainCircuit, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-white">
      <header className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
            <BrainCircuit className="w-6 h-6" />
          </div>
          <span className="font-bold text-xl tracking-tight">InterviewIQ</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <Link
            to="/admin-login"
            className="px-3.5 py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25 text-xs font-bold"
          >
            Admin Portal Sign In
          </Link>
          <Link to="/login" className="text-sm text-slate-300 hover:text-white">
            Candidate Sign In
          </Link>
          <Link
            to="/register"
            className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm font-semibold"
          >
            Start Practicing Free
          </Link>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 pt-20 pb-24 text-center">
        <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-300 text-xs font-semibold mb-6">
          <Sparkles size={14} /> Powered by Google Gemini 2.5 Flash
        </span>
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight">
          Your Personal{' '}
          <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400 bg-clip-text text-transparent">
            AI Interview Coach.
          </span>
        </h1>
        <p className="text-slate-400 max-w-2xl mx-auto text-base sm:text-lg mt-6">
          Practice realistic technical, behavioral, and resume-driven mock interviews with adaptive
          follow-up questions, 6-axis rubric evaluations, and ATS resume intelligence.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            to="/register"
            className="px-7 py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 font-bold text-sm shadow-xl shadow-violet-600/30 flex items-center gap-2"
          >
            Start Practicing Free <ArrowRight size={16} />
          </Link>
          <Link
            to="/login"
            className="px-7 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 font-semibold text-sm"
          >
            Explore Dashboard Demo
          </Link>
        </div>
      </section>

      <section id="features" className="max-w-6xl mx-auto px-6 py-16 grid sm:grid-cols-3 gap-6">
        {[
          {
            title: 'Adaptive AI Mock Interviews',
            desc: 'Conducts realistic role-specific interviews with dynamic follow-up probing and voice dictation.',
          },
          {
            title: 'ATS Resume Analyzer',
            desc: 'Extracts skills, scores ATS compatibility, identifies missing keywords, and rewrites weak bullets.',
          },
          {
            title: '6-Axis Answer Evaluation',
            desc: 'Scores technical accuracy, communication, problem-solving, clarity, and provides sample senior answers.',
          },
        ].map((f) => (
          <div
            key={f.title}
            className="p-6 rounded-2xl bg-obsidian-900 border border-white/10 space-y-2"
          >
            <CheckCircle2 className="text-violet-400 w-6 h-6" />
            <h3 className="font-bold text-base">{f.title}</h3>
            <p className="text-xs text-slate-400 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
