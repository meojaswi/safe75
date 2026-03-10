redirectIfLoggedIn();
initGoogleAuth("signin_with");

async function handleLogin(e) {
  e.preventDefault();

  const alert = document.getElementById("alert");
  const btn = document.getElementById("submitBtn");

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  alert.classList.remove("show");

  btn.innerHTML = '<span class="loading-spinner"></span>';
  btn.classList.add("loading");

  try {
    const data = await api.post("/api/auth/login", { email, password });

    localStorage.setItem("token", data.token);
    localStorage.setItem("userName", data.name);

    window.location.replace("dashboard.html");
  } catch (error) {
    alert.textContent = error.message;
    alert.classList.add("show");
    btn.textContent = "Login";
    btn.classList.remove("loading");
  }

  return false;
}
