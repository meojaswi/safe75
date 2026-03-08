const express = require("express");
const router = express.Router();

const { addSubject } = require("../controllers/subjectController");

router.post("/", addSubject);

module.exports = router;
const { addSubject, getSubjects } = require("../controllers/subjectController");

router.post("/", addSubject);
router.get("/", getSubjects);
