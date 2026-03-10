function syncHamburgerState() {
  const sidebar = document.getElementById("sidebar");
  const hamburger = document.querySelector(".hamburger");

  if (!sidebar || !hamburger) return;

  const isOpen = sidebar.classList.contains("open");
  hamburger.textContent = isOpen ? "✕" : "☰";
  hamburger.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
}

// Sidebar toggle for mobile
function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");

  if (!sidebar || !overlay) return;

  sidebar.classList.toggle("open");
  overlay.classList.toggle("open");
  syncHamburgerState();
}

document.addEventListener("DOMContentLoaded", syncHamburgerState);
