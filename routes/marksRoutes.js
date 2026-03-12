// ============================================================================
// routes/marksRoutes.js — Marks Submission Endpoints
// ============================================================================
// All routes require auth + roleGuard('teacher').
// No IP restriction — marks can be entered from any network.
// ============================================================================

const express    = require('express');
const router     = express.Router();
const auth       = require('../middleware/auth');
const roleGuard  = require('../middleware/roleGuard');
const controller = require('../controllers/marksController');

router.post('/marks/isa1',       auth, roleGuard('teacher'), controller.submitISA1);
router.post('/marks/isa2',       auth, roleGuard('teacher'), controller.submitISA2);
router.post('/marks/mse',        auth, roleGuard('teacher'), controller.submitMSE);
router.post('/marks/ese',        auth, roleGuard('teacher'), controller.submitESE);
router.post('/marks/assignment', auth, roleGuard('teacher'), controller.submitAssignment);

module.exports = router;
