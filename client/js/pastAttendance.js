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
let pastDeckIndex = 0;
let pastDeckCards = [];
let pastDeckStage = null;
let pastDeckTouchStartX = null;
let pastDeckTouchStartY = null;
let pastDeckMaxCardHeight = 0;
let pastDeckResizeListenerAttached = false;
const PAST_DECK_SWIPE_THRESHOLD_PX = 48;

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
  resetPastSubjectDeck();
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

function resetPastSubjectDeck() {
  pastDeckCards = [];
  pastDeckStage = null;
  pastDeckMaxCardHeight = 0;
  pastDeckIndex = 0;
}

function getPastDeckControls() {
  return {
    prevBtn: document.getElementById("pastDeckPrev"),
    nextBtn: document.getElementById("pastDeckNext"),
    statusEl: document.getElementById("pastDeckStatus"),
  };
}

function setPastCardInteractive(card, isActive) {
  if ("inert" in card) {
    card.inert = !isActive;
  }

  const controls = card.querySelectorAll("button, a, input, select, textarea");
  controls.forEach((control) => {
    if (isActive) {
      if (control.hasAttribute("data-prev-tabindex")) {
        control.setAttribute(
          "tabindex",
          control.getAttribute("data-prev-tabindex") || "0",
        );
        control.removeAttribute("data-prev-tabindex");
      } else if (control.getAttribute("tabindex") === "-1") {
        control.removeAttribute("tabindex");
      }
      return;
    }

    if (
      control.hasAttribute("tabindex") &&
      !control.hasAttribute("data-prev-tabindex")
    ) {
      control.setAttribute(
        "data-prev-tabindex",
        control.getAttribute("tabindex") || "0",
      );
    }

    control.setAttribute("tabindex", "-1");
  });
}

function syncPastDeckStageHeight() {
  if (!pastDeckStage || pastDeckCards.length === 0) return;

  if (!pastDeckMaxCardHeight) {
    const measuredHeights = pastDeckCards.map((card) =>
      Math.ceil(
        card.getBoundingClientRect().height ||
          card.offsetHeight ||
          card.scrollHeight ||
          0,
      ),
    );
    pastDeckMaxCardHeight = Math.max(...measuredHeights, 0);
  }

  const stackPadding = pastDeckCards.length > 1 ? 36 : 8;
  pastDeckStage.style.height = `${pastDeckMaxCardHeight + stackPadding}px`;
}

function refreshPastDeckMeasurements() {
  pastDeckMaxCardHeight = 0;
  syncPastDeckStageHeight();
}

function updatePastDeckControls() {
  const { prevBtn, nextBtn, statusEl } = getPastDeckControls();
  const total = pastDeckCards.length;
  const disableNav = total <= 1;

  if (statusEl) {
    if (total === 0) {
      statusEl.textContent = "No subjects";
    } else {
      statusEl.textContent = `Subject ${pastDeckIndex + 1} of ${total}`;
    }
  }

  if (prevBtn) prevBtn.disabled = disableNav;
  if (nextBtn) nextBtn.disabled = disableNav;
}

function updatePastSubjectDeck() {
  const total = pastDeckCards.length;

  if (total === 0) {
    updatePastDeckControls();
    return;
  }

  if (pastDeckIndex >= total) {
    pastDeckIndex = 0;
  }

  const nextIndex = (pastDeckIndex + 1) % total;
  const afterNextIndex = (pastDeckIndex + 2) % total;
  const prevIndex = (pastDeckIndex - 1 + total) % total;

  pastDeckCards.forEach((card, idx) => {
    let deckState = "hidden";

    if (idx === pastDeckIndex) {
      deckState = "active";
    } else if (idx === nextIndex && total > 1) {
      deckState = "next";
    } else if (idx === afterNextIndex && total > 2) {
      deckState = "after-next";
    } else if (idx === prevIndex && total > 1) {
      deckState = "prev";
    }

    card.setAttribute("data-deck-state", deckState);
    card.setAttribute("aria-hidden", deckState === "active" ? "false" : "true");
    setPastCardInteractive(card, deckState === "active");
  });

  updatePastDeckControls();
  syncPastDeckStageHeight();
}

