// ============================================================================
// controllers/marksController.js — ISA / MSE / ESE Marks Submission
// ============================================================================
// Teachers submit marks for their assigned subjects.
// Each endpoint validates:
//   1. Teacher is assigned to the subject
//   2. Student is enrolled in the subject
//   3. No duplicate entry (upsert pattern)
// ============================================================================

const pool = require('../config/db');

// ── Helper: Get teacher ID from user ID ──
async function getTeacherId(userId) {
    const [rows] = await pool.query('SELECT id FROM teachers WHERE user_id = ?', [userId]);
    return rows.length > 0 ? rows[0].id : null;
}

// ── Helper: Verify teacher owns the subject ──
async function verifySubjectOwnership(teacherId, subjectId) {
    const [rows] = await pool.query(
        'SELECT id FROM subjects WHERE id = ? AND teacher_id = ?',
        [subjectId, teacherId]
    );
    return rows.length > 0;
}

// ── Helper: Verify student is enrolled ──
async function verifyEnrollment(studentId, subjectId) {
    const [rows] = await pool.query(
        'SELECT id FROM enrollments WHERE student_id = ? AND subject_id = ?',
        [studentId, subjectId]
    );
    return rows.length > 0;
}

// ── Generic marks submission handler ──
// Used by ISA, MSE, and ESE endpoints (DRY pattern).
async function submitMarks(req, res, examType) {
    try {
        const { student_id, subject_id, marks_obtained, max_marks, remarks } = req.body;

        if (!student_id || !subject_id || marks_obtained === undefined || !max_marks) {
            return res.status(400).json({
                success: false,
                message: 'student_id, subject_id, marks_obtained, and max_marks are required.'
            });
        }

        if (parseFloat(marks_obtained) > parseFloat(max_marks)) {
            return res.status(400).json({
                success: false,
                message: 'marks_obtained cannot exceed max_marks.'
            });
        }

        // Get teacher profile
        const teacherId = await getTeacherId(req.user.id);
        if (!teacherId) {
            return res.status(403).json({ success: false, message: 'Teacher profile not found.' });
        }

        // Verify ownership
        const ownsSubject = await verifySubjectOwnership(teacherId, subject_id);
        if (!ownsSubject) {
            return res.status(403).json({ success: false, message: 'You are not assigned to this subject.' });
        }

        // Verify enrollment
        const isEnrolled = await verifyEnrollment(student_id, subject_id);
        if (!isEnrolled) {
            return res.status(404).json({ success: false, message: 'Student is not enrolled in this subject.' });
        }

        // Insert or update marks (upsert)
        const [result] = await pool.query(
            `INSERT INTO marks (student_id, subject_id, exam_type, marks_obtained, max_marks, entered_by, remarks)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                marks_obtained = VALUES(marks_obtained),
                max_marks      = VALUES(max_marks),
                entered_by     = VALUES(entered_by),
                remarks        = VALUES(remarks)`,
            [student_id, subject_id, examType, marks_obtained, max_marks, teacherId, remarks || null]
        );

        return res.status(200).json({
            success: true,
            message: `${examType} marks submitted successfully.`,
            marks: {
                student_id,
                subject_id,
                exam_type:      examType,
                marks_obtained,
                max_marks,
                remarks: remarks || null
            }
        });

    } catch (err) {
        console.error(`submit${examType} error:`, err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
}

// ── POST /api/marks/isa1 ──
exports.submitISA1 = (req, res) => submitMarks(req, res, 'ISA1');

// ── POST /api/marks/isa2 ──
exports.submitISA2 = (req, res) => submitMarks(req, res, 'ISA2');

// ── POST /api/marks/mse ──
exports.submitMSE = (req, res) => submitMarks(req, res, 'MSE');

// ── POST /api/marks/ese ──
exports.submitESE = (req, res) => submitMarks(req, res, 'ESE');

// ── POST /api/marks/assignment ──
exports.submitAssignment = async (req, res) => {
    try {
        const { student_id, subject_id, assignment_id, marks_obtained, max_marks, remarks } = req.body;

        if (!student_id || !subject_id || !assignment_id || marks_obtained === undefined || !max_marks) {
            return res.status(400).json({
                success: false,
                message: 'student_id, subject_id, assignment_id, marks_obtained, and max_marks are required.'
            });
        }

        if (parseFloat(marks_obtained) > parseFloat(max_marks)) {
            return res.status(400).json({
                success: false,
                message: 'marks_obtained cannot exceed max_marks.'
            });
        }

        const teacherId = await getTeacherId(req.user.id);
        if (!teacherId) {
            return res.status(403).json({ success: false, message: 'Teacher profile not found.' });
        }

        const ownsSubject = await verifySubjectOwnership(teacherId, subject_id);
        if (!ownsSubject) {
            return res.status(403).json({ success: false, message: 'You are not assigned to this subject.' });
        }

        const isEnrolled = await verifyEnrollment(student_id, subject_id);
        if (!isEnrolled) {
            return res.status(404).json({ success: false, message: 'Student is not enrolled in this subject.' });
        }

        const [result] = await pool.query(
            `INSERT INTO marks (student_id, subject_id, exam_type, assignment_id, marks_obtained, max_marks, entered_by, remarks)
             VALUES (?, ?, 'ASSIGNMENT', ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                marks_obtained = VALUES(marks_obtained),
                max_marks      = VALUES(max_marks),
                entered_by     = VALUES(entered_by),
                remarks        = VALUES(remarks)`,
            [student_id, subject_id, assignment_id, marks_obtained, max_marks, teacherId, remarks || null]
        );

        return res.status(200).json({
            success: true,
            message: 'Assignment marks submitted successfully.',
            marks: { student_id, subject_id, assignment_id, marks_obtained, max_marks }
        });

    } catch (err) {
        console.error('submitAssignment error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};
