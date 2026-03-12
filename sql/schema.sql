-- ============================================================================
-- Smart Attendance & Performance Analytics System
-- MySQL Database Schema
-- ============================================================================
-- Run this file once to initialize the database:
--   mysql -u root -p < schema.sql
-- ============================================================================

CREATE DATABASE IF NOT EXISTS smart_attendance_db;
USE smart_attendance_db;

-- ============================================================================
-- 1. USERS TABLE
-- ============================================================================
-- Central authentication table for all roles.
-- Every person in the system (admin, teacher, student) has exactly one row here.
-- The 'role' ENUM enforces that only valid roles can be stored.

CREATE TABLE users (
    id              INT             AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(100)    NOT NULL,
    email           VARCHAR(150)    NOT NULL,
    password        VARCHAR(255)    NOT NULL,               -- bcrypt hash
    role            ENUM('admin', 'teacher', 'student') NOT NULL,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT uq_users_email UNIQUE (email)
);

-- ============================================================================
-- 2. STUDENTS TABLE
-- ============================================================================
-- Extended profile for users with role = 'student'.
-- Stores academic identifiers that only apply to students.
-- One-to-one relationship with users table.

CREATE TABLE students (
    id              INT             AUTO_INCREMENT PRIMARY KEY,
    user_id         INT             NOT NULL,
    roll_number     VARCHAR(20)     NOT NULL,
    department      VARCHAR(100)    NOT NULL,
    semester        INT             NOT NULL,
    admission_year  YEAR            NOT NULL,

    CONSTRAINT fk_students_user    FOREIGN KEY (user_id)   REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uq_students_user    UNIQUE (user_id),       -- one-to-one with users
    CONSTRAINT uq_students_roll    UNIQUE (roll_number)
);

-- ============================================================================
-- 3. TEACHERS TABLE
-- ============================================================================
-- Extended profile for users with role = 'teacher'.
-- Stores department affiliation and designation.
-- One-to-one relationship with users table.

CREATE TABLE teachers (
    id              INT             AUTO_INCREMENT PRIMARY KEY,
    user_id         INT             NOT NULL,
    department      VARCHAR(100)    NOT NULL,
    designation     VARCHAR(100)    DEFAULT 'Assistant Professor',

    CONSTRAINT fk_teachers_user    FOREIGN KEY (user_id)   REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uq_teachers_user    UNIQUE (user_id)        -- one-to-one with users
);

-- ============================================================================
-- 4. SUBJECTS TABLE
-- ============================================================================
-- Master list of subjects offered.
-- Each subject belongs to a specific semester and department.

CREATE TABLE subjects (
    id              INT             AUTO_INCREMENT PRIMARY KEY,
    subject_code    VARCHAR(20)     NOT NULL,
    subject_name    VARCHAR(150)    NOT NULL,
    department      VARCHAR(100)    NOT NULL,
    semester        INT             NOT NULL,
    academic_year   VARCHAR(9)      NOT NULL,               -- e.g. '2025-2026'
    teacher_id      INT             NOT NULL,               -- assigned teacher

    CONSTRAINT fk_subjects_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE RESTRICT,
    CONSTRAINT uq_subjects_code_year UNIQUE (subject_code, academic_year)
);

CREATE INDEX idx_subjects_teacher ON subjects(teacher_id);
CREATE INDEX idx_subjects_sem     ON subjects(semester, department);

-- ============================================================================
-- 5. ENROLLMENTS TABLE
-- ============================================================================
-- Many-to-many relationship between students and subjects.
-- A student is enrolled in multiple subjects; a subject has many students.
-- The unique constraint prevents duplicate enrollment.

CREATE TABLE enrollments (
    id              INT             AUTO_INCREMENT PRIMARY KEY,
    student_id      INT             NOT NULL,
    subject_id      INT             NOT NULL,
    enrolled_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_enrollments_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    CONSTRAINT fk_enrollments_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    CONSTRAINT uq_enrollment          UNIQUE (student_id, subject_id)
);

CREATE INDEX idx_enrollments_subject ON enrollments(subject_id);

-- ============================================================================
-- 6. ATTENDANCE SESSIONS TABLE
-- ============================================================================
-- Each row represents one class session where attendance was taken.
-- A teacher starts a session → a QR token is generated → students check in.
-- Status tracks the lifecycle: ACTIVE → CLOSED → EXPIRED.

CREATE TABLE attendance_sessions (
    id              INT             AUTO_INCREMENT PRIMARY KEY,
    subject_id      INT             NOT NULL,
    teacher_id      INT             NOT NULL,
    session_date    DATE            NOT NULL,
    start_time      TIME            NOT NULL,
    end_time        TIME            DEFAULT NULL,
    status          ENUM('ACTIVE', 'CLOSED', 'EXPIRED') NOT NULL DEFAULT 'ACTIVE',
    total_present   INT             DEFAULT 0,
    total_absent    INT             DEFAULT 0,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_attsess_subject  FOREIGN KEY (subject_id) REFERENCES subjects(id)  ON DELETE CASCADE,
    CONSTRAINT fk_attsess_teacher  FOREIGN KEY (teacher_id) REFERENCES teachers(id)  ON DELETE RESTRICT
);

