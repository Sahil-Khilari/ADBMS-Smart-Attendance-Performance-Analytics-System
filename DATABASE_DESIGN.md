# Database Schema Design — Smart Attendance & Performance Analytics System

---

## Entity-Relationship Diagram

```
                         ┌──────────────────┐
                         │      users       │
                         │──────────────────│
                         │ PK  id           │
                         │     name         │
                         │ UQ  email        │
                         │     password     │
                         │     role (ENUM)  │
                         │     is_active    │
                         └───────┬──────────┘
                                 │
                    ┌────────────┼────────────┐
                    │ 1:1        │            │ 1:1
                    ▼            │            ▼
          ┌─────────────────┐   │   ┌─────────────────┐
          │    students     │   │   │    teachers      │
          │─────────────────│   │   │─────────────────│
          │ PK  id          │   │   │ PK  id          │
          │ FK  user_id(UQ) │   │   │ FK  user_id(UQ) │
          │ UQ  roll_number │   │   │     department   │
          │     department  │   │   │     designation  │
          │     semester    │   │   └────────┬────────┘
          │     admission_yr│   │            │
          └──┬──────────┬───┘   │            │
             │          │       │            │ 1:N
             │          │       │            ▼
             │          │       │   ┌─────────────────┐
             │          │       │   │    subjects      │
             │          │       │   │─────────────────│
             │          │       │   │ PK  id          │
             │          │       │   │ UQ  (code,year) │
             │          │       │   │ FK  teacher_id  │
             │          │       │   │     subject_code│
             │          │       │   │     subject_name│
             │          │       │   │     department  │
             │          │       │   │     semester    │
             │          │       │   │     academic_yr │
             │          │       │   └──┬─────┬────┬──┘
             │     N:M  │       │      │     │    │
             │     via  │       │      │     │    │
             │          ▼       │      │     │    │
             │  ┌──────────────────┐   │     │    │
             │  │   enrollments    │   │     │    │
             │  │──────────────────│   │     │    │
             │  │ PK  id           │   │     │    │
             │  │ FK  student_id   │◄──┘     │    │
             │  │ FK  subject_id   │◄────────┘    │
             │  │ UQ  (stud,subj)  │              │
             │  └──────────────────┘              │
             │                                    │
             │                         ┌──────────┘
             │                         │
             │               ┌─────────▼──────────┐        ┌──────────────────┐
             │               │ attendance_sessions │        │  session_tokens   │
             │               │────────────────────│        │──────────────────│
             │               │ PK  id             │ 1:N    │ PK  id           │
             │               │ FK  subject_id     │───────→│ FK  session_id   │
             │               │ FK  teacher_id     │        │ UQ  token        │
             │               │     session_date   │        │     expires_at   │
             │               │     start_time     │        │     is_used      │
             │               │     status (ENUM)  │        └──────────────────┘
             │               │     total_present  │
             │               │     total_absent   │
             │               └─────────┬──────────┘
             │                         │ 1:N
             │                         ▼
             │               ┌────────────────────┐
             │               │ attendance_records  │
             │               │────────────────────│
             │               │ PK  id             │
             │               │ FK  session_id     │
             │               │ FK  student_id     │◄──────── (from students)
             │               │ UQ  (stud,session) │
             │               │     status (ENUM)  │
             │               │     check_in_time  │
             │               │     ip_address     │
             │               └────────────────────┘
             │
             │
             │           ┌────────────────────┐       ┌──────────────────────┐
             │           │    assignments     │       │       marks          │
             │           │────────────────────│       │──────────────────────│
             │           │ PK  id            │       │ PK  id               │
             │           │ FK  subject_id    │       │ FK  student_id       │◄── (students)
             │           │ FK  created_by    │       │ FK  subject_id       │
             │           │     title         │       │ FK  assignment_id    │
             │           │     max_marks     │       │ FK  entered_by       │
             │           │     due_date      │       │     exam_type (ENUM) │
             │           └────────────────────┘       │     marks_obtained   │
             │                                        │     max_marks        │
             │                                        │ UQ  (stud,subj,     │
             │                                        │      type,assign)   │
             │                                        └──────────────────────┘
             │
             │
             │           ┌──────────────────────────┐
             └──────────→│   performance_records    │
                         │──────────────────────────│
                         │ PK  id                   │
                         │ FK  student_id           │
                         │ FK  subject_id           │
                         │ UQ  (student, subject)   │
                         │     attendance_pct       │
                         │     attendance_marks     │
                         │     assignment_marks     │
                         │     isa_total            │
                         │     mse_marks            │
                         │     ese_marks            │
                         │     total_marks          │
                         │     grade                │
                         │     is_at_risk           │
                         │     risk_reason          │
                         └──────────────────────────┘
```

