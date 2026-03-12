const fs = require('fs');
const dashPath = 'd:/Projects/safe75/safe75/client/js/dashboard.js';
const sidePath = 'd:/Projects/safe75/safe75/client/js/sidebar.js';

const lines = fs.readFileSync(dashPath, 'utf8').split('\n');
const start = lines.findIndex(l => l.startsWith('function escapeHtml(text)'));
const end = lines.findIndex(l => l.startsWith('function createProgressRing(percentage)'));

if(start >= 0 && end > start) {
  const toMove = lines.slice(start, end).join('\n');
  lines.splice(start, end - start);
  fs.writeFileSync(dashPath, lines.join('\n'), 'utf8');

  let sideContent = fs.readFileSync(sidePath, 'utf8');
  sideContent += '\n// --- UTILITIES FOR ESCAPING & REPORT GENERATION ---\n' + toMove;
  
  const resetLogic = `
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
    reportWindow.document.write(\`
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
    \`);
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
      reportWindow.document.write(\`
        <!doctype html>
        <html lang="en">
          <head><meta charset="UTF-8" /><title>Report Error</title></head>
          <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Could not generate report</h2>
            <p>\${escapeReportText(error.message || "Unknown error")}</p>
          </body>
        </html>
      \`);
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
  overlay.innerHTML = \`
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
  \`;

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
  overlay.innerHTML = \`
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
  \`;

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
`;
  
  sideContent += '\n' + resetLogic;
  fs.writeFileSync(sidePath, sideContent, 'utf8');
  console.log('Successfully completed code migration!');
} else {
  console.error('Failed to locate extraction points in dashboard.js.', start, end);
}
