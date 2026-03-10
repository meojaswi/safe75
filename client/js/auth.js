function isLoggedIn() {
  return localStorage.getItem("isAuthenticated") === "1";
}

function getCurrentPageName() {
  const path = window.location.pathname || "";
  const fileName = path.split("/").pop();
  return (fileName || "index.html").toLowerCase();
}

function isAuthEntryPage() {
  const page = getCurrentPageName();
  return page === "login.html";
}

function isPublicPage() {
  const page = getCurrentPageName();
  return (
    page === "index.html" ||
    page === "login.html" ||
    page === "forgot-password.html" ||
    page === "reset-password.html" ||
    page === "404.html"
  );
}

function getUserName() {
  return localStorage.getItem("userName") || "Student";
}

function logout() {
  api
    .post("/api/auth/logout")
    .catch(() => {})
    .finally(() => {
      localStorage.removeItem("isAuthenticated");
      localStorage.removeItem("userName");
      // replace() removes this page from history so Back can't return here
      window.location.replace("login.html");
    });
}

function requireAuth() {
  if (!isLoggedIn()) {
    // replace() so the protected page is not kept in history
    window.location.replace("login.html");
    return false;
  }
  // Unhide body only after auth confirmed (body starts hidden via inline style in HTML)
  document.body.style.visibility = "visible";
  return true;
}

// Re-check auth whenever browser restores a page from the bfcache (Back/Forward)
window.addEventListener("pageshow", function (event) {
  if (isLoggedIn() && isAuthEntryPage()) {
    window.location.replace("dashboard.html");
    return;
  }

  if (event.persisted && !isLoggedIn() && !isPublicPage()) {
    window.location.replace("login.html");
  }
});

function redirectIfLoggedIn() {
  if (isLoggedIn()) {
    window.location.replace("dashboard.html");
  }
}

function showToast(message, type = "success") {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = "toast toast-" + type + " show";

  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}
