import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Video,
  FileSearch,
  Sparkles,
  BarChart3,
  History,
  Bookmark,
  UserCog,
  ShieldAlert,
  Sun,
  Moon,
  LogOut,
  ChevronLeft,
  ChevronRight,
  BrainCircuit,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

const candidateNavItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/mock-interview', icon: Video, label: 'Live Video Interview' },
  { to: '/resume-analyzer', icon: FileSearch, label: 'Resume Analyzer' },
  { to: '/question-generator', icon: Sparkles, label: 'Question Generator' },
  { to: '/analytics', icon: BarChart3, label: 'Performance & Insights' },
  { to: '/interview-history', icon: History, label: 'Interview History' },
  { to: '/saved-questions', icon: Bookmark, label: 'Saved Questions' },
  { to: '/profile', icon: UserCog, label: 'Profile & Settings' },
];

const adminNavItems = [
  { to: '/admin/proctoring', icon: ShieldAlert, label: 'Admin Monitor & Reports' },
  { to: '/profile', icon: UserCog, label: 'Admin Profile' },
];

export default function AppShell({ children, title }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const isAdmin = user?.role === 'admin';
  const navItems = isAdmin ? adminNavItems : candidateNavItems;

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-obsidian-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Mobile Slide-Over Sidebar Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-obsidian-950/80 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-[82vw] bg-white dark:bg-obsidian-900 border-r border-slate-200 dark:border-white/10 flex flex-col justify-between p-4 z-10 shadow-2xl">
            <div>
              <div className="flex items-center justify-between mb-6 px-1">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-lg ${
                      isAdmin
                        ? 'bg-gradient-to-br from-rose-600 to-amber-600'
                        : 'bg-gradient-to-br from-violet-600 to-indigo-600'
                    }`}
                  >
                    <BrainCircuit className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-base tracking-tight bg-gradient-to-r from-violet-600 to-indigo-400 bg-clip-text text-transparent">
                      InterviewIQ
                    </span>
                    <span className="block text-[10px] uppercase tracking-widest text-slate-400">
                      {isAdmin ? 'Admin Control' : 'Candidate Studio'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-300"
                >
                  <X size={18} />
                </button>
              </div>

              <nav className="space-y-1.5">
                {navItems.map(({ to, icon: Icon, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3.5 py-3 rounded-xl font-medium text-sm transition-all ${
                        isActive
                          ? isAdmin
                            ? 'bg-gradient-to-r from-rose-600 to-amber-600 text-white shadow-md'
                            : 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                      }`
                    }
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span>{label}</span>
                  </NavLink>
                ))}
              </nav>
            </div>

            <div className="pt-4 border-t border-slate-200/80 dark:border-white/10 space-y-3">
              <div className="p-3 rounded-2xl bg-violet-600/10 border border-violet-500/20">
                <p className="text-xs font-semibold text-violet-500 dark:text-violet-300">
                  {user?.fullName}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {user?.email}
                </p>
              </div>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                  navigate('/login');
                }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-rose-500 hover:bg-rose-500/10 transition-colors"
              >
                <LogOut className="w-5 h-5 shrink-0" />
                <span>Sign Out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside
        className={`${
          collapsed ? 'w-20' : 'w-64'
        } hidden md:flex flex-col justify-between border-r border-slate-200/80 dark:border-white/10 bg-white dark:bg-obsidian-900 transition-all duration-300 z-30 shrink-0`}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-8 px-2">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg ${
                  isAdmin
                    ? 'bg-gradient-to-br from-rose-600 to-amber-600 shadow-rose-600/30'
                    : 'bg-gradient-to-br from-violet-600 to-indigo-600 shadow-violet-600/30'
                }`}
              >
                <BrainCircuit className="w-6 h-6" />
              </div>
              {!collapsed && (
                <div>
                  <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-violet-600 to-indigo-400 bg-clip-text text-transparent">
                    InterviewIQ
                  </span>
                  <span className="block text-[10px] uppercase tracking-widest text-slate-400">
                    {isAdmin ? 'Admin Control Center' : 'Candidate Studio'}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400"
            >
              {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </div>

          <nav className="space-y-1.5">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                    isActive
                      ? isAdmin
                        ? 'bg-gradient-to-r from-rose-600 to-amber-600 text-white shadow-md shadow-rose-600/25'
                        : 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-600/25'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
                  }`
                }
              >
                <Icon className="w-5 h-5 shrink-0" />
                {!collapsed && <span>{label}</span>}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-200/80 dark:border-white/10 space-y-3">
          {!collapsed && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-violet-600/15 via-indigo-600/10 to-transparent border border-violet-500/20">
              <p className="text-xs font-semibold text-violet-600 dark:text-violet-300">
                {isAdmin ? 'Administrator Mode' : 'Candidate Mode'}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {isAdmin ? 'Live Video & Full Report Verification' : `Target: ${user?.targetJobRole}`}
              </p>
            </div>
          )}
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-rose-500 hover:bg-rose-500/10 transition-colors"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 sm:h-16 border-b border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-obsidian-900/80 backdrop-blur-md px-3.5 sm:px-6 flex items-center justify-between sticky top-0 z-20 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open Navigation Menu"
              className="md:hidden p-2 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300 shrink-0"
            >
              <Menu size={18} />
            </button>
            <h1 className="text-sm sm:text-lg font-bold tracking-tight truncate">{title}</h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <button
              onClick={toggleTheme}
              aria-label="Toggle Theme"
              className="p-2 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300"
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            <div className="flex items-center gap-2.5 pl-2 sm:pl-3 border-l border-slate-200 dark:border-white/10">
              <div
                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-white font-bold text-xs sm:text-sm ${
                  isAdmin
                    ? 'bg-gradient-to-tr from-rose-600 to-amber-500'
                    : 'bg-gradient-to-tr from-violet-600 to-fuchsia-500'
                }`}
              >
                {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-semibold leading-none">{user?.fullName}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {isAdmin ? 'Proctoring Administrator' : user?.experienceLevel}
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
