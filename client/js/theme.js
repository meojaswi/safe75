// Theme toggle — persists via localStorage
(function () {
  const saved = localStorage.getItem("theme");
  if (saved) {
    document.documentElement.setAttribute("data-theme", saved);
  }
})();

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "light" ? "dark" : "light";

  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);

  const btn = document.querySelector(".theme-toggle");
  if (btn) {
    btn.textContent = next === "light" ? "🌙" : "☀️";
    btn.title = next === "light" ? "Switch to dark mode" : "Switch to light mode";
  }
}

function initThemeButtons() {
  const buttons = document.querySelectorAll(".theme-toggle");
  const current = document.documentElement.getAttribute("data-theme");
  const text = current === "light" ? "🌙" : "☀️";
  const title =
    current === "light" ? "Switch to dark mode" : "Switch to light mode";

  buttons.forEach((btn) => {
    btn.textContent = text;
    btn.title = title;
    btn.addEventListener("click", toggleTheme);
  });
}

document.addEventListener("DOMContentLoaded", initThemeButtons);
