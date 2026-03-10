redirectIfLoggedIn();
initGoogleAuth("signup_with");

async function handleSignup(e) {
  e.preventDefault();

  const alert = document.getElementById("alert");
  const btn = document.getElementById("submitBtn");

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  alert.classList.remove("show");

  if (password !== confirmPassword) {
    alert.textContent = "Passwords do not match";
    alert.classList.add("show");
    return false;
  }

  btn.innerHTML = '<span class="loading-spinner"></span>';
  btn.classList.add("loading");

  try {
    const data = await api.post("/api/auth/signup", {
      name,
      email,
      password,
    });

    localStorage.setItem("isAuthenticated", "1");
    localStorage.setItem("userName", data.name);

    window.location.replace("dashboard.html");
  } catch (error) {
    alert.textContent = error.message;
    alert.classList.add("show");
    btn.textContent = "Create Account";
    btn.classList.remove("loading");
  }

  return false;
}
