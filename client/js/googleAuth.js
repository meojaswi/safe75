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

    localStorage.setItem("token", data.token);
    localStorage.setItem("userName", data.name);
    window.location.replace("dashboard.html");
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
      buttonContainer.style.display = "none";
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
    buttonContainer.style.display = "none";
    showGoogleError(error.message);
  }
}

window.initGoogleAuth = initGoogleAuth;
