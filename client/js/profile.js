if (!requireAuth()) {
  // Will redirect to login
}

const userNameEl = document.getElementById("userName");
if (userNameEl) {
  userNameEl.textContent = getUserName();
}

let currentProfile = null;
let currentRole = "user";
let currentConfigId = null;
let configHolidays = [];

function showProfileAlert(message, type = "info") {
  const el = document.getElementById("profileAlert");
  if (!el) return;

  el.textContent = message;
  el.style.display = "block";
  el.className = "alert";
  el.classList.add(
    type === "success" ? "alert-success" : type === "error" ? "alert-error" : "alert-info",
  );
}

function renderProfileSummary() {
  const container = document.getElementById("profileSummary");
  if (!container) return;

  if (!currentProfile) {
    container.innerHTML = '<p class="text-muted">No profile saved yet.</p>';
    return;
  }

  const { college, branch, semester, section, isConfigured } = currentProfile;

  container.innerHTML = `
    <div class="profile-summary-grid">
      <div>
        <h4>College</h4>
        <p>${college || "-"}</p>
      </div>
      <div>
        <h4>Branch</h4>
        <p>${branch || "-"}</p>
      </div>
      <div>
        <h4>Semester</h4>
        <p>${semester || "-"}</p>
      </div>
      <div>
        <h4>Section</h4>
        <p>${section || "-"}</p>
      </div>
    </div>
    <p style="margin-top: 12px;">
      <strong>Configuration:</strong>
      ${
        isConfigured
          ? "Auto-filled from a class config."
          : "Manual — subjects and holidays were set up by you."
      }
    </p>
  `;
}

async function loadProfile() {
  try {
    const data = await api.get("/api/profile");
    currentProfile = data.profile || null;
    currentRole = data.role || "user";

    if (currentProfile) {
      const collegeInput = document.getElementById("profileCollege");
      const branchInput = document.getElementById("profileBranch");
      const semInput = document.getElementById("profileSemester");
      const sectionInput = document.getElementById("profileSection");

      if (collegeInput) collegeInput.value = currentProfile.college || "";
      if (branchInput) branchInput.value = currentProfile.branch || "";
      if (semInput && currentProfile.semester) {
        semInput.value = String(currentProfile.semester);
      }
      if (sectionInput) sectionInput.value = currentProfile.section || "";
    }

    renderProfileSummary();
    const adminCard = document.getElementById("adminConfigCard");
    if (adminCard) {
      adminCard.style.display = currentRole === "admin" ? "block" : "none";
    }

    if (currentRole === "admin" && currentProfile) {
      await loadExistingConfigForAdmin(currentProfile);
    }
  } catch (error) {
    showProfileAlert(error.message, "error");
    renderProfileSummary();
  } finally {
    document.body.style.visibility = "visible";
  }
}

async function handleProfileSubmit(event) {
  event.preventDefault();

  const btn = document.getElementById("profileSaveBtn");
  const college = document.getElementById("profileCollege").value.trim();
  const branch = document.getElementById("profileBranch").value.trim();
  const semester = document.getElementById("profileSemester").value;
  const section = document.getElementById("profileSection").value.trim();

  if (!college || !branch || !semester || !section) {
    showProfileAlert("Please fill all profile fields.", "error");
    return false;
  }

  if (btn) {
    btn.classList.add("loading");
    btn.innerHTML = '<span class="loading-spinner"></span>';
  }

  try {
    const res = await api.put("/api/profile", {
      college,
      branch,
      semester: Number(semester),
      section,
    });

    currentProfile = res.profile || null;
    renderProfileSummary();

    if (res.autoFilled) {
      showProfileAlert(
        "Your subjects, holidays and semester dates have been auto-filled from a class config.",
        "success",
      );
    } else {
      showProfileAlert(
        "No matching class config was found. You can continue setting up subjects and holidays manually.",
        "info",
      );
    }
  } catch (error) {
    showProfileAlert(error.message, "error");
  } finally {
    if (btn) {
      btn.classList.remove("loading");
      btn.textContent = "Save & Auto-fill";
    }
  }

  return false;
}