CREATE INDEX idx_attsess_subject_date ON attendance_sessions(subject_id, session_date);
CREATE INDEX idx_attsess_teacher      ON attendance_sessions(teacher_id);
CREATE INDEX idx_attsess_status       ON attendance_sessions(status);

-- ============================================================================
-- 7. SESSION TOKENS TABLE
-- ============================================================================
-- Stores short-lived QR tokens linked to attendance sessions.
-- The token is embedded in the QR code that students scan.
-- Expires within a few minutes to prevent proxy attendance.
-- One-to-one with attendance_sessions (one token per session at a time).

CREATE TABLE session_tokens (
    id              INT             AUTO_INCREMENT PRIMARY KEY,
    session_id      INT             NOT NULL,
    token           VARCHAR(255)    NOT NULL,               -- UUID v4 string
    expires_at      DATETIME        NOT NULL,               -- typically NOW() + 5 minutes
    is_used         BOOLEAN         NOT NULL DEFAULT FALSE,  -- revoked after session closes
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_sesstoken_session FOREIGN KEY (session_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    CONSTRAINT uq_sesstoken_token   UNIQUE (token)
);

CREATE INDEX idx_sesstoken_session ON session_tokens(session_id);
CREATE INDEX idx_sesstoken_expiry  ON session_tokens(expires_at);

-- ============================================================================
-- 8. ATTENDANCE RECORDS TABLE
-- ============================================================================
-- One row per student per session.
-- The unique constraint (student_id, session_id) ensures a student
-- cannot check in twice for the same session.

CREATE TABLE attendance_records (
    id              INT             AUTO_INCREMENT PRIMARY KEY,
    session_id      INT             NOT NULL,
    student_id      INT             NOT NULL,
    status          ENUM('PRESENT', 'ABSENT', 'LATE') NOT NULL DEFAULT 'ABSENT',
    check_in_time   DATETIME        DEFAULT NULL,           -- NULL if ABSENT
    ip_address      VARCHAR(45)     DEFAULT NULL,           -- for audit trail
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_attrec_session   FOREIGN KEY (session_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_attrec_student   FOREIGN KEY (student_id) REFERENCES students(id)            ON DELETE CASCADE,
    CONSTRAINT uq_attendance       UNIQUE (student_id, session_id)
);

CREATE INDEX idx_attrec_session ON attendance_records(session_id);
CREATE INDEX idx_attrec_student ON attendance_records(student_id);

-- ============================================================================
-- 9. ASSIGNMENTS TABLE
-- ============================================================================
-- Assignments given by teachers for specific subjects.
-- Each assignment has a maximum marks value for normalization.

CREATE TABLE assignments (
    id              INT             AUTO_INCREMENT PRIMARY KEY,
    subject_id      INT             NOT NULL,
    title           VARCHAR(200)    NOT NULL,
    description     TEXT            DEFAULT NULL,
    max_marks       DECIMAL(5,2)    NOT NULL,
    due_date        DATE            DEFAULT NULL,
    created_by      INT             NOT NULL,               -- teacher who created it
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_assign_subject   FOREIGN KEY (subject_id) REFERENCES subjects(id)   ON DELETE CASCADE,
    CONSTRAINT fk_assign_teacher   FOREIGN KEY (created_by) REFERENCES teachers(id)    ON DELETE RESTRICT
);

CREATE INDEX idx_assign_subject ON assignments(subject_id);

-- ============================================================================
-- 10. MARKS TABLE
-- ============================================================================
-- Stores individual scores for students across all evaluation types.
-- exam_type covers ISA1, ISA2, MSE, ESE, and ASSIGNMENT.
-- For ASSIGNMENT type, assignment_id links to the specific assignment.
-- Unique constraint prevents duplicate score entries.

CREATE TABLE marks (
    id              INT             AUTO_INCREMENT PRIMARY KEY,
    student_id      INT             NOT NULL,
    subject_id      INT             NOT NULL,
    exam_type       ENUM('ISA1', 'ISA2', 'MSE', 'ESE', 'ASSIGNMENT') NOT NULL,
    assignment_id   INT             DEFAULT NULL,           -- populated only when exam_type = 'ASSIGNMENT'
    marks_obtained  DECIMAL(5,2)    NOT NULL,
    max_marks       DECIMAL(5,2)    NOT NULL,
    entered_by      INT             NOT NULL,               -- teacher user ID
    remarks         VARCHAR(255)    DEFAULT NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_marks_student    FOREIGN KEY (student_id)    REFERENCES students(id)     ON DELETE CASCADE,
    CONSTRAINT fk_marks_subject    FOREIGN KEY (subject_id)    REFERENCES subjects(id)     ON DELETE CASCADE,
    CONSTRAINT fk_marks_assignment FOREIGN KEY (assignment_id) REFERENCES assignments(id)  ON DELETE SET NULL,
    CONSTRAINT fk_marks_enteredby FOREIGN KEY (entered_by)    REFERENCES teachers(id)     ON DELETE RESTRICT,
    CONSTRAINT uq_marks_exam       UNIQUE (student_id, subject_id, exam_type, assignment_id)
);

CREATE INDEX idx_marks_student_subject ON marks(student_id, subject_id);
CREATE INDEX idx_marks_type            ON marks(exam_type);

-- ============================================================================
-- 11. PERFORMANCE RECORDS TABLE
-- ============================================================================
-- Aggregated performance snapshot per student per subject.
-- This is a materialized/computed table updated when marks or attendance change.
-- Stores pre-calculated totals so dashboards load instantly without
-- running expensive JOINs on every request.
--
-- ISA = attendance_marks + assignment_marks
-- Total = ISA + MSE + ESE
-- Risk flag is set when attendance < 75% or total < passing threshold.

CREATE TABLE performance_records (
    id                  INT             AUTO_INCREMENT PRIMARY KEY,
    student_id          INT             NOT NULL,
    subject_id          INT             NOT NULL,
    attendance_pct      DECIMAL(5,2)    DEFAULT 0.00,       -- (present / total sessions) * 100
    attendance_marks    DECIMAL(5,2)    DEFAULT 0.00,       -- marks allotted for attendance
    assignment_marks    DECIMAL(5,2)    DEFAULT 0.00,       -- average/total assignment marks
    isa_total           DECIMAL(5,2)    DEFAULT 0.00,       -- ISA1 + ISA2 combined
    mse_marks           DECIMAL(5,2)    DEFAULT 0.00,
    ese_marks           DECIMAL(5,2)    DEFAULT 0.00,
    total_marks         DECIMAL(5,2)    DEFAULT 0.00,       -- ISA + MSE + ESE
    max_possible        DECIMAL(5,2)    DEFAULT 0.00,       -- maximum possible total
    grade               VARCHAR(2)      DEFAULT NULL,       -- O, A+, A, B+, B, C, F
    is_at_risk          BOOLEAN         NOT NULL DEFAULT FALSE,
    risk_reason         VARCHAR(255)    DEFAULT NULL,        -- e.g. 'Attendance below 75%'
    last_calculated_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_perf_student     FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    CONSTRAINT fk_perf_subject     FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    CONSTRAINT uq_perf_student_sub UNIQUE (student_id, subject_id)
);

CREATE INDEX idx_perf_risk ON performance_records(is_at_risk);

-- ============================================================================
-- SEED: Default Admin Account
-- ============================================================================
-- Password: 'admin123' → bcrypt hash (10 rounds)
-- Change this immediately in production.

INSERT INTO users (name, email, password, role) VALUES
('System Admin', 'admin@college.edu',
 '$2b$10$placeholder_hash_replace_in_app', 'admin');

-- ============================================================================
-- ANALYTICS-READY VIEWS (Optional helpers for Chart.js dashboards)
-- ============================================================================

-- View: Subject-wise attendance summary
CREATE OR REPLACE VIEW vw_subject_attendance AS
SELECT
    s.id            AS subject_id,
    s.subject_name,
    s.subject_code,
    COUNT(DISTINCT asess.id)  AS total_sessions,
    st.id           AS student_id,
    st.roll_number,
    u.name          AS student_name,
    SUM(CASE WHEN ar.status = 'PRESENT' THEN 1 ELSE 0 END) AS present_count,
    SUM(CASE WHEN ar.status = 'ABSENT'  THEN 1 ELSE 0 END) AS absent_count,
    ROUND(
        SUM(CASE WHEN ar.status = 'PRESENT' THEN 1 ELSE 0 END) * 100.0
        / NULLIF(COUNT(DISTINCT asess.id), 0)
    , 2) AS attendance_percentage
FROM subjects s
JOIN attendance_sessions asess ON asess.subject_id = s.id
JOIN enrollments e             ON e.subject_id = s.id
JOIN students st               ON st.id = e.student_id
JOIN users u                   ON u.id = st.user_id
LEFT JOIN attendance_records ar ON ar.session_id = asess.id AND ar.student_id = st.id
GROUP BY s.id, s.subject_name, s.subject_code, st.id, st.roll_number, u.name;

-- View: Student performance overview across subjects
CREATE OR REPLACE VIEW vw_student_performance AS
SELECT
    st.id           AS student_id,
    st.roll_number,
    u.name          AS student_name,
    s.subject_code,
    s.subject_name,
    pr.attendance_pct,
    pr.isa_total,
    pr.mse_marks,
    pr.ese_marks,
    pr.total_marks,
    pr.max_possible,
    pr.grade,
    pr.is_at_risk,
    pr.risk_reason
FROM performance_records pr
JOIN students st ON st.id = pr.student_id
JOIN users u     ON u.id  = st.user_id
JOIN subjects s  ON s.id  = pr.subject_id;

-- View: At-risk students (attendance < 75% OR failing marks)
CREATE OR REPLACE VIEW vw_at_risk_students AS
SELECT * FROM vw_student_performance
WHERE is_at_risk = TRUE;
