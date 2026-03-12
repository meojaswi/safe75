const DASHBOARD_PAGE = "dashboard.html";
const LOGIN_PAGE = "login.html";
const ONBOARDING_PAGE = "onboarding.html";

let setupStatusPromise = null;

function isLoggedIn() {
  return localStorage.getItem("isAuthenticated") === "1";
}

function getCurrentPageName() {
  const path = window.location.pathname || "";
  const fileName = path.split("/").pop();
  return (fileName || "index.html").toLowerCase();
}

function isAuthEntryPage() {
  return getCurrentPageName() === LOGIN_PAGE;
}

function isPublicPage() {
  const page = getCurrentPageName();
  return (
    page === "index.html" ||
    page === LOGIN_PAGE ||
    page === "forgot-password.html" ||
    page === "reset-password.html" ||
    page === "404.html"
  );
}

function getUserName() {
  return localStorage.getItem("userName") || "Student";
}

function clearSetupStatusCache() {
  setupStatusPromise = null;
}

async function getSetupStatus(forceRefresh = false) {
  if (!isLoggedIn()) {
    return { requiresOnboarding: false, onboardingCompleted: true };
  }

  if (!forceRefresh && setupStatusPromise) {
    return setupStatusPromise;
  }

  setupStatusPromise = api.get("/api/settings/setup-status");

  try {
    return await setupStatusPromise;
  } catch (error) {
    clearSetupStatusCache();
    throw error;
  }
}

async function getPostLoginRedirectPath(forceRefresh = false) {
  try {
    const status = await getSetupStatus(forceRefresh);
    return status?.requiresOnboarding ? ONBOARDING_PAGE : DASHBOARD_PAGE;
  } catch (_error) {
    return isLoggedIn() ? DASHBOARD_PAGE : LOGIN_PAGE;
  }
}

async function redirectLoggedInUserFromAuthPage() {
  const destination = await getPostLoginRedirectPath(true);

  if (getCurrentPageName() === destination) {
    return;
  }

  window.location.replace(destination);
}

function enforceOnboardingGate() {
  if (!isLoggedIn() || isPublicPage()) {
    return;
  }

  const page = getCurrentPageName();
  getSetupStatus()
    .then((status) => {
      if (!status?.requiresOnboarding) {
        return;
      }

      if (page !== ONBOARDING_PAGE) {
        window.location.replace(ONBOARDING_PAGE);
      }
    })
    .catch(() => {
      // Keep page usable if setup-status check fails temporarily.
    });
}

function logout() {
  api
    .post("/api/auth/logout")
    .catch(() => {})
    .finally(() => {
      localStorage.removeItem("isAuthenticated");
      localStorage.removeItem("userName");
      clearSetupStatusCache();
      // replace() removes this page from history so Back can't return here
      window.location.replace(LOGIN_PAGE);
    });
}

function requireAuth() {
  if (!isLoggedIn()) {
    // replace() so the protected page is not kept in history
    window.location.replace(LOGIN_PAGE);
    return false;
  }

  // Unhide body only after auth confirmed (body starts hidden via inline style in HTML)
  document.body.style.visibility = "visible";
  enforceOnboardingGate();
  return true;
}

// Re-check auth whenever browser restores a page from the bfcache (Back/Forward)
window.addEventListener("pageshow", function (event) {
  if (isLoggedIn() && isAuthEntryPage()) {
    redirectLoggedInUserFromAuthPage();
    return;
  }

  if (event.persisted && !isLoggedIn() && !isPublicPage()) {
    window.location.replace(LOGIN_PAGE);
    return;
  }

  if (event.persisted && isLoggedIn()) {
    enforceOnboardingGate();
  }
});

function redirectIfLoggedIn() {
  if (isLoggedIn()) {
    redirectLoggedInUserFromAuthPage();
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

window.getPostLoginRedirectPath = getPostLoginRedirectPath;
window.clearSetupStatusCache = clearSetupStatusCache;