function goToNextPastSubject() {
  const total = pastDeckCards.length;
  if (total <= 1) return;

  pastDeckIndex = (pastDeckIndex + 1) % total;
  updatePastSubjectDeck();
}

function goToPreviousPastSubject() {
  const total = pastDeckCards.length;
  if (total <= 1) return;

  pastDeckIndex = (pastDeckIndex - 1 + total) % total;
  updatePastSubjectDeck();
}

function handlePastDeckTouchStart(event) {
  const touch = event.changedTouches?.[0];
  if (!touch) return;

  pastDeckTouchStartX = touch.clientX;
  pastDeckTouchStartY = touch.clientY;
}

function handlePastDeckTouchEnd(event) {
  const touch = event.changedTouches?.[0];
  if (!touch || pastDeckTouchStartX === null || pastDeckTouchStartY === null) {
    return;
  }

  const deltaX = touch.clientX - pastDeckTouchStartX;
  const deltaY = touch.clientY - pastDeckTouchStartY;
  const absDeltaX = Math.abs(deltaX);
  const absDeltaY = Math.abs(deltaY);

  pastDeckTouchStartX = null;
  pastDeckTouchStartY = null;

  if (
    absDeltaX < PAST_DECK_SWIPE_THRESHOLD_PX ||
    absDeltaX <= absDeltaY
  ) {
    return;
  }

  if (deltaX < 0) {
    goToNextPastSubject();
    return;
  }

  goToPreviousPastSubject();
}

function setupPastSubjectDeck() {
  pastDeckStage = document.getElementById("pastSubjectsDeckStage");

  if (!pastDeckStage) {
    resetPastSubjectDeck();
    return;
  }

  pastDeckCards = Array.from(pastDeckStage.querySelectorAll(".deck-card"));
  if (pastDeckCards.length === 0) {
    resetPastSubjectDeck();
    return;
  }

  if (pastDeckIndex >= pastDeckCards.length) {
    pastDeckIndex = 0;
  }

  pastDeckStage.addEventListener("touchstart", handlePastDeckTouchStart, {
    passive: true,
  });
  pastDeckStage.addEventListener("touchend", handlePastDeckTouchEnd, {
    passive: true,
  });

  if (!pastDeckResizeListenerAttached) {
    window.addEventListener("resize", refreshPastDeckMeasurements);
    pastDeckResizeListenerAttached = true;
  }

  refreshPastDeckMeasurements();
  updatePastSubjectDeck();
}

