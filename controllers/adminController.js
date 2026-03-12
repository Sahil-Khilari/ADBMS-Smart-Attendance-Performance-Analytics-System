// ============================================================================
// controllers/adminController.js — Admin-Only Operations
// ============================================================================
// Create teachers, students, subjects, and enrollments.
// All endpoints require role = 'admin'.
// ============================================================================

const bcrypt = require('bcrypt');
const pool   = require('../config/db');

const SALT_ROUNDS = 10;

// ── POST /api/admin/teachers ──
exports.createTeacher = async (req, res) => {
    try {
        const { name, email, password, department, designation } = req.body;

        if (!name || !email || !password || !department) {
            return res.status(400).json({
                success: false,
                message: 'name, email, password, and department are required.'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        // Start a transaction — we need to insert into both users and teachers
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            // Insert into users
            const [userResult] = await conn.query(
                'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
                [name, email, hashedPassword, 'teacher']
            );
            const userId = userResult.insertId;

            // Insert into teachers
            const [teacherResult] = await conn.query(
                'INSERT INTO teachers (user_id, department, designation) VALUES (?, ?, ?)',
                [userId, department, designation || 'Assistant Professor']
            );

            await conn.commit();

            return res.status(201).json({
                success: true,
                message: 'Teacher created successfully.',
                teacher: {
                    id:      teacherResult.insertId,
                    userId:  userId,
                    name,
                    email,
                    department,
                    designation: designation || 'Assistant Professor'
                }
            });

        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }

    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'Email already exists.' });
        }
        console.error('createTeacher error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── POST /api/admin/students ──
exports.createStudent = async (req, res) => {
    try {
        const { name, email, password, roll_number, department, semester, admission_year } = req.body;

        if (!name || !email || !password || !roll_number || !department || !semester || !admission_year) {
            return res.status(400).json({
                success: false,
                message: 'name, email, password, roll_number, department, semester, and admission_year are required.'
            });
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            const [userResult] = await conn.query(
                'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
                [name, email, hashedPassword, 'student']
            );
            const userId = userResult.insertId;

            const [studentResult] = await conn.query(
                'INSERT INTO students (user_id, roll_number, department, semester, admission_year) VALUES (?, ?, ?, ?, ?)',
                [userId, roll_number, department, semester, admission_year]
            );

            await conn.commit();

            return res.status(201).json({
                success: true,
                message: 'Student created successfully.',
                student: {
                    id:       studentResult.insertId,
                    userId:   userId,
                    name,
                    email,
                    roll_number,
                    department,
                    semester,
                    admission_year
                }
            });

        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }

    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'Email or roll number already exists.' });
        }
        console.error('createStudent error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── POST /api/admin/subjects ──
exports.createSubject = async (req, res) => {
    try {
        const { subject_code, subject_name, department, semester, academic_year, teacher_id } = req.body;

        if (!subject_code || !subject_name || !department || !semester || !academic_year || !teacher_id) {
            return res.status(400).json({
                success: false,
                message: 'subject_code, subject_name, department, semester, academic_year, and teacher_id are required.'
            });
        }

        // Verify teacher exists
        const [teachers] = await pool.query('SELECT id FROM teachers WHERE id = ?', [teacher_id]);
        if (teachers.length === 0) {
            return res.status(404).json({ success: false, message: 'Teacher not found.' });
        }

        const [result] = await pool.query(
            `INSERT INTO subjects (subject_code, subject_name, department, semester, academic_year, teacher_id)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [subject_code, subject_name, department, semester, academic_year, teacher_id]
        );

        return res.status(201).json({
            success: true,
            message: 'Subject created successfully.',
            subject: {
                id: result.insertId,
                subject_code,
                subject_name,
                department,
                semester,
                academic_year,
                teacher_id
            }
        });

    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'Subject code already exists for this academic year.' });
        }
        console.error('createSubject error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ── POST /api/admin/enrollments ──
exports.enrollStudent = async (req, res) => {
    try {
        const { student_id, subject_id } = req.body;

        if (!student_id || !subject_id) {
            return res.status(400).json({
                success: false,
                message: 'student_id and subject_id are required.'
            });
        }

        // Verify both exist
        const [students] = await pool.query('SELECT id FROM students WHERE id = ?', [student_id]);
        if (students.length === 0) {
            return res.status(404).json({ success: false, message: 'Student not found.' });
        }

        const [subjects] = await pool.query('SELECT id FROM subjects WHERE id = ?', [subject_id]);
        if (subjects.length === 0) {
            return res.status(404).json({ success: false, message: 'Subject not found.' });
        }

        const [result] = await pool.query(
            'INSERT INTO enrollments (student_id, subject_id) VALUES (?, ?)',
            [student_id, subject_id]
        );

        return res.status(201).json({
            success: true,
            message: 'Student enrolled successfully.',
            enrollment: {
                id:         result.insertId,
                student_id,
                subject_id
            }
        });

    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'Student is already enrolled in this subject.' });
        }
        console.error('enrollStudent error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};
