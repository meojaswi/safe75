# Safe75

Safe75 is a student attendance tracking application that helps students monitor their attendance percentage and stay safely above the **75% attendance requirement**.

---

## 🚀 Features

* Track attendance for each **subject and lab**
* Automatic **attendance percentage calculation**
* **Daily attendance updates**
* Upload class **routine/timetable**
* AI-assisted **subject detection from timetable**
* **Warning when attendance goes below 75%**
* Dashboard showing **subject-wise attendance**
* Password reset via **email (Gmail SMTP)**

---

## 🛠 Tech Stack

### Frontend

* HTML
* CSS
* JavaScript

### Backend

* Node.js
* Express.js

### Database

* MongoDB

### Other Tools

* Multer (file uploads)
* JWT (authentication)
* bcrypt (password hashing)
* Nodemailer (password reset emails)

---

## 📁 Project Structure

```
safe75
│
├── client
│   ├── index.html
│   ├── login.html
│   ├── dashboard.html
│   ├── css
│   └── js
│
├── server
│   ├── routes
│   ├── models
│   └── controllers
│
├── uploads
├── package.json
└── README.md
```

---

## ⚙️ Installation

Clone the repository

```
git clone https://github.com/meojaswi/safe75.git
```

Go to project folder

```
cd safe75
```

Install dependencies

```
npm install
```

Run the server

```
npm run dev
```

---

## 🔑 Environment Variables

Create a `.env` file in the root directory.

Example:

```
PORT=3000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
GMAIL_USER=your_gmail_address
GMAIL_APP_PASSWORD=your_gmail_app_password
CLIENT_BASE_URL=http://localhost:3000
# optional:
MAIL_FROM=Safe75 Support <your_gmail_address>
```

For Google Sign-In, add `http://localhost:3000` in Google Cloud Console under:
OAuth Client -> Authorized JavaScript origins.

---

## 📌 Future Improvements

* Attendance prediction system
* Mobile responsive UI
* Notifications for low attendance
* Better AI timetable parsing
* Safe bunk calculator

---

## 👨‍💻 Author

**Kumar Ojaswi**
