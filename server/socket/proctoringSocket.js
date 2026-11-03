export const initializeProctoringSocket = (io) => {
  const liveSessionsMap = new Map();

  io.on('connection', (socket) => {
    socket.on('admin:join_monitor', () => {
      socket.join('admin_monitors');
      socket.emit('admin:active_sessions_sync', Array.from(liveSessionsMap.values()));
    });

    socket.on('candidate:join_session', (payload) => {
      const { sessionId, candidateId, fullName, email, jobRole, interviewType } = payload;
      if (!sessionId) return;
      socket.join(`session_${sessionId}`);
      if (candidateId) {
        socket.join(`candidate_${candidateId}`);
      }
      socket.sessionId = sessionId;

      const existing = liveSessionsMap.get(sessionId) || {};
      const sessionState = {
        ...existing,
        socketId: socket.id,
        sessionId,
        candidateId,
        fullName,
        email,
        jobRole,
        interviewType,
        cameraActive: true,
        micActive: true,
        fullscreenActive: true,
        screenShareActive: true,
        displaySurface: 'monitor',
        faceStatus: 'single_face_ok',
        currentQuestionIndex: existing.currentQuestionIndex || 0,
        violationCount: existing.violationCount || 0,
        tabSwitchCount: existing.tabSwitchCount || 0,
        fullscreenExitCount: existing.fullscreenExitCount || 0,
        screenShareDropCount: existing.screenShareDropCount || 0,
        warningLevel: existing.warningLevel || 'normal',
        latestSnapshot: existing.latestSnapshot || '',
        latestScreenSnapshot: existing.latestScreenSnapshot || '',
        lastHeartbeat: new Date().toISOString(),
      };

      liveSessionsMap.set(sessionId, sessionState);
      io.to('admin_monitors').emit('admin:session_started', sessionState);
    });

    // Candidate joins their personal notification room (on Dashboard / History / Report pages)
    socket.on('candidate:subscribe_verdicts', ({ candidateId }) => {
      if (candidateId) {
        socket.join(`candidate_${candidateId}`);
      }
    });

    // Relay BOTH Live Webcam Frame AND Live Screen Share Frame to Admin Monitors
    socket.on('candidate:video_frame', ({ sessionId, frame, screenFrame, audioLevel }) => {
      if (!sessionId) return;
      const existing = liveSessionsMap.get(sessionId) || { sessionId };
      if (frame) existing.latestSnapshot = frame;
      if (screenFrame) existing.latestScreenSnapshot = screenFrame;
      existing.audioLevel = audioLevel || 0;
      existing.lastHeartbeat = new Date().toISOString();
      liveSessionsMap.set(sessionId, existing);

      io.to('admin_monitors').emit('admin:video_frame', {
        sessionId,
        frame: frame || existing.latestSnapshot || '',
        screenFrame: screenFrame || existing.latestScreenSnapshot || '',
        audioLevel: audioLevel || 0,
      });
    });

    // Telemetry state updates
    socket.on('candidate:telemetry_heartbeat', (telemetry) => {
      const { sessionId } = telemetry;
      if (!sessionId) return;

      const existing = liveSessionsMap.get(sessionId) || {};
      const updated = {
        ...existing,
        ...telemetry,
        lastHeartbeat: new Date().toISOString(),
      };
      liveSessionsMap.set(sessionId, updated);
      io.to('admin_monitors').emit('admin:telemetry_update', updated);
    });

    socket.on('admin:send_candidate_notice', ({ sessionId, message, severity }) => {
      io.to(`session_${sessionId}`).emit('candidate:admin_notice', {
        message,
        severity: severity || 'warning',
        timestamp: new Date().toISOString(),
      });
    });

    socket.on('candidate:leave_session', ({ sessionId }) => {
      if (sessionId && liveSessionsMap.has(sessionId)) {
        liveSessionsMap.delete(sessionId);
        io.to('admin_monitors').emit('admin:session_ended', { sessionId });
      }
    });

    socket.on('disconnect', () => {
      if (socket.sessionId && liveSessionsMap.has(socket.sessionId)) {
        const endedSessionId = socket.sessionId;
        liveSessionsMap.delete(endedSessionId);
        io.to('admin_monitors').emit('admin:session_ended', { sessionId: endedSessionId });
      }
    });
  });
};