---

## 1. Table Structures — Detailed Breakdown

### 1.1 `users`

Central authentication table shared across all roles.

| Column     | Type         | Constraints      | Purpose                        |
|------------|--------------|------------------|--------------------------------|
| id         | INT AUTO_INC | PRIMARY KEY      | Unique user identifier         |
| name       | VARCHAR(100) | NOT NULL         | Full name                      |
| email      | VARCHAR(150) | NOT NULL, UNIQUE | Login identifier               |
| password   | VARCHAR(255) | NOT NULL         | bcrypt hash (never plaintext)  |
| role       | ENUM         | NOT NULL         | 'admin', 'teacher', 'student'  |
| is_active  | BOOLEAN      | DEFAULT TRUE     | Soft-delete / deactivation     |
| created_at | TIMESTAMP    | DEFAULT NOW()    | Account creation time          |
| updated_at | TIMESTAMP    | ON UPDATE NOW()  | Last modification time         |

**Design decision**: A single `users` table holds credentials for every role. This simplifies JWT authentication — the login endpoint queries one table regardless of role. Role-specific data lives in `students` and `teachers` tables linked via foreign key.

---

### 1.2 `students`

| Column         | Type        | Constraints               | Purpose                   |
|----------------|-------------|---------------------------|---------------------------|
| id             | INT AUTO_INC| PRIMARY KEY               | Student record identifier |
| user_id        | INT         | FK → users(id), UNIQUE    | Links to login account    |
| roll_number    | VARCHAR(20) | NOT NULL, UNIQUE          | Academic roll number      |
| department     | VARCHAR(100)| NOT NULL                  | e.g. 'Computer Science'  |
| semester       | INT         | NOT NULL                  | Current semester          |
| admission_year | YEAR        | NOT NULL                  | Year of admission         |

**Why separate from `users`?** Not every user is a student. Admins and teachers don't have roll numbers or semesters. The `UNIQUE(user_id)` constraint enforces a strict **one-to-one** relationship.

---

### 1.3 `teachers`

| Column      | Type         | Constraints            | Purpose                   |
|-------------|--------------|------------------------|---------------------------|
| id          | INT AUTO_INC | PRIMARY KEY            | Teacher record identifier |
| user_id     | INT          | FK → users(id), UNIQUE | Links to login account    |
| department  | VARCHAR(100) | NOT NULL               | Faculty department        |
| designation | VARCHAR(100) | DEFAULT 'Asst Prof'    | Academic title            |

---

### 1.4 `subjects`

| Column        | Type         | Constraints                        | Purpose                    |
|---------------|--------------|-------------------------------------|----------------------------|
| id            | INT AUTO_INC | PRIMARY KEY                        | Subject identifier          |
| subject_code  | VARCHAR(20)  | NOT NULL                           | e.g. 'CS301'               |
| subject_name  | VARCHAR(150) | NOT NULL                           | Full subject name           |
| department    | VARCHAR(100) | NOT NULL                           | Offering department         |
| semester      | INT          | NOT NULL                           | Which semester              |
| academic_year | VARCHAR(9)   | NOT NULL                           | e.g. '2025-2026'           |
| teacher_id    | INT          | FK → teachers(id), ON DELETE RESTRICT | Assigned teacher         |

**UNIQUE(subject_code, academic_year)**: The same subject code can exist across different academic years, but not duplicated within the same year.

**ON DELETE RESTRICT on teacher_id**: You cannot delete a teacher who has assigned subjects — reassign first.

---

### 1.5 `enrollments`

| Column      | Type         | Constraints                   | Purpose                 |
|-------------|--------------|-------------------------------|-------------------------|
| id          | INT AUTO_INC | PRIMARY KEY                   | Enrollment identifier   |
| student_id  | INT          | FK → students(id)             | Which student           |
| subject_id  | INT          | FK → subjects(id)             | Which subject           |
| enrolled_at | TIMESTAMP    | DEFAULT NOW()                 | When enrolled           |

