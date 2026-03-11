const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");

const {
  getSemester,
  setSemester,
  exportSemesterData,
  resetSemesterData,
} = require("../controllers/settingsController");

router.get("/semester", auth, getSemester);
router.put("/semester", auth, setSemester);
router.get("/semester/export", auth, exportSemesterData);
router.post("/semester/reset", auth, resetSemesterData);

module.exports = router;
