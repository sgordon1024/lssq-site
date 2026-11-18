// Small touches. The site works the same without them.
(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var root = document.documentElement;

  // 0. The stripe wipe between pages. A click on a link to another page of this
  //    site sweeps the stripes up to cover the screen, then goes there. The next
  //    page starts covered (see the script in base.njk) and the stripes lift off.
  var wipe = document.querySelector(".wipe");
  var COVER = 720, LIFT = 760;
  var lift = function () {
    if (!root.classList.contains("wipe-in")) return;
    requestAnimationFrame(function () {
      root.classList.add("wipe-out");
      setTimeout(function () { root.classList.remove("wipe-in", "wipe-out"); }, LIFT);
    });
  };
  lift();
  // Coming back with the Back button can restore a page that was still covered.
  window.addEventListener("pageshow", function (e) {
    if (e.persisted && root.classList.contains("wipe-cover")) {
      root.classList.remove("wipe-cover");
      root.classList.add("wipe-in");
      lift();
    }
  });
  var home = document.querySelector(".logo");
  var base = home ? new URL(home.getAttribute("href"), location.href).pathname : "/";
  if (wipe && !reduce) {
    document.addEventListener("click", function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest && e.target.closest("a[href]");
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      var url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname.indexOf(base) !== 0) return;
      if (/\/admin\//.test(url.pathname) || /\.[a-z0-9]+$/i.test(url.pathname)) return;
      if (url.pathname === location.pathname && url.search === location.search) return;  // same page, maybe an anchor
      e.preventDefault();
      root.classList.remove("wipe-in", "wipe-out");
      root.classList.add("wipe-cover");
      try { sessionStorage.setItem("lssq-wipe", "1"); } catch (err) {}
      setTimeout(function () { location.href = url.href; }, COVER);
    });
  }

  // 1. The logo draws itself in on someone's first visit, and again whenever
  //    they hover or focus it. Each replay loads the animated file as a fresh
  //    image, which restarts its animation from the first frame.
  var logo = document.querySelector(".logo img");
  if (logo && !reduce) {
    var animated = logo.src.replace("f-stripes.svg", "f-stripes-animated.svg");
    var blob = null;
    var busyUntil = 0;
    var lastUrl = null;

    var play = function () {
      var now = Date.now();
      if (now < busyUntil) return;
      busyUntil = now + 5200;
      var next = blob ? URL.createObjectURL(blob) : animated + "?play=" + now;
      // Load it off screen first so the logo never blinks empty.
      var probe = new Image();
      probe.onload = function () {
        logo.src = next;
        if (lastUrl) URL.revokeObjectURL(lastUrl);
        lastUrl = blob ? next : null;
      };
      probe.src = next;
    };

    if (window.fetch) {
      fetch(animated).then(function (r) { return r.ok ? r.blob() : null; }).then(function (b) { blob = b; }).catch(function () {});
    }

    var seen = true;
    try {
      seen = localStorage.getItem("lssq-seen") === "1";
      localStorage.setItem("lssq-seen", "1");
    } catch (e) { /* storage blocked: only replay on hover */ }
    if (!seen) { busyUntil = Date.now() + 5200; logo.src = animated; }

    var link = logo.closest("a") || logo;
    link.addEventListener("mouseenter", play);
    link.addEventListener("focus", play);
  }

  // 2. Countdowns. The build writes the days; this keeps them exact and adds
  //    hours, minutes and seconds on the event page.
  var pad = function (n) { return n < 10 ? "0" + n : String(n); };
  var counters = Array.prototype.slice.call(document.querySelectorAll("[data-countdown]"));
  counters.forEach(function (el) {
    el.querySelectorAll("[data-live]").forEach(function (u) { u.hidden = false; });
  });
  var setUnit = function (el, name, value) {
    var b = el.querySelector('[data-unit="' + name + '"]');
    if (!b || b.textContent === value) return;
    b.textContent = value;
    if (!reduce) { b.classList.remove("tick"); void b.offsetWidth; b.classList.add("tick"); }
  };
  var tick = function () {
    var now = Date.now();
    counters.forEach(function (el) {
      var start = Date.parse(el.dataset.start);
      var end = Date.parse(el.dataset.end);
      if (isNaN(start)) return;
      var left = Math.max(0, start - now);
      var d = Math.floor(left / 86400000);
      var h = Math.floor(left / 3600000) % 24;
      var m = Math.floor(left / 60000) % 60;
      var s = Math.floor(left / 1000) % 60;
      var on = left === 0 && now < end;
      var over = left === 0 && now >= end;

      if (el.dataset.countdown === "pill") {
        el.innerHTML = over ? "<b>That's a wrap</b>"
          : on ? "<b>Happening now</b>"
          : d >= 2 ? "<b>" + d + "</b> days to go"
          : d === 1 ? "<b>1</b> day to go"
          : "<b>" + h + "h " + pad(m) + "m</b> to go";
        return;
      }
      var units = el.querySelector(".cd-units");
      var label = el.querySelector(".cd-label");
      var note = el.querySelector(".cd-now");
      if (left > 0) {
        setUnit(el, "d", String(d));
        setUnit(el, "h", pad(h));
        setUnit(el, "m", pad(m));
        setUnit(el, "s", pad(s));
        var dl = el.querySelector('[data-unit="d"] + small');
        if (dl) dl.textContent = d === 1 ? "day" : "days";
      } else {
        if (units) units.hidden = true;
        if (note) { note.hidden = false; if (over) note.textContent = "See you next month."; }
        if (label) label.textContent = over ? "That's a wrap" : "Happening now";
      }
    });
  };
  if (counters.length) {
    tick();
    var full = counters.some(function (el) { return el.dataset.countdown === "full"; });
    setInterval(tick, full ? 1000 : 30000);
  }

  // 3. Copy the coordinates in one tap, for pasting into any map app.
  if (navigator.clipboard && window.isSecureContext) {
    document.querySelectorAll("[data-copy]").forEach(function (btn) {
      var status = btn.parentNode.querySelector("[data-copy-status]");
      btn.hidden = false;
      btn.addEventListener("click", function () {
        navigator.clipboard.writeText(btn.dataset.copy).then(function () {
          btn.textContent = "Copied";
          if (status) status.textContent = "Coordinates copied";
          setTimeout(function () { btn.textContent = "Copy"; if (status) status.textContent = ""; }, 2000);
        });
      });
    });
  }

  // 4. Touch screens have no hover, so the stripe echo comes in once the event name scrolls into view.
  if (!reduce && window.matchMedia("(hover: none)").matches && "IntersectionObserver" in window) {
    document.querySelectorAll(".echo").forEach(function (el) {
      var watch = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) { el.classList.add("on"); watch.disconnect(); }
      }, { threshold: 0.6 });
      watch.observe(el);
    });
  }
})();
