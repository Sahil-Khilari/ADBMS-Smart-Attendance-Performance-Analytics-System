// ============================================================================
// routes/adminRoutes.js — Admin-Only Endpoints
// ============================================================================
// All routes require auth + roleGuard('admin').
// No IP restriction — admin actions work from any network.
// ============================================================================

const express    = require('express');
const router     = express.Router();
const auth       = require('../middleware/auth');
const roleGuard  = require('../middleware/roleGuard');
const controller = require('../controllers/adminController');

router.post('/teachers',    auth, roleGuard('admin'), controller.createTeacher);
router.post('/students',    auth, roleGuard('admin'), controller.createStudent);
router.post('/subjects',    auth, roleGuard('admin'), controller.createSubject);
router.post('/enrollments', auth, roleGuard('admin'), controller.enrollStudent);

module.exports = router;
