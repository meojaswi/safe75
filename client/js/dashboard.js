if (!requireAuth()) {
  // Will redirect to login
}

// Set user name in sidebar
const userNameEl = document.getElementById("userName");
if (userNameEl) {
  userNameEl.textContent = getUserName();
}

const CIRCLE_RADIUS = 35;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

let isHolidayToday = false;
let dashboardData = null;

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getProgressColor(pct) {
  if (pct >= 75) return "var(--accent)";
  if (pct >= 65) return "var(--warning)";
  return "var(--danger)";
}

function getStatusClass(pct) {
  if (pct >= 75) return "good";
  if (pct >= 65) return "warn";
  return "bad";
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
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

/* ===== TODAY'S CLASSES ===== */
function renderTodaySection(subjects, todayDay) {
  const section = document.getElementById("todaySection");
  const todaySubjects = subjects.filter((s) => s.scheduledToday);

  if (isHolidayToday || todaySubjects.length === 0) {
    section.innerHTML = "";
    return;
  }

  const cards = todaySubjects
    .map((item) => {
      const s = item.todayStatus;
      let actionHtml;

      if (s) {
        const labels = {
          present: "✓ Present",
          absent: "✕ Absent",
          no_class: "⊘ No Class",
        };
        actionHtml = `
          <div class="today-marked">
            <span class="today-status ${s}">${labels[s]}</span>
            <button class="btn-edit" onclick="toggleEdit('${item.subjectId}')" title="Change status">✏️</button>
          </div>
          <div class="mark-btns edit-btns" id="edit-${item.subjectId}" style="display:none;">
            <button class="btn btn-sm btn-present" onclick="markAttendance('${item.subjectId}', 'present')">✓ Present</button>
            <button class="btn btn-sm btn-absent" onclick="markAttendance('${item.subjectId}', 'absent')">✕ Absent</button>
            <button class="btn btn-sm btn-noclass" onclick="markAttendance('${item.subjectId}', 'no_class')">⊘ No Class</button>
          </div>
        `;
      } else {
        actionHtml = `
          <div class="mark-btns">
            <button class="btn btn-sm btn-present" onclick="markAttendance('${item.subjectId}', 'present')">✓ Present</button>
            <button class="btn btn-sm btn-absent" onclick="markAttendance('${item.subjectId}', 'absent')">✕ Absent</button>
            <button class="btn btn-sm btn-noclass" onclick="markAttendance('${item.subjectId}', 'no_class')">⊘ No Class</button>
          </div>
        `;
      }

      return `
      <div class="today-card" id="today-${item.subjectId}">
        <div class="today-card-header">
          <h4>${escapeHtml(item.subject)}</h4>
          <span class="subject-badge ${item.type === "lab" ? "badge-lab" : "badge-theory"}">${item.type === "lab" ? "Lab" : "Theory"}</span>
        </div>
        ${actionHtml}
      </div>
    `;
    })
    .join("");

  section.innerHTML = `
    <div class="today-section">
      <div class="section-heading">
        📅 Today's Classes
        <span class="day-tag">${todayDay}</span>
      </div>
      <div class="today-grid">${cards}</div>
    </div>
    <hr class="section-divider" />
  `;
}

/* ===== SUBJECT CARDS ===== */
function createSubjectCard(item) {
  const badgeClass = item.type === "lab" ? "badge-lab" : "badge-theory";
  const badgeText = item.type === "lab" ? "Lab" : "Theory";

  let bunkHtml = "";
  if (item.totalClasses > 0) {
    if (item.isLow) {
      bunkHtml = `<div class="bunk-info danger">⚠ Attend next ${item.needToAttend} class${item.needToAttend !== 1 ? "es" : ""} to reach 75%</div>`;
    } else if (item.canBunk > 0) {
      bunkHtml = `<div class="bunk-info safe">✓ You can safely skip ${item.canBunk} class${item.canBunk !== 1 ? "es" : ""}</div>`;
    } else {
      bunkHtml = `<div class="bunk-info warning">⚡ Right at the edge — don't miss any!</div>`;
    }
  }

  const daysStr =
    item.days.length > 0
      ? item.days.map((d) => d.slice(0, 3)).join(", ")
      : "No schedule";

  const expectedStr =
    item.expectedTotal > 0
      ? `<span class="expected">of ${item.expectedTotal} expected</span>`
      : "";

  return `
    <div class="subject-card" id="card-${item.subjectId}">
      <div class="subject-card-header">
        <div class="subject-info">
          <h3>${escapeHtml(item.subject)}</h3>
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
        <div class="mark-btns">
          <button class="btn btn-sm btn-present" onclick="markAttendance('${item.subjectId}', 'present')">
            ✓ Present
          </button>
          <button class="btn btn-sm btn-absent" onclick="markAttendance('${item.subjectId}', 'absent')">
            ✕ Absent
          </button>
          <button class="btn btn-sm btn-noclass" onclick="markAttendance('${item.subjectId}', 'no_class')">
            ⊘ No Class
          </button>
        </div>
        <button class="btn btn-sm btn-danger-ghost" onclick="confirmDelete('${item.subjectId}', '${escapeHtml(item.subject)}')" title="Delete subject">
          🗑
        </button>
      </div>
    </div>
  `;
}

/* ===== BANNERS ===== */
function renderSetupBanner(data) {
  const banner = document.getElementById("setupBanner");
  if (!data.semesterStart || !data.semesterEnd) {
    banner.innerHTML = `
      <div class="setup-banner">
        <span class="setup-icon">📅</span>
        <span>Set your <a href="settings.html">semester dates</a> to see expected class counts and better bunk predictions.</span>
      </div>
    `;
  } else {
    banner.innerHTML = "";
  }
}

function renderHolidayBanner() {
  const banner = document.getElementById("holidayBanner");
  if (isHolidayToday) {
    banner.innerHTML = `
      <div class="holiday-banner">
        <span class="holiday-emoji">🏖</span>
        <div>
          <strong>Today is a holiday!</strong>
          <span>Attendance marking is disabled for today's classes.</span>
        </div>
      </div>
    `;
  } else {
    banner.innerHTML = "";
  }
}

/* ===== STATS BAR ===== */
function renderStatsBar(data) {
  const statsBar = document.getElementById("statsBar");
  const subjects = data.subjects;

  if (subjects.length === 0) {
    statsBar.innerHTML = "";
    return;
  }

  const totalSubjects = subjects.length;
  const totalClasses = subjects.reduce((sum, d) => sum + d.totalClasses, 0);
  const totalPresent = subjects.reduce((sum, d) => sum + d.presentClasses, 0);
  const overallPct =
    totalClasses === 0
      ? 0
      : parseFloat(((totalPresent / totalClasses) * 100).toFixed(1));
  const lowCount = subjects.filter((d) => d.isLow).length;
  const statusClass = getStatusClass(overallPct);

  statsBar.innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Subjects</div>
      <div class="stat-value">${totalSubjects}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Overall Attendance</div>
      <div class="stat-value ${statusClass}">${overallPct}%</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Total Classes</div>
      <div class="stat-value">${totalClasses}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Low Attendance</div>
      <div class="stat-value ${lowCount > 0 ? "bad" : "good"}">${lowCount > 0 ? lowCount + " subject" + (lowCount > 1 ? "s" : "") : "None ✓"}</div>
    </div>
  `;
}

/* ===== SEMESTER HEATMAP ===== */
function renderHeatmap(data) {
  const container = document.getElementById("semesterHeatmap");

  if (!data.semesterStart || !data.semesterEnd) {
    container.innerHTML = "";
    return;
  }

  const start = new Date(data.semesterStart + "T00:00:00");
  const end = new Date(data.semesterEnd + "T00:00:00");
  const today = new Date(data.today + "T00:00:00");
  const holidaySet = new Set(data.holidays || []);
  const heatmap = data.heatmap || {};

  let cells = "";
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const dayNum = d.getDate();

    let cls = "hm-cell";
    let title = dateStr;

    if (holidaySet.has(dateStr)) {
      cls += " hm-holiday";
      title += " (Holiday)";
    } else if (heatmap[dateStr] === "present") {
      cls += " hm-present";
      title += " (Present)";
    } else if (heatmap[dateStr] === "absent") {
      cls += " hm-absent";
      title += " (Absent)";
    } else if (d < today) {
      cls += " hm-past";
    } else if (d.getTime() === today.getTime()) {
      cls += " hm-today";
      title += " (Today)";
    } else {
      cls += " hm-future";
    }

    cells += `<div class="${cls}" title="${title}">${dayNum}</div>`;
  }

  container.innerHTML = `
    <div class="heatmap-card">
      <div class="heatmap-header">
        <span class="heatmap-title">Days Left in Semester: <strong>${data.daysLeft}/${data.totalDays}</strong></span>
        <div class="heatmap-legend">
          <span class="hm-legend"><span class="hm-dot hm-present"></span>Present</span>
          <span class="hm-legend"><span class="hm-dot hm-absent"></span>Absent</span>
          <span class="hm-legend"><span class="hm-dot hm-holiday"></span>Holiday</span>
          <span class="hm-legend"><span class="hm-dot hm-today"></span>Today</span>
        </div>
      </div>
      <div class="heatmap-grid">${cells}</div>
    </div>
  `;
}

/* ===== MAIN RENDER ===== */
function renderDashboard(data) {
  renderSetupBanner(data);
  renderHolidayBanner();
  renderHeatmap(data);
  renderStatsBar(data);
  renderTodaySection(data.subjects, data.todayDay);
  cachedSubjects = data.subjects;
}

/* ===== LOAD ===== */
async function loadDashboard() {
  try {
    const [holidays, data] = await Promise.all([
      api.get("/api/holidays"),
      api.get("/api/attendance/dashboard"),
    ]);

    const todayStr = getTodayStr();
    isHolidayToday = holidays.includes(todayStr);
    dashboardData = data;

    renderDashboard(data);
  } catch (error) {
    const todaySection = document.getElementById("todaySection");
    todaySection.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠</div>
        <h3>Failed to load dashboard</h3>
        <p>${error.message}</p>
        <button onclick="loadDashboard()" class="btn btn-primary">Retry</button>
      </div>
    `;
  }
}

