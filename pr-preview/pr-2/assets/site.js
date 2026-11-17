// Two small touches. The site works the same without them.
(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // 1. The logo draws itself in once, on someone's first visit. Still after that.
  var logo = document.querySelector(".logo img");
  var seen = true;
  try {
    seen = localStorage.getItem("lssq-seen") === "1";
    localStorage.setItem("lssq-seen", "1");
  } catch (e) { /* storage blocked: keep the logo still */ }
  if (logo && !seen && !reduce) {
    logo.src = logo.src.replace("f-stripes.svg", "f-stripes-animated.svg");
  }

  // 2. Touch screens have no hover, so the stripe echo comes in once the event name scrolls into view.
  if (!reduce && window.matchMedia("(hover: none)").matches && "IntersectionObserver" in window) {
    document.querySelectorAll(".echo").forEach(function (el) {
      var watch = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) { el.classList.add("on"); watch.disconnect(); }
      }, { threshold: 0.6 });
      watch.observe(el);
    });
  }
})();
