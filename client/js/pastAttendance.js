if (!requireAuth()) {
  // Will redirect to login
}

// Set user name in sidebar
const userNameEl = document.getElementById("userName");
if (userNameEl) {
  userNameEl.textContent = getUserName();
}

let currentDate = new Date();
let selectedDate = null;
let allSubjects = [];
let holidays = [];
let attendanceByDate = {};
let draftStatusBySubject = {};
let semesterStart = null;

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// ===== INITIALIZATION =====
async function initializePage() {
  try {
    // Load subjects, holidays, and semester settings
    const [subjectsRes, holidaysRes, settingsRes] = await Promise.all([
      api.get("/api/subjects"),
      api.get("/api/holidays"),
      api.get("/api/settings/semester"),
    ]);

    allSubjects = subjectsRes;
    holidays = holidaysRes || [];
    semesterStart = settingsRes.semesterStart;

    // Initialize currentDate to today or semester start (whichever is later)
    const today = new Date();
    if (semesterStart) {
      const semesterStartDate = new Date(semesterStart + "T00:00:00");
      if (today < semesterStartDate) {
        currentDate = new Date(semesterStartDate);
      }
    } else {
      const container = document.getElementById("subjectsContainer");
      if (container) {
        container.innerHTML =
          '<p class="placeholder">Set semester start date in Semester Timeline before marking past attendance.</p>';
      }
    }

    renderCalendar();
    updateMonthNavigationButtons();
  } catch (error) {
    showToast("Error loading data: " + error.message, "error");
  }
}

// ===== CALENDAR RENDERING =====
function renderCalendar() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Update header
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  document.getElementById("currentMonth").textContent =
    `${monthNames[month]} ${year}`;

  // Get first day of month and number of days
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Create calendar grid
  const calendar = document.getElementById("calendar");
  calendar.innerHTML = "";

  // Day labels
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  dayLabels.forEach((label) => {
    const dayHeader = document.createElement("div");
    dayHeader.className = "calendar-day-header";
    dayHeader.textContent = label;
    calendar.appendChild(dayHeader);
  });

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    const emptyCell = document.createElement("div");
    emptyCell.className = "calendar-day empty";
    calendar.appendChild(emptyCell);
  }

  // Date cells
  const today = new Date();
  const todayStr = formatDateStr(today);
  const semesterStartStr = semesterStart || "";

  for (let day = 1; day <= daysInMonth; day++) {
    const dateObj = new Date(year, month, day);
    const dateStr = formatDateStr(dateObj);
    const isToday = dateStr === todayStr;
    const isSelected = selectedDate && dateStr === selectedDate;

    // Check if date is within allowed range (semesterStart to today)
    const isBeforeSemesterStart =
      !semesterStartStr || dateStr < semesterStartStr;
    const isAfterToday = dateStr > todayStr;
    const isAllowed = !isBeforeSemesterStart && !isAfterToday;

    const dayCell = document.createElement("div");
    dayCell.className = "calendar-day";
    if (isToday) dayCell.classList.add("today");
    if (isSelected) dayCell.classList.add("selected");
    if (holidays.includes(dateStr)) dayCell.classList.add("holiday");
    if (!isAllowed) dayCell.classList.add("disabled");

    dayCell.textContent = day;

    if (isAllowed) {
      dayCell.onclick = () => selectDate(dateStr);
      dayCell.style.cursor = "pointer";
    } else {
      dayCell.style.cursor = "not-allowed";
      dayCell.style.opacity = "0.5";
    }

    calendar.appendChild(dayCell);
  }
}

function formatDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getDateValidationError(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return "Invalid date selected";
  }

  if (!semesterStart) {
    return "Set semester start date in Semester Timeline first";
  }

  const todayStr = formatDateStr(new Date());

  if (dateStr < semesterStart) {
    return "Cannot select date before semester start";
  }

  if (dateStr > todayStr) {
    return "Cannot select future dates";
  }

  return null;
}

