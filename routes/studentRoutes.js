// ============================================================================
// routes/studentRoutes.js — Student Read-Only Endpoints
// ============================================================================
// All routes require auth + roleGuard('student').
// No IP restriction — students can view data from any network.
// All endpoints are GET (read-only).
// ============================================================================

const express    = require('express');
const router     = express.Router();
const auth       = require('../middleware/auth');
const roleGuard  = require('../middleware/roleGuard');
const controller = require('../controllers/studentController');

router.get('/student/attendance',  auth, roleGuard('student'), controller.viewAttendance);
router.get('/student/dashboard',   auth, roleGuard('student'), controller.viewDashboard);
router.get('/student/performance', auth, roleGuard('student'), controller.viewPerformance);
router.get('/student/risk-alerts', auth, roleGuard('student'), controller.viewRiskAlerts);

module.exports = router;
