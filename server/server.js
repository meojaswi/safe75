const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const app = express();
const subjectRoutes = require("./routes/subjectRoutes");

app.use(cors());
app.use(express.json());
app.use("/api/subjects", subjectRoutes);
app.use("/api/attendance", attendanceRoutes);
connectDB();

app.use("/api/auth", authRoutes);

app.get("/", (req, res) => {
  res.send("Safe75 API running");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
