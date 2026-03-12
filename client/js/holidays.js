if (!requireAuth()) {
  // Will redirect to login
}

const userNameEl = document.getElementById("userName");
if (userNameEl) {
  userNameEl.textContent = getUserName();
}

let currentYear;
let currentMonth;
let holidays = [];
let semesterStart = "";
let semesterEnd = "";

const MONTH_NAMES = [
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

function formatDate(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isValidDateString(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function hasValidSemesterRange() {
  if (!isValidDateString(semesterStart) || !isValidDateString(semesterEnd)) {
    return false;
  }

  return new Date(`${semesterEnd}T00:00:00`) > new Date(`${semesterStart}T00:00:00`);
}

function isDateWithinSemester(dateStr) {
  if (!isValidDateString(dateStr)) {
    return false;
  }

  if (!hasValidSemesterRange()) {
    return true;
  }

  return dateStr >= semesterStart && dateStr <= semesterEnd;
}

function monthBounds(year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return {
    first: formatDate(year, month, 1),
    last: formatDate(year, month, daysInMonth),
  };
}

function isMonthWithinSemester(year, month) {
  if (!hasValidSemesterRange()) {
    return true;
  }

  const { first, last } = monthBounds(year, month);
  return !(last < semesterStart || first > semesterEnd);
}

function canChangeMonth(delta) {
  if (!Number.isInteger(delta) || delta === 0) {
    return false;
  }

  let nextMonth = currentMonth + delta;
  let nextYear = currentYear;
  if (nextMonth > 11) {
    nextMonth = 0;
    nextYear += 1;
  } else if (nextMonth < 0) {
    nextMonth = 11;
    nextYear -= 1;
  }

  return isMonthWithinSemester(nextYear, nextMonth);
}

function clampCurrentMonthToSemester() {
  if (!hasValidSemesterRange()) {
    return;
  }

  if (isMonthWithinSemester(currentYear, currentMonth)) {
    return;
  }

  const { first, last } = monthBounds(currentYear, currentMonth);
  const target = last < semesterStart ? semesterStart : semesterEnd;
  const [targetYear, targetMonth] = target.split("-").map(Number);
  currentYear = targetYear;
  currentMonth = targetMonth - 1;
}

function setMonthNavDisabledState() {
  const prevBtn = document.getElementById("prevMonth");
  const nextBtn = document.getElementById("nextMonth");
  if (prevBtn) prevBtn.disabled = !canChangeMonth(-1);
  if (nextBtn) nextBtn.disabled = !canChangeMonth(1);
}

function formatDateReadable(dateStr) {
  const [y, m, d] = dateStr.split("-");
  return `${parseInt(d)} ${MONTH_NAMES[parseInt(m) - 1]} ${y}`;
}

async function loadHolidays() {
  try {
    const [holidayData, semesterData] = await Promise.all([
      api.get("/api/holidays"),
      api.get("/api/settings/semester"),
    ]);
    holidays = Array.isArray(holidayData) ? holidayData : [];
    semesterStart = semesterData?.semesterStart || "";
    semesterEnd = semesterData?.semesterEnd || "";
    clampCurrentMonthToSemester();
    renderCalendar();
    renderHolidayList();
  } catch (error) {
    showToast(error.message, "error");
  }
}

function renderCalendar() {
  const grid = document.getElementById("calendarGrid");
  const title = document.getElementById("calendarTitle");
  clampCurrentMonthToSemester();

  title.textContent = `${MONTH_NAMES[currentMonth]} ${currentYear}`;

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const today = new Date();
  const todayStr = formatDate(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  let html = "";

  for (let i = 0; i < firstDay; i++) {
    html += '<div class="calendar-day empty"></div>';
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = formatDate(currentYear, currentMonth, day);
    const inSemester = isDateWithinSemester(dateStr);
    const isHoliday = holidays.includes(dateStr);
    const isToday = dateStr === todayStr;

    let classes = "calendar-day";
    if (!inSemester) classes += " disabled";
    if (isHoliday) classes += " holiday";
    if (isToday) classes += " today";
    const clickAttr = inSemester ? `data-holiday-date="${dateStr}"` : "";
    const titleText = inSemester
      ? formatDateReadable(dateStr)
      : `${formatDateReadable(dateStr)} (Outside semester timeline)`;

    html += `<div class="${classes}" ${clickAttr} title="${titleText}">
      <span class="day-num">${day}</span>
      ${isHoliday ? '<span class="day-badge">🏖</span>' : ""}
    </div>`;
  }

  grid.innerHTML = html;
  setMonthNavDisabledState();
}

function renderHolidayList() {
  const list = document.getElementById("holidayList");
  const count = document.getElementById("holidayCount");

  count.textContent = holidays.length;

  if (holidays.length === 0) {
    list.innerHTML =
      '<p class="text-muted" style="font-size: 0.85rem;">No holidays marked yet. Click dates on the calendar to add.</p>';
    return;
  }

  const sorted = [...holidays].sort();

  list.innerHTML = sorted
    .map(
      (date) => `
    <div class="holiday-item">
      <span>🏖 ${formatDateReadable(date)}</span>
      <button class="btn btn-sm btn-danger-ghost" data-holiday-date="${date}" title="Remove">✕</button>
    </div>
  `,
    )
    .join("");
}

async function toggleHoliday(dateStr) {
  try {
    const isAlreadyHoliday = holidays.includes(dateStr);

    if (!isAlreadyHoliday && !isDateWithinSemester(dateStr)) {
      showToast("Select holiday dates within your semester timeline.", "error");
      return;
    }

    if (isAlreadyHoliday) {
      await api.delete("/api/holidays/" + dateStr);
      holidays = holidays.filter((d) => d !== dateStr);
      showToast("Holiday removed", "success");
    } else {
      await api.post("/api/holidays", { date: dateStr });
      holidays.push(dateStr);
      showToast("Holiday added — " + formatDateReadable(dateStr), "success");
    }
    renderCalendar();
    renderHolidayList();
  } catch (error) {
    showToast(error.message, "error");
  }
}

function changeMonth(delta) {
  if (!canChangeMonth(delta)) {
    return;
  }

  currentMonth += delta;
  if (currentMonth > 11) {
    currentMonth = 0;
    currentYear++;
  } else if (currentMonth < 0) {
    currentMonth = 11;
    currentYear--;
  }
  renderCalendar();
}

// Initialize
const now = new Date();
currentYear = now.getFullYear();
currentMonth = now.getMonth();
loadHolidays();

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const holidayTarget = target.closest("[data-holiday-date]");
  const holidayDate =
    holidayTarget instanceof HTMLElement
      ? holidayTarget.getAttribute("data-holiday-date")
      : null;
  if (holidayDate) {
    toggleHoliday(holidayDate);
    return;
  }

  if (target.closest("#prevMonth")) {
    changeMonth(-1);
    return;
  }

  if (target.closest("#nextMonth")) {
    changeMonth(1);
  }
});
