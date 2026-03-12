function syncHamburgerState() {
  const sidebar = document.getElementById("sidebar");
  const hamburger = document.querySelector(".hamburger");

  if (!sidebar || !hamburger) return;

  const isOpen = sidebar.classList.contains("open");
  hamburger.textContent = isOpen ? "✕" : "☰";
  hamburger.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
}

// Sidebar toggle for mobile
function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");

  if (!sidebar || !overlay) return;

  sidebar.classList.toggle("open");
  overlay.classList.toggle("open");
  syncHamburgerState();
}

document.addEventListener("DOMContentLoaded", () => {
  syncHamburgerState();

  document.querySelectorAll(".hamburger").forEach((btn) => {
    btn.addEventListener("click", toggleSidebar);
  });

  const overlay = document.getElementById("sidebarOverlay");
  if (overlay) {
    overlay.addEventListener("click", toggleSidebar);
  }

  document.querySelectorAll(".sidebar-link[href='#']").forEach((link) => {
    if (link.id && link.id.startsWith("sidebarLogout")) {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        logout();
      });
    }
  });
});

// --- UTILITIES FOR ESCAPING & REPORT GENERATION ---
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


function closeSemesterResetDialog() {
  document.getElementById("semesterResetOverlay")?.remove();
}

function getReportSemesterInputValue() {
  const input = document.getElementById("reportSemesterInput");
  const raw = input ? input.value.trim() : "";
  const semester = Number(raw);

  if (!raw || !Number.isInteger(semester) || semester < 1 || semester > 8) {
    if(typeof showToast === 'function') showToast("Enter a valid semester number (1-8)", "error");
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
    if(typeof showToast === 'function') showToast("Enter a valid semester number (1-8)", "error");
    return;
  }

  if (actionBtn) {
    actionBtn.innerHTML = '<span class="loading-spinner"></span>';
    actionBtn.classList.add("loading");
    actionBtn.disabled = true;
  }

  try {
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
      }
      if (attempt < 40) {
        setTimeout(() => attemptAutoExport(attempt + 1), 250);
      }
    };
    setTimeout(() => { attemptAutoExport(0); }, 400);

    if (typeof showToast === 'function') {
      showToast(
        "Report opened. PDF export will start automatically (or click Export PDF in the tab).",
        "success",
      );
    }
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
    if(typeof showToast === 'function') showToast(error.message, "error");
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
    if(typeof showToast === 'function') showToast("TYPE RESET IN CAPS TO CONTINUE", "error");
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
    if(typeof showToast === 'function') showToast("Semester reset complete. Ready for your next semester ✓", "success");
    window.location.href = "dashboard.html";
  } catch (error) {
    if(typeof showToast === 'function') showToast(error.message, "error");
    if (actionBtn) {
      actionBtn.textContent = "Reset Now";
      actionBtn.classList.remove("loading");
      actionBtn.disabled = false;
    }
  }
}

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  if (target.closest("#sidebarStartNewSemesterBtn")) {
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