**UNIQUE(student_id, subject_id)**: Prevents a student from being enrolled in the same subject twice. This is the junction table for the **many-to-many** relationship between students and subjects.

---

### 1.6 `attendance_sessions`

| Column        | Type         | Constraints           | Purpose                         |
|---------------|--------------|-----------------------|---------------------------------|
| id            | INT AUTO_INC | PRIMARY KEY           | Session identifier              |
| subject_id    | INT          | FK → subjects(id)     | Which subject's class           |
| teacher_id    | INT          | FK → teachers(id)     | Who started the session         |
| session_date  | DATE         | NOT NULL              | Calendar date of class          |
| start_time    | TIME         | NOT NULL              | When session started            |
| end_time      | TIME         | DEFAULT NULL          | When session ended              |
| status        | ENUM         | DEFAULT 'ACTIVE'      | ACTIVE → CLOSED → EXPIRED      |
| total_present | INT          | DEFAULT 0             | Cached count for fast queries   |
| total_absent  | INT          | DEFAULT 0             | Cached count for fast queries   |
| created_at    | TIMESTAMP    | DEFAULT NOW()         | Record creation time            |

**Status lifecycle**:
```
ACTIVE  →  teacher starts session, students can check in
CLOSED  →  teacher manually closes, no more check-ins
EXPIRED →  system auto-expires after session_token.expires_at passes
```

---

### 1.7 `session_tokens`

| Column     | Type         | Constraints              | Purpose                          |
|------------|--------------|--------------------------|----------------------------------|
| id         | INT AUTO_INC | PRIMARY KEY              | Token record identifier          |
| session_id | INT          | FK → attendance_sessions | Which session this token is for  |
| token      | VARCHAR(255) | NOT NULL, UNIQUE         | UUID v4 embedded in QR code      |
| expires_at | DATETIME     | NOT NULL                 | Typically NOW() + 5 minutes      |
| is_used    | BOOLEAN      | DEFAULT FALSE            | Revoked when session closes      |
| created_at | TIMESTAMP    | DEFAULT NOW()            | When token was generated         |

**Why a separate table?** A session might regenerate its QR token (e.g., teacher refreshes the QR). Each regeneration creates a new row, invalidating the old one. The **UNIQUE(token)** constraint ensures no two QR codes ever share the same string.

---

### 1.8 `attendance_records`

| Column        | Type         | Constraints                  | Purpose                        |
|---------------|--------------|------------------------------|--------------------------------|
| id            | INT AUTO_INC | PRIMARY KEY                  | Record identifier              |
| session_id    | INT          | FK → attendance_sessions(id) | Which session                  |
| student_id    | INT          | FK → students(id)            | Which student                  |
| status        | ENUM         | DEFAULT 'ABSENT'             | PRESENT / ABSENT / LATE        |
| check_in_time | DATETIME     | DEFAULT NULL                 | When QR was scanned            |
| ip_address    | VARCHAR(45)  | DEFAULT NULL                 | Client IP for audit trail      |
| created_at    | TIMESTAMP    | DEFAULT NOW()                | Record creation                |

**UNIQUE(student_id, session_id)**: This is the critical constraint — a student **cannot have two attendance records for the same session**. If they try to scan the QR code twice, the database will reject the duplicate insert.

---

### 1.9 `assignments`

| Column      | Type         | Constraints             | Purpose                     |
|-------------|--------------|-------------------------|-----------------------------|
| id          | INT AUTO_INC | PRIMARY KEY             | Assignment identifier       |
| subject_id  | INT          | FK → subjects(id)       | Which subject               |
| title       | VARCHAR(200) | NOT NULL                | Assignment name             |
| description | TEXT         | DEFAULT NULL            | Detailed description        |
| max_marks   | DECIMAL(5,2) | NOT NULL                | Maximum possible score      |
| due_date    | DATE         | DEFAULT NULL            | Submission deadline         |
| created_by  | INT          | FK → teachers(id)       | Which teacher created it    |
| created_at  | TIMESTAMP    | DEFAULT NOW()           | Creation time               |

---

### 1.10 `marks`

