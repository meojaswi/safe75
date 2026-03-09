function isLoggedIn() {
  return !!localStorage.getItem("token");
}

function getUserName() {
  return localStorage.getItem("userName") || "Student";
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("userName");
  // replace() removes this page from history so Back can't return here
  window.location.replace("login.html");
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
  if (event.persisted && !isLoggedIn()) {
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
