function showGoogleError(message) {
  const alertEl = document.getElementById("alert");
  if (!alertEl) {
    return;
  }

  alertEl.textContent = message;
  alertEl.classList.add("show");
}

function clearGoogleError() {
  const alertEl = document.getElementById("alert");
  if (!alertEl) {
    return;
  }

  alertEl.classList.remove("show");
}

function renderGoogleFallback(buttonContainer, message) {
  if (!buttonContainer) {
    return;
  }

  buttonContainer.innerHTML = "";
  buttonContainer.style.display = "flex";

  const fallback = document.createElement("div");
  fallback.className = "google-signin-fallback";
  fallback.textContent = message;

  buttonContainer.appendChild(fallback);
}

function waitForGoogleSdk(timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const interval = setInterval(() => {
      if (window.google && window.google.accounts && window.google.accounts.id) {
        clearInterval(interval);
        resolve();
        return;
      }

      if (Date.now() - startTime >= timeoutMs) {
        clearInterval(interval);
        reject(new Error("Google Sign-In could not be loaded. Please refresh."));
      }
    }, 60);
  });
}

async function handleGoogleCredentialResponse(response) {
  if (!response || !response.credential) {
    showGoogleError("Google Sign-In failed. Please try again.");
    return;
  }

  clearGoogleError();

  try {
    const data = await api.post("/api/auth/google", {
      idToken: response.credential,
    });

    localStorage.setItem("isAuthenticated", "1");
    localStorage.setItem("userName", data.name);
    const destination =
      typeof window.getPostLoginRedirectPath === "function"
        ? await window.getPostLoginRedirectPath(true)
        : "dashboard.html";
    window.location.replace(destination);
  } catch (error) {
    showGoogleError(error.message);
  }
}

async function initGoogleAuth(buttonText = "signin_with") {
  const buttonContainer = document.getElementById("googleSignInButton");
  if (!buttonContainer) {
    return;
  }

  buttonContainer.innerHTML = "";

  try {
    const config = await api.get("/api/auth/google-config");

    if (!config.clientId) {
      renderGoogleFallback(
        buttonContainer,
        "Google Sign-In is currently unavailable. Please try again later.",
      );
      return;
    }

    await waitForGoogleSdk();

    window.google.accounts.id.initialize({
      client_id: config.clientId,
      callback: handleGoogleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    const width = Math.max(220, Math.min(380, buttonContainer.offsetWidth || 320));

    window.google.accounts.id.renderButton(buttonContainer, {
      type: "standard",
      shape: "rectangular",
      theme: "outline",
      text: buttonText,
      size: "large",
      logo_alignment: "left",
      width,
    });
  } catch (error) {
    renderGoogleFallback(
      buttonContainer,
      "Google Sign-In could not be loaded right now. Please refresh and try again.",
    );
    showGoogleError(
      error && error.message
        ? error.message
        : "Google Sign-In is currently unavailable.",
    );
  }
}

window.initGoogleAuth = initGoogleAuth;
