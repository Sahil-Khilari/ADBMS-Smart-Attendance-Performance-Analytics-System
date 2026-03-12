// ============================================================================
// controllers/authController.js — Login / Logout
// ============================================================================

const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');
const pool   = require('../config/db');
require('dotenv').config();

// ── POST /api/auth/login ──
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required.'
            });
        }

        // 1. Find user by email
        const [rows] = await pool.query(
            'SELECT id, name, email, password, role, is_active FROM users WHERE email = ?',
            [email]
        );

        if (rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.'
            });
        }

        const user = rows[0];

        // 2. Check if account is active
        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: 'Account is deactivated. Contact admin.'
            });
        }

        // 3. Compare password with bcrypt hash
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.'
            });
        }

        // 4. Sign JWT
        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
        );

        // 5. Return token + user info (never return password)
        return res.status(200).json({
            success: true,
            message: 'Login successful.',
            token,
            user: {
                id:   user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── POST /api/auth/logout ──
// JWT is stateless — logout is handled client-side by deleting the token.
// This endpoint exists for completeness and audit logging.
exports.logout = async (req, res) => {
    // In a stateful implementation, you'd blacklist the token here.
    return res.status(200).json({
        success: true,
        message: 'Logged out successfully. Please delete the token on the client.'
    });
};

// ── GET /api/auth/me ──
// Returns the currently authenticated user's profile.
exports.me = async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT id, name, email, role, is_active, created_at FROM users WHERE id = ?',
            [req.user.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        return res.status(200).json({ success: true, user: rows[0] });

    } catch (err) {
        console.error('Me error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};
