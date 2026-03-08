const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");

const {
  getHolidays,
  addHoliday,
  removeHoliday,
  addMultipleHolidays,
} = require("../controllers/holidayController");

router.get("/", auth, getHolidays);
router.post("/", auth, addHoliday);
router.post("/bulk", auth, addMultipleHolidays);
router.delete("/:date", auth, removeHoliday);

module.exports = router;