function canNavigateToPreviousMonth() {
  if (!semesterStart) return false;

  const semesterStartDate = new Date(semesterStart + "T00:00:00");
  const firstOfCurrentMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    1,
  );
  const lastOfPreviousMonth = new Date(
    firstOfCurrentMonth.getFullYear(),
    firstOfCurrentMonth.getMonth(),
    0,
  );

  // Can go to previous month only if it still includes allowed dates.
  return lastOfPreviousMonth >= semesterStartDate;
}

function canNavigateToNextMonth() {
  if (!semesterStart) return false;

  const today = new Date();
  const firstOfCurrentMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    1,
  );
  const firstOfNextMonth = new Date(firstOfCurrentMonth);
  firstOfNextMonth.setMonth(firstOfNextMonth.getMonth() + 1);

  // Can only go to next month if it includes any date up to and including today
  return firstOfNextMonth <= today;
}

function updateMonthNavigationButtons() {
  const prevBtn = document.getElementById("prevMonthPast");
  const nextBtn = document.getElementById("nextMonthPast");

  if (prevBtn) {
    const canGoPrev = canNavigateToPreviousMonth();
    prevBtn.disabled = !canGoPrev;
    prevBtn.style.opacity = canGoPrev ? "1" : "0.5";
    prevBtn.style.cursor = canGoPrev ? "pointer" : "not-allowed";
  }

  if (nextBtn) {
    const canGoNext = canNavigateToNextMonth();
    nextBtn.disabled = !canGoNext;
    nextBtn.style.opacity = canGoNext ? "1" : "0.5";
    nextBtn.style.cursor = canGoNext ? "pointer" : "not-allowed";
  }
}

function previousMonth() {
  if (!canNavigateToPreviousMonth()) {
    showToast("Cannot navigate before semester start", "error");
    return;
  }
  currentDate.setMonth(currentDate.getMonth() - 1);
  renderCalendar();
  updateMonthNavigationButtons();
}

function nextMonth() {
  if (!canNavigateToNextMonth()) {
    showToast("Cannot navigate beyond today", "error");
    return;
  }
  currentDate.setMonth(currentDate.getMonth() + 1);
  renderCalendar();
  updateMonthNavigationButtons();
}

function handlePrevMonthClick(e) {
  e.preventDefault();
  e.stopPropagation();
  previousMonth();
}

function handleNextMonthClick(e) {
  e.preventDefault();
  e.stopPropagation();
  nextMonth();
}

// ===== DATE SELECTION =====
async function selectDate(dateStr) {
  const validationError = getDateValidationError(dateStr);
  if (validationError) {
    showToast(validationError, "error");
    return;
  }

  selectedDate = dateStr;
  const dateObj = new Date(dateStr + "T00:00:00");
  const dayName = DAY_NAMES[dateObj.getDay()];

  // Update display
  document.getElementById("selectedDateDisplay").textContent = dateStr;
  document.getElementById("selectedDayDisplay").textContent = dayName;

  // Re-render calendar to show selection
  renderCalendar();

  const container = document.getElementById("subjectsContainer");
  container.innerHTML = '<p class="placeholder">Loading attendance...</p>';

  try {
    await loadAttendanceForDate(dateStr);
    displaySubjectsForDate(dateStr, dayName);
  } catch (error) {
    container.innerHTML =
      '<p class="placeholder">Failed to load attendance for this date</p>';
    showToast("Error loading attendance: " + error.message, "error");
  }
}

async function loadAttendanceForDate(dateStr) {
  const data = await api.get(
    "/api/attendance/date/" + encodeURIComponent(dateStr),
  );
  attendanceByDate = data.statuses || {};
  draftStatusBySubject = { ...attendanceByDate };
}

