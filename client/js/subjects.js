if (!requireAuth()) {
  // Will redirect to login
}

const userNameEl = document.getElementById("userName");
if (userNameEl) {
  userNameEl.textContent = getUserName();
}

const CIRCLE_RADIUS = 35;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;
const EDITABLE_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
let cachedSubjects = [];
let currentDeckIndex = 0;
let deckCards = [];
let deckStage = null;
let touchStartX = null;
let touchStartY = null;
let resizeListenerAttached = false;
let deckMaxCardHeight = 0;
const SWIPE_THRESHOLD_PX = 48;

function getProgressColor(pct) {
  if (pct >= 75) return "var(--accent)";
  if (pct >= 65) return "var(--warning)";
  return "var(--danger)";
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function escapeAttr(text) {
  return escapeHtml(text).replace(/"/g, "&quot;");
}

function createProgressRing(percentage) {
  const offset =
    CIRCLE_CIRCUMFERENCE - (percentage / 100) * CIRCLE_CIRCUMFERENCE;
  const color = getProgressColor(percentage);

  return `
    <div class="progress-ring-container">
      <svg class="progress-ring" viewBox="0 0 80 80">
        <circle class="progress-ring-bg" cx="40" cy="40" r="${CIRCLE_RADIUS}" />
        <circle class="progress-ring-fill" cx="40" cy="40" r="${CIRCLE_RADIUS}"
          style="stroke: ${color}; stroke-dasharray: ${CIRCLE_CIRCUMFERENCE}; stroke-dashoffset: ${offset}" />
      </svg>
      <span class="progress-ring-text" style="color: ${color}">${percentage}%</span>
    </div>
  `;
}

function buildAttendanceMessage(item) {
  if (item.totalClasses <= 0) return "";

  if (item.percentage >= 90) {
    return `<div class="bunk-info safe">🌟 This subject thinks you live in the classroom.</div>`;
  }

  if (item.percentage >= 75) {
    return `<div class="bunk-info safe">✅ You can bunk a little... but don't get greedy.</div>`;
  }

  if (item.percentage >= 60) {
    return `<div class="bunk-info warning">⚡ Maybe attend the next class... just saying.</div>`;
  }

  return `<div class="bunk-info danger">🚨 At this point, just move into the classroom.</div>`;
}

function createSubjectCard(item) {
  const badgeClass = item.type === "lab" ? "badge-lab" : "badge-theory";
  const badgeText = item.type === "lab" ? "Lab" : "Theory";
  const safeSubjectName = escapeHtml(item.subject);
  const subjectNameAttr = escapeAttr(item.subject);

  const bunkHtml = buildAttendanceMessage(item);

  const daysStr = item.days.length > 0
    ? item.days.map((d) => d.slice(0, 3)).join(", ")
    : "No schedule";

  const expectedStr = item.expectedTotal > 0
    ? `<span class="expected">of ${item.expectedTotal} expected</span>`
    : "";

  return `
    <div class="subject-card deck-card" id="card-${item.subjectId}">
      <div class="subject-card-header">
        <div class="subject-info">
          <h3>${safeSubjectName}</h3>
          <span class="subject-badge ${badgeClass}">${badgeText} · ${daysStr}</span>
        </div>
        ${createProgressRing(item.percentage)}
      </div>

      <div class="subject-stats">
        <div class="stat">
          <span class="num">${item.presentClasses}</span>
          <span class="label">Present</span>
        </div>
        <div class="stat">
          <span class="num">${item.totalClasses - item.presentClasses}</span>
          <span class="label">Absent</span>
        </div>
        <div class="stat">
          <span class="num">${item.totalClasses}</span>
          <span class="label">Total</span>
          ${expectedStr}
        </div>
      </div>

      ${bunkHtml}

      <div class="subject-actions">
        <div class="mark-btns"></div>
        <button
          class="btn btn-sm btn-ghost btn-edit-subject"
          data-open-edit-subject-id="${item.subjectId}"
          title="Edit subject"
        >
          Edit
        </button>
        <button
          class="btn btn-sm btn-danger-ghost"
          data-delete-subject-id="${item.subjectId}"
          data-delete-subject-name="${subjectNameAttr}"
          title="Delete subject"
        >
          🗑 Delete
        </button>
      </div>
    </div>
  `;
}

function getAttendancePercent(item) {
  if (!item || item.totalClasses <= 0) {
    return 0;
  }

  const percentage = Math.round((item.presentClasses / item.totalClasses) * 100);
  return Math.max(0, Math.min(100, percentage));
}

function getSubjectPickerTone(item) {
  if (!item || item.totalClasses <= 0) {
    return "none";
  }

  const percent = getAttendancePercent(item);
  if (percent > 75) return "good";
  if (percent >= 60) return "warn";
  return "bad";
}

function createSubjectPickerButton(item, index) {
  const safeSubjectName = escapeHtml(item.subject);
  const attendancePercent = getAttendancePercent(item);
  const tone = getSubjectPickerTone(item);

  return `
    <button
      type="button"
      class="subject-picker-btn tone-${tone}"
      data-subject-pick-index="${index}"
      aria-label="Jump to ${safeSubjectName}, ${attendancePercent}% attendance"
      aria-current="false"
    >
      <span class="subject-picker-name">${safeSubjectName}</span>
      <span class="subject-picker-badge">${attendancePercent}%</span>
    </button>
  `;
}

function getDeckControls() {
  return {
    prevBtn: document.getElementById("subjectDeckPrev"),
    nextBtn: document.getElementById("subjectDeckNext"),
    statusEl: document.getElementById("subjectDeckStatus"),
  };
}

function setCardInteractive(card, isActive) {
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

function syncDeckStageHeight() {
  if (!deckStage || deckCards.length === 0) return;

  if (!deckMaxCardHeight) {
    const measuredHeights = deckCards.map((card) =>
      Math.ceil(
        card.getBoundingClientRect().height ||
          card.offsetHeight ||
          card.scrollHeight ||
          0,
      ),
    );
    deckMaxCardHeight = Math.max(...measuredHeights, 0);
  }

  const stackPadding = deckCards.length > 1 ? 36 : 8;
  const targetHeight = deckMaxCardHeight + stackPadding;
  deckStage.style.height = `${targetHeight}px`;
}

function refreshDeckMeasurements() {
  deckMaxCardHeight = 0;
  syncDeckStageHeight();
}

function updateSubjectPicker() {
  const picker = document.getElementById("subjectPickerGrid");
  if (!picker) return;

  const buttons = Array.from(picker.querySelectorAll("[data-subject-pick-index]"));
  buttons.forEach((chip, index) => {
    const isActive = index === currentDeckIndex;
    chip.classList.toggle("active", isActive);
    chip.setAttribute("aria-current", isActive ? "true" : "false");
  });
}

function updateDeckControls() {
  const { prevBtn, nextBtn, statusEl } = getDeckControls();
  const total = deckCards.length;

  if (statusEl) {
    if (total === 0) {
      statusEl.textContent = "No subjects";
    } else {
      statusEl.textContent = `Subject ${currentDeckIndex + 1} of ${total}`;
    }
  }

  const disableNav = total <= 1;

  if (prevBtn) prevBtn.disabled = disableNav;
  if (nextBtn) nextBtn.disabled = disableNav;
  updateSubjectPicker();
}

function updateSubjectDeck() {
  const total = deckCards.length;

  if (total === 0) {
    updateDeckControls();
    return;
  }

  if (currentDeckIndex >= total) {
    currentDeckIndex = 0;
  }

  const nextIndex = (currentDeckIndex + 1) % total;
  const afterNextIndex = (currentDeckIndex + 2) % total;
  const prevIndex = (currentDeckIndex - 1 + total) % total;

  deckCards.forEach((card, idx) => {
    let deckState = "hidden";

    if (idx === currentDeckIndex) {
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
    setCardInteractive(card, deckState === "active");
  });

  updateDeckControls();
  syncDeckStageHeight();
}

function goToNextSubject() {
  const total = deckCards.length;
  if (total <= 1) return;

  currentDeckIndex = (currentDeckIndex + 1) % total;
  updateSubjectDeck();
}

function goToPreviousSubject() {
  const total = deckCards.length;
  if (total <= 1) return;

  currentDeckIndex = (currentDeckIndex - 1 + total) % total;
  updateSubjectDeck();
}

function goToSubject(index) {
  const total = deckCards.length;
  if (total === 0) return;

  const parsed = Number(index);
  if (!Number.isInteger(parsed)) return;

  const bounded = Math.max(0, Math.min(parsed, total - 1));
  if (bounded === currentDeckIndex) return;

  currentDeckIndex = bounded;
  updateSubjectDeck();
}

function handleDeckTouchStart(event) {
  const touch = event.changedTouches?.[0];
  if (!touch) return;

  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
}

function handleDeckTouchEnd(event) {
  const touch = event.changedTouches?.[0];
  if (!touch || touchStartX === null || touchStartY === null) return;

  const deltaX = touch.clientX - touchStartX;
  const deltaY = touch.clientY - touchStartY;
  const absDeltaX = Math.abs(deltaX);
  const absDeltaY = Math.abs(deltaY);

  touchStartX = null;
  touchStartY = null;

  if (absDeltaX < SWIPE_THRESHOLD_PX || absDeltaX <= absDeltaY) {
    return;
  }

  if (deltaX < 0) {
    goToNextSubject();
    return;
  }

  goToPreviousSubject();
}

function setupSubjectDeck() {
  deckStage = document.getElementById("subjectsDeckStage");

  if (!deckStage) {
    deckCards = [];
    currentDeckIndex = 0;
    deckMaxCardHeight = 0;
    return;
  }

  deckCards = Array.from(deckStage.querySelectorAll(".deck-card"));
  if (deckCards.length === 0) {
    currentDeckIndex = 0;
    deckMaxCardHeight = 0;
    updateDeckControls();
    return;
  }

  if (currentDeckIndex >= deckCards.length) {
    currentDeckIndex = 0;
  }

  deckStage.addEventListener("touchstart", handleDeckTouchStart, {
    passive: true,
  });
  deckStage.addEventListener("touchend", handleDeckTouchEnd, { passive: true });

  if (!resizeListenerAttached) {
    window.addEventListener("resize", refreshDeckMeasurements);
    resizeListenerAttached = true;
  }

  refreshDeckMeasurements();
  updateSubjectDeck();
}

async function loadSubjects() {
  const grid = document.getElementById("subjectsGrid");

  try {
    const data = await api.get("/api/attendance/dashboard");
    cachedSubjects = data.subjects || [];

    if (data.subjects.length === 0) {
      deckCards = [];
      deckStage = null;
      currentDeckIndex = 0;
      deckMaxCardHeight = 0;

      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📚</div>
          <h3>No subjects yet</h3>
          <p>Add your first subject to start tracking attendance.</p>
          <a href="add-subject.html" class="btn btn-primary">Add Subject</a>
        </div>
      `;
      return;
    }

    grid.innerHTML = `
      <section class="subjects-layout" id="subjectsLayout">
        <div class="subject-stack-pane">
          <section class="subject-deck" id="subjectDeck" aria-label="Subjects carousel">
            <div class="subject-deck-shell">
              <button
                id="subjectDeckPrev"
                class="subject-deck-side-btn"
                type="button"
                data-deck-prev
                aria-label="Show previous subject"
              >
                ◀
              </button>
              <div
                id="subjectsDeckStage"
                class="subject-deck-stage"
                tabindex="0"
                role="region"
                aria-roledescription="carousel"
                aria-label="Subject cards"
              >
                ${data.subjects.map(createSubjectCard).join("")}
              </div>
              <button
                id="subjectDeckNext"
                class="subject-deck-side-btn"
                type="button"
                data-deck-next
                aria-label="Show next subject"
              >
                ▶
              </button>
            </div>
            <div class="subject-deck-meta">
              <span id="subjectDeckStatus" class="subject-deck-status" aria-live="polite"></span>
              <span class="subject-deck-help">Use arrow keys or swipe</span>
            </div>
          </section>
        </div>
        <aside class="subject-picker-pane" aria-label="All subjects">
          <div class="subject-picker-grid" id="subjectPickerGrid">
            ${data.subjects.map(createSubjectPickerButton).join("")}
          </div>
        </aside>
      </section>
    `;

    setupSubjectDeck();
  } catch (error) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠</div>
        <h3>Failed to load subjects</h3>
        <p>${error.message}</p>
        <button class="btn btn-primary" id="retryLoadSubjects">Retry</button>
      </div>
    `;
    deckCards = [];
    deckStage = null;
    currentDeckIndex = 0;
    deckMaxCardHeight = 0;
  }
}

function openDeletePanel() {
  const existing = document.querySelector(".delete-panel");
  if (existing) {
    existing.remove();
    return;
  }

  if (cachedSubjects.length === 0) {
    showToast("No subjects to delete", "error");
    return;
  }

  const panel = document.createElement("div");
  panel.className = "delete-panel";
  panel.innerHTML = `
    <h3>Select a subject to delete</h3>
    <div class="delete-list">
      ${cachedSubjects.map((s) => `
        <div class="delete-item" id="del-${s.subjectId}">
          <span class="delete-item-name">${escapeHtml(s.subject)}</span>
          <button
            class="delete-item-btn"
            data-delete-subject-id="${s.subjectId}"
            data-delete-subject-name="${escapeAttr(s.subject)}"
          >
            Delete
          </button>
        </div>
      `).join("")}
    </div>
  `;

  const grid = document.getElementById("subjectsGrid");
  grid.parentNode.insertBefore(panel, grid);
}

function closeEditSubjectDialog() {
  document.getElementById("editSubjectOverlay")?.remove();
}

function openEditSubjectDialog(subjectId) {
  const subject = cachedSubjects.find(
    (s) => String(s.subjectId) === String(subjectId),
  );
  if (!subject) {
    showToast("Subject not found", "error");
    return;
  }

  closeEditSubjectDialog();

  const selectedDays = new Set(Array.isArray(subject.days) ? subject.days : []);
  const dayCheckboxes = EDITABLE_DAYS.map((day) => {
    const id = `edit-day-${subject.subjectId}-${day.toLowerCase().slice(0, 3)}`;
    const checked = selectedDays.has(day) ? "checked" : "";
    return `
      <div class="day-checkbox">
        <input type="checkbox" id="${id}" value="${day}" ${checked} />
        <label for="${id}">${day.slice(0, 3)}</label>
      </div>
    `;
  }).join("");

  const overlay = document.createElement("div");
  overlay.className = "dialog-overlay";
  overlay.id = "editSubjectOverlay";
  overlay.innerHTML = `
    <div class="dialog edit-subject-dialog">
      <h3>Edit Subject</h3>
      <p>Update the subject details and schedule.</p>

      <div class="form-group">
        <label for="editSubjectName">Subject Name</label>
        <input id="editSubjectName" type="text" value="${escapeAttr(subject.subject || "")}" />
      </div>

      <div class="form-group">
        <label for="editSubjectType">Type</label>
        <select id="editSubjectType">
          <option value="theory" ${subject.type === "theory" ? "selected" : ""}>Theory</option>
          <option value="lab" ${subject.type === "lab" ? "selected" : ""}>Lab</option>
        </select>
      </div>

      <div class="form-group">
        <label>Scheduled Days</label>
        <div class="days-grid">${dayCheckboxes}</div>
      </div>

      <div class="dialog-actions">
        <button class="btn btn-sm btn-ghost" data-dialog-cancel>Cancel</button>
        <button class="btn btn-sm btn-primary" data-dialog-save="${subject.subjectId}">Save</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeEditSubjectDialog();
    }
  });
}

async function saveSubjectEdit(subjectId, btn) {
  const nameInput = document.getElementById("editSubjectName");
  const typeInput = document.getElementById("editSubjectType");

  if (!nameInput || !typeInput) {
    showToast("Edit form not available", "error");
    return;
  }

  const name = nameInput.value.trim();
  const type = typeInput.value;
  const selectedDayNodes = document.querySelectorAll(
    '#editSubjectOverlay .day-checkbox input[type="checkbox"]:checked',
  );
  const days = Array.from(selectedDayNodes).map((node) => node.value);

  if (!name) {
    showToast("Subject name is required", "error");
    nameInput.focus();
    return;
  }

  btn.innerHTML = '<span class="loading-spinner"></span>';
  btn.classList.add("loading");

  try {
    await api.put("/api/subjects/" + subjectId, { name, type, days });
    showToast("Subject updated successfully ✓", "success");
    closeEditSubjectDialog();
    await loadSubjects();
  } catch (error) {
    showToast(error.message, "error");
    btn.textContent = "Save";
    btn.classList.remove("loading");
  }
}

async function markAttendance(subjectId, status) {
  try {
    await api.post("/api/attendance", { subjectId, status });

    const messages = {
      present: "Marked as present ✓",
      absent: "Marked as absent",
      no_class: "Marked as no class",
    };
    showToast(messages[status] || "Attendance marked", "success");

    await loadSubjects();
  } catch (error) {
    showToast(error.message, "error");
  }
}

function confirmDelete(subjectId, subjectName) {
  const overlay = document.createElement("div");
  overlay.className = "dialog-overlay";
  overlay.innerHTML = `
    <div class="dialog">
      <h3>Delete Subject?</h3>
      <p>Are you sure you want to delete <strong>${subjectName}</strong>? All attendance records will also be removed.</p>
      <div class="dialog-actions">
        <button class="btn btn-sm btn-ghost" data-dialog-cancel>Cancel</button>
        <button class="btn btn-sm btn-absent" data-dialog-delete="${subjectId}">Delete</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

async function deleteSubject(subjectId, btn) {
  btn.innerHTML = '<span class="loading-spinner"></span>';
  btn.classList.add("loading");

  try {
    await api.delete("/api/subjects/" + subjectId);
    document.querySelector(".dialog-overlay")?.remove();
    showToast("Subject deleted", "success");
    await loadSubjects();
  } catch (error) {
    showToast(error.message, "error");
    document.querySelector(".dialog-overlay")?.remove();
  }
}

loadSubjects();

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  if (target.closest("[data-deck-prev]")) {
    goToPreviousSubject();
    return;
  }

  if (target.closest("[data-deck-next]")) {
    goToNextSubject();
    return;
  }

  const deckJumpTarget = target.closest("[data-subject-pick-index]");
  if (deckJumpTarget) {
    const idx = deckJumpTarget.getAttribute("data-subject-pick-index");
    goToSubject(idx);
    return;
  }

  const openEditTarget = target.closest("[data-open-edit-subject-id]");
  if (openEditTarget) {
    const openEditId = openEditTarget.getAttribute("data-open-edit-subject-id");
    if (openEditId) {
      openEditSubjectDialog(openEditId);
      return;
    }
  }

  const deleteId = target.getAttribute("data-delete-subject-id");
  if (deleteId) {
    const name =
      target.getAttribute("data-delete-subject-name") || "this subject";
    confirmDelete(deleteId, name);
    return;
  }

  if (target.hasAttribute("data-dialog-cancel")) {
    const overlay = target.closest(".dialog-overlay");
    if (overlay) overlay.remove();
    return;
  }

  const saveId = target.getAttribute("data-dialog-save");
  if (saveId) {
    saveSubjectEdit(saveId, target);
    return;
  }

  const dialogDeleteId = target.getAttribute("data-dialog-delete");
  if (dialogDeleteId) {
    deleteSubject(dialogDeleteId, target);
    return;
  }

  if (target.id === "retryLoadSubjects") {
    loadSubjects();
  }
});

document.addEventListener("keydown", (event) => {
  if (deckCards.length <= 1) return;

  const target = event.target;
  if (target instanceof HTMLElement) {
    const tagName = target.tagName;
    const isEditable =
      target.isContentEditable ||
      tagName === "INPUT" ||
      tagName === "TEXTAREA" ||
      tagName === "SELECT";

    if (isEditable || target.closest(".dialog-overlay")) {
      return;
    }
  }

  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    event.preventDefault();
    goToNextSubject();
    return;
  }

  if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    event.preventDefault();
    goToPreviousSubject();
  }
});
