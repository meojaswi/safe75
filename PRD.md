# Safe75 - Product Requirements Document (PRD)

## 1. Product Overview

Safe75 is a web app for students to track attendance per subject and stay above the 75 percent minimum attendance requirement.

The product helps users:

- Track subject-wise attendance
- Mark present, absent, or no class
- Monitor current attendance percentage
- See low-attendance warnings and bunk guidance
- Export semester reports

## 2. Objectives

- Make attendance tracking fast and reliable
- Provide clear visibility into subject-wise and overall attendance health
- Prevent attendance shortage through early warnings and action guidance
- Reduce manual calculations for students

## 3. Users and Roles

Primary user:

- Student user (`role: user`)

Secondary user:

- Admin user (`role: admin`) who can manage reusable class configurations

## 4. Scope

### 4.1 In Scope (Current Implementation)

- Google Sign-In based authentication
- Profile setup (college, branch, semester, section)
- Subject CRUD (theory/lab + weekly schedule)
- Attendance marking for today and past dates (with semester date validation)
- Holiday management
- Dashboard analytics and attendance heatmap
- Semester date settings
- Semester data export and reset
- Admin class configuration create/update + student auto-fill
- Forgot/reset password API and email flow

### 4.2 Out of Scope (Current Implementation)

- OCR timetable upload and AI parsing
- Native mobile app
- Push notifications

## 5. Functional Requirements

### FR1. Authentication and Session

- The system must allow users to sign in via Google OAuth token flow.
- Email/password signup and login endpoints exist but return "disabled" responses.
- On successful login, server issues JWT in `auth_token` HttpOnly cookie.
- Authenticated routes must reject missing/invalid tokens with `401`.
- Users can log out, which clears auth cookie.

### FR2. Profile and Class Auto-Fill

- Users can store profile fields: college, branch, semester, section.
- After profile save, system checks matching `ClassConfig`.
- If a match exists, the app auto-applies:
  - Semester start/end dates
  - Subject list and schedules
  - Holiday list
- Profile tracks whether user data came from class config (`isConfigured`).

### FR3. Subject Management

- Users can add, view, update, and delete subjects.
- Subject fields:
  - `name`
  - `type` (`theory` or `lab`)
  - `days` (scheduled weekdays)
- Subject deletion must remove linked attendance records.

### FR4. Attendance Management

- Users can mark attendance status per subject:
  - `present`
  - `absent`
  - `no_class`
- Attendance is unique per `(subjectId, date)` and updates if already present.
- Past attendance is allowed only after semester start is set.
- Future dates are blocked.
- Dates before semester start are blocked.

### FR5. Holiday Management

- Users can add single holidays, bulk holidays, view holidays, and remove holidays.
- Holiday dates use `YYYY-MM-DD` format.
- Duplicate holiday dates per user are prevented.

### FR6. Dashboard and Analytics

- Dashboard must return per-subject summary:
  - Present classes
  - Absent classes
  - Total tracked classes
  - No class count
  - Attendance percentage
  - Low attendance flag (`< 75%`)
- Attendance formula:
  - `Attendance % = (Present / (Present + Absent)) * 100`
- It must compute:
  - `canBunk` when percentage >= 75
  - `needToAttend` when percentage < 75
- It must provide semester-level info:
  - Days passed / days left
  - Heatmap-ready day status map
  - Latest bunk date and subject

### FR7. Semester Settings and Data Lifecycle

- Users can set semester start and end dates.
- End date must be after start date.
- Users can export semester snapshot as JSON.
- Users can reset semester data by explicit confirmation token (`RESET`), clearing:
  - Subjects
  - Attendance
  - Holidays
  - Semester dates
  - Profile configured flag

### FR8. Admin Class Configuration

- Admin can create and update class templates by:
  - college
  - branch
  - semester
  - section
- Each config stores:
  - semester range
  - subjects with schedule
  - holidays