function createSubjectConfigRow(subject = {}) {
  const id = `cfg-subject-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const selected = new Set(Array.isArray(subject.schedule) ? subject.schedule : []);

  const wrapper = document.createElement("div");
  wrapper.className = "config-subject-row";
  wrapper.dataset.subjectRow = "true";

  const dayCheckboxes = days
    .map((day) => {
      const short = day.slice(0, 3);
      const checked = selected.has(day) ? "checked" : "";
      return `
        <label class="day-checkbox">
          <input type="checkbox" value="${day}" ${checked} />
          <span>${short}</span>
        </label>
      `;
    })
    .join("");

  wrapper.innerHTML = `
    <div class="form-row">
      <div class="form-group">
        <label>Subject Name</label>
        <input type="text" class="config-subject-name" value="${subject.name || ""}" required />
      </div>
      <div class="form-group">
        <label>Schedule</label>
        <div class="days-grid">
          ${dayCheckboxes}
        </div>
      </div>
      <div class="form-group" style="align-self: flex-end">
        <button type="button" class="btn btn-danger-ghost" data-remove-subject>Remove</button>
      </div>
    </div>
  `;

  return wrapper;
}

function renderConfigSubjects(subjects = []) {
  const container = document.getElementById("configSubjects");
  if (!container) return;

  container.innerHTML = "";
  if (!Array.isArray(subjects) || subjects.length === 0) {
    return;
  }

  subjects.forEach((s) => {
    container.appendChild(createSubjectConfigRow(s));
  });
}

function renderConfigHolidays() {
  const list = document.getElementById("configHolidaysList");
  if (!list) return;

  if (!configHolidays.length) {
    list.innerHTML =
      '<p class="text-muted" style="font-size: 0.85rem;">No holidays added yet.</p>';
    return;
  }

  const sorted = [...configHolidays].sort();
  list.innerHTML = sorted
    .map(
      (d) => `
    <div class="holiday-item">
      <span>${d}</span>
      <button class="btn btn-sm btn-danger-ghost" data-remove-config-holiday="${d}">✕</button>
    </div>
  `,
    )
    .join("");
}

async function loadExistingConfigForAdmin(profile) {
  try {
    const params = new URLSearchParams({
      college: profile.college || "",
      branch: profile.branch || "",
      semester: String(profile.semester || ""),
      section: profile.section || "",
    });

    const config = await api.get("/api/config?" + params.toString());
    if (!config) {
      currentConfigId = null;
      configHolidays = [];
      renderConfigSubjects([]);
      renderConfigHolidays();
      return;
    }

    currentConfigId = config._id;
    configHolidays = Array.isArray(config.holidays) ? config.holidays.slice() : [];

    document.getElementById("configCollege").value = config.college || "";
    document.getElementById("configBranch").value = config.branch || "";
    document.getElementById("configSemester").value = String(config.semester || "");
    document.getElementById("configSection").value = config.section || "";
    document.getElementById("configSemesterStart").value = config.semesterStart || "";
    document.getElementById("configSemesterEnd").value = config.semesterEnd || "";

    renderConfigSubjects(config.subjects || []);
    renderConfigHolidays();
  } catch (error) {
    // Non-fatal
    console.error("loadExistingConfigForAdmin error:", error);
  }
}

function collectConfigSubjects() {
  const container = document.getElementById("configSubjects");
  if (!container) return [];

  const rows = Array.from(container.querySelectorAll("[data-subject-row]"));
  const subjects = [];

  for (const row of rows) {
    const nameInput = row.querySelector(".config-subject-name");
    if (!nameInput) continue;

    const name = nameInput.value.trim();
    if (!name) continue;

    const dayInputs = row.querySelectorAll('input[type="checkbox"]:checked');
    const schedule = Array.from(dayInputs).map((el) => el.value);

    subjects.push({ name, schedule });
  }

  return subjects;
}

async function handleConfigSubmit(event) {
  event.preventDefault();

  const college = document.getElementById("configCollege").value.trim();
  const branch = document.getElementById("configBranch").value.trim();
  const semester = document.getElementById("configSemester").value;
  const section = document.getElementById("configSection").value.trim();
  const semesterStart = document.getElementById("configSemesterStart").value;
  const semesterEnd = document.getElementById("configSemesterEnd").value;
  const btn = document.getElementById("configSaveBtn");

  if (!college || !branch || !semester || !section || !semesterStart || !semesterEnd) {
    showProfileAlert(
      "All admin config fields (college, branch, semester, section, dates) are required.",
      "error",
    );
    return false;
  }

  const subjects = collectConfigSubjects();
  const holidays = configHolidays.slice();

  if (btn) {
    btn.classList.add("loading");
    btn.innerHTML = '<span class="loading-spinner"></span>';
  }

  try {
    const payload = {
      college,
      branch,
      semester: Number(semester),
      section,
      semesterStart,
      semesterEnd,
      subjects,
      holidays,
    };

    let res;
    if (currentConfigId) {
      res = await api.put("/api/config/" + currentConfigId, payload);
    } else {
      res = await api.post("/api/config", payload);
    }

    currentConfigId = res._id;
    configHolidays = Array.isArray(res.holidays) ? res.holidays.slice() : [];
    renderConfigSubjects(res.subjects || []);
    renderConfigHolidays();

    showProfileAlert("Class configuration saved successfully.", "success");
  } catch (error) {
    showProfileAlert(error.message, "error");
  } finally {
    if (btn) {
      btn.classList.remove("loading");
      btn.textContent = "Save Class Config";
    }
  }

  return false;
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("profileForm");
  if (form) {
    form.addEventListener("submit", handleProfileSubmit);
  }

  const configForm = document.getElementById("configForm");
  if (configForm) {
    configForm.addEventListener("submit", handleConfigSubmit);
  }

  const addSubjectBtn = document.getElementById("addSubjectConfigBtn");
  if (addSubjectBtn) {
    addSubjectBtn.addEventListener("click", () => {
      const container = document.getElementById("configSubjects");
      if (!container) return;
      container.appendChild(createSubjectConfigRow());
    });
  }

  const addHolidayBtn = document.getElementById("addHolidayConfigBtn");
  if (addHolidayBtn) {
    addHolidayBtn.addEventListener("click", () => {
      const input = document.getElementById("configHolidayDate");
      if (!input || !input.value) return;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.value)) return;

      if (!configHolidays.includes(input.value)) {
        configHolidays.push(input.value);
        renderConfigHolidays();
      }
      input.value = "";
    });
  }

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.matches("[data-remove-subject]")) {
      const row = target.closest("[data-subject-row]");
      if (row && row.parentNode) {
        row.parentNode.removeChild(row);
      }
      return;
    }

    const holidayToRemove = target.getAttribute("data-remove-config-holiday");
    if (holidayToRemove) {
      configHolidays = configHolidays.filter((d) => d !== holidayToRemove);
      renderConfigHolidays();
    }
  });

  loadProfile();
});

