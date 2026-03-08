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

function initThemeButton() {
  const btn = document.querySelector(".theme-toggle");
  if (btn) {
    const current = document.documentElement.getAttribute("data-theme");
    btn.textContent = current === "light" ? "🌙" : "☀️";
    btn.title = current === "light" ? "Switch to dark mode" : "Switch to light mode";
  }
}

document.addEventListener("DOMContentLoaded", initThemeButton);
