import http from 'http';
import fs from 'fs';
import path from 'path';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import dns from 'dns';
import { connectDB } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import interviewRoutes from './routes/interviewRoutes.js';
import resumeRoutes from './routes/resumeRoutes.js';
import questionRoutes from './routes/questionRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import proctoringRoutes from './routes/proctoringRoutes.js';
import { initializeProctoringSocket } from './socket/proctoringSocket.js';
import { errorHandler } from './middleware/errorMiddleware.js';


dns.setServers(["1.1.1.1","8.8.8.8"]);


dotenv.config();
connectDB();

const app = express();
const httpServer = http.createServer(app);

const io = new SocketIOServer(httpServer, {
  maxHttpBufferSize: 1e7,
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  },
});

app.set('io', io);
initializeProctoringSocket(io);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  })
);
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Dedicated HTTP 206 Byte-Range Video Streaming Endpoint so local recorded videos start immediately & seek smoothly
app.get('/uploads/recordings/:filename', (req, res) => {
  const filePath = path.join(process.cwd(), 'uploads', 'recordings', req.params.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Recording file not found');
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;
  const contentType = filePath.endsWith('.mp4') ? 'video/mp4' : 'video/webm';

  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const file = fs.createReadStream(filePath, { start, end });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
    });
    file.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'InterviewIQ Live Video, Recording & Admin Proctoring API',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api/resumes', resumeRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/proctoring', proctoringRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`[InterviewIQ Server + Socket.IO] Running on http://localhost:${PORT}`);
});
