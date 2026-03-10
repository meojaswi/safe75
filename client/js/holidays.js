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

function formatDateReadable(dateStr) {
  const [y, m, d] = dateStr.split("-");
  return `${parseInt(d)} ${MONTH_NAMES[parseInt(m) - 1]} ${y}`;
}

async function loadHolidays() {
  try {
    holidays = await api.get("/api/holidays");
    renderCalendar();
    renderHolidayList();
  } catch (error) {
    showToast(error.message, "error");
  }
}

function renderCalendar() {
  const grid = document.getElementById("calendarGrid");
  const title = document.getElementById("calendarTitle");

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
    const isHoliday = holidays.includes(dateStr);
    const isToday = dateStr === todayStr;

    let classes = "calendar-day";
    if (isHoliday) classes += " holiday";
    if (isToday) classes += " today";

    html += `<div class="${classes}" data-holiday-date="${dateStr}" title="${formatDateReadable(dateStr)}">
      <span class="day-num">${day}</span>
      ${isHoliday ? '<span class="day-badge">🏖</span>' : ""}
    </div>`;
  }

  grid.innerHTML = html;
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
    if (holidays.includes(dateStr)) {
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

  const holidayDate = target.getAttribute("data-holiday-date");
  if (holidayDate) {
    toggleHoliday(holidayDate);
    return;
  }

  if (target.id === "prevMonth") {
    changeMonth(-1);
    return;
  }

  if (target.id === "nextMonth") {
    changeMonth(1);
  }
});
