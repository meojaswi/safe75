function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(dateStr) {
  if (!dateStr) {
    return "an unknown date";
  }

  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return dateStr;
  }

  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function setMissingPathText() {
  const missingPathEl = document.getElementById("missingPath");
  if (!missingPathEl) {
    return;
  }

  const attemptedPath =
    window.location.pathname + window.location.search + window.location.hash;
  missingPathEl.textContent = attemptedPath;
}

function setSecondaryAction(token) {
  const secondaryAction = document.getElementById("secondaryAction");
  if (!secondaryAction) {
    return;
  }

  if (token) {
    secondaryAction.href = "/dashboard.html";
    secondaryAction.textContent = "Dashboard";
  } else {
    secondaryAction.href = "/login.html";
    secondaryAction.textContent = "Login";
  }
}

function showDefaultMessage() {
  const bunkMessageEl = document.getElementById("bunkMessage");
  if (!bunkMessageEl) {
    return;
  }

  bunkMessageEl.textContent = "page bunked today";
}

async function renderBunkMessage() {
  const bunkMessageEl = document.getElementById("bunkMessage");
  if (!bunkMessageEl) {
    return;
  }

  const token = localStorage.getItem("token");
  setSecondaryAction(token);

  if (!token) {
    showDefaultMessage();
    return;
  }

  try {
    const response = await fetch("/api/attendance/latest-bunk", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("userName");
      showDefaultMessage();
      setSecondaryAction(null);
      return;
    }

    if (!response.ok) {
      showDefaultMessage();
      return;
    }

    const data = await response.json();

    const latestBunk = data && data.latestBunk ? data.latestBunk : null;

    if (!latestBunk || typeof latestBunk !== "object") {
      showDefaultMessage();
      return;
    }

    if (
      typeof latestBunk.date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(latestBunk.date)
    ) {
      showDefaultMessage();
      return;
    }

    const safeSubject = escapeHtml(latestBunk.subject || "Unknown Subject");
    const safeDate = escapeHtml(formatDate(latestBunk.date));

    bunkMessageEl.innerHTML =
      'This page bunked today. Just like you bunked <strong>"' +
      safeSubject +
      '"</strong> on <strong>' +
      safeDate +
      "</strong>.";
  } catch (error) {
    showDefaultMessage();
  }
}

setMissingPathText();
renderBunkMessage();
