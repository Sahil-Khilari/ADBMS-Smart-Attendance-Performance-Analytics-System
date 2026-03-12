# Smart Attendance & Performance Analytics System — Architecture & Security Design

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT TIER (Browser)                        │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────────┐ │
│  │  Admin Panel  │  │ Teacher Panel│  │      Student Panel        │ │
│  │  (Bootstrap)  │  │ (Bootstrap)  │  │  (Bootstrap + Chart.js)   │ │
│  └──────┬───────┘  └──────┬───────┘  └────────────┬──────────────┘ │
│         │                 │                        │                │
│         └─────────────────┼────────────────────────┘                │
│                           │  REST API calls (JSON over HTTPS)       │
└───────────────────────────┼─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     APPLICATION TIER (Node.js)                      │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                     Express.js Server                          │ │
│  │                                                                │ │
│  │  ┌──────────┐  ┌──────────────┐  ┌──────────────────────────┐ │ │
│  │  │  CORS    │→ │ IP Whitelist │→ │  JWT Auth Middleware     │ │ │
│  │  │ Middleware│  │ Middleware   │  │  (verify + decode token) │ │ │
│  │  └──────────┘  │ (selective)  │  └──────────┬───────────────┘ │ │
│  │                └──────────────┘             │                  │ │
│  │                                             ▼                  │ │
│  │                          ┌──────────────────────────────┐      │ │
│  │                          │   Role Guard Middleware       │      │ │
│  │                          │   (ADMIN / TEACHER / STUDENT) │      │ │
│  │                          └──────────────┬───────────────┘      │ │
│  │                                         ▼                      │ │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ │ │
│  │  │  Auth      │ │ Attendance │ │ Marks      │ │ Analytics  │ │ │
│  │  │  Routes    │ │ Routes     │ │ Routes     │ │ Routes     │ │ │
│  │  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ │ │
│  │        │               │              │              │         │ │
│  │        ▼               ▼              ▼              ▼         │ │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ │ │
│  │  │  Auth      │ │ Attendance │ │ Marks      │ │ Analytics  │ │ │
│  │  │ Controller │ │ Controller │ │ Controller │ │ Controller │ │ │
│  │  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ │ │
│  │        │               │              │              │         │ │
│  │        ▼               ▼              ▼              ▼         │ │
│  │  ┌─────────────────────────────────────────────────────────┐   │ │
│  │  │              MySQL Connection Pool (mysql2)             │   │ │
│  │  └─────────────────────────┬───────────────────────────────┘   │ │
│  └────────────────────────────┼───────────────────────────────────┘ │
└───────────────────────────────┼─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       DATA TIER (MySQL)                             │
│                                                                     │
│  ┌──────────┐ ┌──────────┐ ┌───────────────┐ ┌──────────────────┐ │
│  │  users   │ │ subjects │ │ enrollments   │ │ teaching_periods │ │
│  └──────────┘ └──────────┘ └───────────────┘ └──────────────────┘ │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐   │
│  │ attendance_      │ │ attendance_      │ │ marks            │   │
│  │ sessions         │ │ records          │ │ (ISA/MSE/ESE)    │   │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

| Layer       | Technology              | Responsibility                                           |
|-------------|-------------------------|----------------------------------------------------------|
| Client      | HTML/CSS/Bootstrap/JS   | Render role-specific dashboards, call REST APIs           |
| Visualize   | Chart.js                | Render attendance trends, marks distribution, risk charts |
| API Server  | Express.js on Node.js   | Business logic, auth, authorization, IP filtering         |
| Data        | MySQL (via mysql2 pool) | Persistent storage, relational integrity, indexing        |

### Folder Structure (Planned)

