// ============================================================================
// middleware/auth.js — JWT Authentication Middleware
// ============================================================================
// Extracts the Bearer token from the Authorization header, verifies it,
// and attaches the decoded payload to req.user for downstream middleware.
//
// Usage:  router.get('/protected', auth, handler)
// ============================================================================

const jwt = require('jsonwebtoken');
require('dotenv').config();

const auth = (req, res, next) => {
    // ── 1. Extract header ──
    const header = req.headers['authorization'];

    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            message: 'Access denied. No token provided.'
        });
    }

    // ── 2. Isolate the token string ──
    const token = header.split(' ')[1];

    try {
        // ── 3. Verify signature + expiry ──
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // ── 4. Attach user info for downstream middleware / controllers ──
        // decoded contains: { id, role, iat, exp }
        req.user = {
            id:   decoded.id,
            role: decoded.role
        };

        next();
    } catch (err) {
        // Token is malformed, expired, or signature mismatch
        return res.status(403).json({
            success: false,
            message: 'Invalid or expired token.'
        });
    }
};

module.exports = auth;
