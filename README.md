<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/Express-4.x-000000?style=for-the-badge&logo=express&logoColor=white" />
  <img src="https://img.shields.io/badge/MySQL-8.x-4479A1?style=for-the-badge&logo=mysql&logoColor=white" />
  <img src="https://img.shields.io/badge/Chart.js-4.x-FF6384?style=for-the-badge&logo=chartdotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/JWT-Auth-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white" />
  <img src="https://img.shields.io/badge/Bootstrap-5.3-7952B3?style=for-the-badge&logo=bootstrap&logoColor=white" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" />
</p>

# 🎓 Smart Attendance & Performance Analytics System

> A full-stack web application for managing student attendance via QR codes and analyzing academic performance through an interactive, chart-driven dashboard — with role-based access control, campus IP restrictions, and real-time risk alerts.

---

## 📑 Table of Contents

1. [Project Overview](#-project-overview)
2. [Key Features](#-key-features)
3. [System Architecture](#-system-architecture)
4. [Tech Stack](#-tech-stack)
5. [User Roles and Permissions](#-user-roles-and-permissions)
6. [Attendance Workflow](#-attendance-workflow)
7. [Performance Evaluation Model](#-performance-evaluation-model)
8. [Dashboard Analytics](#-dashboard-analytics)
9. [Database Schema Overview](#-database-schema-overview)
10. [API Overview](#-api-overview)
11. [Installation Guide](#-installation-guide)
12. [Running the Project Locally](#-running-the-project-locally)
13. [Environment Variables](#-environment-variables)
14. [Future Improvements](#-future-improvements)
15. [License](#-license)

---

## 📋 Project Overview

The **Smart Attendance & Performance Analytics System** replaces manual, error-prone attendance tracking with a secure, QR-code-based digital workflow and couples it with a comprehensive performance analytics dashboard.

### Problems Solved

| Traditional Approach | This System |
|---|---|
| Paper-based attendance → proxy marking | QR tokens with 5-minute expiry → one scan per student per session |
| Manual mark tabulation in spreadsheets | Automated ISA + MSE + ESE aggregation with grade computation |
| No early-warning for at-risk students | Real-time risk alerts when attendance drops below 50% |
| Attendance possible from anywhere | Campus IP whitelist restricts check-in to on-premise networks |
| Single admin manages everything | Three-tier RBAC (Admin → Teacher → Student) |

---

## ✨ Key Features

- **🔐 Role-Based Access Control** — Admin, Teacher, and Student roles with granular permissions
- **📱 QR-Based Attendance** — Short-lived UUID tokens generated per session; students scan to check in
- **🌐 Campus IP Restriction** — Attendance routes locked to configurable CIDR ranges via middleware
- **📊 Interactive Dashboard** — 5 Chart.js visualizations with lazy-loaded per-subject deep dives
- **⚠️ Risk Alert Engine** — Automatic detection when attendance falls below the 50% threshold
- **🧮 Performance Analytics** — ISA + MSE + ESE breakdown with grade computation
- **🔒 JWT Authentication** — Stateless token-based auth with 8-hour expiry
- **🛡️ Rate Limiting** — Brute-force protection on login (20/15min) and check-in (10/1min) endpoints
- **📱 Responsive Design** — Bootstrap 5 grid adapts from desktop to mobile

---

## 🏗 System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                               │
│  ┌──────────┐  ┌───────────────────┐  ┌──────────────────────────┐  │
│  │ Login    │  │ Student Dashboard │  │ Teacher / Admin Panels   │  │
│  │ Page     │  │ (Chart.js)        │  │ (Future)                 │  │
│  └────┬─────┘  └────────┬──────────┘  └───────────┬──────────────┘  │
│       │                 │                          │                 │
│       └─────────────────┼──────────────────────────┘                 │
│                         │  Authorization: Bearer <JWT>              │
├─────────────────────────┼───────────────────────────────────────────┤
│                    API GATEWAY                                      │
│            Express.js + Rate Limiting + CORS                        │
├─────────────────────────┼───────────────────────────────────────────┤
│                   MIDDLEWARE CHAIN                                   │
│  ┌──────────┐  ┌────────────┐  ┌─────────────┐                     │
│  │ JWT Auth │→ │ Role Guard │→ │ IP Whitelist │  (conditional)      │
│  └──────────┘  └────────────┘  └─────────────┘                     │
├─────────────────────────┼───────────────────────────────────────────┤
│                   CONTROLLER LAYER                                  │
│  Auth │ Admin │ Attendance │ Marks │ Student │ Analytics            │
├─────────────────────────┼───────────────────────────────────────────┤
│                   DATA LAYER                                        │
│             MySQL 8.x  (mysql2/promise pool)                        │
│          11 Tables  ·  3 Views  ·  Indexes                          │
└─────────────────────────────────────────────────────────────────────┘
```

### Request Lifecycle

```
Client Request
      │
      ▼
  express.json()       ← Parse body
      │
      ▼
  Rate Limiter         ← Throttle abusive clients
      │
      ▼
  auth middleware       ← Verify JWT, attach req.user = { id, role }
      │
      ▼
  roleGuard(roles...)   ← Check req.user.role ∈ allowedRoles
      │
      ▼
  ipWhitelist           ← (only on /sessions/start & /attendance/check-in)
      │
      ▼
  Controller Logic      ← Business logic + SQL queries
      │
      ▼
  JSON Response         ← { success: true/false, data/message }
```

---

## 🛠 Tech Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| **Runtime** | Node.js | 18+ | Server-side JavaScript |
| **Framework** | Express.js | 4.21 | REST API framework |
| **Database** | MySQL | 8.x | Relational data storage |
| **ORM / Driver** | mysql2 | 3.11 | Promise-based MySQL driver with connection pooling |
| **Auth** | jsonwebtoken | 9.0 | JWT creation & verification |
| **Hashing** | bcrypt | 5.1 | Password hashing (10 salt rounds) |
| **QR Tokens** | uuid | 10.0 | UUID v4 for short-lived session tokens |
| **Security** | express-rate-limit | 7.4 | Brute-force protection |
| **Frontend** | Bootstrap | 5.3.2 | Responsive UI framework |
| **Charts** | Chart.js | 4.4.1 | Data visualization (bar, radar, line, doughnut) |
| **Icons** | Bootstrap Icons | 1.11.1 | UI iconography |
| **Dev Tools** | nodemon | 3.1 | Auto-restart on file changes |

---

## 👥 User Roles and Permissions

### Permission Matrix

| Capability | Admin | Teacher | Student |
|:---|:---:|:---:|:---:|
| Create teachers | ✅ | — | — |
| Create students | ✅ | — | — |
| Create subjects | ✅ | — | — |
| Enroll students into subjects | ✅ | — | — |
| Start attendance session | — | ✅ | — |
| Generate QR code for session | — | ✅ | — |
| Close session (auto-mark absentees) | — | ✅ | — |
| Verify attendance checklist | — | ✅ | — |
| Enter ISA / MSE / ESE marks | — | ✅ | — |
| View subject analytics | — | ✅ | — |
| Scan QR to check in | — | — | ✅ |
| View attendance history | — | — | ✅ |
| View performance dashboard | — | — | ✅ |
| View risk alerts | — | — | ✅ |

### Middleware Chaining per Zone

```
Public Zone    →  No middleware             (POST /api/auth/login)
General Zone   →  auth                      (GET  /api/auth/me)
Role Zone      →  auth → roleGuard(role)    (POST /api/admin/teachers)
Secure Zone    →  auth → ipWhitelist → role (POST /api/sessions/start)
```

---

## 📱 Attendance Workflow

```
 ┌─────────────┐         ┌──────────────┐         ┌─────────────┐
 │   TEACHER   │         │    SERVER     │         │   STUDENT   │
 └──────┬──────┘         └──────┬───────┘         └──────┬──────┘
        │                       │                        │
        │  1. Start Session     │                        │
        │  POST /sessions/start │                        │
        │  {subject, date, slot}│                        │
        │──────────────────────►│                        │
        │                       │                        │
        │  2. UUID Token        │                        │
        │  (5 min expiry)       │                        │
        │◄──────────────────────│                        │
        │                       │                        │
        │  3. Display QR Code   │                        │
        │  ┌──────────┐        │                        │
        │  │ ██ QR ██ │        │                        │
        │  └──────────┘        │                        │
        │                       │   4. Scan QR Code      │
        │                       │   POST /attendance/    │
        │                       │        check-in        │
        │                       │   { token }            │
        │                       │◄───────────────────────│
        │                       │                        │
        │                       │   5. Validate:         │
        │                       │   • Token exists?      │
        │                       │   • Not expired?       │
        │                       │   • Not revoked?       │
        │                       │   • Session active?    │
        │                       │   • Student enrolled?  │
        │                       │   • No duplicate?      │
        │                       │   • Campus IP?         │
        │                       │                        │
        │                       │   6. Mark PRESENT      │
        │                       │───────────────────────►│
        │                       │                        │
        │  7. Close Session     │                        │
        │  POST /sessions/close │                        │
        │──────────────────────►│                        │
        │                       │  8. Mark remaining     │
        │                       │     as ABSENT           │
        └───────────────────────┴────────────────────────┘
```

### Validation Rules (7-Step Check-In)

| Step | Check | Failure Response |
|---|---|---|
| 1 | Token exists in `session_tokens` | `404` — Invalid token |
| 2 | Token not expired (`expires_at > NOW()`) | `410` — Token expired |
| 3 | Token not revoked (`is_revoked = 0`) | `410` — Token revoked |
| 4 | Parent session is still `active` | `409` — Session closed |
| 5 | Student profile exists in `students` table | `404` — Profile not found |
| 6 | Student enrolled in the session's subject | `403` — Not enrolled |
| 7 | No duplicate record for this student + session | `409` — Already checked in |

---

## 🧮 Performance Evaluation Model

Student performance follows a **multi-component evaluation** model:

```
┌─────────────────────────────────────────────────────┐
│              TOTAL PERFORMANCE SCORE                 │
│                                                     │
│   ISA (Internal Sessional Assessment)               │
│   ├── Attendance Marks                              │
│   └── Assignment Marks                              │
│                                                     │
│   MSE (Mid-Semester Exam)                           │
│   └── Mid-semester exam marks                       │
│                                                     │
│   ESE (End-Semester Exam)                           │
│   └── End-semester exam marks                       │
│                                                     │
│   Total = ISA₁ + ISA₂ + MSE + ESE                  │
│                                                     │
│   Grade = f(Total / Max_Possible × 100)             │
└─────────────────────────────────────────────────────┘
```

### Marks Entry (Teacher)

Teachers submit marks via dedicated endpoints that use **upsert** logic (`ON DUPLICATE KEY UPDATE`) — so re-submission overwrites cleanly:

| Endpoint | Exam Component |
|---|---|
| `POST /api/marks/isa1` | ISA 1 |
| `POST /api/marks/isa2` | ISA 2 |
| `POST /api/marks/mse` | Mid-Semester |
| `POST /api/marks/ese` | End-Semester |
| `POST /api/marks/assignment` | Assignment |

---

## 📊 Dashboard Analytics

The **Student Dashboard** renders five chart types using **Chart.js 4.x**:

| Chart | Type | What It Visualizes |
|---|---|---|
| Attendance per Subject | Horizontal Bar | Color-coded bars: 🟢 ≥75%, 🟠 50–74%, 🔴 <50% |
| Performance Comparison | Radar | ISA vs MSE vs ESE percentages overlaid per subject |
| Attendance Trend | Line (filled) | Present vs Absent session counts across subjects |
| Attendance Breakdown | Doughnut | Present/Absent ratio per subject (inside accordion) |
| ISA vs MSE vs ESE | Grouped Bar | Obtained vs Maximum marks per component (inside accordion) |

### Dashboard Layout

```
┌───────────────────────────────────────────────────────┐
│  NAVBAR                                    [Logout]   │
├───────────┬───────────┬───────────┬───────────────────┤
│ Subjects  │ Avg       │ Avg       │ Risk              │
│ Enrolled  │ Attendance│ Marks     │ Alerts             │
│    5      │   72.4%   │  68.1%    │    2               │
├───────────┴───────────┴───────────┴───────────────────┤
│  ⚠️ RISK ALERT BANNER (if any subject < 50%)         │
├──────────────────────────┬────────────────────────────┤
│  📊 Attendance Bar Chart │  📊 Performance Radar      │
│     (horizontal bars)    │     (ISA / MSE / ESE)      │
├──────────────────────────┴────────────────────────────┤
│  📈 Attendance Trend (Present vs Absent — full width) │
├───────────────────────────────────────────────────────┤
│  ▶ CS301 — Data Structures         [72% ⚠ Warning]   │
│  ▶ CS302 — Operating Systems       [89% ✓ Safe]      │
│  ▶ CS303 — DBMS                    [45% ✗ At Risk]   │
│    └─ expanded: progress bar, marks table,            │
│       doughnut chart, bar comparison chart             │
└───────────────────────────────────────────────────────┘
```

### Collapsible Subject Panels

Each accordion panel provides a **deep-dive** into a single subject:

- **Required Attendance Indicator** — Calculates consecutive sessions needed to reach 75%
- **Progress Bar** — Color-coded by attendance threshold
- **Marks Table** — ISA1 / ISA2 / MSE / ESE with percentages and overall grade
- **Doughnut Chart** — Present vs Absent breakdown (lazy-rendered on expand)
- **Comparison Bar** — Obtained vs Maximum for each exam component

Charts inside collapsed panels use **lazy initialization** — they render only when the panel is expanded via Bootstrap's `shown.bs.collapse` event, ensuring correct canvas dimensions.

---

## 🗄 Database Schema Overview

The system uses **11 relational tables** and **3 analytical views**:

```
┌──────────────┐      ┌──────────────┐       ┌──────────────┐
│    users     │      │   students   │       │   teachers   │
│──────────────│      │──────────────│       │──────────────│
│ id (PK)      │◄─┐   │ id (PK)      │       │ id (PK)      │
│ username     │  │   │ user_id (FK) │───────│ user_id (FK) │
│ password     │  │   │ roll_number  │       │ department   │
│ role         │  │   │ name         │       └──────────────┘
│ display_name │  └───│ department   │
└──────────────┘      └──────┬───────┘
                             │
    ┌────────────────────────┼────────────────────────┐
    │                        │                        │
    ▼                        ▼                        ▼
┌──────────────┐   ┌──────────────────┐   ┌──────────────────┐
│ enrollments  │   │attendance_records│   │     marks        │
│──────────────│   │──────────────────│   │──────────────────│
│ student_id   │   │ student_id (FK)  │   │ student_id (FK)  │
│ subject_id   │   │ session_id (FK)  │   │ subject_id (FK)  │
│ semester     │   │ status           │   │ exam_type        │
└──────┬───────┘   │ check_in_time    │   │ marks_obtained   │
       │           └──────────────────┘   │ max_marks        │
       ▼                                  └──────────────────┘
┌──────────────┐   ┌──────────────────┐   ┌──────────────────┐
│   subjects   │   │attendance_session│   │  session_tokens  │
│──────────────│   │──────────────────│   │──────────────────│
│ id (PK)      │◄──│ subject_id (FK)  │──►│ session_id (FK)  │
│ subject_code │   │ teacher_id (FK)  │   │ token (UUID)     │
│ subject_name │   │ date / slot      │   │ expires_at       │
│ semester     │   │ status           │   │ is_revoked       │
└──────────────┘   └──────────────────┘   └──────────────────┘

┌──────────────────┐    ┌──────────────┐
│performance_record│    │ assignments  │
│──────────────────│    │──────────────│
│ student_id (FK)  │    │ subject_id   │
│ subject_id (FK)  │    │ title        │
│ total_marks      │    │ max_marks    │
│ max_possible     │    │ due_date     │
│ grade            │    └──────────────┘
└──────────────────┘
```

### Analytical Views

| View | Purpose |
|---|---|
| `vw_subject_attendance` | Aggregates per-student attendance percentage per subject |
| `vw_student_performance` | Joins marks across exam types for a unified performance view |
| `vw_at_risk_students` | Identifies students with attendance below 50% threshold |

---

## 🔌 API Overview

All API routes are prefixed with `/api`. Authenticated routes require the header:

```
Authorization: Bearer <JWT_TOKEN>
```

### Authentication

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `POST` | `/api/auth/login` | — | — | Login, receive JWT |
| `POST` | `/api/auth/logout` | ✅ | Any | Logout (stateless) |
| `GET` | `/api/auth/me` | ✅ | Any | Get current user profile |

### Admin

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `POST` | `/api/admin/teachers` | ✅ | Admin | Create teacher account |
| `POST` | `/api/admin/students` | ✅ | Admin | Create student account |
| `POST` | `/api/admin/subjects` | ✅ | Admin | Create subject |
| `POST` | `/api/admin/enrollments` | ✅ | Admin | Enroll student in subject |

### Attendance

| Method | Endpoint | Auth | Role | IP Lock | Description |
|---|---|---|---|---|---|
| `POST` | `/api/sessions/start` | ✅ | Teacher | 🔒 Campus | Start session, get QR token |
| `POST` | `/api/attendance/check-in` | ✅ | Student | 🔒 Campus | Scan QR token to check in |
| `GET` | `/api/attendance/verify/:id` | ✅ | Teacher | — | View session checklist |
| `POST` | `/api/sessions/close/:id` | ✅ | Teacher | — | Close session, mark absentees |

### Marks

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `POST` | `/api/marks/isa1` | ✅ | Teacher | Submit ISA-1 marks |
| `POST` | `/api/marks/isa2` | ✅ | Teacher | Submit ISA-2 marks |
| `POST` | `/api/marks/mse` | ✅ | Teacher | Submit MSE marks |
| `POST` | `/api/marks/ese` | ✅ | Teacher | Submit ESE marks |
| `POST` | `/api/marks/assignment` | ✅ | Teacher | Submit assignment marks |

### Student

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `GET` | `/api/student/attendance` | ✅ | Student | Attendance history |
| `GET` | `/api/student/dashboard` | ✅ | Student | Combined dashboard data |
| `GET` | `/api/student/performance` | ✅ | Student | Performance records |
| `GET` | `/api/student/risk-alerts` | ✅ | Student | At-risk subjects |

### Analytics (Teacher)

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `GET` | `/api/analytics/subjects` | ✅ | Teacher | List assigned subjects |
| `GET` | `/api/analytics/subject/:id` | ✅ | Teacher | Full subject analytics |

---

## ⚙️ Installation Guide

### Prerequisites

- **Node.js** ≥ 18.x — [Download](https://nodejs.org/)
- **MySQL** ≥ 8.x — [Download](https://dev.mysql.com/downloads/)
- **Git** — [Download](https://git-scm.com/)

### Step-by-Step Setup

```bash
# 1. Clone the repository
git clone https://github.com/your-username/smart-attendance-system.git
cd smart-attendance-system

# 2. Install dependencies
npm install

# 3. Set up the database
mysql -u root -p < sql/schema.sql

# 4. Configure environment variables
cp .env.example .env
# Edit .env with your MySQL credentials and JWT secret

# 5. Start the server
npm run dev
```

---

## 🚀 Running the Project Locally

### Development Mode (auto-restart)

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

The server starts on the port defined in `.env` (default: `3000`):

```
🚀 Smart Attendance System running on http://localhost:3000
   Health check: http://localhost:3000/api/health
```

### Verify Installation

```bash
# Health check
curl http://localhost:3000/api/health

# Expected response:
# { "success": true, "message": "Server is running.", "timestamp": "..." }
```

### Default Admin Account

The database schema seeds a default admin user:

| Field | Value |
|---|---|
| Username | `admin` |
| Password | `admin123` |
| Role | `admin` |

> ⚠️ **Change the default admin password immediately in production.**

---

## 🔐 Environment Variables

Create a `.env` file in the project root (or copy from `.env.example`):

```env
# ── Server ──
PORT=3000

# ── MySQL ──
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=smart_attendance_db

# ── JWT ──
JWT_SECRET=your_super_secret_key_here
JWT_EXPIRES_IN=8h

# ── IP Whitelist (comma-separated CIDR ranges) ──
WHITELIST_IPS=10.0.0.0/8,172.16.0.0/12,192.168.1.0/24,127.0.0.1/32

# ── QR Token ──
QR_TOKEN_EXPIRY_MINUTES=5
```

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port (default: `3000`) |
| `DB_HOST` | Yes | MySQL host |
| `DB_PORT` | No | MySQL port (default: `3306`) |
| `DB_USER` | Yes | MySQL username |
| `DB_PASSWORD` | Yes | MySQL password |
| `DB_NAME` | Yes | Database name |
| `JWT_SECRET` | Yes | Secret key for signing JWTs |
| `JWT_EXPIRES_IN` | No | Token expiry duration (default: `8h`) |
| `WHITELIST_IPS` | No | Comma-separated CIDR ranges for campus IP restriction |
| `QR_TOKEN_EXPIRY_MINUTES` | No | QR token lifetime in minutes (default: `5`) |

---

## 🗂 Project Structure

```
smart-attendance-system/
├── config/
│   └── db.js                   # MySQL connection pool
├── controllers/
│   ├── adminController.js      # Admin CRUD operations
│   ├── analyticsController.js  # Teacher analytics
│   ├── attendanceController.js # QR sessions & check-in
│   ├── authController.js       # Login / Logout / Me
│   ├── marksController.js      # ISA / MSE / ESE entry
│   └── studentController.js    # Student data endpoints
├── middleware/
│   ├── auth.js                 # JWT verification
│   ├── ipWhitelist.js          # Campus IP CIDR matching
│   └── roleGuard.js            # RBAC enforcement
├── public/
│   ├── css/
│   │   └── dashboard.css       # Dashboard custom styles
│   ├── js/
│   │   ├── api.js              # JWT-authenticated fetch wrapper
│   │   └── studentDashboard.js # Chart rendering & UI logic
│   ├── pages/
│   │   └── studentDashboard.html
│   └── login.html
├── routes/
│   ├── adminRoutes.js
│   ├── analyticsRoutes.js
│   ├── attendanceRoutes.js
│   ├── authRoutes.js
│   ├── marksRoutes.js
│   └── studentRoutes.js
├── sql/
│   └── schema.sql              # DDL + seed data
├── .env                        # Environment config (git-ignored)
├── .env.example                # Template for .env
├── server.js                   # Express app entry point
├── package.json
├── ARCHITECTURE.md             # System architecture document
├── DATABASE_DESIGN.md          # Schema design document
└── README.md
```

---

## 🔮 Future Improvements

| Feature | Description |
|---|---|
| 📱 **Mobile QR Scanner** | Native mobile app with camera-based QR scanning |
| 👨‍🏫 **Teacher Dashboard** | Analytics panel with attendance trends, marks distribution, grade curves |
| 🛡️ **Admin Dashboard** | System-wide metrics, user management UI, audit logs |
| 📧 **Email Notifications** | Alert students and parents when attendance drops below threshold |
| 📤 **Report Export** | Download attendance and performance reports as PDF/Excel |
| 🔄 **Real-time Updates** | WebSocket integration for live attendance tracking |
| 🧪 **Unit & Integration Tests** | Jest/Mocha test suites for controllers and middleware |
| 🐳 **Docker Support** | Containerized deployment with Docker Compose |
| 📊 **Advanced Analytics** | Predictive models for student performance using historical data |
| 🔑 **OAuth / SSO** | Integration with institutional identity providers |
| 📝 **Audit Trail** | Log all administrative actions for compliance |
| ♿ **Accessibility (a11y)** | WCAG 2.1 compliance for the dashboard |

---

## 📄 License

This project is licensed under the **MIT License**.

```
MIT License

Copyright (c) 2026 Smart Attendance System

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

<p align="center">
  Built with ❤️ for smarter education management.
</p>
