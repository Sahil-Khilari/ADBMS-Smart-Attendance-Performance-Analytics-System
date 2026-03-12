// ============================================================================
// server.js — Application Entry Point
// ============================================================================
// Wires together all middleware, routes, and starts the Express server.
// ============================================================================

const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const rateLimit  = require('express-rate-limit');
require('dotenv').config();

const app = express();

// ── Trust proxy (required if behind Nginx / load balancer for IP whitelist) ──
app.set('trust proxy', 1);

// ── Global Middleware ──
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Rate Limiting (protect login & check-in from brute force) ──
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,   // 15 minutes
    max:      20,                // max 20 login attempts per window
    message:  { success: false, message: 'Too many login attempts. Try again in 15 minutes.' }
});

const checkinLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,    // 1 minute
    max:      10,                // max 10 check-in attempts per minute
    message:  { success: false, message: 'Too many check-in attempts. Slow down.' }
});

// ── Static Files (frontend pages, CSS, JS) ──
app.use(express.static(path.join(__dirname, 'public')));

// ── Import Routes ──
const authRoutes       = require('./routes/authRoutes');
const adminRoutes      = require('./routes/adminRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const marksRoutes      = require('./routes/marksRoutes');
const studentRoutes    = require('./routes/studentRoutes');
const analyticsRoutes  = require('./routes/analyticsRoutes');

// ── Mount Routes ──
app.use('/api/auth', loginLimiter, authRoutes);      // POST /api/auth/login, /logout, /me
app.use('/api/admin',              adminRoutes);      // POST /api/admin/teachers, /students, etc.
app.use('/api',      checkinLimiter, attendanceRoutes);  // POST /api/sessions/start, /attendance/check-in
app.use('/api',                    marksRoutes);       // POST /api/marks/isa1, /mse, /ese
app.use('/api',                    studentRoutes);     // GET  /api/student/attendance, /dashboard, etc.
app.use('/api',                    analyticsRoutes);   // GET  /api/analytics/subject/:id

// ── Health Check ──
app.get('/api/health', (req, res) => {
    res.status(200).json({ success: true, message: 'Server is running.', timestamp: new Date() });
});

// ── 404 Handler ──
app.use((req, res) => {
    res.status(404).json({ success: false, message: `Route ${req.method} ${req.originalUrl} not found.` });
});

// ── Global Error Handler ──
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
});

// ── Start Server ──
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n🚀 Smart Attendance System running on http://localhost:${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
});
