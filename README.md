# InterviewIQ — Mobile-Responsive AI Live Video Interview & Proctoring Platform (MERN + Gemini AI + Cloudinary + Google OAuth + OTP)

**InterviewIQ** is a full-stack, mobile-responsive, real-time AI Video Interview and Proctoring Platform built with the **MERN Stack (MongoDB, Express.js, React 18, Node.js)**, **Google Gemini 2.5 Flash**, **Socket.IO**, **WebRTC / MediaDevices**, **Web Speech API (TTS + STT)**, **Google Identity Services (OAuth 2.0)**, **Nodemailer OTP Verification**, and **Cloudinary Video Cloud Storage**.

Candidates can attend proctored video interviews on **both Desktop/Laptop and Mobile Smartphones**. An AI Lead Interviewer speaks questions aloud and transcribes candidate voice responses in real time within a **Fixed Interview Countdown Timer**, while the **Administrator Proctoring Center** monitors live video streams, reviews **HD Recorded Video + Voice**, and issues instant **Qualify / Disqualify** decisions.

---

## Key Platform Features

### 1. Mobile-Responsive & Desktop-Ready Live Interview Studio
* **100% Mobile-Friendly Navigation & Studio:** Includes a responsive slide-over mobile navigation drawer (`AppShell.jsx`), adaptive video grids, and automatic **Mobile Proctoring Mode** on smartphones (where front camera, microphone, and tab/app-switch detection work seamlessly even on mobile browsers that do not support desktop `getDisplayMedia`).
* **One-Time 3-Step Hardware & Screen Share Gate (`/mock-interview`):**
  1. **1. Enable Camera & Mic** (Live webcam preview + real-time microphone decibel meter)
  2. **2. Test AI Voice Output** (Verifies Text-to-Speech question audio)
  3. **3. Share Screen** (Asked **only once** right on the setup screen; carries straight into the interview room without double-prompting)
* **Fixed Interview Countdown Timer (`timeLimitMinutes`):**
  * Configurable fixed duration (**10, 15, 20, 30, or 45 Minutes**).
  * Displays a live `Time Left: MM:SS` countdown badge in the interview header (turns amber under 3 minutes and pulses red under 1 minute).
  * Automatically finishes the interview, uploads the recorded video, and shuts down webcam/microphone hardware if the timer reaches `00:00`.
* **Automatic Webcam & Mic Turn-Off:** Guaranteed hardware release (`track.stop()` + `srcObject = null`) the moment an interview ends or the candidate navigates to the report/dashboard.

### 2. Real Google OAuth 2.0 & 3-Step Email OTP Password Reset
* **Real Google Account Sign-Up & Log-In:** Uses Google Identity Services (`https://accounts.google.com/gsi/client`) to open the official Google Account chooser popup and verifies the token on the backend (`https://www.googleapis.com/oauth2/v3/userinfo`).
* **3-Step Forgot Password with 6-Digit Email OTP:**
  1. **Step 1:** Candidate enters their registered email -> Backend generates a 6-digit OTP and sends it via Gmail SMTP (`nodemailer`).
  2. **Step 2:** Candidate enters and verifies the 6-digit OTP (`POST /api/auth/forgot-password/verify-otp`).
  3. **Step 3:** Candidate sets a new password and is signed in automatically (`POST /api/auth/forgot-password/reset`).

### 3. Administrator Proctoring, Smooth HD Video Player & Qualification Center (`/admin/proctoring`)
* **Strict Admin-Only Access (`adminOnly`):** Normal candidates cannot access proctoring logs or admin routes. Admin has a dedicated Sign-In tab (`admin@interviewiq.com` / `Admin@1234`) with no public registration.
* **Dual Live Stream Monitoring:** Admins watch both the candidate's **Live Webcam Feed** and **Live Screen Share** side-by-side in real time over Socket.IO.
* **Smooth HD Recorded Video + Voice Playback:** Recordings are uploaded to **Cloudinary** as `.mp4` (`quality: 'auto:best'`) with a local **HTTP 206 Byte-Range Streaming** fallback so videos start immediately and play smoothly.
* **Instant Qualify / Disqualify Verdicts:** Admins can click **Qualify** or **Disqualify** on any candidate session, immediately broadcasting a real-time **QUALIFIED ✓** or **DISQUALIFIED ✕** status banner to the candidate's Dashboard, History, and Report pages.
* **2-Step Permission Delete:** Deleting a candidate record requires two consecutive confirmation steps (*Permission 1 of 2* -> *Permission 2 of 2*) and removes the session, proctoring logs, and Cloudinary video file.

---

## Local Setup & Environment Variables

### 1. Backend Setup (`server/`)
```bash
cd server
npm install
cp .env.example .env
```

Fill in `server/.env`:
```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
MONGO_URI=mongodb+srv://<user>:<password>@cluster0.mongodb.net/interviewiq
JWT_SECRET=your_super_secret_64_char_jwt_key_here
JWT_EXPIRES_IN=7d
GEMINI_API_KEY=your_google_gemini_api_key_here

# Cloudinary Credentials for Smooth HD Interview Video + Voice Storage
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# Google OAuth Client ID
GOOGLE_CLIENT_ID=your_google_oauth_client_id.apps.googleusercontent.com

# Gmail SMTP for Sending 6-Digit Forgot-Password OTP Emails
SMTP_EMAIL=your_gmail_address@gmail.com
SMTP_PASSWORD=your_16_digit_google_app_password
```

Start the backend:
```bash
npm run dev
```

### 2. Frontend Setup (`client/`)
```bash
cd client
npm install
cp .env.example .env
```

Fill in `client/.env`:
```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id.apps.googleusercontent.com
```

Start the frontend:
```bash
npm run dev
```

---

## Default Administrator Credentials
* **Admin Sign-In URL:** `http://localhost:5173/admin-login`
* **Email:** `admin@interviewiq.com`
* **Password:** `Admin@1234`