| Column         | Type         | Constraints                                | Purpose                      |
|----------------|--------------|---------------------------------------------|------------------------------|
| id             | INT AUTO_INC | PRIMARY KEY                                | Score record identifier       |
| student_id     | INT          | FK → students(id)                          | Which student                 |
| subject_id     | INT          | FK → subjects(id)                          | Which subject                 |
| exam_type      | ENUM         | NOT NULL                                   | ISA1, ISA2, MSE, ESE, ASSIGNMENT |
| assignment_id  | INT          | FK → assignments(id), DEFAULT NULL         | Only for ASSIGNMENT type      |
| marks_obtained | DECIMAL(5,2) | NOT NULL                                   | Actual score                  |
| max_marks      | DECIMAL(5,2) | NOT NULL                                   | Maximum possible              |
| entered_by     | INT          | FK → teachers(id)                          | Who entered the marks         |
| remarks        | VARCHAR(255) | DEFAULT NULL                               | Optional teacher comment      |

**UNIQUE(student_id, subject_id, exam_type, assignment_id)**: This composite unique constraint handles two scenarios:
- For ISA1/ISA2/MSE/ESE: `assignment_id` is NULL, so uniqueness is on `(student, subject, type, NULL)` — one score per exam type.
- For ASSIGNMENT: `assignment_id` is set, so a student can have marks for multiple assignments in the same subject.

---

### 1.11 `performance_records`

| Column            | Type         | Constraints            | Purpose                              |
|-------------------|--------------|------------------------|--------------------------------------|
| id                | INT AUTO_INC | PRIMARY KEY            | Record identifier                    |
| student_id        | INT          | FK → students(id)      | Which student                        |
| subject_id        | INT          | FK → subjects(id)      | Which subject                        |
| attendance_pct    | DECIMAL(5,2) | DEFAULT 0              | (present / total) × 100             |
| attendance_marks  | DECIMAL(5,2) | DEFAULT 0              | Marks awarded for attendance         |
| assignment_marks  | DECIMAL(5,2) | DEFAULT 0              | Average or total assignment score    |
| isa_total         | DECIMAL(5,2) | DEFAULT 0              | ISA1 + ISA2 combined                 |
| mse_marks         | DECIMAL(5,2) | DEFAULT 0              | Mid-Semester Exam score              |
| ese_marks         | DECIMAL(5,2) | DEFAULT 0              | End-Semester Exam score              |
| total_marks       | DECIMAL(5,2) | DEFAULT 0              | ISA + MSE + ESE grand total          |
| max_possible      | DECIMAL(5,2) | DEFAULT 0              | Maximum achievable total             |
| grade             | VARCHAR(2)   | DEFAULT NULL           | Computed letter grade                |
| is_at_risk        | BOOLEAN      | DEFAULT FALSE          | Flag for at-risk students            |
| risk_reason       | VARCHAR(255) | DEFAULT NULL           | Human-readable risk explanation      |
| last_calculated_at| TIMESTAMP    | ON UPDATE NOW()        | When this was last recomputed        |

**UNIQUE(student_id, subject_id)**: One aggregated performance snapshot per student per subject.

**Why materialized?** Dashboards need instant load times. Instead of joining `attendance_records`, `marks`, and `enrollments` on every page load, the app recalculates this table whenever marks or attendance change. Chart.js queries read directly from this table.

---

## 2. Primary Keys Summary

| Table                | Primary Key | Type          |
|----------------------|-------------|---------------|
| users                | id          | INT AUTO_INC  |
| students             | id          | INT AUTO_INC  |
| teachers             | id          | INT AUTO_INC  |
| subjects             | id          | INT AUTO_INC  |
| enrollments          | id          | INT AUTO_INC  |
| attendance_sessions  | id          | INT AUTO_INC  |
| session_tokens       | id          | INT AUTO_INC  |
| attendance_records   | id          | INT AUTO_INC  |
| assignments          | id          | INT AUTO_INC  |
| marks                | id          | INT AUTO_INC  |
| performance_records  | id          | INT AUTO_INC  |

All tables use surrogate integer keys for consistency, indexing performance, and simpler JOIN syntax.

---

## 3. Foreign Keys Summary

