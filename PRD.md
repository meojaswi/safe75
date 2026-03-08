# Safe75 – Project Requirement Document (PRD)

## 1. Project Overview

**Safe75** is a web application designed to help students track their attendance and ensure they stay above the **75% minimum attendance requirement** commonly enforced by colleges.

Students will be able to:

- Track subject-wise attendance
- View attendance percentage
- Update attendance daily
- Upload their timetable
- Automatically extract subjects and schedule using AI

The goal of the system is to help students **avoid attendance shortage and stay informed about their attendance status**.

---

# 2. Objectives

The primary objectives of the Safe75 system are:

- Allow students to track attendance easily
- Automatically calculate subject-wise attendance percentage
- Provide early warnings when attendance falls below 75%
- Reduce manual tracking of attendance
- Allow timetable upload and automatic subject detection

---

# 3. Target Users

Primary Users:

**Students**

Students will use the system to:

- Upload their timetable
- Track attendance daily
- Monitor attendance percentage
- Receive warnings if attendance is low

---

# 4. Functional Requirements

## 4.1 User Authentication

The system must allow students to:

- Create an account
- Login securely
- Logout

User data stored:

- Name
- Email
- Password (hashed)

---

## 4.2 Subject Management

Students must be able to:

- Add subjects manually
- Add labs separately
- Edit subject details
- Delete subjects

Each subject contains:

- Subject Name
- Type (Theory / Lab)
- Scheduled Days

---

## 4.3 Timetable Upload

Students should be able to upload their **class timetable** as:

- Image
- PDF

The system will:

1. Extract text from the timetable using OCR
2. Send the extracted text to an AI parser
3. Identify subjects and scheduled days
4. Generate subjects automatically

The student will then confirm or edit the detected subjects.

---

## 4.4 Attendance Tracking

Students will be able to:

- Mark attendance daily
- Select **Present / Absent**

Attendance will be stored with:

- Subject ID
- Date
- Attendance status

---

## 4.5 Attendance Calculation

The system will automatically calculate attendance percentage.

Formula:

```
Attendance % = (Present Classes / Total Classes) × 100
```

Example:

```
Present Classes = 30
Total Classes = 40

Attendance = 75%
```

---

## 4.6 Dashboard

The dashboard will display:

- Subject name
- Total classes
- Present classes
- Attendance percentage
- Warning if attendance < 75%

Example:

```
DSA                  82%
Operating Systems    76%
Microprocessor Lab   91%
Maths                73% ⚠
```

---

# 5. Non-Functional Requirements

## Performance

- System should load within **2 seconds**

## Security

- Passwords must be hashed using **bcrypt**
- Authentication must use **JWT tokens**

## Scalability

- System should support multiple users

## Reliability

- Data should be stored securely in the database

---

# 6. System Architecture

### Frontend

- HTML
- CSS
- JavaScript

### Backend

- Node.js
- Express.js

### Database

- MongoDB

### File Upload

- Multer

### Authentication

- JWT

---

# 7. Database Design

## Users Collection

Fields:

- id
- name
- email
- password

---

## Subjects Collection

Fields:

- id
- user_id
- subject_name
- subject_type
- days

---

## Attendance Collection

Fields:

- id
- subject_id
- date
- status (present / absent)

---

# 8. Future Enhancements

Possible improvements:

- Attendance prediction
- Safe bunk calculator
- Mobile responsive UI
- Notification system
- Calendar view for attendance
- Analytics dashboard

---

# 9. Author

Kumar Ojaswi
Safe75 Project
