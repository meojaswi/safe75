document.addEventListener("DOMContentLoaded", () => {
  const img = document.querySelector(".landing-hero-img");
  const fallback = document.querySelector(".landing-hero-fallback");

  if (!img || !fallback) {
    return;
  }

  const showFallback = () => {
    img.style.display = "none";
    fallback.style.display = "flex";
  };

  img.addEventListener("error", showFallback);

  if (img.complete && img.naturalWidth === 0) {
    showFallback();
  }
});

