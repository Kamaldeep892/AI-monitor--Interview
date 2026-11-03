import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import MockInterviewSetup from './pages/MockInterviewSetup';
import InterviewRoom from './pages/InterviewRoom';
import InterviewReport from './pages/InterviewReport';
import ResumeAnalyzer from './pages/ResumeAnalyzer';
import QuestionGenerator from './pages/QuestionGenerator';
import AnalyticsPage from './pages/AnalyticsPage';
import InterviewHistory from './pages/InterviewHistory';
import ProfileSettings from './pages/ProfileSettings';
import AdminProctoringDashboard from './pages/AdminProctoringDashboard';

// Redirects already-logged-in users away from public landing/login pages straight to their dashboard
const PublicOrRedirect = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-obsidian-950" />;
  if (user) {
    return <Navigate to={user.role === 'admin' ? '/admin/proctoring' : '/dashboard'} replace />;
  }
  return children;
};

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-obsidian-950" />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

const CandidateOnlyRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-obsidian-950" />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'admin') return <Navigate to="/admin/proctoring" replace />;
  return children;
};

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-obsidian-950" />;
  if (!user) return <Navigate to="/admin-login" replace />;
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<PublicOrRedirect><LandingPage /></PublicOrRedirect>} />
            <Route path="/features" element={<PublicOrRedirect><LandingPage section="features" /></PublicOrRedirect>} />
            <Route path="/pricing" element={<PublicOrRedirect><LandingPage section="pricing" /></PublicOrRedirect>} />
            <Route path="/login" element={<PublicOrRedirect><AuthPage mode="login" defaultRole="candidate" /></PublicOrRedirect>} />
            <Route path="/admin-login" element={<PublicOrRedirect><AuthPage mode="login" defaultRole="admin" /></PublicOrRedirect>} />
            <Route path="/register" element={<PublicOrRedirect><AuthPage mode="register" defaultRole="candidate" /></PublicOrRedirect>} />
            <Route path="/forgot-password" element={<PublicOrRedirect><AuthPage mode="forgot" defaultRole="candidate" /></PublicOrRedirect>} />

            <Route path="/dashboard" element={<CandidateOnlyRoute><Dashboard /></CandidateOnlyRoute>} />
            <Route path="/mock-interview" element={<CandidateOnlyRoute><MockInterviewSetup /></CandidateOnlyRoute>} />
            <Route path="/resume-interview" element={<CandidateOnlyRoute><MockInterviewSetup defaultType="Resume-Based" /></CandidateOnlyRoute>} />
            <Route path="/interview/:sessionId" element={<CandidateOnlyRoute><InterviewRoom /></CandidateOnlyRoute>} />
            <Route path="/resume-analyzer" element={<CandidateOnlyRoute><ResumeAnalyzer /></CandidateOnlyRoute>} />
            <Route path="/question-generator" element={<CandidateOnlyRoute><QuestionGenerator /></CandidateOnlyRoute>} />
            <Route path="/saved-questions" element={<CandidateOnlyRoute><QuestionGenerator savedView /></CandidateOnlyRoute>} />
            <Route path="/analytics" element={<CandidateOnlyRoute><AnalyticsPage /></CandidateOnlyRoute>} />
            <Route path="/interview-history" element={<CandidateOnlyRoute><InterviewHistory /></CandidateOnlyRoute>} />

            <Route path="/interview-report/:sessionId" element={<ProtectedRoute><InterviewReport /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfileSettings /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><ProfileSettings /></ProtectedRoute>} />

            <Route path="/admin/proctoring" element={<AdminRoute><AdminProctoringDashboard /></AdminRoute>} />
            <Route path="/admin" element={<Navigate to="/admin/proctoring" replace />} />
            <Route path="*" element={<PublicOrRedirect><LandingPage /></PublicOrRedirect>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
