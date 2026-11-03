import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Resume Upload (Memory Storage)
const resumeStorage = multer.memoryStorage();

const resumeFileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF and DOCX files are permitted.'), false);
  }
};

export const uploadResume = multer({
  storage: resumeStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: resumeFileFilter,
});

// Interview Video+Audio Recording Upload (Disk Storage in server/uploads/recordings)
const recordingsDir = path.join(process.cwd(), 'uploads', 'recordings');
if (!fs.existsSync(recordingsDir)) {
  fs.mkdirSync(recordingsDir, { recursive: true });
}

const recordingStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, recordingsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `session_${req.params.sessionId}_${Date.now()}${ext}`);
  },
});

export const uploadRecording = multer({
  storage: recordingStorage,
  limits: { fileSize: 200 * 1024 * 1024 }, // Up to 200MB video+voice recording
});
