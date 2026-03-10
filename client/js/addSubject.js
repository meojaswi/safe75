if (!requireAuth()) {
  // Will redirect to login
}

const userNameEl = document.getElementById("userName");
if (userNameEl) {
  userNameEl.textContent = getUserName();
}

async function handleAddSubject(e) {
  e.preventDefault();

  const alert = document.getElementById("alert");
  const btn = document.getElementById("submitBtn");

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

    showToast("Subject added successfully ✓");

    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 800);
  } catch (error) {
    alert.textContent = error.message;
    alert.classList.add("show");
    btn.textContent = "Add Subject";
    btn.classList.remove("loading");
  }

  return false;
}