- Any authenticated user can fetch config by query for matching profile.
- Create/update actions are admin-only.

### FR9. Password Recovery

- Users can request forgot-password link by email.
- Reset token is hashed and expires in 15 minutes.
- If mail is configured, system sends Gmail SMTP email.
- In development fallback, system logs reset link when mail is not configured.

## 6. Non-Functional Requirements

### Security

- JWT-based authentication with HttpOnly cookie session
- Password hashing via bcrypt for password reset path
- Route-level auth middleware on protected APIs
- Admin-only middleware for config writes
- CORS allowlist and CSP headers at server level

### Reliability and Data Integrity

- MongoDB unique indexes for:
  - attendance `(subjectId, date)`
  - holiday `(userId, date)`
  - user email, optional googleId
  - class config key `(college, branch, semester, section)`
- Transaction-based writes for critical multi-collection flows (config apply, reset)

### Performance

- Dashboard and settings endpoints should respond within practical interactive limits for normal student data sizes.
- Frontend interactions should remain responsive on typical laptop/mobile browsers.

### Multi-user Isolation

- Subject, attendance, and holiday data are scoped by authenticated user context.

## 7. Data Model (MongoDB)

### User

- `name`, `email`, `password`, `googleId`
- `passwordResetToken`, `passwordResetExpires`
- `semesterStart`, `semesterEnd`
- `role` (`user` or `admin`)
- `profile`:
  - `college`, `branch`, `semester`, `section`, `isConfigured`

### Subject

- `name`, `type`, `days`, `userId`

### Attendance

- `subjectId`, `status`, `date`
- unique: `(subjectId, date)`

### Holiday

- `date`, `userId`
- unique: `(userId, date)`

### ClassConfig

- `college`, `branch`, `semester`, `section`
- `semesterStart`, `semesterEnd`
- `subjects[]` with `name` and `schedule[]`
- `holidays[]`
- `createdBy`, `updatedAt`

## 8. Architecture and Tech Stack

Frontend:

- HTML, CSS, vanilla JavaScript

Backend:

- Node.js (CommonJS), Express.js

Database:

- MongoDB + Mongoose

Infra and supporting libraries:

- `jsonwebtoken`, `bcrypt`, `google-auth-library`, `nodemailer`, `cors`, `dotenv`
- Vercel server deployment via `server/server.js`

## 9. Primary User Flow

1. User opens app and signs in with Google.
2. User lands on dashboard (or configures profile if new).
3. User sets profile details; app attempts class-config auto-fill.
4. User verifies/edits subjects, holidays, and semester timeline.
5. User marks attendance daily or for allowed past dates.
6. Dashboard shows percentage, warnings, expected total classes, and guidance.
7. User can export semester report or reset semester when needed.

## 10. API Modules (Summary)

- `/api/auth` - Google auth, logout, forgot/reset password, google config
- `/api/profile` - profile get/update and auto-fill trigger
- `/api/subjects` - subject CRUD
- `/api/attendance` - mark attendance, date-wise status, dashboard, latest bunk
- `/api/holidays` - holiday CRUD + bulk add
- `/api/settings` - semester get/set, export, reset
- `/api/config` - class config read, admin write

## 11. Environment Variables

Required core variables:

- `MONGO_URI`
- `JWT_SECRET`
- `GOOGLE_CLIENT_ID`

Optional/feature variables:

- `PORT`
- `CLIENT_BASE_URL`
- `GMAIL_USER` and `GMAIL_APP_PASSWORD` (or legacy `EMAIL_USER` and `EMAIL_PASS`)
- `MAIL_FROM`

## 12. Future Enhancements

- OCR + AI timetable parsing and subject extraction
- Attendance prediction and stronger trend analytics
- Safer bunk planning assistant
- Notification and reminder system
- Additional reporting formats and historical comparisons

## 13. Author

Kumar Ojaswi  
Safe75 Project
