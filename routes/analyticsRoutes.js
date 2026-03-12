// ============================================================================
// routes/analyticsRoutes.js — Teacher Analytics Endpoints
// ============================================================================
// All routes require auth + roleGuard('teacher').
// No IP restriction — analytics can be viewed from any network.
// ============================================================================

const express    = require('express');
const router     = express.Router();
const auth       = require('../middleware/auth');
const roleGuard  = require('../middleware/roleGuard');
const controller = require('../controllers/analyticsController');

router.get('/analytics/subjects',            auth, roleGuard('teacher'), controller.mySubjects);
router.get('/analytics/subject/:subjectId',  auth, roleGuard('teacher'), controller.subjectAnalytics);

module.exports = router;
