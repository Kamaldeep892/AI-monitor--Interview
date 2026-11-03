import React, { useState } from 'react';
import AppShell from '../components/Layout/AppShell';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function ProfileSettings() {
  const { user, updateUserState } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [targetJobRole, setTargetJobRole] = useState(user?.targetJobRole || '');
  const [experienceLevel, setExperienceLevel] = useState(user?.experienceLevel || 'Fresher');
  const [skills, setSkills] = useState((user?.skills || []).join(', '));
  const [message, setMessage] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    const { data } = await api.put('/auth/profile', {
      fullName,
      targetJobRole,
      experienceLevel,
      skills: skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    });
    updateUserState(data.user);
    setMessage('Profile updated successfully.');
  };

  return (
    <AppShell title="Profile & Career Preferences">
      <form
        onSubmit={handleSave}
        className="max-w-xl p-6 rounded-2xl bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-white/10 space-y-4"
      >
        {message && (
          <div className="p-3 rounded-xl bg-emerald-500/15 text-emerald-400 text-xs font-semibold">
            {message}
          </div>
        )}
        <div>
          <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
            Full Name
          </label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full p-3 rounded-xl bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-white/10 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
            Target Job Role
          </label>
          <input
            value={targetJobRole}
            onChange={(e) => setTargetJobRole(e.target.value)}
            className="w-full p-3 rounded-xl bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-white/10 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
            Core Technical Skills (Comma-separated)
          </label>
          <input
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            className="w-full p-3 rounded-xl bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-white/10 text-sm"
          />
        </div>
        <button
          type="submit"
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold text-sm"
        >
          Save Profile Settings
        </button>
      </form>
    </AppShell>
  );
}