```
project/
├── server.js                  # Entry point
├── .env                       # Secrets (JWT_SECRET, DB creds, WHITELIST_IPS)
├── config/
│   └── db.js                  # MySQL pool configuration
├── middleware/
│   ├── auth.js                # JWT verification
│   ├── roleGuard.js           # Role-based access control
│   └── ipWhitelist.js         # IP range enforcement
├── routes/
│   ├── authRoutes.js
│   ├── adminRoutes.js
│   ├── attendanceRoutes.js
│   ├── marksRoutes.js
│   └── analyticsRoutes.js
├── controllers/
│   ├── authController.js
│   ├── adminController.js
│   ├── attendanceController.js
│   ├── marksController.js
│   └── analyticsController.js
├── public/
│   ├── css/
│   ├── js/
│   │   ├── charts.js          # Chart.js rendering logic
│   │   └── qrScanner.js       # QR scanning (teacher side)
│   └── pages/
│       ├── login.html
│       ├── adminDashboard.html
│       ├── teacherDashboard.html
│       └── studentDashboard.html
├── sql/
│   └── schema.sql             # Full database DDL
└── package.json
```

---

## 2. Authentication Flow (JWT)

### Token Lifecycle

```
┌──────────┐         POST /api/auth/login          ┌──────────────┐
│  Browser  │ ──────── { email, password } ───────→ │  Auth Route   │
│           │                                       │               │
│           │                                       │  1. Query DB  │
│           │                                       │  2. bcrypt    │
│           │                                       │     compare   │
│           │                                       │  3. Sign JWT  │
│           │ ←──── { token, role, name } ───────── │     payload:  │
│           │                                       │   { id, role }│
│  Store    │                                       │   exp: 8h     │
│  token in │                                       └───────────────┘
│  localStorage                                     
│           │                                       
│           │     GET /api/attendance/my             
│           │ ──── Authorization: Bearer <token> ──→ ┌──────────────┐
│           │                                        │ auth.js MW   │
│           │                                        │ verify(token)│
│           │                                        │ attach       │
│           │                                        │ req.user =   │
│           │                                        │ { id, role } │
│           │ ←──── { attendance data } ──────────── └──────────────┘
└──────────┘
```

### JWT Payload Structure

```json
{
  "id": 42,
  "role": "STUDENT",
  "iat": 1741766400,
  "exp": 1741795200
}
```

### Key Design Decisions

| Concern               | Decision                                                     |
|-----------------------|--------------------------------------------------------------|
| Token storage         | `localStorage` (simple SPA), sent via `Authorization` header |
| Token lifetime        | 8 hours (one academic day), no refresh tokens for v1         |
| Password hashing      | `bcrypt` with 10 salt rounds                                 |
| Token signing algo    | HS256 with a 256-bit secret from `.env`                      |
| Logout                | Client-side token deletion (stateless JWT)                   |

### Auth Middleware Pseudocode

```
function authenticate(req, res, next):
    header = req.headers['authorization']
    if not header or not header.startsWith('Bearer '):
        return 401 "No token provided"

    token = header.split(' ')[1]
    try:
        decoded = jwt.verify(token, process.env.JWT_SECRET)
        req.user = { id: decoded.id, role: decoded.role }
        next()
    catch:
        return 403 "Invalid or expired token"
```

---

## 3. Role-Based Authorization Strategy

### Role Hierarchy & Permissions Matrix

```
                    ┌─────────────────────────────────────────────────────────────┐
                    │              PERMISSION MATRIX                              │
                    ├──────────────────────────┬─────────┬──────────┬────────────┤
                    │  Action                  │  ADMIN  │ TEACHER  │  STUDENT   │
                    ├──────────────────────────┼─────────┼──────────┼────────────┤
                    │  Create teacher account  │   ✅    │    ❌    │     ❌     │
                    │  Create student account  │   ✅    │    ❌    │     ❌     │
                    │  Create subject          │   ✅    │    ❌    │     ❌     │
                    │  Enroll student          │   ✅    │    ❌    │     ❌     │
                    │  Define teaching period  │   ✅    │    ❌    │     ❌     │
                    │  Start attendance session│   ❌    │    ✅    │     ❌     │
                    │  Verify attendance       │   ❌    │    ✅    │     ❌     │
                    │  Enter ISA marks         │   ❌    │    ✅    │     ❌     │
                    │  Enter MSE marks         │   ❌    │    ✅    │     ❌     │
                    │  Enter ESE marks         │   ❌    │    ✅    │     ❌     │
                    │  View subject analytics  │   ❌    │    ✅    │     ❌     │
                    │  QR check-in             │   ❌    │    ❌    │     ✅     │
                    │  View own attendance     │   ❌    │    ❌    │     ✅     │
                    │  View own dashboard      │   ❌    │    ❌    │     ✅     │
                    │  View own performance    │   ❌    │    ❌    │     ✅     │
                    │  View risk alerts        │   ❌    │    ❌    │     ✅     │
                    └──────────────────────────┴─────────┴──────────┴────────────┘
```

