if (!requireAuth()) {
  // Will redirect to login
}

// Set user name in sidebar
const userNameEl = document.getElementById("userName");
const userName = getUserName();
if (userNameEl) {
  userNameEl.textContent = userName;
}

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function setDashboardGreeting() {
  const greetingEl = document.getElementById("dashboardGreeting");
  if (!greetingEl) return;

  const firstName = (userName || "").trim().split(/\s+/)[0] || "";
  greetingEl.textContent = firstName
    ? `${getTimeGreeting()}, ${firstName}`
    : getTimeGreeting();
}

setDashboardGreeting();

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

function escapeAttr(text) {
  return escapeHtml(text).replace(/"/g, "&quot;");
}

function escapeReportText(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return "-";
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return dateStr;
  }
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function buildSemesterReportHtml(exportData) {
  const semester = exportData?.semester || {};
  const semesterStart = semester.semesterStart || null;
  const semesterEnd = semester.semesterEnd || null;
  const user = exportData?.user || {};
  const subjects = Array.isArray(exportData?.subjects) ? exportData.subjects : [];
  const attendance = Array.isArray(exportData?.attendance)
    ? exportData.attendance
    : [];
  const holidays = Array.isArray(exportData?.holidays) ? exportData.holidays : [];

  const bySubjectId = new Map();
  for (const subject of subjects) {
    const subjectId = String(subject.subjectId || "");
    bySubjectId.set(subjectId, {
      subjectId,
      name: subject.name || "Untitled Subject",
      type: subject.type || "theory",
      days: Array.isArray(subject.days) ? subject.days : [],
      present: 0,
      absent: 0,
      noClass: 0,
    });
  }

  for (const record of attendance) {
    const subjectId = String(record.subjectId || "");
    if (!bySubjectId.has(subjectId)) {
      bySubjectId.set(subjectId, {
        subjectId,
        name: record.subjectName || "Unknown Subject",
        type: "theory",
        days: [],
        present: 0,
        absent: 0,
        noClass: 0,
      });
    }

    const stat = bySubjectId.get(subjectId);
    if (record.status === "present") {
      stat.present += 1;
    } else if (record.status === "absent") {
      stat.absent += 1;
    } else if (record.status === "no_class") {
      stat.noClass += 1;
    }
  }

  const subjectRows = Array.from(bySubjectId.values())
    .map((item) => {
      const totalClasses = item.present + item.absent;
      const percentage =
        totalClasses > 0
          ? Number(((item.present / totalClasses) * 100).toFixed(1))
          : 0;

      return {
        ...item,
        totalClasses,
        percentage,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const totalPresent = subjectRows.reduce((sum, item) => sum + item.present, 0);
  const totalAbsent = subjectRows.reduce((sum, item) => sum + item.absent, 0);
  const totalNoClass = subjectRows.reduce((sum, item) => sum + item.noClass, 0);
  const totalClasses = totalPresent + totalAbsent;
  const overallPct =
    totalClasses > 0 ? Number(((totalPresent / totalClasses) * 100).toFixed(1)) : 0;
  const overallAbsentPct =
    totalClasses > 0 ? Number((100 - overallPct).toFixed(1)) : 0;
  const parsedReportSemester = Number(exportData?.reportSemester);
  const hasReportSemester =
    Number.isInteger(parsedReportSemester) &&
    parsedReportSemester >= 1 &&
    parsedReportSemester <= 8;
  const reportSemesterLabel = hasReportSemester
    ? `Semester ${parsedReportSemester}`
    : "Semester not specified";

  const subjectChartData = subjectRows.map((item) => ({
    label: `${item.name} (${item.type === "lab" ? "Lab" : "Theory"})`,
    percentage: item.percentage,
  }));

  const subjectChartHeight = Math.max(420, subjectChartData.length * 42);
  const filenameSeed = (semesterStart || "semester-report").replace(/[^a-zA-Z0-9_-]/g, "-");
  const reportPayloadJson = JSON.stringify({
    overall: {
      label: "Overall Attendance",
      percentage: overallPct,
    },
    subjects: subjectChartData,
    filename: `safe75-${hasReportSemester ? `sem-${parsedReportSemester}` : "sem-na"}-${filenameSeed}.pdf`,
  })
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/<\/script/gi, "<\\/script");

  const generatedAt = new Date(exportData?.exportedAt || Date.now()).toLocaleString(
    "en-IN",
  );

  const semesterWindow =
    semesterStart && semesterEnd
      ? `${formatDisplayDate(semesterStart)} to ${formatDisplayDate(semesterEnd)}`
      : "Semester dates not set";
  const appOrigin = window.location.origin;

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Safe75 Semester Report</title>
    <style>
      :root {
        --ink: #0f172a;
        --subtle: #475569;
        --muted: #64748b;
        --line: #e2e8f0;
        --accent: #22c55e;
        --card: #f8fafc;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 22px;
        font-family: Arial, sans-serif;
        color: var(--ink);
        background: #ffffff;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        force-color-adjust: exact;
      }
      .report-wrap {
        max-width: 900px;
        margin: 0 auto;
      }
      .report-head {
        border-bottom: 2px solid var(--line);
        padding-bottom: 14px;
        margin-bottom: 16px;
      }
      .brand {
        font-size: 24px;
        font-weight: 800;
        letter-spacing: -0.3px;
      }
      .brand-safe { color: #111827; }
      .brand-75 { color: var(--accent); }
      .title {
        margin: 8px 0 4px;
        font-size: 22px;
        font-weight: 700;
      }
      .meta {
        color: var(--subtle);
        font-size: 13px;
        line-height: 1.5;
      }
      .info-grid {
        margin-top: 14px;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }
      .info-card {
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 10px 12px;
        background: #fff;
      }
      .info-label {
        color: var(--muted);
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .info-value {
        margin-top: 3px;
        font-size: 14px;
        font-weight: 600;
      }
      .stats-grid {
        margin-top: 16px;
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
      }
      .stat-card {
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 10px 12px;
        background: var(--card);
      }
      .stat-label {
        color: var(--muted);
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.4px;
      }
      .stat-value {
        margin-top: 4px;
        font-size: 20px;
        font-weight: 700;
      }
      .section {
        margin-top: 18px;
      }
      .section h3 {
        margin: 0 0 10px;
        font-size: 16px;
      }
      .overall-bar-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        align-items: start;
      }
      .overall-bar-canvas-wrap {
        position: relative;
        width: 100%;
      }
      #overallAttendanceBarChart {
        width: 100% !important;
        height: 100% !important;
      }
      .pie-legend {
        display: grid;
        gap: 6px;
        font-size: 13px;
        color: var(--subtle);
      }
      .legend-percent-present {
        color: #16a34a;
        font-weight: 700;
      }
      .legend-percent-absent {
        color: #dc2626;
        font-weight: 700;
      }
      .pie-legend-vertical {
        font-size: 12px;
      }
      .dot {
        display: inline-block;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        margin-right: 6px;
        vertical-align: middle;
      }
      .dot-present { background: #22c55e; }
      .dot-absent { background: #ef4444; }
      .dot-neutral { background: #94a3b8; }
      .subject-bar-card {
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 16px 14px;
        background: #fff;
      }
      .subject-bar-canvas-wrap {
        position: relative;
        width: 100%;
      }
      #subjectAttendanceBarChart {
        width: 100% !important;
        height: 100% !important;
      }
      .subject-bar-empty {
        margin: 0;
        padding: 26px 12px;
        text-align: center;
        color: var(--muted);
        font-size: 13px;
      }
      .report-toolbar {
        margin-top: 12px;
        display: flex;
        justify-content: flex-end;
      }
      .report-pdf-btn {
        border: 1px solid #0f172a;
        background: #0f172a;
        color: #fff;
        border-radius: 8px;
        padding: 8px 14px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
      }
      .report-pdf-btn[disabled] {
        opacity: 0.65;
        cursor: wait;
      }
      .report-pdf-btn:hover:not([disabled]) {
        background: #111827;
      }
      .holiday-list {
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 10px 12px;
        font-size: 13px;
      }
      .holiday-list ul {
        margin: 8px 0 0;
        padding-left: 18px;
        columns: 2;
      }
      .print-note {
        margin-top: 16px;
        color: var(--muted);
        font-size: 12px;
      }
      .pdf-exporting .report-toolbar,
      .pdf-exporting .print-note {
        display: none !important;
      }
      .empty-text {
        margin: 0;
        color: var(--muted);
        font-size: 13px;
      }
      @page {
        size: A4;
        margin: 12mm;
      }
      @media (max-width: 860px) {
        .stats-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .overall-bar-row {
          grid-template-columns: 1fr;
        }
      }
      @media print {
        .dot {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .report-toolbar {
          display: none;
        }
        .print-note {
          display: none;
        }
      }
    </style>
  </head>
  <body>
    <div class="report-wrap" id="reportRoot">
      <header class="report-head">
        <div class="brand"><span class="brand-safe">Safe</span><span class="brand-75">75</span></div>
        <h1 class="title">Semester Attendance Report</h1>
        <p class="meta">
          Report For: ${escapeReportText(reportSemesterLabel)}<br />
          Generated: ${escapeReportText(generatedAt)}<br />
          Student: ${escapeReportText(user.name || "Student")} (${escapeReportText(user.email || "-")})
        </p>

        <div class="info-grid">
          <div class="info-card">
            <div class="info-label">Semester Window</div>
            <div class="info-value">${escapeReportText(semesterWindow)}</div>
          </div>
          <div class="info-card">
            <div class="info-label">Report Semester</div>
            <div class="info-value">${escapeReportText(reportSemesterLabel)}</div>
          </div>
        </div>
      </header>

      <section class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Subjects</div>
          <div class="stat-value">${subjectRows.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Overall Attendance</div>
          <div class="stat-value">${overallPct}%</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Classes</div>
          <div class="stat-value">${totalClasses}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Holidays</div>
          <div class="stat-value">${holidays.length}</div>
        </div>
      </section>

      <div class="report-toolbar">
        <button id="exportPdfBtn" class="report-pdf-btn" type="button">Export PDF</button>
      </div>

      <section class="section">
        <h3>Overall Attendance Bar Chart</h3>
        <div class="subject-bar-card">
          <div class="overall-bar-row">
            <div class="overall-bar-canvas-wrap" style="height:120px;">
              <canvas id="overallAttendanceBarChart"></canvas>
            </div>
            <div class="pie-legend">
              <div>
                <span class="dot dot-present"></span>
                Present: <span class="legend-percent-present">${overallPct}%</span> (${totalPresent} classes)
              </div>
              <div>
                <span class="dot dot-absent"></span>
                Absent: <span class="legend-percent-absent">${overallAbsentPct}%</span> (${totalAbsent} classes)
              </div>
              <div><span class="dot dot-neutral"></span>No Class Entries: ${totalNoClass}</div>
              <div><strong>Counted for Attendance:</strong> ${totalClasses}</div>
            </div>
          </div>
        </div>
      </section>

      <section class="section">
        <h3>Subject-wise Attendance Bar Chart</h3>
        <div class="subject-bar-card">
          ${
            subjectChartData.length === 0
              ? '<p class="subject-bar-empty">No attendance has been marked yet.</p>'
              : `<div class="subject-bar-canvas-wrap" style="height:${subjectChartHeight}px;">
                  <canvas id="subjectAttendanceBarChart"></canvas>
                </div>`
          }
        </div>
      </section>

      <section class="section">
        <h3>Semester Totals</h3>
        <div class="holiday-list">
          <strong>Present:</strong> ${totalPresent} |
          <strong>Absent:</strong> ${totalAbsent} |
          <strong>No Class:</strong> ${totalNoClass}
        </div>
      </section>

      <section class="section">
        <h3>Holiday Dates</h3>
        <div class="holiday-list">
          ${
            holidays.length === 0
              ? `<span class="empty-text">No holidays marked.</span>`
              : `
                <ul>
                  ${holidays
                    .map((dateStr) => `<li>${escapeReportText(formatDisplayDate(dateStr))}</li>`)
                    .join("")}
                </ul>
              `
          }
        </div>
      </section>

      <p class="print-note">If download does not start automatically, click the Export PDF button.</p>
    </div>
    <script id="reportPayload" type="application/json">${reportPayloadJson}</script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js"></script>
    <script src="${appOrigin}/js/reportExport.js"></script>
  </body>
</html>
  `;
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
            <button class="btn-edit" data-edit-subject-id="${item.subjectId}" title="Change status">✏️</button>
          </div>
          <div class="mark-btns edit-btns" id="edit-${item.subjectId}" style="display:none;">
            <button class="btn btn-sm btn-present" data-mark-subject-id="${item.subjectId}" data-mark-status="present">✓ Present</button>
            <button class="btn btn-sm btn-absent" data-mark-subject-id="${item.subjectId}" data-mark-status="absent">✕ Absent</button>
            <button class="btn btn-sm btn-noclass" data-mark-subject-id="${item.subjectId}" data-mark-status="no_class">⊘ No Class</button>
          </div>
        `;
      } else {
        actionHtml = `
          <div class="mark-btns">
            <button class="btn btn-sm btn-present" data-mark-subject-id="${item.subjectId}" data-mark-status="present">✓ Present</button>
            <button class="btn btn-sm btn-absent" data-mark-subject-id="${item.subjectId}" data-mark-status="absent">✕ Absent</button>
            <button class="btn btn-sm btn-noclass" data-mark-subject-id="${item.subjectId}" data-mark-status="no_class">⊘ No Class</button>
          </div>
        `;
      }

      return `
      <div class="today-card" id="today-${item.subjectId}">
        <div class="today-card-header">
          <h4>${escapeHtml(item.subject)}</h4>
          <div class="today-card-tools">
            <span class="subject-badge ${item.type === "lab" ? "badge-lab" : "badge-theory"}">${item.type === "lab" ? "Lab" : "Theory"}</span>
            <button class="btn btn-sm btn-ghost btn-edit-subject" data-open-edit-subject-id="${item.subjectId}">Edit</button>
          </div>
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

  const bunkHtml = buildAttendanceMessage(item);

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
          <button class="btn btn-sm btn-present" data-mark-subject-id="${item.subjectId}" data-mark-status="present">
            ✓ Present
          </button>
          <button class="btn btn-sm btn-absent" data-mark-subject-id="${item.subjectId}" data-mark-status="absent">
            ✕ Absent
          </button>
          <button class="btn btn-sm btn-noclass" data-mark-subject-id="${item.subjectId}" data-mark-status="no_class">
            ⊘ No Class
          </button>
        </div>
        <button class="btn btn-sm btn-danger-ghost" data-delete-subject-id="${item.subjectId}" data-delete-subject-name="${escapeHtml(item.subject)}" title="Delete subject">
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
        <button class="btn btn-primary" data-retry-dashboard>Retry</button>
      </div>
    `;
  }
}

function closeSemesterResetDialog() {
  document.getElementById("semesterResetOverlay")?.remove();
}

function getReportSemesterInputValue() {
  const input = document.getElementById("reportSemesterInput");
  const raw = input ? input.value.trim() : "";
  const semester = Number(raw);

  if (!raw || !Number.isInteger(semester) || semester < 1 || semester > 8) {
    showToast("Enter a valid semester number (1-8)", "error");
    input?.focus();
    return null;
  }

  return semester;
}

async function exportSemesterReportPdf(btn, reportSemester) {
  const actionBtn = btn instanceof HTMLElement ? btn : null;
  const originalLabel = actionBtn ? actionBtn.innerHTML : "";
  let reportWindow = null;

  if (
    !Number.isInteger(reportSemester) ||
    reportSemester < 1 ||
    reportSemester > 8
  ) {
    showToast("Enter a valid semester number (1-8)", "error");
    return;
  }

  if (actionBtn) {
    actionBtn.innerHTML = '<span class="loading-spinner"></span>';
    actionBtn.classList.add("loading");
    actionBtn.disabled = true;
  }

  try {
    // Open popup immediately from user click to avoid popup blockers.
    reportWindow = window.open("", "_blank");
    if (!reportWindow) {
      throw new Error("Popup blocked. Allow popups to generate the PDF report.");
    }

    reportWindow.document.open();
    reportWindow.document.write(`
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <title>Preparing Report...</title>
          <style>
            body {
              margin: 0;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              font-family: Arial, sans-serif;
              color: #0f172a;
              background: #f8fafc;
            }
          </style>
        </head>
        <body>Preparing your semester report...</body>
      </html>
    `);
    reportWindow.document.close();

    const data = await api.get("/api/settings/semester/export");
    const reportData = {
      ...data,
      reportSemester,
    };

    reportWindow.document.open();
    reportWindow.document.write(buildSemesterReportHtml(reportData));
    reportWindow.document.close();

    const attemptAutoExport = (attempt = 0) => {
      try {
        if (reportWindow.closed) return;
        if (typeof reportWindow.generateReportPdf === "function") {
          reportWindow.generateReportPdf(true);
          return;
        }
      } catch (_) {
        // Ignore cross-window readiness errors while scripts are loading.
      }

      if (attempt < 40) {
        setTimeout(() => attemptAutoExport(attempt + 1), 250);
      }
    };

    setTimeout(() => {
      attemptAutoExport(0);
    }, 400);

    showToast(
      "Report opened. PDF export will start automatically (or click Export PDF in the tab).",
      "success",
    );
  } catch (error) {
    if (reportWindow && !reportWindow.closed) {
      reportWindow.document.open();
      reportWindow.document.write(`
        <!doctype html>
        <html lang="en">
          <head><meta charset="UTF-8" /><title>Report Error</title></head>
          <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Could not generate report</h2>
            <p>${escapeReportText(error.message || "Unknown error")}</p>
          </body>
        </html>
      `);
      reportWindow.document.close();
    }

    showToast(error.message, "error");
  } finally {
    if (actionBtn) {
      actionBtn.innerHTML = originalLabel;
      actionBtn.classList.remove("loading");
      actionBtn.disabled = false;
    }
  }
}

function openSemesterExportDialog() {
  closeSemesterResetDialog();

  const overlay = document.createElement("div");
  overlay.className = "dialog-overlay";
  overlay.id = "semesterResetOverlay";
  overlay.innerHTML = `
    <div class="dialog">
      <h3>Start New Semester</h3>
      <p>Before clearing your current semester data, export it so you keep a personal backup.</p>

      <div class="reset-export-form">
        <label for="reportSemesterInput">Semester Number</label>
        <input
          id="reportSemesterInput"
          type="number"
          min="1"
          max="8"
          step="1"
          inputmode="numeric"
          placeholder="Enter semester (1-8)"
        />
      </div>

      <div class="reset-export-actions">
        <button class="btn btn-sm btn-primary" data-semester-report>
          Download Semester Report (PDF)
        </button>
      </div>
      <p class="reset-export-note">A printable report opens in a new tab with your selected semester label.</p>

      <div class="dialog-actions">
        <button class="btn btn-sm btn-ghost" data-semester-close>Cancel</button>
        <button class="btn btn-sm btn-absent" data-semester-next>Continue to Reset</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeSemesterResetDialog();
    }
  });
}

function updateResetConfirmButtonState() {
  const input = document.getElementById("resetConfirmInput");
  const btn = document.querySelector("[data-confirm-semester-reset]");
  if (!input || !(btn instanceof HTMLButtonElement)) return;
  btn.disabled = input.value.trim() !== "RESET";
}

function openSemesterResetConfirmDialog() {
  closeSemesterResetDialog();

  const overlay = document.createElement("div");
  overlay.className = "dialog-overlay";
  overlay.id = "semesterResetOverlay";
  overlay.innerHTML = `
    <div class="dialog">
      <h3>Confirm Semester Reset</h3>
      <p>This permanently deletes current subjects, attendance, holidays and semester dates from your account.</p>

      <div class="reset-confirm-wrap">
        <label for="resetConfirmInput">TYPE RESET IN CAPS TO CONTINUE</label>
        <input id="resetConfirmInput" type="text" autocomplete="off" placeholder="RESET" />
        <div class="reset-warning">This action cannot be undone.</div>
      </div>

      <div class="dialog-actions">
        <button class="btn btn-sm btn-ghost" data-semester-close>Cancel</button>
        <button class="btn btn-sm btn-absent" data-confirm-semester-reset disabled>Reset Now</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeSemesterResetDialog();
    }
  });

  const input = document.getElementById("resetConfirmInput");
  if (input) {
    input.focus();
    input.addEventListener("input", updateResetConfirmButtonState);
  }
}

async function resetSemesterData(btn) {
  const actionBtn = btn instanceof HTMLElement ? btn : null;
  const confirmInput = document.getElementById("resetConfirmInput");
  const confirmation = confirmInput ? confirmInput.value.trim() : "";

  if (confirmation !== "RESET") {
    showToast("TYPE RESET IN CAPS TO CONTINUE", "error");
    confirmInput?.focus();
    return;
  }

  if (actionBtn) {
    actionBtn.innerHTML = '<span class="loading-spinner"></span>';
    actionBtn.classList.add("loading");
    actionBtn.disabled = true;
  }

  try {
    await api.post("/api/settings/semester/reset", { confirmation });
    closeSemesterResetDialog();
    showToast("Semester reset complete. Ready for your next semester ✓", "success");
    await loadDashboard();
  } catch (error) {
    showToast(error.message, "error");
    if (actionBtn) {
      actionBtn.textContent = "Reset Now";
      actionBtn.classList.remove("loading");
      actionBtn.disabled = false;
    }
  }
}

/* ===== TOGGLE EDIT ===== */
function toggleEdit(subjectId) {
  const el = document.getElementById("edit-" + subjectId);
  if (el) {
    el.style.display = el.style.display === "none" ? "flex" : "none";
  }
}

function closeEditSubjectDialog() {
  document.getElementById("editSubjectOverlay")?.remove();
}

function openEditSubjectDialog(subjectId) {
  const subject = cachedSubjects.find((s) => String(s.subjectId) === String(subjectId));
  if (!subject) {
    showToast("Subject not found", "error");
    return;
  }

  closeEditSubjectDialog();

  const overlay = document.createElement("div");
  overlay.className = "dialog-overlay";
  overlay.id = "editSubjectOverlay";
  overlay.innerHTML = `
    <div class="dialog edit-subject-dialog">
      <h3>Edit Subject</h3>
      <p>Update the subject name and type.</p>

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

      <div class="dialog-actions">
        <button class="btn btn-sm btn-ghost" data-dialog-cancel>Cancel</button>
        <button class="btn btn-sm btn-primary" data-dialog-save="${subject.subjectId}">Save</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
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

  if (!name) {
    showToast("Subject name is required", "error");
    nameInput.focus();
    return;
  }

  btn.innerHTML = '<span class="loading-spinner"></span>';
  btn.classList.add("loading");

  try {
    await api.put("/api/subjects/" + subjectId, { name, type });

    showToast("Subject updated successfully ✓", "success");
    closeEditSubjectDialog();
    await loadDashboard();
  } catch (error) {
    showToast(error.message, "error");
    btn.textContent = "Save";
    btn.classList.remove("loading");
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
          <button class="delete-item-btn" data-delete-subject-id="${s.subjectId}" data-delete-subject-name="${s.subject.replace(/'/g, "\\'")}">Delete</button>
        </div>
      `,
        )
        .join("")}
    </div>
  `;

  const setupBanner = document.getElementById("setupBanner");
  setupBanner.parentNode.insertBefore(panel, setupBanner);
}

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  if (target.closest("#startNewSemesterBtn")) {
    openSemesterExportDialog();
    return;
  }

  const reportBtn = target.closest("[data-semester-report]");
  if (reportBtn) {
    const selectedSemester = getReportSemesterInputValue();
    if (!selectedSemester) {
      return;
    }
    exportSemesterReportPdf(reportBtn, selectedSemester);
    return;
  }

  if (target.closest("[data-semester-next]")) {
    openSemesterResetConfirmDialog();
    return;
  }

  if (target.closest("[data-semester-close]")) {
    closeSemesterResetDialog();
    return;
  }

  const confirmResetBtn = target.closest("[data-confirm-semester-reset]");
  if (confirmResetBtn) {
    resetSemesterData(confirmResetBtn);
    return;
  }

  const markSubjectId = target.getAttribute("data-mark-subject-id");
  const markStatus = target.getAttribute("data-mark-status");
  if (markSubjectId && markStatus) {
    markAttendance(markSubjectId, markStatus);
    return;
  }

  const editSubjectId = target.getAttribute("data-edit-subject-id");
  if (editSubjectId) {
    toggleEdit(editSubjectId);
    return;
  }

  const openEditId = target.getAttribute("data-open-edit-subject-id");
  if (openEditId) {
    openEditSubjectDialog(openEditId);
    return;
  }

  const deleteId = target.getAttribute("data-delete-subject-id");
  if (deleteId) {
    const name = target.getAttribute("data-delete-subject-name") || "this subject";
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

  if (target.hasAttribute("data-retry-dashboard")) {
    loadDashboard();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.getElementById("semesterResetOverlay")) {
    closeSemesterResetDialog();
    return;
  }

  if (event.key !== "Enter") return;
  if (!(event.target instanceof HTMLElement)) return;
  if (event.target.id !== "resetConfirmInput") return;

  const confirmBtn = document.querySelector("[data-confirm-semester-reset]");
  if (!(confirmBtn instanceof HTMLElement) || confirmBtn.hasAttribute("disabled")) {
    return;
  }

  event.preventDefault();
  resetSemesterData(confirmBtn);
});

loadDashboard();
