import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Mic,
  MicOff,
  Video,
  Monitor,
  RotateCcw,
  Send,
  Lightbulb,
  Clock,
  StopCircle,
  CheckCircle2,
  ShieldAlert,
  Maximize2,
  ArrowRight,
  Sparkles,
  UserCheck,
  Trash2,
  Smartphone,
} from 'lucide-react';
import api from '../services/api';
import { socket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import {
  getGlobalScreenStream,
  setGlobalScreenStream,
  stopGlobalScreenStream,
  setGlobalCameraStream,
  registerMediaStream,
  stopAllInterviewMediaStreams,
} from '../services/screenShareStore';

export default function InterviewRoom() {
  const { sessionId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Detect Mobile / Tablet device
  const isMobileDevice =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent || ''
    ) || typeof navigator.mediaDevices?.getDisplayMedia !== 'function';

  const supportsFullscreen = Boolean(
    !isMobileDevice && document.documentElement?.requestFullscreen
  );

  // Interview Session States
  const [session, setSession] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [answer, setAnswer] = useState('');
  const [speechLang, setSpeechLang] = useState('en-IN');
  const [showHint, setShowHint] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState(null);
  const [nextQuestionPending, setNextQuestionPending] = useState(null);
  const [isCompleted, setIsCompleted] = useState(false);

  // Per-Question Elapsed & Fixed Total Interview Countdown Timer States
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const [timeUpTriggered, setTimeUpTriggered] = useState(false);

  // Voice Interaction States (TTS + STT)
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');

  // Live Video, Recording, Screen Share & Proctoring States
  const [isFullscreen, setIsFullscreen] = useState(
    !supportsFullscreen || Boolean(document.fullscreenElement)
  );
  const [screenShareActive, setScreenShareActive] = useState(
    isMobileDevice || Boolean(getGlobalScreenStream()?.active)
  );
  const [displaySurface, setDisplaySurface] = useState(
    isMobileDevice ? 'mobile_camera' : 'monitor'
  );
  const [cameraActive, setCameraActive] = useState(false);
  const [recordingActive, setRecordingActive] = useState(false);
  const [faceStatus, setFaceStatus] = useState('single_face_ok');
  const [violationCount, setViolationCount] = useState(0);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [fullscreenExitCount, setFullscreenExitCount] = useState(0);
  const [screenShareDropCount, setScreenShareDropCount] = useState(0);
  const [adminLiveNotice, setAdminLiveNotice] = useState(null);
  const [adminVerdictNotice, setAdminVerdictNotice] = useState(null);

  // Refs
  const videoRef = useRef(null);
  const screenVideoRef = useRef(null);
  const canvasRef = useRef(null);
  const screenCanvasRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  const baseTextBeforeMicRef = useRef('');
  const currentAnswerRef = useRef('');
  const tabHiddenTimestampRef = useRef(null);
  const noFaceStreakRef = useRef(0);
  const multiFaceStreakRef = useRef(0);
  const faceDetectorRef = useRef(null);

  useEffect(() => {
    currentAnswerRef.current = answer;
  }, [answer]);

  const bindWebcamToVideoElement = useCallback(() => {
    const videoEl = videoRef.current;
    const stream = mediaStreamRef.current;
    if (videoEl && stream) {
      if (videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
      }
      videoEl.play().catch(() => {});
    }
  }, []);

  const bindScreenToVideoElement = useCallback(() => {
    if (isMobileDevice) return;
    const screenEl = screenVideoRef.current;
    const stream = getGlobalScreenStream();
    if (screenEl && stream && stream.active) {
      if (screenEl.srcObject !== stream) {
        screenEl.srcObject = stream;
      }
      screenEl.play().catch(() => {});
    }
  }, [isMobileDevice]);

  useEffect(() => {
    if (session && currentQuestion) {
      bindWebcamToVideoElement();
      bindScreenToVideoElement();
    }
  }, [
    session,
    currentQuestion,
    cameraActive,
    screenShareActive,
    bindWebcamToVideoElement,
    bindScreenToVideoElement,
  ]);

  const recordViolation = useCallback(
    async (eventType, description, severity = 'medium', durationSeconds = 0, metadata = {}) => {
      try {
        const { data } = await api.post(`/proctoring/sessions/${sessionId}/events`, {
          eventType,
          description,
          severity,
          durationSeconds,
          metadata,
        });
        if (data.proctoringStatus) {
          setViolationCount(data.proctoringStatus.totalViolations || 0);
          setTabSwitchCount(data.proctoringStatus.tabSwitchCount || 0);
          setFullscreenExitCount(data.proctoringStatus.fullscreenExitCount || 0);
          setScreenShareDropCount(data.proctoringStatus.screenShareDropCount || 0);
        }
      } catch (err) {
        console.error('Failed to log proctoring event:', err);
      }
    },
    [sessionId]
  );

  // Completely shut down Webcam, Microphone, and Screen Share hardware LED immediately
  const shutDownAllCameraAndMicHardware = useCallback(() => {
    isListeningRef.current = false;
    setListening(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {}
    }
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      } catch {}
    }
    if (screenVideoRef.current) {
      try {
        screenVideoRef.current.pause();
        screenVideoRef.current.srcObject = null;
      } catch {}
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
          track.enabled = false;
        } catch {}
      });
      mediaStreamRef.current = null;
    }
    stopAllInterviewMediaStreams();
    setCameraActive(false);
    setScreenShareActive(false);
    setRecordingActive(false);
  }, []);

  // Upload HD Recorded Interview Video + Voice to Backend / Cloudinary & Shut Down Webcam Immediately
  const stopAndUploadInterviewRecording = useCallback(async () => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        shutDownAllCameraAndMicHardware();
        resolve();
        return;
      }

      setUploadingVideo(true);
      recorder.onstop = async () => {
        try {
          if (recordedChunksRef.current.length > 0) {
            const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
            const formData = new FormData();
            formData.append('recording', blob, `interview_${sessionId}.webm`);
            await api.post(`/proctoring/sessions/${sessionId}/recording`, formData);
          }
        } catch (err) {
          console.error('Recording upload error:', err);
        } finally {
          shutDownAllCameraAndMicHardware();
          setUploadingVideo(false);
          resolve();
        }
      };

      try {
        recorder.stop();
      } catch {
        shutDownAllCameraAndMicHardware();
        setUploadingVideo(false);
        resolve();
      }
    });
  }, [sessionId, shutDownAllCameraAndMicHardware]);

  const attachScreenShareStream = useCallback(
    (stream) => {
      if (isMobileDevice) {
        setScreenShareActive(true);
        return;
      }
      if (!stream || !stream.active) {
        setScreenShareActive(false);
        return;
      }
      const screenTrack = stream.getVideoTracks()[0];
      if (!screenTrack || screenTrack.readyState !== 'live') {
        setScreenShareActive(false);
        return;
      }

      const settings = screenTrack.getSettings ? screenTrack.getSettings() : {};
      const surface = settings.displaySurface || 'monitor';
      setDisplaySurface(surface);
      setScreenShareActive(true);

      setTimeout(() => {
        bindScreenToVideoElement();
      }, 100);

      screenTrack.onended = () => {
        setScreenShareActive(false);
        recordViolation(
          'SCREEN_SHARE_STOPPED',
          'Candidate stopped sharing their screen during the live interview.',
          'critical'
        );
      };
    },
    [isMobileDevice, recordViolation, bindScreenToVideoElement]
  );

  const handleResumeScreenShareIfDropped = async () => {
    if (isMobileDevice) {
      setScreenShareActive(true);
      return;
    }
    try {
      stopGlobalScreenStream();
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor', cursor: 'always' },
        audio: false,
      });
      setGlobalScreenStream(stream);
      attachScreenShareStream(stream);

      if (supportsFullscreen && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch {}
  };

  const speakQuestionAloud = useCallback((textToSpeak, welcomePrefix = '') => {
    if (!('speechSynthesis' in window) || !textToSpeak) return;
    window.speechSynthesis.cancel();

    const fullSpeech = welcomePrefix ? `${welcomePrefix} ${textToSpeak}` : textToSpeak;
    const utterance = new SpeechSynthesisUtterance(fullSpeech);
    utterance.lang = 'en-US';
    utterance.rate = 0.98;
    utterance.pitch = 1.0;

    utterance.onstart = () => setAiSpeaking(true);
    utterance.onend = () => setAiSpeaking(false);
    utterance.onerror = () => setAiSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, []);

  // 1. Load Session & Initialize Fixed Countdown Timer
  useEffect(() => {
    let mounted = true;
    const initSession = async () => {
      try {
        const { data } = await api.get(`/interviews/${sessionId}`);
        if (!mounted) return;
        const sess = data.session;
        setSession(sess);
        setViolationCount(sess.proctoring?.totalViolations || 0);
        setTabSwitchCount(sess.proctoring?.tabSwitchCount || 0);
        setFullscreenExitCount(sess.proctoring?.fullscreenExitCount || 0);
        setScreenShareDropCount(sess.proctoring?.screenShareDropCount || 0);

        const totalLimitSeconds = (sess.timeLimitMinutes || 15) * 60;
        setRemainingSeconds(totalLimitSeconds);

        const unanswered = sess.questions.find((q) => !q.isAnswered);
        if (!unanswered || sess.status === 'completed') {
          stopAllInterviewMediaStreams();
          navigate(`/interview-report/${sessionId}`);
          return;
        }
        setCurrentQuestion(unanswered);

        if (isMobileDevice) {
          setScreenShareActive(true);
        } else {
          const existingScreenStream = getGlobalScreenStream();
          if (existingScreenStream && existingScreenStream.active) {
            attachScreenShareStream(existingScreenStream);
          } else {
            setScreenShareActive(false);
          }
        }

        if (!socket.connected) socket.connect();
        socket.emit('candidate:join_session', {
          sessionId: sess._id,
          candidateId: user?.id || user?._id,
          fullName: user?.fullName,
          email: user?.email,
          jobRole: sess.jobRole,
          interviewType: sess.interviewType,
        });

        socket.on('candidate:admin_notice', (notice) => {
          setAdminLiveNotice(notice);
        });

        socket.on('candidate:verdict_updated', (payload) => {
          if (payload.sessionId === sess._id) {
            setAdminVerdictNotice(payload.adminReviewVerdict);
          }
        });

        const welcome =
          unanswered.questionIndex === 0
            ? `Welcome ${user?.fullName?.split(' ')[0] || ''} to your live ${sess.jobRole} interview. You have ${sess.timeLimitMinutes || 15} minutes to complete this session. Here is your first question.`
            : '';
        setTimeout(() => speakQuestionAloud(unanswered.questionText, welcome), 600);
      } catch (err) {
        console.error('Session load error:', err);
      }
    };

    initSession();

    return () => {
      mounted = false;
      isListeningRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onend = null;
          recognitionRef.current.stop();
        } catch {}
      }
      window.speechSynthesis?.cancel();
      socket.emit('candidate:leave_session', { sessionId });
      socket.off('candidate:admin_notice');
      socket.off('candidate:verdict_updated');
    };
  }, [sessionId, navigate, user, isMobileDevice, speakQuestionAloud, attachScreenShareStream]);

  // 2. Initialize Webcam + Microphone Recording
  useEffect(() => {
    let faceIntervalId;

    const startHDVideoAndVoiceRecorder = async () => {
      try {
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: isMobileDevice ? 1280 : 1920 },
              height: { ideal: isMobileDevice ? 720 : 1080 },
              frameRate: { ideal: 30 },
              facingMode: 'user',
            },
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
        }

        const vTrack = stream.getVideoTracks()[0];

        mediaStreamRef.current = stream;
        setGlobalCameraStream(stream);
        registerMediaStream(stream);
        setCameraActive(true);
        bindWebcamToVideoElement();

        recordedChunksRef.current = [];
        // Use VP9/VP8 + Opus at 8.0 Mbps Ultra-HD Bitrate so recorded video is 100% razor-sharp with zero blurriness!
        const preferredMimes = [
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp8,opus',
          'video/webm',
        ];
        const selectedMime = preferredMimes.find((m) => MediaRecorder.isTypeSupported(m)) || '';
        const recorderOptions = selectedMime
          ? {
              mimeType: selectedMime,
              videoBitsPerSecond: 8000000, // 8.0 Mbps Razor-Sharp HD Video (Never blurry!)
              audioBitsPerSecond: 192000,  // 192 kbps Studio Voice Audio
            }
          : {
              videoBitsPerSecond: 8000000,
              audioBitsPerSecond: 192000,
            };

        const recorder = new MediaRecorder(stream, recorderOptions);
        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
          }
        };
        recorder.start(500);
        mediaRecorderRef.current = recorder;
        setRecordingActive(true);

        if (vTrack) {
          vTrack.onended = () => {
            setCameraActive(false);
            recordViolation('CAMERA_DISABLED', 'Candidate webcam feed was disconnected.', 'critical');
          };
        }

        if ('FaceDetector' in window) {
          try {
            // eslint-disable-next-line no-undef
            faceDetectorRef.current = new FaceDetector({ fastMode: true, maxDetectedFaces: 3 });
          } catch {
            faceDetectorRef.current = null;
          }
        }

        faceIntervalId = setInterval(async () => {
          const videoEl = videoRef.current;
          if (!videoEl || videoEl.readyState < 2) return;

          const activeTrack = mediaStreamRef.current?.getVideoTracks()?.[0];
          if (!activeTrack || !activeTrack.enabled || activeTrack.readyState !== 'live') {
            setCameraActive(false);
            return;
          }
          setCameraActive(true);

          if (faceDetectorRef.current) {
            try {
              const faces = await faceDetectorRef.current.detect(videoEl);
              if (faces.length === 0) {
                setFaceStatus('no_face');
                noFaceStreakRef.current += 1;
                if (noFaceStreakRef.current >= 2) {
                  noFaceStreakRef.current = 0;
                  recordViolation('NO_FACE_DETECTED', 'Candidate face not visible in frame.', 'high');
                }
              } else if (faces.length > 1) {
                setFaceStatus('multiple_faces');
                multiFaceStreakRef.current += 1;
                if (multiFaceStreakRef.current >= 2) {
                  multiFaceStreakRef.current = 0;
                  recordViolation('MULTIPLE_FACES_DETECTED', 'Multiple faces detected in frame.', 'critical');
                }
              } else {
                setFaceStatus('single_face_ok');
                noFaceStreakRef.current = 0;
                multiFaceStreakRef.current = 0;
              }
            } catch {}
          }
        }, 3500);
      } catch (err) {
        console.error('Webcam init error:', err);
        setCameraActive(false);
      }
    };

    startHDVideoAndVoiceRecorder();

    return () => {
      if (faceIntervalId) clearInterval(faceIntervalId);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = null;
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
  }, []);

  // 3. Browser Tab-Switching, Window Blur, & Fullscreen Exit Listeners
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        tabHiddenTimestampRef.current = Date.now();
      } else if (tabHiddenTimestampRef.current) {
        const awaySeconds = Math.max(
          1,
          Math.round((Date.now() - tabHiddenTimestampRef.current) / 1000)
        );
        tabHiddenTimestampRef.current = null;
        recordViolation(
          'TAB_SWITCH',
          `Candidate switched tabs or minimized app for ${awaySeconds} second(s).`,
          awaySeconds > 8 ? 'high' : 'medium',
          awaySeconds
        );
      }
    };

    const handleWindowBlur = () => {
      if (!document.hidden && !isMobileDevice) {
        recordViolation(
          'WINDOW_BLUR',
          'Browser window lost focus (candidate clicked outside interview window).',
          'medium'
        );
      }
    };

    const handleFullscreenChange = () => {
      if (!supportsFullscreen) return;
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);
      if (!active) {
        recordViolation('FULLSCREEN_EXIT', 'Candidate exited full-screen interview mode.', 'high');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [isMobileDevice, supportsFullscreen, recordViolation]);

  // 4A. Stream Live Webcam Frame & Live Screen Share Frame to Admin Dashboard
  useEffect(() => {
    const videoStreamInterval = setInterval(() => {
      if (!session) return;
      if (!socket.connected) socket.connect();

      let webcamFrameUrl = '';
      let screenFrameUrl = '';

      const videoEl = videoRef.current;
      const canvas = canvasRef.current;
      if (videoEl && canvas && videoEl.readyState >= 2) {
        try {
          canvas.width = 640;
          canvas.height = 360;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(videoEl, 0, 0, 640, 360);
          webcamFrameUrl = canvas.toDataURL('image/jpeg', 0.80);
        } catch {}
      }

      const screenEl = screenVideoRef.current;
      const sCanvas = screenCanvasRef.current;
      if (!isMobileDevice && screenEl && sCanvas && screenEl.readyState >= 2) {
        try {
          sCanvas.width = 640;
          sCanvas.height = 360;
          const sCtx = sCanvas.getContext('2d');
          sCtx.drawImage(screenEl, 0, 0, 640, 360);
          screenFrameUrl = sCanvas.toDataURL('image/jpeg', 0.78);
        } catch {}
      }

      if (webcamFrameUrl || screenFrameUrl) {
        socket.emit('candidate:video_frame', {
          sessionId: session._id,
          frame: webcamFrameUrl,
          screenFrame: screenFrameUrl || webcamFrameUrl,
        });
      }
    }, 320);

    return () => clearInterval(videoStreamInterval);
  }, [session, isMobileDevice]);

  // 4B. Periodic Telemetry State Heartbeat to Admin Dashboard
  useEffect(() => {
    const heartbeat = setInterval(() => {
      if (socket.connected && session) {
        socket.emit('candidate:telemetry_heartbeat', {
          sessionId: session._id,
          candidateId: user?.id || user?._id,
          fullName: user?.fullName,
          email: user?.email,
          jobRole: session.jobRole,
          interviewType: session.interviewType,
          cameraActive,
          micActive: true,
          fullscreenActive: isFullscreen,
          screenShareActive,
          displaySurface,
          faceStatus,
          currentQuestionIndex: currentQuestion?.questionIndex || 0,
          violationCount,
          tabSwitchCount,
          fullscreenExitCount,
          screenShareDropCount,
        });
      }
    }, 2000);

    return () => clearInterval(heartbeat);
  }, [
    session,
    user,
    cameraActive,
    isFullscreen,
    screenShareActive,
    displaySurface,
    faceStatus,
    currentQuestion,
    violationCount,
    tabSwitchCount,
    fullscreenExitCount,
    screenShareDropCount,
  ]);

  // 5. Voice-to-Text Engine
  const stopVoiceRecording = useCallback(() => {
    isListeningRef.current = false;
    setListening(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {}
    }
  }, []);

  const startVoiceRecording = useCallback(() => {
    setVoiceError('');

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setAiSpeaking(false);
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError(
        'Voice-to-Text ke liye Google Chrome ya Microsoft Edge browser use karein.'
      );
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {}
    }

    baseTextBeforeMicRef.current = currentAnswerRef.current
      ? currentAnswerRef.current.trim() + ' '
      : '';

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = speechLang;

      recognition.onstart = () => {
        isListeningRef.current = true;
        setListening(true);
        setVoiceError('');
      };

      recognition.onresult = (event) => {
        let sessionTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          sessionTranscript += event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            sessionTranscript += ' ';
          }
        }
        const combined = (baseTextBeforeMicRef.current + sessionTranscript)
          .replace(/\s+/g, ' ')
          .trimStart();
        currentAnswerRef.current = combined;
        setAnswer(combined);
      };

      recognition.onerror = (event) => {
        if (event.error === 'no-speech' || event.error === 'aborted') {
          return;
        }
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setVoiceError(
            'Microphone permission blocked! Browser address bar mein Microphone Allow karein.'
          );
          stopVoiceRecording();
        } else {
          setVoiceError(`Voice error (${event.error}): Kripya Chrome browser check karein.`);
        }
      };

      recognition.onend = () => {
        if (isListeningRef.current) {
          baseTextBeforeMicRef.current = currentAnswerRef.current
            ? currentAnswerRef.current.trim() + ' '
            : '';
          setTimeout(() => {
            if (isListeningRef.current) {
              try {
                recognition.start();
              } catch {}
            }
          }, 120);
        } else {
          setListening(false);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setVoiceError('Mic start nahi ho paya. Dubara "Start Speaking" par click karein.');
    }
  }, [speechLang, stopVoiceRecording]);

  const toggleVoiceInput = () => {
    if (listening) {
      stopVoiceRecording();
    } else {
      startVoiceRecording();
    }
  };

  // End Interview & Upload Video Function (Used by Manual Finish AND Fixed Countdown Auto-Finish)
  const handleEndInterviewAndSave = useCallback(async () => {
    if (listening) stopVoiceRecording();
    window.speechSynthesis?.cancel();
    await stopAndUploadInterviewRecording();
    shutDownAllCameraAndMicHardware();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    try {
      await api.post(`/interviews/${sessionId}/end`);
    } catch {}
    navigate(`/interview-report/${sessionId}`);
  }, [
    listening,
    stopVoiceRecording,
    stopAndUploadInterviewRecording,
    shutDownAllCameraAndMicHardware,
    sessionId,
    navigate,
  ]);

  // 6. Fixed Total Interview Countdown Timer & Per-Question Elapsed Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsElapsed((s) => s + 1);
      setRemainingSeconds((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-Finish Interview when Fixed Countdown Timer reaches 00:00
  useEffect(() => {
    if (remainingSeconds === 0 && !timeUpTriggered && !uploadingVideo) {
      setTimeUpTriggered(true);
      handleEndInterviewAndSave();
    }
  }, [remainingSeconds, timeUpTriggered, uploadingVideo, handleEndInterviewAndSave]);

  const returnToFullscreen = async () => {
    if (supportsFullscreen) {
      await document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  const handleSubmitAnswer = async (e) => {
    e.preventDefault();
    const finalAnswerToSubmit = answer.trim();
    if (listening) stopVoiceRecording();
    if (!finalAnswerToSubmit || submitting) return;

    setSubmitting(true);
    try {
      const { data } = await api.post(`/interviews/${sessionId}/answer`, {
        questionId: currentQuestion._id,
        userAnswer: finalAnswerToSubmit,
        timeTakenSeconds: secondsElapsed,
      });
      setAnswer(finalAnswerToSubmit);
      setEvaluationResult(data.evaluation);
      setNextQuestionPending(data.nextQuestion);
      setIsCompleted(data.isCompleted);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit answer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleProceedNext = async () => {
    if (isCompleted || !nextQuestionPending) {
      await handleEndInterviewAndSave();
      return;
    }
    setCurrentQuestion(nextQuestionPending);
    setEvaluationResult(null);
    setNextQuestionPending(null);
    setAnswer('');
    currentAnswerRef.current = '';
    baseTextBeforeMicRef.current = '';
    setShowHint(false);
    setSecondsElapsed(0);
    speakQuestionAloud(nextQuestionPending.questionText);
  };

  if (!session || !currentQuestion) {
    return (
      <div className="min-h-screen bg-obsidian-950 text-white flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <Sparkles className="w-10 h-10 text-violet-400 animate-spin mx-auto" />
          <p className="text-sm text-slate-300">Initializing Live Proctored Studio...</p>
        </div>
      </div>
    );
  }

  const formatMMSS = (totalSecs) => {
    const s = Math.max(0, totalSecs || 0);
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-obsidian-950 text-slate-100 flex flex-col">
      <canvas ref={canvasRef} className="hidden" />
      <canvas ref={screenCanvasRef} className="hidden" />

      {/* Uploading HD Video Overlay */}
      {uploadingVideo && (
        <div className="fixed inset-0 z-50 bg-obsidian-950/95 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6">
          <div className="max-w-md w-full p-6 sm:p-8 rounded-3xl bg-obsidian-900 border border-violet-500/40 text-center space-y-4">
            <Sparkles className="w-10 h-10 text-violet-400 animate-spin mx-auto" />
            <h2 className="text-base sm:text-lg font-bold text-white">
              {timeUpTriggered
                ? 'Time is Up! Auto-Saving Interview Recording...'
                : 'Saving HD Interview Video & Voice...'}
            </h2>
            <p className="text-xs text-slate-400">
              Uploading your recorded interview video and voice to Cloudinary / Admin Server. Your webcam will turn off automatically.
            </p>
          </div>
        </div>
      )}



      {/* Fullscreen Enforcement Lock Overlay (Desktop Only) */}
      {supportsFullscreen && !isFullscreen && !uploadingVideo && (
        <div className="fixed inset-0 z-50 bg-obsidian-950/95 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6">
          <div className="max-w-md w-full p-6 sm:p-8 rounded-3xl bg-obsidian-900 border border-rose-500/40 text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 mx-auto">
              <ShieldAlert size={30} />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white">Full-Screen Mode Required</h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Exiting full-screen mode is monitored and sent to the Administrator. Please return to full-screen mode immediately.
            </p>
            <button
              onClick={returnToFullscreen}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 font-bold text-sm text-white flex items-center justify-center gap-2"
            >
              <Maximize2 size={16} /> Return to Full-Screen Interview
            </button>
          </div>
        </div>
      )}

      {/* Responsive Top Header with Fixed Countdown Timer */}
      <header className="min-h-[3.75rem] px-3 sm:px-6 py-2 border-b border-white/10 bg-obsidian-900/90 backdrop-blur-md flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[10px] sm:text-xs font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            {recordingActive ? 'REC • LIVE' : 'PROCTORED'}
          </span>
          <span className="text-xs sm:text-sm font-bold truncate max-w-[140px] sm:max-w-none">
            {session.jobRole}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-violet-600 text-white text-[11px] sm:text-xs font-bold">
            Q{currentQuestion.questionIndex + 1}/{session.totalQuestions}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
          <span
            className={`hidden sm:flex px-2.5 py-1 rounded-lg border items-center gap-1.5 ${
              faceStatus === 'single_face_ok'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/20 border-rose-500/40 text-rose-300 animate-pulse'
            }`}
          >
            <UserCheck size={14} />
            {faceStatus === 'single_face_ok' ? 'Camera OK' : 'Keep Face in Frame!'}
          </span>

          {/* Fixed Interview Countdown Timer Badge */}
          {remainingSeconds !== null && (
            <div
              className={`flex items-center gap-1.5 font-mono text-xs sm:text-sm font-extrabold px-2.5 sm:px-3.5 py-1 rounded-xl border ${
                remainingSeconds <= 60
                  ? 'bg-rose-600/30 border-rose-500 text-rose-200 animate-pulse'
                  : remainingSeconds <= 180
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              }`}
              title="Fixed Interview Time Remaining"
            >
              <Clock size={14} />
              <span>Time Left: {formatMMSS(remainingSeconds)}</span>
            </div>
          )}

          <button
            onClick={handleEndInterviewAndSave}
            className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 font-semibold flex items-center gap-1 text-xs"
          >
            <StopCircle size={14} /> <span>Finish</span>
          </button>
        </div>
      </header>

      {adminLiveNotice && (
        <div className="bg-rose-500/20 border-b border-rose-500/40 px-4 sm:px-6 py-2.5 flex items-center justify-between text-xs text-rose-200">
          <span>
            <strong>Administrator Live Alert:</strong> {adminLiveNotice.message}
          </span>
          <button onClick={() => setAdminLiveNotice(null)} className="underline ml-4">
            Acknowledge
          </button>
        </div>
      )}

      {adminVerdictNotice && (
        <div
          className={`px-4 sm:px-6 py-3 flex items-center justify-between text-xs font-bold border-b ${
            adminVerdictNotice === 'cleared'
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
              : adminVerdictNotice === 'invalidated'
              ? 'bg-rose-600/30 border-rose-500/50 text-rose-200'
              : 'bg-amber-500/20 border-amber-500/40 text-amber-200'
          }`}
        >
          <span>
            Admin Decision:{' '}
            {adminVerdictNotice === 'cleared'
              ? 'QUALIFIED (Verified Clear) by Administrator!'
              : adminVerdictNotice === 'invalidated'
              ? 'DISQUALIFIED by Administrator.'
              : 'Under Review by Administrator.'}
          </span>
          <button onClick={() => setAdminVerdictNotice(null)} className="underline ml-4">
            Dismiss
          </button>
        </div>
      )}

      {/* Responsive Main Studio Grid */}
      <main className="flex-1 p-3.5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 max-w-[1600px] w-full mx-auto">
        <div className="lg:col-span-7 flex flex-col gap-4 sm:gap-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            {/* 1. AI Interviewer Stage */}
            <div className="relative aspect-video rounded-2xl sm:rounded-3xl bg-gradient-to-br from-obsidian-900 via-indigo-950 to-violet-950 border border-violet-500/30 flex flex-col items-center justify-center p-3 overflow-hidden shadow-xl">
              <div
                className={`relative w-11 h-11 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center shadow-2xl ${
                  aiSpeaking ? 'ring-8 ring-violet-500/30 animate-pulse' : ''
                }`}
              >
                <Sparkles className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
              </div>
              <p className="mt-1.5 sm:mt-2.5 font-bold text-[11px] sm:text-xs text-white">
                InterviewIQ AI Lead
              </p>
              <p className="text-[10px] text-violet-300 text-center">
                {aiSpeaking ? 'Speaking question...' : 'Listening to you'}
              </p>
            </div>

            {/* 2. Candidate Live Webcam Feed */}
            <div className="relative aspect-video rounded-2xl sm:rounded-3xl bg-obsidian-900 border border-emerald-500/30 overflow-hidden shadow-xl flex items-center justify-center">
              <video
                ref={(el) => {
                  videoRef.current = el;
                  if (el && mediaStreamRef.current && el.srcObject !== mediaStreamRef.current) {
                    el.srcObject = mediaStreamRef.current;
                    el.play().catch(() => {});
                  }
                }}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-obsidian-950/80 border border-white/10 text-[9px] sm:text-[10px] font-semibold flex items-center gap-1">
                <Video size={10} className={cameraActive ? 'text-emerald-400' : 'text-rose-400'} />
                <span>Live Webcam</span>
              </div>
            </div>

            {/* 3. Candidate Live Screen Share Stream (or Mobile Proctoring Status) */}
            <div className="col-span-2 sm:col-span-1 relative aspect-video rounded-2xl sm:rounded-3xl bg-obsidian-900 border border-indigo-500/30 overflow-hidden shadow-xl flex items-center justify-center">
              {!isMobileDevice ? (
                <>
                  <video
                    ref={(el) => {
                      screenVideoRef.current = el;
                      const sStream = getGlobalScreenStream();
                      if (el && sStream && sStream.active && el.srcObject !== sStream) {
                        el.srcObject = sStream;
                        el.play().catch(() => {});
                      }
                    }}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-contain bg-black"
                  />
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-obsidian-950/80 border border-indigo-500/30 text-[9px] sm:text-[10px] font-semibold text-indigo-300 flex items-center gap-1">
                    <Monitor size={10} className="text-indigo-400" />
                    <span>Live Screen Share</span>
                  </div>
                </>
              ) : (
                <div className="text-center p-3 space-y-1">
                  <Smartphone className="w-6 h-6 text-emerald-400 mx-auto" />
                  <p className="text-xs font-bold text-emerald-300">Mobile Proctoring Active</p>
                  <p className="text-[10px] text-slate-400">
                    Camera &amp; Tab-Lock Monitored Live
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Question Card */}
          <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-obsidian-900 border border-white/10 space-y-3 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-violet-500/20 text-violet-300 text-xs font-bold">
                {currentQuestion.topic} • {currentQuestion.difficulty}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => speakQuestionAloud(currentQuestion.questionText)}
                  className="px-3 py-1.5 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-200 text-xs font-semibold flex items-center gap-1.5"
                >
                  <RotateCcw size={13} /> Replay Audio
                </button>
                {currentQuestion.hint && (
                  <button
                    type="button"
                    onClick={() => setShowHint(!showHint)}
                    className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-amber-300 text-xs font-medium flex items-center gap-1"
                  >
                    <Lightbulb size={13} /> {showHint ? 'Hide Hint' : 'Hint'}
                  </button>
                )}
              </div>
            </div>

            <p className="text-base sm:text-lg font-semibold leading-relaxed text-white">
              {currentQuestion.questionText}
            </p>

            {showHint && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
                <strong>Hint:</strong> {currentQuestion.hint}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Speech-to-Text Response Box */}
        <div className="lg:col-span-5 flex flex-col gap-4 sm:gap-5">
          <form
            onSubmit={handleSubmitAnswer}
            className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-obsidian-900 border border-white/10 flex-1 flex flex-col justify-between space-y-4"
          >
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-violet-400 block">
                    Live Voice-to-Text Answer
                  </span>
                  {listening ? (
                    <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5 mt-0.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      Listening Live: Speak now...
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400">
                      Tap &ldquo;Start Speaking&rdquo; or type your answer below
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={speechLang}
                    disabled={listening}
                    onChange={(e) => setSpeechLang(e.target.value)}
                    className="px-2.5 py-2 rounded-xl bg-obsidian-950 border border-white/10 text-xs text-slate-200"
                  >
                    <option value="en-IN">English (India)</option>
                    <option value="en-US">English (US)</option>
                    <option value="hi-IN">Hindi (हिंदी)</option>
                  </select>

                  <button
                    type="button"
                    disabled={Boolean(evaluationResult)}
                    onClick={toggleVoiceInput}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                      listening
                        ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30 animate-pulse'
                        : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/25'
                    }`}
                  >
                    {listening ? <MicOff size={14} /> : <Mic size={14} />}
                    {listening ? 'Stop Mic' : 'Start Speaking'}
                  </button>

                  {answer && !evaluationResult && (
                    <button
                      type="button"
                      onClick={() => {
                        setAnswer('');
                        currentAnswerRef.current = '';
                        baseTextBeforeMicRef.current = '';
                      }}
                      title="Clear Text"
                      className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>

              {voiceError && (
                <div className="mb-3 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300">
                  {voiceError}
                </div>
              )}

              <textarea
                rows={7}
                value={answer}
                disabled={Boolean(evaluationResult)}
                onChange={(e) => {
                  const val = e.target.value;
                  setAnswer(val);
                  currentAnswerRef.current = val;
                  if (listening) {
                    baseTextBeforeMicRef.current = val ? val.trim() + ' ' : '';
                  }
                }}
                placeholder="1. Tap green 'Start Speaking' button.
2. Speak into your mic — your words appear here in real time.
3. You can also type or edit with your keyboard..."
                className={`w-full rounded-2xl p-3.5 sm:p-4 bg-obsidian-950 border text-sm leading-relaxed focus:outline-none ${
                  listening
                    ? 'border-emerald-500 ring-2 ring-emerald-500/20 text-white'
                    : 'border-white/10 focus:border-violet-500 text-slate-100'
                }`}
              />
            </div>

            {!evaluationResult ? (
              <button
                type="submit"
                disabled={submitting || !answer.trim()}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2"
              >
                <Send size={16} />
                {submitting ? 'Gemini AI Evaluating Answer...' : 'Submit Answer'}
              </button>
            ) : (
              <div className="space-y-4 pt-2 border-t border-white/10">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 size={15} /> Question Score: {evaluationResult.score}/10
                  </span>
                  <span className="text-xs text-slate-400">
                    Comm: {evaluationResult.communicationSkills}/10 • Tech:{' '}
                    {evaluationResult.technicalAccuracy}/10
                  </span>
                </div>
                <p className="text-xs text-slate-300 bg-white/5 p-3 rounded-xl">
                  <strong>Ideal Response Summary:</strong> {evaluationResult.improvedSampleAnswer}
                </p>
                <button
                  type="button"
                  onClick={handleProceedNext}
                  className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2"
                >
                  <span>
                    {isCompleted
                      ? 'Finish, Upload HD Video & View Report'
                      : 'Next Live Question'}
                  </span>
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}
