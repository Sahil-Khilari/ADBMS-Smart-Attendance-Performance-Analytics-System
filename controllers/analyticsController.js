// ============================================================================
// controllers/analyticsController.js — Teacher Analytics Endpoints
// ============================================================================
// Returns Chart.js-ready data structures for teacher dashboards.
// Every endpoint validates that the teacher owns the requested subject.
// ============================================================================

const pool = require('../config/db');

// ── Helper: Get teacher ID from user ID ──
async function getTeacherId(userId) {
    const [rows] = await pool.query('SELECT id FROM teachers WHERE user_id = ?', [userId]);
    return rows.length > 0 ? rows[0].id : null;
}

// ── GET /api/analytics/subject/:subjectId ──
// Full analytics for a single subject: attendance + marks distribution.
exports.subjectAnalytics = async (req, res) => {
    try {
        const { subjectId } = req.params;
        const teacherId = await getTeacherId(req.user.id);
        if (!teacherId) {
            return res.status(403).json({ success: false, message: 'Teacher profile not found.' });
        }

        // Verify ownership
        const [subjects] = await pool.query(
            'SELECT id, subject_code, subject_name FROM subjects WHERE id = ? AND teacher_id = ?',
            [subjectId, teacherId]
        );
        if (subjects.length === 0) {
            return res.status(403).json({ success: false, message: 'You are not assigned to this subject.' });
        }

        const subject = subjects[0];

        // ── 1. Attendance per student (for bar chart) ──
        const [attendanceData] = await pool.query(
            `SELECT
                s.roll_number,
                u.name AS student_name,
                COUNT(ar.id)                           AS total_sessions,
                SUM(ar.status = 'PRESENT')             AS present,
                SUM(ar.status = 'ABSENT')              AS absent,
                ROUND(SUM(ar.status = 'PRESENT') * 100.0
                      / NULLIF(COUNT(ar.id), 0), 2)   AS percentage
             FROM enrollments e
             JOIN students s ON s.id = e.student_id
             JOIN users u    ON u.id = s.user_id
             LEFT JOIN attendance_records ar
                ON ar.student_id = s.id
                AND ar.session_id IN (
                    SELECT id FROM attendance_sessions WHERE subject_id = ?
                )
             WHERE e.subject_id = ?
             GROUP BY s.id, s.roll_number, u.name
             ORDER BY s.roll_number`,
            [subjectId, subjectId]
        );

        // ── 2. Attendance trend over time (for line chart) ──
        const [trendData] = await pool.query(
            `SELECT
                asess.session_date,
                SUM(ar.status = 'PRESENT') AS present,
                SUM(ar.status = 'ABSENT')  AS absent
             FROM attendance_sessions asess
             LEFT JOIN attendance_records ar ON ar.session_id = asess.id
             WHERE asess.subject_id = ? AND asess.status = 'CLOSED'
             GROUP BY asess.session_date
             ORDER BY asess.session_date`,
            [subjectId]
        );

        // ── 3. Marks distribution (for stacked bar / table) ──
        const [marksData] = await pool.query(
            `SELECT
                s.roll_number,
                u.name AS student_name,
                MAX(CASE WHEN m.exam_type = 'ISA1' THEN m.marks_obtained END) AS isa1,
                MAX(CASE WHEN m.exam_type = 'ISA2' THEN m.marks_obtained END) AS isa2,
                MAX(CASE WHEN m.exam_type = 'MSE'  THEN m.marks_obtained END) AS mse,
                MAX(CASE WHEN m.exam_type = 'ESE'  THEN m.marks_obtained END) AS ese
             FROM enrollments e
             JOIN students s ON s.id = e.student_id
             JOIN users u    ON u.id = s.user_id
             LEFT JOIN marks m ON m.student_id = s.id AND m.subject_id = ?
                AND m.exam_type IN ('ISA1','ISA2','MSE','ESE')
             WHERE e.subject_id = ?
             GROUP BY s.id, s.roll_number, u.name
             ORDER BY s.roll_number`,
            [subjectId, subjectId]
        );

        // ── 4. Grade distribution (for pie / doughnut chart) ──
        const [gradeData] = await pool.query(
            `SELECT grade, COUNT(*) AS count
             FROM performance_records
             WHERE subject_id = ?
             GROUP BY grade`,
            [subjectId]
        );

        // ── 5. At-risk students for this subject ──
        const [riskData] = await pool.query(
            `SELECT
                s.roll_number,
                u.name AS student_name,
                pr.attendance_pct,
                pr.total_marks,
                pr.risk_reason
             FROM performance_records pr
             JOIN students s ON s.id = pr.student_id
             JOIN users u    ON u.id = s.user_id
             WHERE pr.subject_id = ? AND pr.is_at_risk = TRUE
             ORDER BY s.roll_number`,
            [subjectId]
        );

        return res.status(200).json({
            success: true,
            subject: {
                id:   subject.id,
                code: subject.subject_code,
                name: subject.subject_name
            },
            analytics: {
                attendance_per_student: attendanceData,
                attendance_trend:      trendData,
                marks_distribution:    marksData,
                grade_distribution:    gradeData,
                at_risk_students:      riskData
            }
        });

    } catch (err) {
        console.error('subjectAnalytics error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── GET /api/analytics/subjects ──
// Returns list of subjects assigned to the authenticated teacher.
exports.mySubjects = async (req, res) => {
    try {
        const teacherId = await getTeacherId(req.user.id);
        if (!teacherId) {
            return res.status(403).json({ success: false, message: 'Teacher profile not found.' });
        }

        const [subjects] = await pool.query(
            `SELECT
                s.id,
                s.subject_code,
                s.subject_name,
                s.department,
                s.semester,
                s.academic_year,
                (SELECT COUNT(*) FROM enrollments e WHERE e.subject_id = s.id) AS enrolled_count
             FROM subjects s
             WHERE s.teacher_id = ?
             ORDER BY s.subject_code`,
            [teacherId]
        );

        return res.status(200).json({
            success: true,
            teacher_id: teacherId,
            subjects
        });

    } catch (err) {
        console.error('mySubjects error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};
