import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BrainCircuit,
  ShieldAlert,
  UserCheck,
  KeyRound,
  Eye,
  EyeOff,
  MailCheck,
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AuthPage({ mode = 'login', defaultRole = 'candidate' }) {
  const {
    login,
    register,
    googleLogin,
    sendForgotOtp,
    verifyForgotOtp,
    resetPasswordAfterOtp,
  } = useAuth();
  const navigate = useNavigate();

  // viewMode: 'login' | 'register' | 'forgot'
  const [viewMode, setViewMode] = useState(mode);
  const [roleTab, setRoleTab] = useState(mode === 'login' ? defaultRole : 'candidate');

  const [form, setForm] = useState({
    fullName: '',
    email: mode === 'login' && defaultRole === 'admin' ? 'admin@interviewiq.com' : '',
    password: mode === 'login' && defaultRole === 'admin' ? 'Admin@1234' : '',
    confirmPassword: '',
  });

  // 3-Step OTP Forgot Password States
  const [forgotStep, setForgotStep] = useState(1);
  const [otpCode, setOtpCode] = useState('');
  const [devOtpHint, setDevOtpHint] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const activeGoogleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setViewMode(mode);
    setError('');
    setStatusMessage('');
    setDevOtpHint('');
    if (mode !== 'login') {
      setRoleTab('candidate');
      setForm((prev) => ({
        ...prev,
        email: prev.email === 'admin@interviewiq.com' ? '' : prev.email,
        password: prev.email === 'admin@interviewiq.com' ? '' : prev.password,
      }));
    } else if (defaultRole === 'admin') {
      setRoleTab('admin');
      setForm((prev) => ({
        ...prev,
        email: 'admin@interviewiq.com',
        password: 'Admin@1234',
      }));
    }
  }, [mode, defaultRole]);

  const switchRoleTab = (selectedRole) => {
    if (viewMode !== 'login' && selectedRole === 'admin') return;
    setRoleTab(selectedRole);
    setError('');
    setStatusMessage('');
    if (selectedRole === 'admin') {
      setForm({
        ...form,
        email: 'admin@interviewiq.com',
        password: 'Admin@1234',
      });
    } else if (selectedRole === 'candidate' && form.email === 'admin@interviewiq.com') {
      setForm({
        ...form,
        email: '',
        password: '',
      });
    }
  };

  // Launch Official Google OAuth 2.0 Account Chooser Popup
  const handleRealGoogleOAuth = () => {
    setError('');
    if (
      !activeGoogleClientId ||
      activeGoogleClientId === 'your_google_oauth_client_id.apps.googleusercontent.com'
    ) {
      setError(
        'Please set VITE_GOOGLE_CLIENT_ID in your client/.env file to use Google Sign-In.'
      );
      return;
    }

    if (!window.google?.accounts?.oauth2) {
      setError(
        'Google Identity Services script is still loading. Please check your internet connection and try again.'
      );
      return;
    }

    try {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: activeGoogleClientId,
        scope: 'openid email profile',
        prompt: 'select_account',
        callback: async (tokenResponse) => {
          if (tokenResponse?.error) {
            setError(`Google Sign-In error: ${tokenResponse.error}`);
            return;
          }
          if (tokenResponse?.access_token) {
            setSubmitting(true);
            try {
              await googleLogin({ accessToken: tokenResponse.access_token });
              navigate('/dashboard', { replace: true });
            } catch (err) {
              setError(
                err.response?.data?.message || 'Failed to verify Google account on server.'
              );
            } finally {
              setSubmitting(false);
            }
          }
        },
      });

      tokenClient.requestAccessToken();
    } catch {
      setError(
        'Google Sign-In initialization failed. Ensure your VITE_GOOGLE_CLIENT_ID is valid.'
      );
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setStatusMessage('');
    setSubmitting(true);

    try {
      if (viewMode === 'login') {
        const data = await login(form.email, form.password, roleTab);
        if (data.user?.role === 'admin') {
          navigate('/admin/proctoring', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      } else if (viewMode === 'register') {
        if (form.password.length < 6) {
          setError('Password must be at least 6 characters long.');
          setSubmitting(false);
          return;
        }
        if (form.password !== form.confirmPassword) {
          setError('Password and Confirm Password do not match.');
          setSubmitting(false);
          return;
        }
        await register({
          fullName: form.fullName.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          confirmPassword: form.confirmPassword,
        });
        navigate('/dashboard', { replace: true });
      } else if (viewMode === 'forgot') {
        if (forgotStep === 1) {
          const data = await sendForgotOtp(form.email);
          setStatusMessage(data.message);
          if (data.devOtpPreview) {
            setDevOtpHint(data.devOtpPreview);
          }
          setForgotStep(2);
        } else if (forgotStep === 2) {
          if (otpCode.trim().length !== 6) {
            setError('Please enter the 6-digit OTP code.');
            setSubmitting(false);
            return;
          }
          const data = await verifyForgotOtp(form.email, otpCode);
          setStatusMessage(data.message);
          setForgotStep(3);
        } else if (forgotStep === 3) {
          if (form.password.length < 6) {
            setError('New password must be at least 6 characters long.');
            setSubmitting(false);
            return;
          }
          if (form.password !== form.confirmPassword) {
            setError('New password and Confirm Password do not match.');
            setSubmitting(false);
            return;
          }
          const data = await resetPasswordAfterOtp({
            email: form.email,
            otp: otpCode,
            newPassword: form.password,
            confirmPassword: form.confirmPassword,
          });
          setStatusMessage(data.message || 'Password updated! Redirecting...');
          setTimeout(() => {
            navigate('/dashboard', { replace: true });
          }, 700);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Operation failed. Please check your details.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-obsidian-950 text-white flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-obsidian-900 border border-white/10 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center shrink-0">
            <BrainCircuit className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg sm:text-xl">InterviewIQ</h1>
            <p className="text-xs text-slate-400">
              {viewMode === 'forgot'
                ? 'Candidate OTP Password Reset'
                : roleTab === 'admin'
                ? 'Administrator Sign-In Portal (Authorized Only)'
                : viewMode === 'login'
                ? 'Candidate Sign-In Portal'
                : 'Candidate Account Registration'}
            </p>
          </div>
        </div>

        {/* Role Selector Tabs ONLY on Sign-In Page */}
        {viewMode === 'login' && (
          <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-obsidian-950 border border-white/10 mb-6">
            <button
              type="button"
              onClick={() => switchRoleTab('candidate')}
              className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                roleTab === 'candidate'
                  ? 'bg-violet-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserCheck size={15} /> Candidate Sign In
            </button>
            <button
              type="button"
              onClick={() => switchRoleTab('admin')}
              className={`py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 justify-center transition ${
                roleTab === 'admin'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShieldAlert size={15} /> Admin Sign In
            </button>
          </div>
        )}

        {viewMode === 'register' && (
          <div className="mb-5 p-3 rounded-2xl bg-violet-500/10 border border-violet-500/20 text-xs text-violet-200 flex items-center gap-2">
            <UserCheck size={16} className="text-violet-400 shrink-0" />
            <span>Create your Candidate account or Sign Up with your Google account below.</span>
          </div>
        )}

        {roleTab === 'admin' && viewMode === 'login' && (
          <div className="mb-4 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold flex items-center gap-1.5 text-rose-300">
                <KeyRound size={14} /> Admin Sign-In Credentials:
              </span>
            </div>
            <p className="font-mono text-[11px] text-slate-300 break-all">
              Email: <strong>admin@interviewiq.com</strong> | Pass: <strong>Admin@1234</strong>
            </p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300">
            {error}
          </div>
        )}

        {statusMessage && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300 flex items-start gap-2">
            <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
            <div>
              <span>{statusMessage}</span>
              {devOtpHint && (
                <p className="mt-1 font-mono text-amber-300 font-bold">
                  Local Dev OTP Code: {devOtpHint}
                </p>
              )}
            </div>
          </div>
        )}

        {/* REAL Google OAuth 2.0 Sign-Up / Sign-In Button for Normal Candidates (Gear icon removed!) */}
        {roleTab === 'candidate' && viewMode !== 'forgot' && (
          <>
            <button
              type="button"
              onClick={handleRealGoogleOAuth}
              className="w-full py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs flex items-center justify-center gap-2.5 shadow-md transition mb-4"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
                />
              </svg>
              <span>
                {viewMode === 'register'
                  ? 'Sign Up with Google Account'
                  : 'Continue with Google Account'}
              </span>
            </button>

            <div className="relative flex py-2 items-center mb-4">
              <div className="flex-grow border-t border-white/10" />
              <span className="flex-shrink mx-3 text-[11px] uppercase text-slate-500">
                Or with Email &amp; Password
              </span>
              <div className="flex-grow border-t border-white/10" />
            </div>
          </>
        )}

        {/* Main Form: Login / Register / 3-Step OTP Forgot Password */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {viewMode === 'register' && (
            <input
              type="text"
              placeholder="Candidate Full Name"
              required
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="w-full p-3 rounded-xl bg-obsidian-950 border border-white/10 text-sm focus:outline-none focus:border-violet-500"
            />
          )}

          <input
            type="email"
            placeholder={
              roleTab === 'admin' ? 'Admin Email Address' : 'Candidate Email Address'
            }
            required
            disabled={viewMode === 'forgot' && forgotStep > 1}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full p-3 rounded-xl bg-obsidian-950 border border-white/10 text-sm focus:outline-none focus:border-violet-500 disabled:opacity-60"
          />

          {/* FORGOT PASSWORD STEP 2: ENTER 6-DIGIT EMAIL OTP */}
          {viewMode === 'forgot' && forgotStep === 2 && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/30 text-xs text-violet-200 flex items-center gap-2">
                <MailCheck size={16} className="text-violet-400 shrink-0" />
                <span>Enter the 6-digit OTP verification code sent to your email:</span>
              </div>
              <input
                type="text"
                maxLength={6}
                required
                placeholder="Enter 6-Digit OTP"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                className="w-full p-3.5 rounded-xl bg-obsidian-950 border border-violet-500/50 text-center font-mono text-lg tracking-[0.35em] font-bold focus:outline-none focus:border-violet-400"
              />
              <div className="flex justify-between items-center text-xs">
                <button
                  type="button"
                  onClick={async () => {
                    setError('');
                    try {
                      const data = await sendForgotOtp(form.email);
                      setStatusMessage('A new 6-digit OTP has been sent!');
                      if (data.devOtpPreview) setDevOtpHint(data.devOtpPreview);
                    } catch (err) {
                      setError(err.response?.data?.message || 'Failed to resend OTP');
                    }
                  }}
                  className="text-violet-400 hover:underline"
                >
                  Resend OTP Code
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setForgotStep(1);
                    setOtpCode('');
                    setStatusMessage('');
                  }}
                  className="text-slate-400 hover:text-white"
                >
                  Change Email
                </button>
              </div>
            </div>
          )}

          {/* FORGOT PASSWORD STEP 3: OTP VERIFIED -> ENTER NEW PASSWORD */}
          {viewMode === 'forgot' && forgotStep === 3 && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200 flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
              <span>OTP Verified! Enter your new password below:</span>
            </div>
          )}

          {(viewMode !== 'forgot' || forgotStep === 3) && (
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder={
                  viewMode === 'forgot'
                    ? 'Enter New Password (min 6 chars)'
                    : 'Password (min 6 chars)'
                }
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full p-3 pr-10 rounded-xl bg-obsidian-950 border border-white/10 text-sm focus:outline-none focus:border-violet-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          )}

          {(viewMode === 'register' || (viewMode === 'forgot' && forgotStep === 3)) && (
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Confirm Password"
              required
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              className="w-full p-3 rounded-xl bg-obsidian-950 border border-white/10 text-sm focus:outline-none focus:border-violet-500"
            />
          )}

          {/* Forgot Password Link for Normal Candidates on Login View */}
          {viewMode === 'login' && roleTab === 'candidate' && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setViewMode('forgot');
                  setForgotStep(1);
                  setOtpCode('');
                  setDevOtpHint('');
                  setError('');
                  setStatusMessage('');
                  setForm({ ...form, password: '', confirmPassword: '' });
                }}
                className="text-xs text-violet-400 hover:underline font-medium"
              >
                Forgot Password?
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className={`w-full py-3 rounded-xl font-bold text-sm transition ${
              roleTab === 'admin' && viewMode === 'login'
                ? 'bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500'
                : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500'
            }`}
          >
            {submitting
              ? 'Please wait...'
              : viewMode === 'forgot'
              ? forgotStep === 1
                ? 'Send 6-Digit OTP to Email'
                : forgotStep === 2
                ? 'Verify 6-Digit OTP'
                : 'Update Password & Sign In'
              : viewMode === 'login'
              ? roleTab === 'admin'
                ? 'Sign In to Admin Dashboard'
                : 'Sign In as Candidate'
              : 'Register Candidate Account'}
          </button>
        </form>

        {/* Bottom Navigation Links */}
        {viewMode === 'forgot' ? (
          <button
            type="button"
            onClick={() => {
              setViewMode('login');
              setForgotStep(1);
              setOtpCode('');
              setDevOtpHint('');
              setError('');
              setStatusMessage('');
            }}
            className="w-full text-xs text-slate-400 hover:text-white flex items-center justify-center gap-1.5 mt-6"
          >
            <ArrowLeft size={14} /> Back to Candidate Sign In
          </button>
        ) : roleTab === 'candidate' ? (
          <p className="text-xs text-slate-400 text-center mt-6">
            {viewMode === 'login'
              ? "Don't have a Candidate account? "
              : 'Already have an account? '}
            <Link
              to={viewMode === 'login' ? '/register' : '/login'}
              className="text-violet-400 font-semibold hover:underline"
            >
              {viewMode === 'login' ? 'Register as Candidate' : 'Sign In'}
            </Link>
          </p>
        ) : (
          <p className="text-[11px] text-slate-500 text-center mt-6">
            Administrator accounts are pre-authorized and cannot be registered publicly.
          </p>
        )}
      </div>
    </div>
  );
}
