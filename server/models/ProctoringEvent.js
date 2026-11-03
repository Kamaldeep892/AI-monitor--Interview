import mongoose from 'mongoose';

const proctoringEventSchema = new mongoose.Schema(
  {
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewSession', required: true, index: true },
    eventType: {
      type: String,
      enum: [
        'TAB_SWITCH',
        'WINDOW_BLUR',
        'FULLSCREEN_EXIT',
        'SCREEN_SHARE_STOPPED',
        'INVALID_SCREEN_SURFACE',
        'NO_FACE_DETECTED',
        'MULTIPLE_FACES_DETECTED',
        'CAMERA_DISABLED',
        'MICROPHONE_DISABLED',
        'SUSPICIOUS_AUDIO',
        'UNUSUAL_INTERRUPTION',
      ],
      required: true,
    },
    description: { type: String, required: true },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    durationSeconds: { type: Number, default: 0 },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    reviewStatus: {
      type: String,
      enum: ['pending_review', 'dismissed_benign', 'confirmed_violation'],
      default: 'pending_review',
    },
    adminNotes: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model('ProctoringEvent', proctoringEventSchema);