// ===== DISPLAY SUBJECTS FOR SELECTED DATE =====
function displaySubjectsForDate(dateStr, dayName) {
  const container = document.getElementById("subjectsContainer");

  // Filter subjects scheduled on this day
  const subjectsOnDay = allSubjects.filter(
    (subject) => subject.days && subject.days.includes(dayName),
  );

  if (subjectsOnDay.length === 0) {
    container.innerHTML =
      '<p class="placeholder">No subjects scheduled on this day</p>';
    return;
  }

  container.innerHTML = subjectsOnDay
    .map((subject) => {
      const subjectId = subject._id;
      const defaultStatus = draftStatusBySubject[subjectId] || "";

      return `
        <div class="subject-attendance-card">
          <div class="subject-header">
            <div>
              <h4>${escapeHtml(subject.name)}</h4>
              <span class="subject-badge ${subject.type === "lab" ? "badge-lab" : "badge-theory"}">
                ${subject.type === "lab" ? "Lab" : "Theory"}
              </span>
            </div>
          </div>

          <div class="attendance-status-options">
            <label>
              <input
                type="radio"
                name="attendance-${subjectId}"
                value="present"
                data-attendance-subject-id="${subjectId}"
                data-attendance-status="present"
                ${defaultStatus === "present" ? "checked" : ""}
              />
              <span class="radio-label present">✓ Present</span>
            </label>
            <label>
              <input
                type="radio"
                name="attendance-${subjectId}"
                value="absent"
                data-attendance-subject-id="${subjectId}"
                data-attendance-status="absent"
                ${defaultStatus === "absent" ? "checked" : ""}
              />
              <span class="radio-label absent">✕ Absent</span>
            </label>
            <label>
              <input
                type="radio"
                name="attendance-${subjectId}"
                value="no_class"
                data-attendance-subject-id="${subjectId}"
                data-attendance-status="no_class"
                ${defaultStatus === "no_class" ? "checked" : ""}
              />
              <span class="radio-label noclass">⊘ No Class</span>
            </label>
          </div>

          <button
            class="btn btn-sm"
            data-mark-past-subject-id="${subjectId}"
            data-mark-past-date="${dateStr}"
            style="width: 100%; margin-top: 12px;"
          >
            Save Attendance
          </button>
        </div>
      `;
    })
    .join("");
}

function updateMarkedStatus(subjectId, status) {
  draftStatusBySubject[subjectId] = status;
}

// ===== MARK ATTENDANCE =====
async function markPastAttendance(subjectId, dateStr) {
  try {
    const validationError = getDateValidationError(dateStr);
    if (validationError) {
      showToast(validationError, "error");
      return;
    }

    const status = draftStatusBySubject[subjectId];

    if (!status) {
      showToast("Please select an attendance status", "error");
      return;
    }

    await api.post("/api/attendance", { subjectId, status, date: dateStr });

    showToast("Attendance marked for " + dateStr, "success");

    attendanceByDate[subjectId] = status;
    draftStatusBySubject[subjectId] = status;

    // Refresh display
    displaySubjectsForDate(
      selectedDate,
      DAY_NAMES[new Date(dateStr + "T00:00:00").getDay()],
    );
  } catch (error) {
    showToast("Error: " + error.message, "error");
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  const prevBtn = document.getElementById("prevMonthPast");
  const nextBtn = document.getElementById("nextMonthPast");

  if (prevBtn) {
    prevBtn.addEventListener("click", handlePrevMonthClick);
  }
  if (nextBtn) {
    nextBtn.addEventListener("click", handleNextMonthClick);
  }

  initializePage();
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const statusSubjectId = target.getAttribute("data-attendance-subject-id");
  const statusValue = target.getAttribute("data-attendance-status");
  if (statusSubjectId && statusValue) {
    updateMarkedStatus(statusSubjectId, statusValue);
    return;
  }

  const pastSubjectId = target.getAttribute("data-mark-past-subject-id");
  const pastDate = target.getAttribute("data-mark-past-date");
  if (pastSubjectId && pastDate) {
    markPastAttendance(pastSubjectId, pastDate);
  }
});