// ===== DISPLAY SUBJECTS FOR SELECTED DATE =====
function displaySubjectsForDate(dateStr, dayName) {
  const container = document.getElementById("subjectsContainer");

  // Filter subjects scheduled on this day
  const subjectsOnDay = allSubjects.filter(
    (subject) => subject.days && subject.days.includes(dayName),
  );

  if (subjectsOnDay.length === 0) {
    resetPastSubjectDeck();
    container.innerHTML =
      '<p class="placeholder">No subjects scheduled on this day</p>';
    return;
  }

  const cardsHtml = subjectsOnDay
    .map((subject) => {
      const subjectId = subject._id;
      const defaultStatus = draftStatusBySubject[subjectId] || "";
      const subjectType = subject.type === "lab" ? "Lab" : "Theory";
      const badgeClass = subject.type === "lab" ? "badge-lab" : "badge-theory";
      const shortDay = dayName.slice(0, 3).toUpperCase();
      const isPresent = defaultStatus === "present";
      const isAbsent = defaultStatus === "absent";
      const isNoClass = defaultStatus === "no_class";

      return `
        <div class="subject-card subject-attendance-card deck-card" id="past-card-${subjectId}">
          <div class="subject-card-header past-subject-header">
            <div class="subject-info">
              <h3>${escapeHtml(subject.name)}</h3>
              <span class="subject-badge ${badgeClass}">
                ${subjectType} · ${shortDay}
              </span>
            </div>
            <span class="past-subject-date-chip">${dateStr}</span>
          </div>

          <div class="subject-actions past-subject-actions">
            <div class="mark-btns past-mark-btns">
              <button
                type="button"
                class="btn btn-sm btn-present past-status-btn ${isPresent ? "is-selected" : ""}"
                data-attendance-subject-id="${subjectId}"
                data-attendance-status="present"
                aria-pressed="${isPresent ? "true" : "false"}"
              >
                ✓ Present
              </button>
              <button
                type="button"
                class="btn btn-sm btn-absent past-status-btn ${isAbsent ? "is-selected" : ""}"
                data-attendance-subject-id="${subjectId}"
                data-attendance-status="absent"
                aria-pressed="${isAbsent ? "true" : "false"}"
              >
                ✕ Absent
              </button>
              <button
                type="button"
                class="btn btn-sm btn-noclass past-status-btn ${isNoClass ? "is-selected" : ""}"
                data-attendance-subject-id="${subjectId}"
                data-attendance-status="no_class"
                aria-pressed="${isNoClass ? "true" : "false"}"
              >
                ⊘ No Class
              </button>
            </div>
          </div>

          <button
            class="btn btn-sm btn-primary past-save-btn"
            type="button"
            data-mark-past-subject-id="${subjectId}"
            data-mark-past-date="${dateStr}"
          >
            Save Attendance
          </button>
        </div>
      `;
    })
    .join("");

  container.innerHTML = `
    <section class="subject-deck past-subject-deck" aria-label="Subjects on selected date">
      <div class="subject-deck-shell past-subject-deck-shell">
        <button
          id="pastDeckPrev"
          class="subject-deck-side-btn"
          type="button"
          data-past-deck-prev
          aria-label="Show previous subject"
        >
          ◀
        </button>
        <div
          id="pastSubjectsDeckStage"
          class="subject-deck-stage past-subject-deck-stage"
          tabindex="0"
          role="region"
          aria-roledescription="carousel"
          aria-label="Past attendance subjects"
        >
          ${cardsHtml}
        </div>
        <button
          id="pastDeckNext"
          class="subject-deck-side-btn"
          type="button"
          data-past-deck-next
          aria-label="Show next subject"
        >
          ▶
        </button>
      </div>
      <div class="subject-deck-meta">
        <span id="pastDeckStatus" class="subject-deck-status" aria-live="polite"></span>
        <span class="subject-deck-help">Use arrow keys or swipe</span>
      </div>
    </section>
  `;

  setupPastSubjectDeck();
}

function updateMarkedStatus(subjectId, status) {
  draftStatusBySubject[subjectId] = status;

  const statusButtons = document.querySelectorAll(
    "[data-attendance-subject-id]",
  );
  statusButtons.forEach((button) => {
    if (!(button instanceof HTMLElement)) return;
    if (button.getAttribute("data-attendance-subject-id") !== subjectId) return;

    const isSelected = button.getAttribute("data-attendance-status") === status;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", isSelected ? "true" : "false");
  });
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

  if (target.closest("[data-past-deck-prev]")) {
    goToPreviousPastSubject();
    return;
  }

  if (target.closest("[data-past-deck-next]")) {
    goToNextPastSubject();
    return;
  }

  const statusButton = target.closest("[data-attendance-subject-id]");
  const statusSubjectId = statusButton?.getAttribute("data-attendance-subject-id");
  const statusValue = statusButton?.getAttribute("data-attendance-status");
  if (statusSubjectId && statusValue) {
    updateMarkedStatus(statusSubjectId, statusValue);
    return;
  }

  const saveButton = target.closest("[data-mark-past-subject-id]");
  const pastSubjectId = saveButton?.getAttribute("data-mark-past-subject-id");
  const pastDate = saveButton?.getAttribute("data-mark-past-date");
  if (pastSubjectId && pastDate) {
    markPastAttendance(pastSubjectId, pastDate);
  }
});

document.addEventListener("keydown", (event) => {
  if (pastDeckCards.length <= 1) return;

  const target = event.target;
  if (target instanceof HTMLElement) {
    const tagName = target.tagName;
    const isEditable =
      target.isContentEditable ||
      tagName === "INPUT" ||
      tagName === "TEXTAREA" ||
      tagName === "SELECT";
    if (isEditable) return;
  }

  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    event.preventDefault();
    goToNextPastSubject();
    return;
  }

  if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    event.preventDefault();
    goToPreviousPastSubject();
  }
});