### Middleware Chaining Strategy

Every protected route passes through **three middleware layers** in sequence:

```
Request
  │
  ▼
┌──────────────────┐     ┌────────────────────┐     ┌─────────────────┐
│  1. auth.js      │ ──→ │ 2. ipWhitelist.js  │ ──→ │ 3. roleGuard.js │ ──→  Controller
│  (JWT verify)    │     │ (only on secure    │     │ (check role)    │
│                  │     │  endpoints)        │     │                 │
└──────────────────┘     └────────────────────┘     └─────────────────┘
```

### Route-to-Middleware Mapping

```javascript
// ADMIN-only routes — no IP restriction
router.post('/teachers',    auth, roleGuard('ADMIN'), adminController.createTeacher);
router.post('/students',    auth, roleGuard('ADMIN'), adminController.createStudent);
router.post('/subjects',    auth, roleGuard('ADMIN'), adminController.createSubject);
router.post('/enrollments', auth, roleGuard('ADMIN'), adminController.enrollStudent);
router.post('/periods',     auth, roleGuard('ADMIN'), adminController.definePeriod);

// TEACHER routes — IP restriction ONLY on session start
router.post('/attendance/start', auth, ipWhitelist, roleGuard('TEACHER'), attendanceCtrl.startSession);
router.get('/attendance/verify', auth, roleGuard('TEACHER'), attendanceCtrl.verifyChecklist);
router.post('/marks/isa',        auth, roleGuard('TEACHER'), marksCtrl.enterISA);
router.post('/marks/mse',        auth, roleGuard('TEACHER'), marksCtrl.enterMSE);
router.post('/marks/ese',        auth, roleGuard('TEACHER'), marksCtrl.enterESE);
router.get('/analytics/:subjectId', auth, roleGuard('TEACHER'), analyticsCtrl.subjectAnalytics);

// STUDENT routes — IP restriction ONLY on QR check-in
router.post('/attendance/checkin', auth, ipWhitelist, roleGuard('STUDENT'), attendanceCtrl.qrCheckin);
router.get('/attendance/my',       auth, roleGuard('STUDENT'), studentCtrl.viewAttendance);
router.get('/dashboard',           auth, roleGuard('STUDENT'), studentCtrl.viewDashboard);
router.get('/performance',         auth, roleGuard('STUDENT'), studentCtrl.viewPerformance);
router.get('/risk-alerts',         auth, roleGuard('STUDENT'), studentCtrl.viewRiskAlerts);
```

### roleGuard Middleware Pseudocode

```
function roleGuard(...allowedRoles):
    return function(req, res, next):
        if not req.user:
            return 401 "Not authenticated"
        if req.user.role not in allowedRoles:
            return 403 "Insufficient permissions"
        next()
```

---

## 4. IP Whitelist Middleware

### Purpose

Only two actions must originate from the **college network**:

1. `POST /api/attendance/start` — teacher starts a session
2. `POST /api/attendance/checkin` — student scans QR code

Everything else (dashboards, analytics, marks entry) works from **any IP**.

### How It Works

```
                    Incoming Request
                           │
                           ▼
                  ┌─────────────────┐
                  │ Extract Client  │
                  │ IP Address      │
                  │                 │
                  │ Sources:        │
                  │ 1. x-forwarded- │
                  │    for header   │
                  │ 2. req.socket.  │
                  │    remoteAddress │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ Normalize IP    │
                  │                 │
                  │ ::ffff:10.0.1.5 │
                  │   → 10.0.1.5    │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐     ┌─────────────────────────────┐
                  │ Check against   │     │  .env WHITELIST_IPS:        │
                  │ allowed ranges  │ ←── │  10.0.0.0/8,               │
                  │ using CIDR      │     │  172.16.0.0/12,            │
                  │ matching        │     │  192.168.1.0/24            │
                  └────────┬────────┘     └─────────────────────────────┘
                           │
                  ┌────────┴────────┐
                  │                 │
               MATCH            NO MATCH
                  │                 │
                  ▼                 ▼
            next()          403 JSON response:
                            "This action is only
                             allowed from the
                             college network"
```

