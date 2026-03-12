// ============================================================================
// controllers/attendanceController.js — Attendance Session & QR Check-in
// ============================================================================
// Handles the full QR attendance lifecycle:
//   1. Teacher starts session  → creates session + QR token
//   2. Student checks in       → validates token + marks attendance
//   3. Teacher verifies        → retrieves checklist
//   4. Teacher closes session  → marks remaining students absent
// ============================================================================

const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
require('dotenv').config();

const TOKEN_EXPIRY_MINUTES = parseInt(process.env.QR_TOKEN_EXPIRY_MINUTES) || 5;

// ── POST /api/sessions/start ──
// Middleware chain: auth → ipWhitelist → roleGuard('teacher')
exports.startSession = async (req, res) => {
    try {
        const { subject_id } = req.body;

        if (!subject_id) {
            return res.status(400).json({
                success: false,
                message: 'subject_id is required.'
            });
        }

        // 1. Get teacher profile from user id
        const [teachers] = await pool.query(
            'SELECT id FROM teachers WHERE user_id = ?',
            [req.user.id]
        );

        if (teachers.length === 0) {
            return res.status(403).json({
                success: false,
                message: 'Teacher profile not found.'
            });
        }

        const teacherId = teachers[0].id;

        // 2. Verify teacher is assigned to this subject
        const [subjects] = await pool.query(
            'SELECT id, subject_name FROM subjects WHERE id = ? AND teacher_id = ?',
            [subject_id, teacherId]
        );

        if (subjects.length === 0) {
            return res.status(403).json({
                success: false,
                message: 'You are not assigned to this subject.'
            });
        }

        // 3. Check for any ACTIVE session already running for this subject
        const [activeSessions] = await pool.query(
            `SELECT id FROM attendance_sessions
             WHERE subject_id = ? AND status = 'ACTIVE'`,
            [subject_id]
        );

        if (activeSessions.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'An active session already exists for this subject. Close it before starting a new one.',
                existing_session_id: activeSessions[0].id
            });
        }

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            // 4. Create attendance session
            const now = new Date();
            const sessionDate = now.toISOString().split('T')[0];      // YYYY-MM-DD
            const startTime   = now.toTimeString().split(' ')[0];     // HH:MM:SS

            const [sessionResult] = await conn.query(
                `INSERT INTO attendance_sessions (subject_id, teacher_id, session_date, start_time, status)
                 VALUES (?, ?, ?, ?, 'ACTIVE')`,
                [subject_id, teacherId, sessionDate, startTime]
            );
            const sessionId = sessionResult.insertId;

            // 5. Generate QR token
            const token     = uuidv4();
            const expiresAt = new Date(now.getTime() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

            await conn.query(
                `INSERT INTO session_tokens (session_id, token, expires_at)
                 VALUES (?, ?, ?)`,
                [sessionId, token, expiresAt]
            );

            await conn.commit();

            // 6. Return QR payload — frontend renders this as a QR code
            return res.status(201).json({
                success: true,
                message: 'Attendance session started.',
                session: {
                    id:           sessionId,
                    subject_id,
                    subject_name: subjects[0].subject_name,
                    session_date: sessionDate,
                    start_time:   startTime,
                    status:       'ACTIVE'
                },
                qr: {
                    token,
                    expires_at:      expiresAt,
                    expiry_minutes:  TOKEN_EXPIRY_MINUTES,
                    // This is the string embedded in the QR code image
                    qr_payload:      `${token}|${sessionId}|${subject_id}`
                }
            });

        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }

    } catch (err) {
        console.error('startSession error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── POST /api/attendance/check-in ──
// Middleware chain: auth → ipWhitelist → roleGuard('student')
exports.checkIn = async (req, res) => {
    try {
        const { session_id, token } = req.body;

        if (!session_id || !token) {
            return res.status(400).json({
                success: false,
                message: 'session_id and token are required.'
            });
        }

        // ── Validation 1: Token exists and matches the session ──
        const [tokens] = await pool.query(
            `SELECT st.id, st.session_id, st.expires_at, st.is_used,
                    asess.subject_id, asess.status AS session_status
             FROM session_tokens st
             JOIN attendance_sessions asess ON asess.id = st.session_id
             WHERE st.token = ? AND st.session_id = ?`,
            [token, session_id]
        );

        if (tokens.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Invalid token or session.'
            });
        }

        const tokenRow = tokens[0];

        // ── Validation 2: Token not expired ──
        if (new Date() > new Date(tokenRow.expires_at)) {
            return res.status(410).json({
                success: false,
                message: 'QR token has expired. Ask your teacher to refresh the session.'
            });
        }

        // ── Validation 3: Token not revoked ──
        if (tokenRow.is_used) {
            return res.status(410).json({
                success: false,
                message: 'This QR token has been revoked.'
            });
        }

        // ── Validation 4: Session is still ACTIVE ──
        if (tokenRow.session_status !== 'ACTIVE') {
            return res.status(410).json({
                success: false,
                message: 'Attendance session is no longer active.'
            });
        }

        // ── Validation 5: Get student profile from user id ──
        const [students] = await pool.query(
            'SELECT id FROM students WHERE user_id = ?',
            [req.user.id]
        );

        if (students.length === 0) {
            return res.status(403).json({
                success: false,
                message: 'Student profile not found.'
            });
        }

        const studentId = students[0].id;

        // ── Validation 6: Student is enrolled in this subject ──
        const [enrollments] = await pool.query(
            'SELECT id FROM enrollments WHERE student_id = ? AND subject_id = ?',
            [studentId, tokenRow.subject_id]
        );

        if (enrollments.length === 0) {
            return res.status(403).json({
                success: false,
                message: 'You are not enrolled in this subject.'
            });
        }

        // ── Validation 7: Student has not already checked in ──
        const [existing] = await pool.query(
            `SELECT id FROM attendance_records
             WHERE student_id = ? AND session_id = ?`,
            [studentId, session_id]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'You have already checked in for this session.'
            });
        }

        // ── All validations passed → Mark attendance ──
        const clientIp = req.headers['x-forwarded-for']
            ? req.headers['x-forwarded-for'].split(',')[0].trim()
            : req.socket.remoteAddress;

        await pool.query(
            `INSERT INTO attendance_records (session_id, student_id, status, check_in_time, ip_address)
             VALUES (?, ?, 'PRESENT', NOW(), ?)`,
            [session_id, studentId, clientIp]
        );

        // Update cached count
        await pool.query(
            `UPDATE attendance_sessions SET total_present = total_present + 1 WHERE id = ?`,
            [session_id]
        );

        return res.status(201).json({
            success: true,
            message: 'Attendance marked successfully.',
            record: {
                session_id,
                student_id: studentId,
                status:     'PRESENT',
                checked_at: new Date()
            }
        });

    } catch (err) {
        // The UNIQUE constraint on (student_id, session_id) acts as a safety net
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                message: 'Duplicate check-in prevented by database.'
            });
        }
        console.error('checkIn error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── GET /api/attendance/verify/:sessionId ──
// Middleware chain: auth → roleGuard('teacher')
exports.verifyChecklist = async (req, res) => {
    try {
        const { sessionId } = req.params;

        // Verify teacher owns this session
        const [teachers] = await pool.query(
            'SELECT id FROM teachers WHERE user_id = ?', [req.user.id]
        );
        if (teachers.length === 0) {
            return res.status(403).json({ success: false, message: 'Teacher profile not found.' });
        }

        const [sessions] = await pool.query(
            'SELECT id, subject_id, status FROM attendance_sessions WHERE id = ? AND teacher_id = ?',
            [sessionId, teachers[0].id]
        );

        if (sessions.length === 0) {
            return res.status(404).json({ success: false, message: 'Session not found or not yours.' });
        }

        // Get all enrolled students with their check-in status
        const [checklist] = await pool.query(
            `SELECT
                s.id            AS student_id,
                s.roll_number,
                u.name          AS student_name,
                ar.status       AS attendance_status,
                ar.check_in_time
             FROM enrollments e
             JOIN students s ON s.id = e.student_id
             JOIN users u    ON u.id = s.user_id
             LEFT JOIN attendance_records ar
                ON ar.student_id = s.id AND ar.session_id = ?
             WHERE e.subject_id = ?
             ORDER BY s.roll_number`,
            [sessionId, sessions[0].subject_id]
        );

        return res.status(200).json({
            success: true,
            session: {
                id:     parseInt(sessionId),
                status: sessions[0].status
            },
            total_enrolled: checklist.length,
            present: checklist.filter(s => s.attendance_status === 'PRESENT').length,
            absent:  checklist.filter(s => !s.attendance_status || s.attendance_status === 'ABSENT').length,
            checklist
        });

    } catch (err) {
        console.error('verifyChecklist error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── POST /api/sessions/close/:sessionId ──
// Middleware chain: auth → roleGuard('teacher')
exports.closeSession = async (req, res) => {
    try {
        const { sessionId } = req.params;

        const [teachers] = await pool.query(
            'SELECT id FROM teachers WHERE user_id = ?', [req.user.id]
        );
        if (teachers.length === 0) {
            return res.status(403).json({ success: false, message: 'Teacher profile not found.' });
        }

        const [sessions] = await pool.query(
            `SELECT id, subject_id, status FROM attendance_sessions
             WHERE id = ? AND teacher_id = ?`,
            [sessionId, teachers[0].id]
        );

        if (sessions.length === 0) {
            return res.status(404).json({ success: false, message: 'Session not found or not yours.' });
        }

        if (sessions[0].status !== 'ACTIVE') {
            return res.status(400).json({ success: false, message: 'Session is already closed.' });
        }

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            // Mark all enrolled students who did NOT check in as ABSENT
            await conn.query(
                `INSERT INTO attendance_records (session_id, student_id, status)
                 SELECT ?, e.student_id, 'ABSENT'
                 FROM enrollments e
                 WHERE e.subject_id = ?
                   AND e.student_id NOT IN (
                       SELECT student_id FROM attendance_records WHERE session_id = ?
                   )`,
                [sessionId, sessions[0].subject_id, sessionId]
            );

            // Count present / absent
            const [counts] = await conn.query(
                `SELECT
                    SUM(status = 'PRESENT') AS present,
                    SUM(status = 'ABSENT')  AS absent
                 FROM attendance_records WHERE session_id = ?`,
                [sessionId]
            );

            // Close the session
            const endTime = new Date().toTimeString().split(' ')[0];
            await conn.query(
                `UPDATE attendance_sessions
                 SET status = 'CLOSED', end_time = ?, total_present = ?, total_absent = ?
                 WHERE id = ?`,
                [endTime, counts[0].present || 0, counts[0].absent || 0, sessionId]
            );

            // Revoke all tokens for this session
            await conn.query(
                'UPDATE session_tokens SET is_used = TRUE WHERE session_id = ?',
                [sessionId]
            );

            await conn.commit();

            return res.status(200).json({
                success: true,
                message: 'Session closed. Remaining students marked absent.',
                summary: {
                    session_id:    parseInt(sessionId),
                    status:        'CLOSED',
                    total_present: counts[0].present || 0,
                    total_absent:  counts[0].absent  || 0
                }
            });

        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }

    } catch (err) {
        console.error('closeSession error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};
