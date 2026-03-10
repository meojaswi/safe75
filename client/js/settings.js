if (!requireAuth()) {
  // Will redirect to login
}

const userNameEl = document.getElementById("userName");
if (userNameEl) {
  userNameEl.textContent = getUserName();
}

async function loadSemester() {
  try {
    const data = await api.get("/api/settings/semester");

    if (data.semesterStart) {
      document.getElementById("semesterStart").value = data.semesterStart;
    }
    if (data.semesterEnd) {
      document.getElementById("semesterEnd").value = data.semesterEnd;
    }

    updateInfo();
  } catch (error) {
    showToast(error.message, "error");
  }
}

function updateInfo() {
  const start = document.getElementById("semesterStart").value;
  const end = document.getElementById("semesterEnd").value;
  const info = document.getElementById("semesterInfo");

  if (start && end) {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

    if (days > 0) {
      const weeks = Math.floor(days / 7);
      info.innerHTML = `<span class="info-icon">📅</span> ${days} days (${weeks} weeks) in this semester`;
      info.style.display = "flex";
    } else {
      info.innerHTML = `<span class="info-icon">⚠</span> End date must be after start date`;
      info.style.display = "flex";
    }
  } else {
    info.style.display = "none";
  }
}

document
  .getElementById("semesterStart")
  .addEventListener("change", updateInfo);
document.getElementById("semesterEnd").addEventListener("change", updateInfo);

async function handleSaveSemester(e) {
  e.preventDefault();

  const alert = document.getElementById("alert");
  const btn = document.getElementById("submitBtn");

  const semesterStart = document.getElementById("semesterStart").value;
  const semesterEnd = document.getElementById("semesterEnd").value;

  alert.classList.remove("show");

  if (semesterStart >= semesterEnd) {
    alert.textContent = "End date must be after start date";
    alert.classList.add("show");
    return false;
  }

  btn.innerHTML = '<span class="loading-spinner"></span>';
  btn.classList.add("loading");

  try {
    await api.put("/api/settings/semester", { semesterStart, semesterEnd });
    showToast("Semester dates saved ✓");

    btn.textContent = "Save Semester Dates";
    btn.classList.remove("loading");
  } catch (error) {
    alert.textContent = error.message;
    alert.classList.add("show");
    btn.textContent = "Save Semester Dates";
    btn.classList.remove("loading");
  }

  return false;
}

loadSemester();

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("semesterForm");
  if (form) {
    form.addEventListener("submit", handleSaveSemester);
  }
});