```
students.user_id             → users.id              (ON DELETE CASCADE)
teachers.user_id             → users.id              (ON DELETE CASCADE)
subjects.teacher_id          → teachers.id            (ON DELETE RESTRICT)
enrollments.student_id       → students.id            (ON DELETE CASCADE)
enrollments.subject_id       → subjects.id            (ON DELETE CASCADE)
attendance_sessions.subject_id → subjects.id          (ON DELETE CASCADE)
attendance_sessions.teacher_id → teachers.id          (ON DELETE RESTRICT)
session_tokens.session_id    → attendance_sessions.id (ON DELETE CASCADE)
attendance_records.session_id → attendance_sessions.id(ON DELETE CASCADE)
attendance_records.student_id → students.id           (ON DELETE CASCADE)
assignments.subject_id       → subjects.id            (ON DELETE CASCADE)
assignments.created_by       → teachers.id            (ON DELETE RESTRICT)
marks.student_id             → students.id            (ON DELETE CASCADE)
marks.subject_id             → subjects.id            (ON DELETE CASCADE)
marks.assignment_id          → assignments.id         (ON DELETE SET NULL)
marks.entered_by             → teachers.id            (ON DELETE RESTRICT)
performance_records.student_id → students.id          (ON DELETE CASCADE)
performance_records.subject_id → subjects.id          (ON DELETE CASCADE)
```

### Delete Behavior Strategy

| Behavior     | Used For                          | Rationale                                    |
|--------------|-----------------------------------|----------------------------------------------|
| CASCADE      | Student/enrollment data           | If a student is removed, all their records go |
| RESTRICT     | Teacher references in subjects    | Cannot delete a teacher with active subjects  |
| SET NULL     | marks.assignment_id               | If an assignment is deleted, keep the score   |

---

## 4. Unique Constraints Summary

| Table               | Unique Constraint                              | Purpose                                 |
|---------------------|------------------------------------------------|-----------------------------------------|
| users               | (email)                                        | No duplicate login accounts             |
| students            | (user_id)                                      | One-to-one with users                   |
| students            | (roll_number)                                  | No duplicate roll numbers               |
| teachers            | (user_id)                                      | One-to-one with users                   |
| subjects            | (subject_code, academic_year)                  | Same code allowed across years          |
| enrollments         | (student_id, subject_id)                       | No duplicate enrollments                |
| session_tokens      | (token)                                        | Every QR token is globally unique       |
| attendance_records  | (student_id, session_id)                       | **One check-in per student per session**|
| marks               | (student_id, subject_id, exam_type, assignment_id) | One score per exam per student      |
| performance_records | (student_id, subject_id)                       | One summary per student per subject     |

---

## 5. Relationships Between Tables

```
Relationship Type    │  Tables Involved                      │  Cardinality
─────────────────────┼───────────────────────────────────────┼──────────────
One-to-One           │  users ↔ students                     │  1:1
One-to-One           │  users ↔ teachers                     │  1:1
One-to-Many          │  teachers → subjects                  │  1:N
One-to-Many          │  subjects → attendance_sessions       │  1:N
One-to-Many          │  teachers → attendance_sessions       │  1:N
One-to-Many          │  attendance_sessions → session_tokens │  1:N
One-to-Many          │  attendance_sessions → attendance_records │ 1:N
One-to-Many          │  subjects → assignments               │  1:N
One-to-Many          │  students → marks                     │  1:N
One-to-Many          │  subjects → marks                     │  1:N
Many-to-Many         │  students ↔ subjects (via enrollments)│  M:N
```

---

## 6. How the Schema Supports Analytics Queries

### 6.1 — Attendance Percentage Per Student Per Subject

```sql
-- Used by: Student dashboard, Teacher analytics, Chart.js bar charts
SELECT
    st.roll_number,
    u.name,
    s.subject_name,
    COUNT(ar.id) AS total_sessions,
    SUM(ar.status = 'PRESENT') AS present,
    ROUND(SUM(ar.status = 'PRESENT') * 100.0 / COUNT(ar.id), 2) AS pct
FROM attendance_records ar
JOIN attendance_sessions asess ON asess.id = ar.session_id
JOIN subjects s ON s.id = asess.subject_id
JOIN students st ON st.id = ar.student_id
JOIN users u ON u.id = st.user_id
WHERE s.id = ?
GROUP BY st.id;
```

**Indexes used**: `idx_attrec_session`, `idx_attrec_student`, `idx_attsess_subject_date`

---

### 6.2 — Performance Breakdown (ISA + MSE + ESE)