### Configuration (.env)

```env
# Comma-separated CIDR ranges for the college network
WHITELIST_IPS=10.0.0.0/8,172.16.0.0/12,192.168.1.0/24
# Add VPN exit IPs if students/teachers use VPN
```

### Middleware Pseudocode

```
const allowedRanges = process.env.WHITELIST_IPS.split(',')

function ipWhitelist(req, res, next):
    clientIp = req.headers['x-forwarded-for']?.split(',')[0]
                || req.socket.remoteAddress

    clientIp = clientIp.replace('::ffff:', '')   // normalize IPv4-mapped IPv6

    for each range in allowedRanges:
        if isIpInCIDR(clientIp, range.trim()):
            return next()

    return res.status(403).json({
        error: 'Access denied. Connect to college Wi-Fi or VPN.'
    })
```

### Key Consideration — Reverse Proxy

If Express sits behind Nginx or a load balancer, the real client IP arrives in `x-forwarded-for`. You **must** enable:

```javascript
app.set('trust proxy', 1);   // trust first proxy hop
```

Without this, `req.ip` will always show the proxy's IP and the whitelist becomes useless.

---

## 5. QR Attendance Flow

### End-to-End Sequence

```
 TEACHER (on-campus)                    SERVER                      STUDENT (on-campus)
       │                                  │                               │
       │  1. POST /attendance/start       │                               │
       │     { subjectId, date }          │                               │
       │  ────────────────────────────→   │                               │
       │                                  │  2. Validate:                 │
       │                                  │     • JWT valid?              │
       │                                  │     • IP in whitelist?        │
       │                                  │     • Role = TEACHER?         │
       │                                  │     • Teacher owns subject?   │
       │                                  │                               │
       │                                  │  3. Create attendance_session │
       │                                  │     row with:                 │
       │                                  │     • session_token (UUID)    │
       │                                  │     • expires_at (now + 10m)  │
       │                                  │     • status = 'ACTIVE'       │
       │                                  │                               │
       │  ←── { sessionId, qrPayload } ──│                               │
       │                                  │                               │
       │  4. Generate QR code             │                               │
       │     from qrPayload string:       │                               │
       │     "<sessionToken>|<subjectId>" │                               │
       │     Display on projector/screen  │                               │
       │         ┌──────────┐             │                               │
       │         │ ██ ██ ██ │             │                               │
       │         │ ██    ██ │ ──── student scans with phone ──→          │
       │         │ ██ ██ ██ │             │                               │
       │         └──────────┘             │                               │
       │                                  │   5. POST /attendance/checkin │
       │                                  │      { sessionToken }         │
       │                                  │  ←────────────────────────────│
       │                                  │                               │
       │                                  │   6. Validate:                │
       │                                  │      • JWT valid?             │
       │                                  │      • IP in whitelist?       │
       │                                  │      • Role = STUDENT?        │
       │                                  │      • Session not expired?   │
       │                                  │      • Student enrolled?      │
       │                                  │      • Not already checked in?│
       │                                  │                               │
       │                                  │   7. Insert attendance_record │
       │                                  │      (student_id, session_id, │
       │                                  │       status='PRESENT',       │
       │                                  │       checked_in_at=NOW())    │
       │                                  │                               │
       │                                  │   ──→ { success: true }  ────→│
       │                                  │                               │
       │  8. GET /attendance/verify       │                               │
       │  ────────────────────────────→   │                               │
       │                                  │   9. Return checklist of      │
       │  ←── [ enrolled students with    │      who checked in and       │
       │        check-in status ]         │      who didn't               │
       │                                  │                               │
       │  10. Teacher reviews & closes    │                               │
       │      POST /attendance/close      │                               │
       │      { sessionId }               │                               │
       │  ────────────────────────────→   │                               │
       │                                  │  11. status = 'CLOSED'        │
       │                                  │      Mark remaining as ABSENT │
```

### QR Security Properties

