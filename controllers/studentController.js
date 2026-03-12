// ============================================================================
// controllers/studentController.js — Student Read-Only Endpoints
// ============================================================================
// Students can only VIEW their own data — no write operations.
// Every query filters by the authenticated student's ID.
// ============================================================================

const pool = require('../config/db');

// ── Helper: Get student ID from user ID ──
async function getStudentId(userId) {
    const [rows] = await pool.query('SELECT id FROM students WHERE user_id = ?', [userId]);
    return rows.length > 0 ? rows[0].id : null;
}

// ── GET /api/student/attendance ──
// Returns attendance records for the logged-in student across all subjects.
exports.viewAttendance = async (req, res) => {
    try {
        const studentId = await getStudentId(req.user.id);
        if (!studentId) {
            return res.status(404).json({ success: false, message: 'Student profile not found.' });
        }

        const [records] = await pool.query(
            `SELECT
                s.subject_code,
                s.subject_name,
                COUNT(ar.id)                                          AS total_sessions,
                SUM(ar.status = 'PRESENT')                            AS present,
                SUM(ar.status = 'ABSENT')                             AS absent,
                ROUND(SUM(ar.status = 'PRESENT') * 100.0
                      / NULLIF(COUNT(ar.id), 0), 2)                  AS percentage
             FROM attendance_records ar
             JOIN attendance_sessions asess ON asess.id = ar.session_id
             JOIN subjects s               ON s.id = asess.subject_id
             WHERE ar.student_id = ?
             GROUP BY s.id, s.subject_code, s.subject_name
             ORDER BY s.subject_code`,
            [studentId]
        );

        return res.status(200).json({
            success: true,
            student_id: studentId,
            subjects: records
        });

    } catch (err) {
        console.error('viewAttendance error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── GET /api/student/dashboard ──
// Returns a combined overview: attendance + marks for all enrolled subjects.
exports.viewDashboard = async (req, res) => {
    try {
        const studentId = await getStudentId(req.user.id);
        if (!studentId) {
            return res.status(404).json({ success: false, message: 'Student profile not found.' });
        }

        // Enrolled subjects with attendance summary
        const [attendance] = await pool.query(
            `SELECT
                s.id            AS subject_id,
                s.subject_code,
                s.subject_name,
                COUNT(ar.id)                           AS total_sessions,
                SUM(ar.status = 'PRESENT')             AS present,
                ROUND(SUM(ar.status = 'PRESENT') * 100.0
                      / NULLIF(COUNT(ar.id), 0), 2)   AS attendance_pct
             FROM enrollments e
             JOIN subjects s ON s.id = e.subject_id
             LEFT JOIN attendance_sessions asess
                ON asess.subject_id = s.id
             LEFT JOIN attendance_records ar
                ON ar.session_id = asess.id AND ar.student_id = e.student_id
             WHERE e.student_id = ?
             GROUP BY s.id, s.subject_code, s.subject_name`,
            [studentId]
        );

        // Marks summary per subject
        const [marks] = await pool.query(
            `SELECT
                s.id           AS subject_id,
                s.subject_code,
                MAX(CASE WHEN m.exam_type = 'ISA1' THEN m.marks_obtained END) AS isa1,
                MAX(CASE WHEN m.exam_type = 'ISA1' THEN m.max_marks     END) AS isa1_max,
                MAX(CASE WHEN m.exam_type = 'ISA2' THEN m.marks_obtained END) AS isa2,
                MAX(CASE WHEN m.exam_type = 'ISA2' THEN m.max_marks     END) AS isa2_max,
                MAX(CASE WHEN m.exam_type = 'MSE'  THEN m.marks_obtained END) AS mse,
                MAX(CASE WHEN m.exam_type = 'MSE'  THEN m.max_marks     END) AS mse_max,
                MAX(CASE WHEN m.exam_type = 'ESE'  THEN m.marks_obtained END) AS ese,
                MAX(CASE WHEN m.exam_type = 'ESE'  THEN m.max_marks     END) AS ese_max
             FROM enrollments e
             JOIN subjects s ON s.id = e.subject_id
             LEFT JOIN marks m ON m.subject_id = s.id
                AND m.student_id = e.student_id
                AND m.exam_type IN ('ISA1','ISA2','MSE','ESE')
             WHERE e.student_id = ?
             GROUP BY s.id, s.subject_code`,
            [studentId]
        );

        return res.status(200).json({
            success: true,
            student_id: studentId,
            attendance,
            marks
        });

    } catch (err) {
        console.error('viewDashboard error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── GET /api/student/performance ──
// Returns the pre-computed performance records for the logged-in student.
exports.viewPerformance = async (req, res) => {
    try {
        const studentId = await getStudentId(req.user.id);
        if (!studentId) {
            return res.status(404).json({ success: false, message: 'Student profile not found.' });
        }

        const [records] = await pool.query(
            `SELECT
                s.subject_code,
                s.subject_name,
                pr.attendance_pct,
                pr.attendance_marks,
                pr.assignment_marks,
                pr.isa_total,
                pr.mse_marks,
                pr.ese_marks,
                pr.total_marks,
                pr.max_possible,
                pr.grade,
                pr.is_at_risk,
                pr.risk_reason
             FROM performance_records pr
             JOIN subjects s ON s.id = pr.subject_id
             WHERE pr.student_id = ?
             ORDER BY s.subject_code`,
            [studentId]
        );

        return res.status(200).json({
            success: true,
            student_id: studentId,
            performance: records
        });

    } catch (err) {
        console.error('viewPerformance error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── GET /api/student/risk-alerts ──
// Returns subjects where the student is flagged at-risk.
exports.viewRiskAlerts = async (req, res) => {
    try {
        const studentId = await getStudentId(req.user.id);
        if (!studentId) {
            return res.status(404).json({ success: false, message: 'Student profile not found.' });
        }

        const [alerts] = await pool.query(
            `SELECT
                s.subject_code,
                s.subject_name,
                pr.attendance_pct,
                pr.total_marks,
                pr.max_possible,
                pr.risk_reason
             FROM performance_records pr
             JOIN subjects s ON s.id = pr.subject_id
             WHERE pr.student_id = ? AND pr.is_at_risk = TRUE
             ORDER BY s.subject_code`,
            [studentId]
        );

        return res.status(200).json({
            success: true,
            student_id: studentId,
            at_risk_count: alerts.length,
            alerts
        });

    } catch (err) {
        console.error('viewRiskAlerts error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};
