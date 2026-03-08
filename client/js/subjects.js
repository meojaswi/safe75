if (!requireAuth()) {
  // Will redirect to login
}

const CIRCLE_RADIUS = 35;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

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

  const daysStr = item.days.length > 0
    ? item.days.map((d) => d.slice(0, 3)).join(", ")
    : "No schedule";

  const expectedStr = item.expectedTotal > 0
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
    </div>
  `;
}

async function loadSubjects() {
  const grid = document.getElementById("subjectsGrid");

  try {
    const data = await api.get("/api/attendance/dashboard");

    if (data.subjects.length === 0) {
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

    grid.innerHTML = data.subjects.map(createSubjectCard).join("");
  } catch (error) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠</div>
        <h3>Failed to load subjects</h3>
        <p>${error.message}</p>
        <button onclick="loadSubjects()" class="btn btn-primary">Retry</button>
      </div>
    `;
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
    await loadSubjects();
  } catch (error) {
    showToast(error.message, "error");
    document.querySelector(".dialog-overlay")?.remove();
  }
}

loadSubjects();
