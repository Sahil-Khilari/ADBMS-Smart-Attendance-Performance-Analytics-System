// ============================================================================
// routes/attendanceRoutes.js — Attendance Session & Check-in Endpoints
// ============================================================================
// IP whitelist is applied ONLY to:
//   POST /api/sessions/start       (teacher — must be on campus)
//   POST /api/attendance/check-in  (student — must be on campus)
//
// All other attendance routes require auth + role only.
// ============================================================================

const express     = require('express');
const router      = express.Router();
const auth        = require('../middleware/auth');
const roleGuard   = require('../middleware/roleGuard');
const ipWhitelist = require('../middleware/ipWhitelist');
const controller  = require('../controllers/attendanceController');

// ── SECURE ZONE (campus IP required) ──
router.post('/sessions/start',       auth, ipWhitelist, roleGuard('teacher'), controller.startSession);
router.post('/attendance/check-in',  auth, ipWhitelist, roleGuard('student'), controller.checkIn);

// ── GENERAL ZONE (any network, auth required) ──
router.get('/attendance/verify/:sessionId',  auth, roleGuard('teacher'), controller.verifyChecklist);
router.post('/sessions/close/:sessionId',    auth, roleGuard('teacher'), controller.closeSession);

module.exports = router;
