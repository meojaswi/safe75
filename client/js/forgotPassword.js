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

async function handleForgotPassword(event) {
  event.preventDefault();

  const email = document.getElementById("email").value.trim();
  const btn = document.getElementById("submitBtn");
  const alert = document.getElementById("alert");

  alert.classList.remove("show");
  btn.innerHTML = '<span class="loading-spinner"></span>';
  btn.classList.add("loading");

  try {
    const data = await api.post("/api/auth/forgot-password", { email });
    showAlert(data.message || "Reset link sent. Please check your inbox.", "success");
    document.getElementById("forgotPasswordForm").reset();
  } catch (error) {
    showAlert(error.message);
  } finally {
    btn.textContent = "Send Reset Link";
    btn.classList.remove("loading");
  }

  return false;
}