| Property               | Implementation                                                     |
|------------------------|--------------------------------------------------------------------|
| **Uniqueness**         | Each session gets a fresh UUID token — no reuse across days        |
| **Expiry**             | Session token valid for 10 minutes (configurable)                  |
| **Location binding**   | Both start and check-in require campus IP — prevents remote scans  |
| **Anti-duplication**   | DB unique constraint on (session_id, student_id)                   |
| **Enrollment check**   | Server verifies student is enrolled in the session's subject       |
| **Tamper resistance**  | QR contains server-generated token, not user-fabricated data       |

---

## 6. Secure vs General Access — Separation Model

### The Two Zones

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ALL REQUESTS                                       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    ZONE 1: SECURE (Campus Only)                     │    │
│  │                                                                     │    │
│  │   Middleware chain:  auth → ipWhitelist → roleGuard → controller    │    │
│  │                                                                     │    │
│  │   ┌───────────────────────────────┐  ┌────────────────────────────┐ │    │
│  │   │ POST /attendance/start        │  │ POST /attendance/checkin   │ │    │
│  │   │ (TEACHER on campus Wi-Fi)     │  │ (STUDENT on campus Wi-Fi)  │ │    │
│  │   └───────────────────────────────┘  └────────────────────────────┘ │    │
│  │                                                                     │    │
│  │   WHY: These actions PROVE physical presence in the classroom.      │    │
│  │   Without IP restriction, a student could check in from home.      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    ZONE 2: GENERAL (Any Network)                    │    │
│  │                                                                     │    │
│  │   Middleware chain:  auth → roleGuard → controller                  │    │
│  │   (no ipWhitelist middleware)                                       │    │
│  │                                                                     │    │
│  │   ADMIN endpoints:                                                  │    │
│  │   ┌─────────────────────────────────────────────────────┐           │    │
│  │   │ POST /teachers, /students, /subjects, /enrollments  │           │    │
│  │   │ POST /periods                                       │           │    │
│  │   └─────────────────────────────────────────────────────┘           │    │
│  │                                                                     │    │
│  │   TEACHER endpoints:                                                │    │
│  │   ┌─────────────────────────────────────────────────────┐           │    │
│  │   │ GET  /attendance/verify                             │           │    │
│  │   │ POST /marks/isa, /marks/mse, /marks/ese             │           │    │
│  │   │ GET  /analytics/:subjectId                          │           │    │
│  │   └─────────────────────────────────────────────────────┘           │    │
│  │                                                                     │    │
│  │   STUDENT endpoints:                                                │    │
│  │   ┌─────────────────────────────────────────────────────┐           │    │
│  │   │ GET /attendance/my                                  │           │    │
│  │   │ GET /dashboard                                      │           │    │
│  │   │ GET /performance                                    │           │    │
│  │   │ GET /risk-alerts                                    │           │    │
│  │   └─────────────────────────────────────────────────────┘           │    │
│  │                                                                     │    │
│  │   WHY: Viewing data doesn't prove physical presence.               │    │
│  │   Students should check grades from home. Teachers should           │    │
│  │   enter marks from anywhere.                                        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    ZONE 0: PUBLIC (No Auth)                         │    │
│  │                                                                     │    │
│  │   ┌────────────────────┐  ┌────────────────────────────┐            │    │
│  │   │ POST /auth/login   │  │ GET  /health               │            │    │
│  │   └────────────────────┘  └────────────────────────────┘            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Summary Table

| Endpoint                  | Auth | IP Check | Role     | Zone     |
|---------------------------|------|----------|----------|----------|
| `POST /auth/login`        | ❌   | ❌       | —        | Public   |
| `POST /teachers`          | ✅   | ❌       | ADMIN    | General  |
| `POST /students`          | ✅   | ❌       | ADMIN    | General  |
| `POST /subjects`          | ✅   | ❌       | ADMIN    | General  |
| `POST /enrollments`       | ✅   | ❌       | ADMIN    | General  |
| `POST /periods`           | ✅   | ❌       | ADMIN    | General  |
| `POST /attendance/start`  | ✅   | ✅       | TEACHER  | Secure   |
| `POST /attendance/checkin`| ✅   | ✅       | STUDENT  | Secure   |
| `GET  /attendance/verify` | ✅   | ❌       | TEACHER  | General  |
| `POST /marks/isa`         | ✅   | ❌       | TEACHER  | General  |
| `POST /marks/mse`         | ✅   | ❌       | TEACHER  | General  |
| `POST /marks/ese`         | ✅   | ❌       | TEACHER  | General  |
| `GET  /analytics/:id`     | ✅   | ❌       | TEACHER  | General  |
| `GET  /attendance/my`     | ✅   | ❌       | STUDENT  | General  |
| `GET  /dashboard`         | ✅   | ❌       | STUDENT  | General  |
| `GET  /performance`       | ✅   | ❌       | STUDENT  | General  |
| `GET  /risk-alerts`       | ✅   | ❌       | STUDENT  | General  |

