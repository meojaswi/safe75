const resetToken = new URLSearchParams(window.location.search).get("token") || "";

function showAlert(message, type = "error") {
  const alert = document.getElementById("alert");
  if (!alert) {
    return;
  }

  alert.textContent = message;
  alert.classList.remove("alert-error", "alert-success");
  alert.classList.add(type === "success" ? "alert-success" : "alert-error");
  alert.classList.add("show");
}

function disableResetForm() {
  const form = document.getElementById("resetPasswordForm");
  if (!form) {
    return;
  }

  const controls = form.querySelectorAll("input, button");
  controls.forEach((element) => {
    element.disabled = true;
  });
}

if (!resetToken) {
  showAlert("Reset link is invalid or missing. Request a new password reset link.");
  disableResetForm();
}

async function handleResetPassword(event) {
  event.preventDefault();

  if (!resetToken) {
    return false;
  }

  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  const btn = document.getElementById("submitBtn");
  const alert = document.getElementById("alert");

  alert.classList.remove("show");

  if (password.length < 6) {
    showAlert("Password must be at least 6 characters");
    return false;
  }

  if (password !== confirmPassword) {
    showAlert("Passwords do not match");
    return false;
  }

  btn.innerHTML = '<span class="loading-spinner"></span>';
  btn.classList.add("loading");

  try {
    const data = await api.post("/api/auth/reset-password", {
      token: resetToken,
      password,
    });

    showAlert(
      data.message || "Password reset successful. Redirecting to login...",
      "success",
    );
    document.getElementById("resetPasswordForm").reset();

    setTimeout(() => {
      window.location.replace("login.html");
    }, 1800);
  } catch (error) {
    showAlert(error.message);
  } finally {
    btn.textContent = "Reset Password";
    btn.classList.remove("loading");
  }

  return false;
}
