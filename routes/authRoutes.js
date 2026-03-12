// ============================================================================
// routes/authRoutes.js — Authentication Endpoints
// ============================================================================
// POST /api/auth/login   — public (no auth needed)
// POST /api/auth/logout  — requires auth
// GET  /api/auth/me      — requires auth
// ============================================================================

const express    = require('express');
const router     = express.Router();
const auth       = require('../middleware/auth');
const controller = require('../controllers/authController');

router.post('/login',  controller.login);
router.post('/logout', auth, controller.logout);
router.get('/me',      auth, controller.me);

module.exports = router;