```sql
-- Used by: Performance chart, Grade distribution pie chart
SELECT
    st.roll_number,
    u.name,
    MAX(CASE WHEN m.exam_type = 'ISA1' THEN m.marks_obtained END) AS isa1,
    MAX(CASE WHEN m.exam_type = 'ISA2' THEN m.marks_obtained END) AS isa2,
    MAX(CASE WHEN m.exam_type = 'MSE'  THEN m.marks_obtained END) AS mse,
    MAX(CASE WHEN m.exam_type = 'ESE'  THEN m.marks_obtained END) AS ese,
    SUM(m.marks_obtained) AS total
FROM marks m
JOIN students st ON st.id = m.student_id
JOIN users u ON u.id = st.user_id
WHERE m.subject_id = ? AND m.exam_type IN ('ISA1','ISA2','MSE','ESE')
GROUP BY st.id;
```

**Indexes used**: `idx_marks_student_subject`, `idx_marks_type`

---

### 6.3 — At-Risk Student Detection

```sql
-- Used by: Risk alert dashboard, Email notification system
SELECT * FROM vw_at_risk_students
WHERE subject_id = ?;
```

Or recompute from raw data:

```sql
-- Students with attendance below 75%
SELECT st.roll_number, u.name, att.pct
FROM (
    SELECT ar.student_id,
           ROUND(SUM(ar.status='PRESENT') * 100.0 / COUNT(*), 2) AS pct
    FROM attendance_records ar
    JOIN attendance_sessions asess ON asess.id = ar.session_id
    WHERE asess.subject_id = ?
    GROUP BY ar.student_id
    HAVING pct < 75
) att
JOIN students st ON st.id = att.student_id
JOIN users u ON u.id = st.user_id;
```

---

### 6.4 — Grade Distribution (Chart.js Pie/Doughnut)

```sql
-- Returns counts per grade for a subject
SELECT grade, COUNT(*) AS count
FROM performance_records
WHERE subject_id = ?
GROUP BY grade;
```

---

### 6.5 — Attendance Trend Over Time (Chart.js Line Chart)

```sql
-- Daily attendance trend for a subject
SELECT
    asess.session_date,
    SUM(ar.status = 'PRESENT') AS present,
    SUM(ar.status = 'ABSENT') AS absent
FROM attendance_sessions asess
JOIN attendance_records ar ON ar.session_id = asess.id
WHERE asess.subject_id = ?
GROUP BY asess.session_date
ORDER BY asess.session_date;
```

**Index used**: `idx_attsess_subject_date`

---

### 6.6 — Pre-computed Views for Dashboard Speed

The schema includes three database views that act as ready-made data sources:

| View                      | Purpose                                   | Consumed By             |
|---------------------------|-------------------------------------------|-------------------------|
| `vw_subject_attendance`   | Per-student attendance for any subject    | Teacher analytics page  |
| `vw_student_performance`  | Full marks breakdown per student          | Student dashboard       |
| `vw_at_risk_students`     | Filtered list of at-risk students         | Risk alerts API         |

These views eliminate the need to write complex JOINs in application code — the Express controller simply runs `SELECT * FROM vw_subject_attendance WHERE subject_id = ?`.

---

## Performance Formula

```
┌──────────────────────────────────────────────────┐
│              ISA (Internal Assessment)            │
│                                                   │
│   ISA = attendance_marks + assignment_marks       │
│         + ISA1 exam + ISA2 exam                   │
│                                                   │
├───────────────────────────────────────────────────┤
│                                                   │
│   Total = ISA + MSE + ESE                         │
│                                                   │
│   Where:                                          │
│   • attendance_marks = (pct / 100) × max_att_marks│
│   • assignment_marks = avg of assignment scores   │
│   • ISA exam marks   = ISA1 + ISA2 from marks tbl│
│   • MSE              = from marks table           │
│   • ESE              = from marks table           │
│                                                   │
├───────────────────────────────────────────────────┤
│                                                   │
│   Risk Flag:                                      │
│   • is_at_risk = TRUE if:                         │
│     - attendance_pct < 75%       OR               │
│     - total_marks < 40% of max_possible           │
│                                                   │
└───────────────────────────────────────────────────┘
```

---

*Schema file: `sql/schema.sql` — ready to execute against any MySQL 8.0+ instance.*
