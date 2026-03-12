if (!requireAuth()) {
  // Will redirect to login
}

const onboardingUserNameEl = document.getElementById("onboardingUserName");
if (onboardingUserNameEl) {
  onboardingUserNameEl.textContent = getUserName();
}

const STEPS = [
  { id: 0, label: "Semester Timeline" },
  { id: 1, label: "Add Subjects" },
  { id: 2, label: "Add Holidays" },
  { id: 3, label: "Welcome Onboard" },
];

const SCHEDULE_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const WEEKDAY_ABBREVIATIONS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
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

const PATH =
  "M 60 80 C 160 20, 280 160, 400 100 C 520 40, 620 160, 740 110 C 860 60, 960 30, 1060 50";
const DOT_T = [0, 0.3, 0.62, 1];
const now = new Date();

const state = {
  loading: true,
  step: 0,
  saving: false,
  error: "",
  semester: {
    start: "",
    end: "",
  },
  subjects: [],
  holidays: [],
  holidayCalendar: {
    year: now.getFullYear(),
    month: now.getMonth(),
  },
};

let tempSubjectCounter = 0;

function nextTempSubjectId() {
  tempSubjectCounter += 1;
  return `tmp-${tempSubjectCounter}`;
}

function subjectKey(subject) {
  return subject.id || subject.tempId;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text == null ? "" : String(text);
  return div.innerHTML;
}

