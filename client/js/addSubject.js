if (!requireAuth()) {
  // Will redirect to login
}

const userNameEl = document.getElementById("userName");
if (userNameEl) {
  userNameEl.textContent = getUserName();
}

function resetSubmitButton() {
  const btn = document.getElementById("submitBtn");
  if (!btn) return;
  btn.textContent = "Add Subject";
  btn.classList.remove("loading");
}

async function handleAddSubject(e) {
  e.preventDefault();

  const alert = document.getElementById("alert");
  const btn = document.getElementById("submitBtn");
  const form = document.getElementById("addForm");

  const name = document.getElementById("name").value.trim();
  const type = document.getElementById("type").value;

  const dayCheckboxes = document.querySelectorAll(
    '.day-checkbox input[type="checkbox"]:checked',
  );
  const days = Array.from(dayCheckboxes).map((cb) => cb.value);

  alert.classList.remove("show");

  if (!name) {
    alert.textContent = "Subject name is required";
    alert.classList.add("show");
    return false;
  }

  btn.innerHTML = '<span class="loading-spinner"></span>';
  btn.classList.add("loading");

  try {
    await api.post("/api/subjects", { name, type, days });

    showToast("Subject added successfully ✓", "success");
    alert.classList.remove("show");
    form?.reset();
    document.getElementById("name")?.focus();
    resetSubmitButton();
  } catch (error) {
    alert.textContent = error.message;
    alert.classList.add("show");
    resetSubmitButton();
  }

  return false;
}

function handleSaveSubjects() {
  window.location.href = "subjects.html";
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("addForm");
  if (form) {
    form.addEventListener("submit", handleAddSubject);
  }

  const saveBtn = document.getElementById("saveBtn");
  if (saveBtn) {
    saveBtn.addEventListener("click", handleSaveSubjects);
  }
});