/* ===== TOGGLE EDIT ===== */
function toggleEdit(subjectId) {
  const el = document.getElementById("edit-" + subjectId);
  if (el) {
    el.style.display = el.style.display === "none" ? "flex" : "none";
  }
}

/* ===== ACTIONS ===== */
async function markAttendance(subjectId, status) {
  try {
    await api.post("/api/attendance", { subjectId, status });

    const card = document.getElementById("card-" + subjectId);
    if (card) {
      card.style.opacity = "0.5";
      card.style.pointerEvents = "none";
    }
    const todayCard = document.getElementById("today-" + subjectId);
    if (todayCard) {
      todayCard.style.opacity = "0.5";
      todayCard.style.pointerEvents = "none";
    }

    const messages = {
      present: "Marked as present ✓",
      absent: "Marked as absent",
      no_class: "Marked as no class — won't affect your %",
    };
    showToast(messages[status] || "Attendance marked", "success");

    await loadDashboard();
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
      <p>Are you sure you want to delete <strong>${subjectName}</strong>? All attendance records for this subject will also be removed.</p>
      <div class="dialog-actions">
        <button class="btn btn-sm btn-ghost" onclick="this.closest('.dialog-overlay').remove()">Cancel</button>
        <button class="btn btn-sm btn-absent" onclick="deleteSubject('${subjectId}', this)">Delete</button>
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

    await loadDashboard();
  } catch (error) {
    showToast(error.message, "error");
    document.querySelector(".dialog-overlay")?.remove();
  }
}

/* ===== DELETE PANEL ===== */
let cachedSubjects = [];

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
      ${cachedSubjects
        .map(
          (s) => `
        <div class="delete-item" id="del-${s.subjectId}">
          <span class="delete-item-name">${s.subject}</span>
          <button class="delete-item-btn" onclick="confirmDelete('${s.subjectId}', '${s.subject.replace(/'/g, "\\'")}')">Delete</button>
        </div>
      `,
        )
        .join("")}
    </div>
  `;

  const setupBanner = document.getElementById("setupBanner");
  setupBanner.parentNode.insertBefore(panel, setupBanner);
}

loadDashboard();
