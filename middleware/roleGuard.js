// ============================================================================
// middleware/roleGuard.js — Role-Based Access Control Middleware
// ============================================================================
// Returns a middleware function that checks if req.user.role is in the
// list of allowed roles. Must be used AFTER auth middleware.
//
// Usage:  router.post('/teachers', auth, roleGuard('admin'), handler)
//         router.get('/analytics',  auth, roleGuard('teacher', 'admin'), handler)
// ============================================================================

const roleGuard = (...allowedRoles) => {
    return (req, res, next) => {
        // auth middleware must have run first
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required before role check.'
            });
        }

        // Check if the user's role is in the allowed list
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Required role(s): ${allowedRoles.join(', ')}. Your role: ${req.user.role}.`
            });
        }

        next();
    };
};

module.exports = roleGuard;
