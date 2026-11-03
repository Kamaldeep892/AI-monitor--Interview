import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Video,
  Mic,
  Volume2,
  Monitor,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Maximize2,
  Sparkles,
  Clock,
  Smartphone,
} from 'lucide-react';
import AppShell from '../components/Layout/AppShell';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  setGlobalScreenStream,
  getGlobalScreenStream,
  stopGlobalScreenStream,
  registerMediaStream,
} from '../services/screenShareStore';

const ROLES = [
  'Full Stack Developer',
  'Frontend Developer',
  'Backend Developer',
  'Software Development Engineer (SDE)',
  'Business Solution Analyst',
  'Data Analyst',
  'Java Developer',
  'Python Developer',
  'DevOps Engineer',
];

export default function MockInterviewSetup({ defaultType }) {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Detect Mobile / Tablet device OR lack of getDisplayMedia support
  const isMobileDevice =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent || ''
    ) || typeof navigator.mediaDevices?.getDisplayMedia !== 'function';

  const [jobRole, setJobRole] = useState(user?.targetJobRole || ROLES[0]);
  const [experienceLevel, setExperienceLevel] = useState(user?.experienceLevel || 'Fresher');
  const [interviewType, setInterviewType] = useState(
    defaultType || searchParams.get('type') || 'Technical'
  );
  const [difficulty, setDifficulty] = useState('Medium');
  const [totalQuestions, setTotalQuestions] = useState(5);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(15);
  const [preferredLanguage, setPreferredLanguage] = useState('English');
  const [resumes, setResumes] = useState([]);
  const [selectedResumeId, setSelectedResumeId] = useState('');

  // Hardware Readiness States (1. Camera & Mic, 2. AI Voice Output, 3. Share Screen Once)
  const [hardwareTested, setHardwareTested] = useState(false);
  const [cameraOk, setCameraOk] = useState(false);
  const [micOk, setMicOk] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [speakerTested, setSpeakerTested] = useState(false);
  const [screenShareOk, setScreenShareOk] = useState(
    isMobileDevice || Boolean(getGlobalScreenStream()?.active)
  );
  const [consentChecked, setConsentChecked] = useState(false);
  const [hardwareError, setHardwareError] = useState('');
  const [starting, setStarting] = useState(false);

  const previewVideoRef = useRef(null);
  const screenPreviewRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const animFrameRef = useRef(null);

  useEffect(() => {
    api.get('/resumes').then(({ data }) => {
      setResumes(data.resumes || []);
      if (data.resumes?.[0]) setSelectedResumeId(data.resumes[0]._id);
    });

    const existingScreen = getGlobalScreenStream();
    if (existingScreen && existingScreen.active) {
      setScreenShareOk(true);
      if (screenPreviewRef.current) {
        screenPreviewRef.current.srcObject = existingScreen;
        screenPreviewRef.current.play().catch(() => {});
      }
    }

    return () => {
      stopCameraMicPreview();
    };
  }, []);

  const stopCameraMicPreview = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
    }
    if (previewVideoRef.current) {
      previewVideoRef.current.srcObject = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
          t.enabled = false;
        } catch {}
      });
      mediaStreamRef.current = null;
    }
  };

  // STEP 1: Enable Camera & Mic
  const runHardwareDiagnostics = async () => {
    setHardwareError('');
    try {
      stopCameraMicPreview();
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
      }

      mediaStreamRef.current = stream;
      registerMediaStream(stream);

      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = stream;
        previewVideoRef.current.play().catch(() => {});
      }

      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];
      setCameraOk(Boolean(videoTrack && videoTrack.readyState === 'live'));
      setMicOk(Boolean(audioTrack && audioTrack.readyState === 'live'));
      setHardwareTested(true);

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateMeter = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setMicLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animFrameRef.current = requestAnimationFrame(updateMeter);
      };
      updateMeter();
    } catch {
      setHardwareError(
        'Camera and Microphone access are mandatory. Please allow permissions in your browser.'
      );
      setCameraOk(false);
      setMicOk(false);
    }
  };

  // STEP 2: Test AI Voice Output
  const testInterviewerVoice = () => {
    if (!('speechSynthesis' in window)) {
      setSpeakerTested(true);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(
      'Hello! Your audio output is ready for the live interview.'
    );
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
    setSpeakerTested(true);
  };

  // STEP 3: Share Screen (Asked ONLY ONCE right here alongside Camera/Mic & Voice!)
  const handleEnableScreenShareOnce = async () => {
    setHardwareError('');
    if (isMobileDevice) {
      setScreenShareOk(true);
      return;
    }
    try {
      stopGlobalScreenStream();
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
          cursor: 'always',
        },
        audio: false,
      });

      const screenTrack = screenStream.getVideoTracks()[0];
      setGlobalScreenStream(screenStream);
      setScreenShareOk(true);

      if (screenPreviewRef.current) {
        screenPreviewRef.current.srcObject = screenStream;
        screenPreviewRef.current.play().catch(() => {});
      }

      if (screenTrack) {
        screenTrack.onended = () => {
          setScreenShareOk(false);
        };
      }
    } catch {
      setHardwareError(
        'Please select your screen and click Share to enable live screen monitoring.'
      );
      setScreenShareOk(false);
    }
  };

  // Start Interview Immediately (Uses the already-shared screen stream without asking a second time!)
  const handleStartLiveInterview = async (e) => {
    e.preventDefault();
    setHardwareError('');

    if (!cameraOk || !micOk) {
      setHardwareError('Please complete Step 1: Enable Camera & Mic.');
      return;
    }
    if (!screenShareOk && !isMobileDevice) {
      setHardwareError('Please complete Step 3: Share Screen.');
      return;
    }
    if (!consentChecked) {
      setHardwareError('Please check the proctoring consent box below.');
      return;
    }

    setStarting(true);
    try {
      if (!isMobileDevice && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen().catch(() => {});
      }

      stopCameraMicPreview();

      const { data } = await api.post('/interviews/start', {
        jobRole,
        experienceLevel,
        interviewType,
        difficulty,
        totalQuestions,
        timeLimitMinutes,
        preferredLanguage,
        resumeId: interviewType === 'Resume-Based' ? selectedResumeId : null,
      });

      await api.post(`/proctoring/sessions/${data.session._id}/consent`);
      navigate(`/interview/${data.session._id}`);
    } catch (err) {
      setHardwareError(
        err.response?.data?.message || 'Failed to initialize live video interview'
      );
    } finally {
      setStarting(false);
    }
  };

  return (
    <AppShell title="Pre-Interview System Check & Proctoring Setup">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-8">
        {/* Left Column: Interview Role, Questions & Fixed Timer Setup */}
        <div className="lg:col-span-6 p-5 sm:p-7 rounded-3xl bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-white/10 shadow-lg space-y-4 sm:space-y-5">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-violet-600/15 text-violet-400 shrink-0">
              <Sparkles size={22} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">1. Interview Parameters &amp; Fixed Timer</h2>
              <p className="text-xs text-slate-400">
                Configure role, question count, and fixed interview time limit
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">
              Target Job Role
            </label>
            <select
              value={jobRole}
              onChange={(e) => setJobRole(e.target.value)}
              className="w-full p-3 rounded-xl bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-white/10 text-sm"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">
                Experience Level
              </label>
              <select
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-white/10 text-sm"
              >
                {['Fresher', '0–1 Year', '1–3 Years', '3–5 Years', '5+ Years'].map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">
                Interview Category
              </label>
              <select
                value={interviewType}
                onChange={(e) => setInterviewType(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-white/10 text-sm"
              >
                {['Technical', 'HR', 'Behavioral', 'Mixed', 'Resume-Based'].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {interviewType === 'Resume-Based' && (
            <div>
              <label className="block text-xs font-semibold uppercase text-violet-400 mb-1.5">
                Select Uploaded Resume
              </label>
              {resumes.length > 0 ? (
                <select
                  value={selectedResumeId}
                  onChange={(e) => setSelectedResumeId(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-obsidian-950 border border-violet-500/40 text-sm"
                >
                  {resumes.map((r) => (
                    <option key={r._id} value={r._id}>
                      {r.fileName} ({new Date(r.createdAt).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-amber-400">
                  Upload a resume in the Resume Analyzer first to enable project-specific probing.
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">
                Difficulty
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-white/10 text-sm"
              >
                {['Easy', 'Medium', 'Hard'].map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">
                Questions
              </label>
              <select
                value={totalQuestions}
                onChange={(e) => {
                  const qCount = Number(e.target.value);
                  setTotalQuestions(qCount);
                  setTimeLimitMinutes(qCount * 3);
                }}
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-white/10 text-sm"
              >
                {[5, 10, 15].map((n) => (
                  <option key={n} value={n}>
                    {n} Qs
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-amber-400 mb-1.5 flex items-center gap-1">
                <Clock size={12} /> Fixed Timer
              </label>
              <select
                value={timeLimitMinutes}
                onChange={(e) => setTimeLimitMinutes(Number(e.target.value))}
                className="w-full p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold text-sm"
              >
                {[10, 15, 20, 30, 45].map((mins) => (
                  <option key={mins} value={mins} className="bg-obsidian-950 text-white">
                    {mins} Mins
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">
                Language
              </label>
              <input
                type="text"
                value={preferredLanguage}
                onChange={(e) => setPreferredLanguage(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-white/10 text-sm"
              />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2 text-xs">
            <h3 className="font-bold text-sm flex items-center gap-2 text-violet-400">
              <ShieldCheck size={16} /> Fixed Interview Timer &amp; Proctoring Rules
            </h3>
            <ul className="list-disc pl-4 space-y-1 text-slate-500 dark:text-slate-300">
              <li>
                <strong>Fixed Time Limit ({timeLimitMinutes} Minutes):</strong> A live countdown timer runs at the top of the interview room. If the timer reaches <code className="text-rose-400">00:00</code>, the interview automatically submits and saves your recording.
              </li>
              <li>
                Complete all 3 hardware steps on the right (Camera &amp; Mic, AI Voice, and Share Screen once), then click Start Interview.
              </li>
              <li>Works seamlessly on both <strong>Desktop/Laptop</strong> and <strong>Mobile Smartphones</strong>.</li>
            </ul>
          </div>
        </div>

        {/* Right Column: 3-Step Hardware Check (1. Camera & Mic, 2. AI Voice, 3. Share Screen Once) */}
        <div className="lg:col-span-6 p-5 sm:p-7 rounded-3xl bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-white/10 shadow-lg flex flex-col justify-between space-y-5">
          <div>
            <h2 className="text-base sm:text-lg font-bold mb-1">
              2. Hardware &amp; Screen Share Check (One-Time Setup)
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Enable your Camera &amp; Mic, test AI Voice Output, and Share Screen once below—then start your interview immediately.
            </p>

            {/* Dual Preview: Camera Preview & Screen Share Preview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {/* Webcam Preview */}
              <div className="relative aspect-video rounded-2xl overflow-hidden bg-obsidian-950 border border-white/10 flex items-center justify-center">
                <video
                  ref={previewVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover scale-x-[-1] ${
                    hardwareTested ? 'block' : 'hidden'
                  }`}
                />
                {!hardwareTested && (
                  <div className="text-center p-3">
                    <Video className="w-8 h-8 text-violet-400 mx-auto mb-1.5 opacity-80" />
                    <p className="text-[11px] text-slate-400">1. Camera &amp; Mic Preview</p>
                  </div>
                )}
                {cameraOk && (
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-semibold">
                    Camera Ready
                  </span>
                )}
              </div>

              {/* Screen Share Preview (or Mobile Camera Proctoring Badge) */}
              <div className="relative aspect-video rounded-2xl overflow-hidden bg-obsidian-950 border border-indigo-500/30 flex items-center justify-center">
                {!isMobileDevice ? (
                  <>
                    <video
                      ref={screenPreviewRef}
                      autoPlay
                      playsInline
                      muted
                      className={`w-full h-full object-contain bg-black ${
                        screenShareOk ? 'block' : 'hidden'
                      }`}
                    />
                    {!screenShareOk && (
                      <div className="text-center p-3">
                        <Monitor className="w-8 h-8 text-indigo-400 mx-auto mb-1.5 opacity-80" />
                        <p className="text-[11px] text-slate-400">3. Screen Share Preview</p>
                      </div>
                    )}
                    {screenShareOk && (
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 text-[10px] font-semibold">
                        Screen Shared ✓
                      </span>
                    )}
                  </>
                ) : (
                  <div className="text-center p-4 space-y-1">
                    <Smartphone className="w-8 h-8 text-emerald-400 mx-auto" />
                    <p className="text-xs font-bold text-emerald-300">Mobile Proctoring Ready</p>
                    <p className="text-[10px] text-slate-400">
                      Front camera &amp; tab-switch lock enabled for mobile device
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 3 Action Buttons: 1. Camera & Mic | 2. Test AI Voice | 3. Share Screen (Once) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-4">
              <button
                type="button"
                onClick={runHardwareDiagnostics}
                className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                  cameraOk
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'bg-violet-600/15 border-violet-500/30 text-violet-300 hover:bg-violet-600/25'
                }`}
              >
                <Video size={14} /> 1. Enable Camera &amp; Mic
              </button>

              <button
                type="button"
                onClick={testInterviewerVoice}
                className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                  speakerTested
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'bg-indigo-600/15 border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/25'
                }`}
              >
                <Volume2 size={14} /> 2. Test AI Voice Output
              </button>

              {!isMobileDevice ? (
                <button
                  type="button"
                  onClick={handleEnableScreenShareOnce}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                    screenShareOk
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : 'bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500/25'
                  }`}
                >
                  <Monitor size={14} /> {screenShareOk ? '3. Screen Shared ✓' : '3. Share Screen'}
                </button>
              ) : (
                <div className="py-2.5 px-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5">
                  <Smartphone size={14} /> 3. Mobile Ready ✓
                </div>
              )}
            </div>

            {/* Microphone Input Level Bar */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-white/10 mb-4">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="flex items-center gap-1.5 font-medium text-slate-400">
                  <Mic size={14} className={micOk ? 'text-emerald-400' : 'text-slate-500'} />
                  Microphone Input Level
                </span>
                <span className="font-mono text-xs">{micOk ? `${micLevel}%` : 'Not Connected'}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-violet-500 transition-all duration-75"
                  style={{ width: `${micLevel}%` }}
                />
              </div>
            </div>

            {/* Status Checklist */}
            <div className="grid grid-cols-3 gap-2 text-[11px] sm:text-xs mb-4">
              <div
                className={`p-2.5 rounded-xl border flex items-center gap-1.5 ${
                  cameraOk
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                    : 'border-slate-200 dark:border-white/10 text-slate-400'
                }`}
              >
                <CheckCircle2 size={14} className="shrink-0" /> Camera &amp; Mic
              </div>
              <div
                className={`p-2.5 rounded-xl border flex items-center gap-1.5 ${
                  speakerTested
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                    : 'border-slate-200 dark:border-white/10 text-slate-400'
                }`}
              >
                <CheckCircle2 size={14} className="shrink-0" /> Voice Output
              </div>
              <div
                className={`p-2.5 rounded-xl border flex items-center gap-1.5 ${
                  screenShareOk
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                    : 'border-slate-200 dark:border-white/10 text-slate-400'
                }`}
              >
                <CheckCircle2 size={14} className="shrink-0" />{' '}
                {isMobileDevice ? 'Mobile Mode' : 'Screen Shared'}
              </div>
            </div>

            {hardwareError && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-center gap-2 mb-3">
                <AlertTriangle size={16} className="shrink-0" />
                <span>{hardwareError}</span>
              </div>
            )}
          </div>

          {/* Consent & Start Interview Button */}
          <div className="space-y-4 pt-3 border-t border-slate-200 dark:border-white/10">
            <label className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
              />
              <span>
                I consent to continuous webcam video &amp; audio recording, live proctoring, and completing the interview within the fixed <strong>{timeLimitMinutes}-minute</strong> time limit.
              </span>
            </label>

            <button
              onClick={handleStartLiveInterview}
              disabled={starting || !cameraOk || !micOk || !screenShareOk || !consentChecked}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 text-white font-bold text-xs sm:text-sm shadow-lg shadow-violet-600/30 flex items-center justify-center gap-2"
            >
              <Maximize2 size={15} />
              {starting
                ? 'Launching Live Interview Studio...'
                : `Start Live Interview (${timeLimitMinutes} Mins Timer)`}
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
