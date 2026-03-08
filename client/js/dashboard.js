if (!requireAuth()) {
  // Will redirect to login
}

document.getElementById("userName").textContent = getUserName();

const CIRCLE_RADIUS = 35;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

function getProgressColor(percentage) {
  if (percentage >= 75) return "var(--accent)";
  if (percentage >= 65) return "var(--warning)";
  return "var(--danger)";
}

function getStatusClass(percentage) {
  if (percentage >= 75) return "good";
  if (percentage >= 65) return "warn";
  return "bad";
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

  return `
    <div class="subject-card" id="card-${item.subjectId}">
      <div class="subject-card-header">
        <div class="subject-info">
          <h3>${escapeHtml(item.subject)}</h3>
          <span class="subject-badge ${badgeClass}">${badgeText}</span>
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
        </div>
        <button class="btn btn-sm btn-danger-ghost" onclick="confirmDelete('${item.subjectId}', '${escapeHtml(item.subject)}')" title="Delete subject">
          🗑
        </button>
      </div>
    </div>
  `;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function renderStatsBar(data) {
  const statsBar = document.getElementById("statsBar");

  if (data.length === 0) {
    statsBar.innerHTML = "";
    return;
  }

  const totalSubjects = data.length;
  const totalClasses = data.reduce((sum, d) => sum + d.totalClasses, 0);
  const totalPresent = data.reduce((sum, d) => sum + d.presentClasses, 0);
  const overallPercentage =
    totalClasses === 0
      ? 0
      : parseFloat(((totalPresent / totalClasses) * 100).toFixed(1));
  const lowCount = data.filter((d) => d.isLow).length;
  const statusClass = getStatusClass(overallPercentage);

  statsBar.innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Subjects</div>
      <div class="stat-value">${totalSubjects}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Overall Attendance</div>
      <div class="stat-value ${statusClass}">${overallPercentage}%</div>
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

function renderDashboard(data) {
  const grid = document.getElementById("subjectsGrid");

  renderStatsBar(data);

  if (data.length === 0) {
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

  grid.innerHTML = data.map(createSubjectCard).join("");
}

async function loadDashboard() {
  try {
    const data = await api.get("/api/attendance/dashboard");
    renderDashboard(data);
  } catch (error) {
    const grid = document.getElementById("subjectsGrid");
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠</div>
        <h3>Failed to load dashboard</h3>
        <p>${error.message}</p>
        <button onclick="loadDashboard()" class="btn btn-primary">Retry</button>
      </div>
    `;
  }
}

async function markAttendance(subjectId, status) {
  try {
    await api.post("/api/attendance", { subjectId, status });

    const card = document.getElementById("card-" + subjectId);
    if (card) {
      card.style.opacity = "0.5";
      card.style.pointerEvents = "none";
    }

    showToast(
      status === "present" ? "Marked as present ✓" : "Marked as absent",
      "success",
    );

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

loadDashboard();
