const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");

const {
  addSubject,
  getSubjects,
  deleteSubject,
} = require("../controllers/subjectController");

router.post("/", auth, addSubject);
router.get("/", auth, getSubjects);
router.delete("/:id", auth, deleteSubject);

module.exports = router;