---

## Database Schema (ER Overview)

```
┌──────────────┐       ┌──────────────────┐       ┌──────────────┐
│    users     │       │  teaching_periods │       │   subjects   │
├──────────────┤       ├──────────────────┤       ├──────────────┤
│ id (PK)      │       │ id (PK)          │       │ id (PK)      │
│ name         │       │ teacher_id (FK)  │───┐   │ name         │
│ email (UQ)   │──┐    │ subject_id (FK)  │──┐│   │ code (UQ)    │
│ password     │  │    │ academic_year    │  ││   │ semester     │
│ role (ENUM)  │  │    │ semester         │  ││   └──────┬───────┘
│ roll_number  │  │    └──────────────────┘  ││          │
│ created_at   │  │                          ││          │
└──────┬───────┘  │     ┌────────────────┐   ││          │
       │          │     │  enrollments   │   ││          │
       │          │     ├────────────────┤   ││          │
       │          └────→│ student_id(FK) │   ││          │
       │                │ subject_id(FK) │───┘│          │
       │                │ academic_year  │    │          │
       │                └────────────────┘    │          │
       │                                      │          │
       │          ┌─────────────────────┐     │          │
       │          │ attendance_sessions │     │          │
       │          ├─────────────────────┤     │          │
       │          │ id (PK)             │     │          │
       ├────────→ │ teacher_id (FK)     │─────┘          │
       │          │ subject_id (FK)     │────────────────┘
       │          │ session_token (UQ)  │
       │          │ session_date        │
       │          │ expires_at          │
       │          │ status (ENUM)       │
       │          └──────────┬──────────┘
       │                     │
       │          ┌──────────┴──────────┐
       │          │ attendance_records  │
       │          ├─────────────────────┤
       └────────→ │ student_id (FK)     │
                  │ session_id (FK)     │
                  │ status (ENUM)       │
                  │ checked_in_at       │
                  │ UQ(session,student) │
                  └─────────────────────┘

       ┌─────────────────┐
       │     marks       │
       ├─────────────────┤
       │ id (PK)         │
       │ student_id (FK) │
       │ subject_id (FK) │
       │ exam_type (ENUM)│  ← ISA1, ISA2, MSE, ESE
       │ marks_obtained  │
       │ max_marks       │
       │ entered_by (FK) │
       │ UQ(student,     │
       │   subject,type) │
       └─────────────────┘
```

---

## Security Checklist

| # | Concern                | Mitigation                                                      |
|---|------------------------|-----------------------------------------------------------------|
| 1 | SQL Injection          | Parameterized queries via `mysql2` prepared statements          |
| 2 | Password storage       | `bcrypt` hash — never store plaintext                           |
| 3 | Token leakage          | HTTPS in production, short-lived tokens (8h)                    |
| 4 | Proxy attendance       | IP whitelist ensures physical campus presence                   |
| 5 | QR reuse               | UUID session tokens with 10-min expiry + unique constraint      |
| 6 | Privilege escalation   | Role checked per-request via middleware, not client-side         |
| 7 | Horizontal access      | Controllers verify resource ownership (teacher→subject, etc.)   |
| 8 | XSS                    | No server-side HTML rendering; static frontend + JSON APIs      |
| 9 | Rate limiting          | `express-rate-limit` on login and check-in endpoints            |
| 10| CORS                   | Restrict allowed origins to the application's domain            |

---

*This document serves as the blueprint for implementation. Each section maps directly to code that will be written in subsequent phases.*
