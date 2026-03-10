// Theme is now dark-only across the app.
(function enforceDarkTheme() {
  document.documentElement.setAttribute("data-theme", "dark");
  localStorage.removeItem("theme");
})();