function isValidDateString(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidSemesterRange(start, end) {
  if (!isValidDateString(start) || !isValidDateString(end)) {
    return false;
  }
  return new Date(`${end}T00:00:00`) > new Date(`${start}T00:00:00`);
}

function getSemesterError() {
  const start = state.semester.start;
  const end = state.semester.end;

  if (!start || !end) {
    return "Semester start and end dates are required.";
  }

  if (!isValidSemesterRange(start, end)) {
    return "End date must be after start date.";
  }

  return "";
}

function getSemesterDuration() {
  if (!isValidSemesterRange(state.semester.start, state.semester.end)) {
    return null;
  }

  const start = new Date(`${state.semester.start}T00:00:00`);
  const end = new Date(`${state.semester.end}T00:00:00`);
  const days = Math.round((end - start) / 86400000);
  const weeks = Math.round(days / 7);

  return { days, weeks };
}

function formatHolidayDate(dateStr) {
  if (!isValidDateString(dateStr)) {
    return dateStr;
  }

  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatIsoDate(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function toggleHolidayDate(date) {
  if (!isValidDateString(date)) {
    return;
  }

  if (state.holidays.includes(date)) {
    state.holidays = state.holidays.filter((holidayDate) => holidayDate !== date);
  } else {
    state.holidays = uniqueSortedDates([...state.holidays, date]);
  }

  clearError();
  render();
}

function changeHolidayCalendarMonth(delta) {
  if (!Number.isInteger(delta) || delta === 0) {
    return;
  }

  let { month, year } = state.holidayCalendar;
  month += delta;

  if (month > 11) {
    month = 0;
    year += 1;
  } else if (month < 0) {
    month = 11;
    year -= 1;
  }

  state.holidayCalendar.month = month;
  state.holidayCalendar.year = year;
  render();
}

function renderHolidayCalendarCells() {
  const { year, month } = state.holidayCalendar;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayStr = formatIsoDate(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  let html = "";

  for (let index = 0; index < firstDay; index += 1) {
    html += '<div class="calendar-day empty"></div>';
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = formatIsoDate(year, month, day);
    const isHoliday = state.holidays.includes(date);
    const isToday = date === todayStr;

    let classes = "calendar-day";
    if (isHoliday) classes += " holiday";
    if (isToday) classes += " today";

    html += `
      <div class="${classes}" data-onboarding-holiday-date="${escapeHtml(date)}" title="${escapeHtml(formatHolidayDate(date))}">
        <span class="day-num">${day}</span>
      </div>
    `;
  }

  return html;
}

function normalizeDays(days) {
  if (!Array.isArray(days)) {
    return [];
  }

  const valid = new Set();
  for (const day of days) {
    if (typeof day !== "string") continue;
    const trimmed = day.trim();
    if (SCHEDULE_DAYS.includes(trimmed)) {
      valid.add(trimmed);
    }
  }

  return Array.from(valid);
}

function sanitizeSubject(subject) {
  const name = (subject?.name || "").trim();
  const type = subject?.type === "lab" ? "lab" : "theory";
  const days = normalizeDays(subject?.days);

  if (!name) {
    return null;
  }

  return { name, type, days };
}

function mapSubjectFromApi(subject) {
  const normalized = sanitizeSubject(subject);
  if (!normalized) {
    return null;
  }

  return {
    id: String(subject._id),
    tempId: nextTempSubjectId(),
    ...normalized,
  };
}

function uniqueSortedDates(dates) {
  const set = new Set();
  for (const date of dates || []) {
    if (isValidDateString(date)) {
      set.add(date);
    }
  }
  return Array.from(set).sort();
}

function getFirstIncompleteStep() {
  if (!isValidSemesterRange(state.semester.start, state.semester.end)) {
    return 0;
  }
  if (state.subjects.length === 0) {
    return 1;
  }
  return 2;
}

function getPointAtT(t) {
  const segments = [
    { p0: [60, 80], p1: [160, 20], p2: [280, 160], p3: [400, 100] },
    { p0: [400, 100], p1: [520, 40], p2: [620, 160], p3: [740, 110] },
    { p0: [740, 110], p1: [860, 60], p2: [960, 30], p3: [1060, 50] },
  ];

  const segment =
    t < 0.333 ? segments[0] : t < 0.667 ? segments[1] : segments[2];
  const localT =
    t < 0.333 ? t / 0.333 : t < 0.667 ? (t - 0.333) / 0.333 : (t - 0.667) / 0.333;

  const mt = 1 - localT;
  const { p0, p1, p2, p3 } = segment;

  return {
    x:
      mt * mt * mt * p0[0] +
      3 * mt * mt * localT * p1[0] +
      3 * mt * localT * localT * p2[0] +
      localT * localT * localT * p3[0],
    y:
      mt * mt * mt * p0[1] +
      3 * mt * mt * localT * p1[1] +
      3 * mt * localT * localT * p2[1] +
      localT * localT * localT * p3[1],
  };
}

function canGoNext() {
  if (state.step === 0) {
    return isValidSemesterRange(state.semester.start, state.semester.end);
  }

  if (state.step === 1) {
    return state.subjects.length > 0;
  }

  if (state.step === 2) {
    return !state.saving;
  }

  return false;
}

function renderStepError() {
  if (!state.error) {
    return "";
  }
  return `<div class="alert alert-error show onboarding-alert">${escapeHtml(state.error)}</div>`;
}

function renderActions() {
  if (state.step >= 3) {
    return "";
  }

  const backDisabled = state.step === 0 || state.saving ? "disabled" : "";
  const nextDisabled = canGoNext() && !state.saving ? "" : "disabled";
  const nextLabel =
    state.step === 2
      ? state.saving
        ? '<span class="loading-spinner"></span>'
        : "Finish Setup"
      : "Next";

  return `
    <div class="onboarding-actions">
      <button type="button" class="btn btn-ghost" data-onboarding-back ${backDisabled}>
        Back
      </button>
      <div class="onboarding-mini-dots" aria-hidden="true">
        ${[0, 1, 2]
          .map((idx) => {
            const classes = [
              "onboarding-mini-dot",
              idx === state.step ? "is-active" : "",
              idx < state.step ? "is-done" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return `<span class="${classes}"></span>`;
          })
          .join("")}
      </div>
      <button type="button" class="btn btn-primary onboarding-next-btn" data-onboarding-next ${nextDisabled}>
        ${nextLabel}
      </button>
    </div>
  `;
}

function renderProgress() {
  const safeStep = Math.max(0, Math.min(state.step, 3));
  const progressRatio = safeStep / 3;
  const dashOffset = 1200 - progressRatio * 1200;
  const points = DOT_T.map((value) => getPointAtT(value));

  const dots = points
    .map((point, index) => {
      const done = index < safeStep;
      const active = index === safeStep;
      const label = STEPS[index].label;
      const anchor = index === 0 ? "start" : index === 3 ? "end" : "middle";
      const jumpAttr = done ? `data-step-jump="${index}"` : "";
      const classList = [
        "onboarding-dot-group",
        done ? "is-done" : "",
        active ? "is-active" : "",
      ]
        .filter(Boolean)
        .join(" ");

      return `
        <g class="${classList}" ${jumpAttr}>
          <circle
            class="onboarding-dot"
            cx="${point.x}"
            cy="${point.y}"
            r="12"
          />
          ${
            done
              ? `<path d="M ${point.x - 4} ${point.y} L ${point.x - 1} ${point.y + 3} L ${point.x + 5} ${point.y - 3}" class="onboarding-dot-check" />`
              : `<circle cx="${point.x}" cy="${point.y}" r="3.5" class="onboarding-dot-inner" />`
          }
          <text
            x="${point.x}"
            y="${point.y + (index % 2 === 0 ? -20 : 26)}"
            text-anchor="${anchor}"
            class="onboarding-dot-label"
          >${escapeHtml(label)}</text>
        </g>
      `;
    })
    .join("");

  return `
    <section class="onboarding-progress-card">
      <div class="page-header onboarding-page-header">
        <h1>First-time setup</h1>
        <p>Use this flow once to configure semester dates, subjects, and holidays.</p>
      </div>

      <svg viewBox="0 0 1120 200" class="onboarding-progress-svg" aria-hidden="true">
        <defs>
          <linearGradient id="onboardingPathGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#22c55e" stop-opacity="0.9"></stop>
            <stop offset="100%" stop-color="#16a34a" stop-opacity="0.5"></stop>
          </linearGradient>
        </defs>
        <path d="${PATH}" fill="none" class="onboarding-path-base"></path>
        <path
          d="${PATH}"
          fill="none"
          class="onboarding-path-progress"
          style="stroke-dasharray: 1200; stroke-dashoffset: ${dashOffset};"
        ></path>
        ${dots}
      </svg>
    </section>
  `;
}

function renderTimelineStep() {
  const duration = getSemesterDuration();
  const durationInfo = duration
    ? `<div class="semester-info onboarding-semester-info" style="display: flex;">
        <span class="info-icon">i</span>
        ${duration.days} days (${duration.weeks} weeks) in this semester
      </div>`
    : "";

  return `
    <section class="form-card onboarding-step-card">
      <p class="onboarding-step-meta">Step 1 of 3</p>
      <h2>Semester Timeline</h2>
      <p class="onboarding-step-copy">Set your semester start and end dates.</p>

      <div class="onboarding-field-row">
        <div class="form-group">
          <label for="semesterStartInput">Semester Start Date</label>
          <input type="date" id="semesterStartInput" value="${escapeHtml(state.semester.start)}" required />
        </div>
        <div class="form-group">
          <label for="semesterEndInput">Last Working Day</label>
          <input type="date" id="semesterEndInput" value="${escapeHtml(state.semester.end)}" required />
        </div>
      </div>

      ${durationInfo}
      ${renderStepError()}
      ${renderActions()}
    </section>
  `;
}

function renderSubjectsStep() {
  const rows = state.subjects
    .map((subject) => {
      const key = subjectKey(subject);
      const typeLabel = subject.type === "lab" ? "Lab" : "Theory";
      const toneClass = subject.type === "lab" ? "tone-warn" : "tone-good";
      const schedule =
        subject.days.length > 0
          ? subject.days.map((day) => day.slice(0, 3)).join(", ")
          : "No schedule";

      return `
        <div class="onboarding-subject-row">
          <button type="button" class="subject-picker-btn ${toneClass}" data-subject-key="${escapeHtml(key)}">
            <span class="subject-picker-name">${escapeHtml(subject.name)}</span>
            <span class="subject-picker-badge">${escapeHtml(typeLabel)} - ${escapeHtml(schedule)}</span>
          </button>
          <button
            type="button"
            class="btn btn-sm btn-danger-ghost onboarding-remove-btn"
            data-remove-subject-key="${escapeHtml(key)}"
            title="Remove subject"
          >
            x
          </button>
        </div>
      `;
    })
    .join("");

  const subjectListHtml =
    rows ||
    '<p class="text-muted onboarding-empty-note">No subjects added yet. Add at least one subject to continue.</p>';

  return `
    <section class="onboarding-step-card onboarding-subjects-step">
      <p class="onboarding-step-meta">Step 2 of 3</p>
      <h2>Add Subjects</h2>
      <p class="onboarding-step-copy">Use the same subject setup style used in your existing subjects flow.</p>

      <div class="onboarding-step-grid">
        <div class="form-card onboarding-subject-form-card">
          <form id="onboardingSubjectForm">
            <div class="form-group">
              <label for="onboardingSubjectName">Subject Name</label>
              <input type="text" id="onboardingSubjectName" placeholder="e.g. Data Structures" required />
            </div>

            <div class="form-group">
              <label for="onboardingSubjectType">Type</label>
              <select id="onboardingSubjectType">
                <option value="theory">Theory</option>
                <option value="lab">Lab</option>
              </select>
            </div>

            <div class="form-group">
              <label>Scheduled Days</label>
              <div class="days-grid onboarding-days-grid">
                ${SCHEDULE_DAYS.map((day) => {
                  const id = `onboarding-day-${day.toLowerCase()}`;
                  return `
                    <div class="day-checkbox onboarding-day-checkbox">
                      <input type="checkbox" id="${id}" name="onboardingDays" value="${day}" />
                      <label for="${id}">${day.slice(0, 3)}</label>
                    </div>
                  `;
                }).join("")}
              </div>
            </div>

            <p class="add-subject-warning">
              Schedule days should match your real class timetable for accurate tracking.
            </p>

            <button type="submit" class="btn btn-primary btn-full">Add Subject</button>
          </form>
        </div>

        <aside class="subject-picker-pane onboarding-subject-pane">
          <div class="onboarding-list-heading">
            <h3>Added Subjects</h3>
            <span>${state.subjects.length}</span>
          </div>
          <div class="subject-picker-grid onboarding-subject-grid">
            ${subjectListHtml}
          </div>
        </aside>
      </div>

      ${renderStepError()}
      ${renderActions()}
    </section>
  `;
}

function renderHolidaysStep() {
  const holidayChips =
    state.holidays.length > 0
      ? state.holidays
          .map(
            (date) => `
            <button
              type="button"
              class="onboarding-holiday-chip"
              data-remove-holiday-date="${escapeHtml(date)}"
              title="Remove ${escapeHtml(formatHolidayDate(date))}"
            >
              ${escapeHtml(formatHolidayDate(date))} <span aria-hidden="true">x</span>
            </button>
          `,
          )
          .join("")
      : '<p class="text-muted onboarding-empty-note">No holidays selected yet.</p>';
  const { year, month } = state.holidayCalendar;

  return `
    <section class="form-card onboarding-step-card">
      <p class="onboarding-step-meta">Step 3 of 3</p>
      <h2>Add Holidays</h2>
      <p class="onboarding-step-copy">Click dates to toggle holidays, and use arrows to switch months.</p>

      <div class="calendar-card onboarding-holiday-card">
        <div class="calendar-nav">
          <button type="button" class="btn btn-ghost btn-sm" data-onboarding-holiday-month="-1" aria-label="Previous month">
            ←
          </button>
          <h3>${MONTH_NAMES[month]} ${year}</h3>
          <button type="button" class="btn btn-ghost btn-sm" data-onboarding-holiday-month="1" aria-label="Next month">
            →
          </button>
        </div>

        <div class="calendar-header">
          ${WEEKDAY_ABBREVIATIONS.map((day) => `<span>${day}</span>`).join("")}
        </div>

        <div class="calendar-grid">
          ${renderHolidayCalendarCells()}
        </div>
      </div>

      <div class="onboarding-holiday-meta">
        <span class="holiday-count">${state.holidays.length}</span>
        <p class="text-muted">Click a selected date again to remove it.</p>
      </div>

      <div class="onboarding-holiday-chip-list">
        ${holidayChips}
      </div>

      ${renderStepError()}
      ${renderActions()}
    </section>
  `;
}

function renderWelcomeStep() {
  return `
    <section class="form-card onboarding-step-card onboarding-welcome-card">
      <p class="onboarding-step-meta">Setup Complete</p>
      <h2>Welcome onboard!</h2>
      <p class="onboarding-step-copy">
        ${state.subjects.length} subjects configured, ${state.holidays.length} holidays marked, and semester dates saved.
      </p>
      <button type="button" class="btn btn-primary" data-go-dashboard>
        Go to Dashboard
      </button>
    </section>
  `;
}

function renderStep() {
  if (state.step === 0) return renderTimelineStep();
  if (state.step === 1) return renderSubjectsStep();
  if (state.step === 2) return renderHolidaysStep();
  return renderWelcomeStep();
}

function render() {
  const appEl = document.getElementById("onboardingApp");
  if (!appEl) {
    return;
  }

  if (state.loading) {
    appEl.innerHTML = `
      <div class="onboarding-loading">
        <span class="loading-spinner"></span>
        <p>Loading setup flow...</p>
      </div>
    `;
    return;
  }

  appEl.innerHTML = `
    ${renderProgress()}
    ${renderStep()}
  `;
}

function clearError() {
  state.error = "";
}

function setError(message) {
  state.error = message || "";
}

function getComparableSubject(subject) {
  const normalized = sanitizeSubject(subject);
  if (!normalized) {
    return null;
  }

  return {
    ...normalized,
    days: normalized.days.slice().sort(),
  };
}

function subjectsAreEqual(existingSubject, draftSubject) {
  const existing = getComparableSubject(existingSubject);
  const draft = getComparableSubject(draftSubject);

  if (!existing || !draft) {
    return false;
  }

  if (existing.name !== draft.name || existing.type !== draft.type) {
    return false;
  }

  if (existing.days.length !== draft.days.length) {
    return false;
  }

  for (let i = 0; i < existing.days.length; i += 1) {
    if (existing.days[i] !== draft.days[i]) {
      return false;
    }
  }

  return true;
}

async function syncSubjectsToServer() {
  const existingSubjects = await api.get("/api/subjects");
  const existingById = new Map(
    existingSubjects.map((subject) => [String(subject._id), subject]),
  );

  const desiredById = new Set();
  const updates = [];
  const creates = [];

  for (const draft of state.subjects) {
    const payload = sanitizeSubject(draft);
    if (!payload) continue;

    if (draft.id && existingById.has(draft.id)) {
      desiredById.add(draft.id);
      const existing = existingById.get(draft.id);
      if (!subjectsAreEqual(existing, payload)) {
        updates.push(api.put("/api/subjects/" + draft.id, payload));
      }
    } else {
      creates.push(payload);
    }
  }

  const deletes = existingSubjects
    .filter((subject) => !desiredById.has(String(subject._id)))
    .map((subject) => api.delete("/api/subjects/" + subject._id));

  await Promise.all([...updates, ...deletes]);

  for (const payload of creates) {
    // Keep create operations sequential to avoid duplicate-name race conditions.
    // eslint-disable-next-line no-await-in-loop
    await api.post("/api/subjects", payload);
  }
}

async function syncHolidaysToServer() {
  const existing = uniqueSortedDates(await api.get("/api/holidays"));
  const desired = uniqueSortedDates(state.holidays);

  const existingSet = new Set(existing);
  const desiredSet = new Set(desired);

  const toAdd = desired.filter((date) => !existingSet.has(date));
  const toRemove = existing.filter((date) => !desiredSet.has(date));

  if (toAdd.length > 0) {
    await api.post("/api/holidays/bulk", { dates: toAdd });
  }

  if (toRemove.length > 0) {
    await Promise.all(toRemove.map((date) => api.delete("/api/holidays/" + date)));
  }
}

async function finishOnboarding() {
  if (state.saving) {
    return;
  }

  const semesterError = getSemesterError();
  if (semesterError) {
    state.step = 0;
    setError(semesterError);
    render();
    return;
  }

  if (state.subjects.length === 0) {
    state.step = 1;
    setError("Add at least one subject to continue.");
    render();
    return;
  }

  state.saving = true;
  clearError();
  render();

  try {
    await api.put("/api/settings/semester", {
      semesterStart: state.semester.start,
      semesterEnd: state.semester.end,
    });

    await syncSubjectsToServer();
    await syncHolidaysToServer();

    if (typeof window.clearSetupStatusCache === "function") {
      window.clearSetupStatusCache();
    }

    document.body.classList.add("onboarding-blackout");
    window.setTimeout(() => {
      document.body.classList.remove("onboarding-blackout");
      state.saving = false;
      state.step = 3;
      render();
    }, 220);
  } catch (error) {
    document.body.classList.remove("onboarding-blackout");
    state.saving = false;
    setError(error.message || "Could not complete onboarding.");
    render();
  }
}

function handleStepAdvance() {
  if (state.step === 0) {
    const semesterError = getSemesterError();
    if (semesterError) {
      setError(semesterError);
      render();
      return;
    }

    clearError();
    state.step = 1;
    render();
    return;
  }

  if (state.step === 1) {
    if (state.subjects.length === 0) {
      setError("Add at least one subject to continue.");
      render();
      return;
    }

    clearError();
    state.step = 2;
    render();
    return;
  }

  if (state.step === 2) {
    finishOnboarding();
  }
}

function handleAddSubject(form) {
  const nameInput = form.querySelector("#onboardingSubjectName");
  const typeInput = form.querySelector("#onboardingSubjectType");
  const checkedDays = form.querySelectorAll('input[name="onboardingDays"]:checked');

  const name = nameInput ? nameInput.value.trim() : "";
  const type = typeInput && typeInput.value === "lab" ? "lab" : "theory";
  const days = Array.from(checkedDays).map((input) => input.value);

  if (!name) {
    setError("Subject name is required.");
    render();
    return;
  }

  const duplicate = state.subjects.some(
    (subject) => subject.name.toLowerCase() === name.toLowerCase(),
  );
  if (duplicate) {
    setError("This subject is already in your list.");
    render();
    return;
  }

  clearError();

  state.subjects.push({
    id: null,
    tempId: nextTempSubjectId(),
    name,
    type,
    days: normalizeDays(days),
  });

  render();
}

function handleClick(event) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  if (target.closest("#onboardingLogoutBtn")) {
    event.preventDefault();
    logout();
    return;
  }

  if (target.closest("[data-onboarding-back]")) {
    if (state.step > 0 && !state.saving) {
      clearError();
      state.step -= 1;
      render();
    }
    return;
  }

  if (target.closest("[data-onboarding-next]")) {
    event.preventDefault();
    handleStepAdvance();
    return;
  }

  const stepJumpEl = target.closest("[data-step-jump]");
  if (stepJumpEl && !state.saving) {
    const value = Number(stepJumpEl.getAttribute("data-step-jump"));
    if (Number.isInteger(value) && value >= 0 && value <= 2) {
      clearError();
      state.step = value;
      render();
    }
    return;
  }

  const holidayMonthBtn = target.closest("[data-onboarding-holiday-month]");
  if (holidayMonthBtn && !state.saving) {
    const delta = Number(holidayMonthBtn.getAttribute("data-onboarding-holiday-month"));
    if (delta === -1 || delta === 1) {
      changeHolidayCalendarMonth(delta);
    }
    return;
  }

  const holidayDateCell = target.closest("[data-onboarding-holiday-date]");
  if (holidayDateCell && !state.saving) {
    const date = holidayDateCell.getAttribute("data-onboarding-holiday-date");
    if (date) {
      toggleHolidayDate(date);
    }
    return;
  }

  const removeSubjectBtn = target.closest("[data-remove-subject-key]");
  if (removeSubjectBtn && !state.saving) {
    const key = removeSubjectBtn.getAttribute("data-remove-subject-key");
    state.subjects = state.subjects.filter((subject) => subjectKey(subject) !== key);
    clearError();
    render();
    return;
  }

  const removeHolidayBtn = target.closest("[data-remove-holiday-date]");
  if (removeHolidayBtn && !state.saving) {
    const date = removeHolidayBtn.getAttribute("data-remove-holiday-date");
    state.holidays = state.holidays.filter((holidayDate) => holidayDate !== date);
    clearError();
    render();
    return;
  }

  if (target.closest("[data-go-dashboard]")) {
    window.location.replace("dashboard.html");
  }
}

function handleSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  if (form.id === "onboardingSubjectForm") {
    event.preventDefault();
    handleAddSubject(form);
  }
}

function handleChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  if (target.id === "semesterStartInput") {
    state.semester.start = target.value;
    clearError();
    render();
    return;
  }

  if (target.id === "semesterEndInput") {
    state.semester.end = target.value;
    clearError();
    render();
  }
}

async function loadOnboarding() {
  const appEl = document.getElementById("onboardingApp");
  if (!appEl) {
    return;
  }

  try {
    const [status, semesterData, subjectsData, holidaysData] = await Promise.all([
      api.get("/api/settings/setup-status"),
      api.get("/api/settings/semester"),
      api.get("/api/subjects"),
      api.get("/api/holidays"),
    ]);

    if (status?.onboardingCompleted) {
      window.location.replace("dashboard.html");
      return;
    }

    state.semester.start = semesterData?.semesterStart || "";
    state.semester.end = semesterData?.semesterEnd || "";
    state.subjects = Array.isArray(subjectsData)
      ? subjectsData.map(mapSubjectFromApi).filter(Boolean)
      : [];
    state.holidays = uniqueSortedDates(holidaysData);
    state.step = getFirstIncompleteStep();
    clearError();
  } catch (error) {
    setError(error.message || "Unable to load onboarding setup.");
  } finally {
    state.loading = false;
    render();
  }
}

document.addEventListener("click", handleClick);
document.addEventListener("submit", handleSubmit);
document.addEventListener("change", handleChange);
document.addEventListener("DOMContentLoaded", loadOnboarding);
