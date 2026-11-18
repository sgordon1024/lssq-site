// The homepage's movement: smooth scrolling, the entrance, the collage drifting at
// different depths, the tagline running along the ribbon, the pillars sliding
// sideways, the photo wall flying in, the next weekend's photo opening up, and the
// donate band's Q turning like a record. It needs GSAP, ScrollTrigger and Lenis.
// Without them, or with reduced motion, the page is a plain scroll and loses nothing.
(function () {
  var root = document.documentElement;
  if (!root.classList.contains("motion") || !window.gsap || !window.ScrollTrigger) {
    root.classList.add("home-still");
    return;
  }
  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;
  gsap.registerPlugin(ScrollTrigger);
  var $ = function (sel, el) { return (el || document).querySelector(sel); };
  var $$ = function (sel, el) { return gsap.utils.toArray(sel, el); };

  // Smooth scrolling, on GSAP's clock so every scroll scene stays in step with it.
  var lenis = null;
  if (window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.12, anchors: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  // 1. The entrance. If we came in through the stripe wipe, wait for it to lift.
  var intro = gsap.timeline({ delay: root.classList.contains("wipe-in") ? 0.42 : 0.08 });
  intro
    .fromTo(".h-title .w > span", { yPercent: 115, autoAlpha: 1 }, { yPercent: 0, duration: 1, ease: "expo.out", stagger: 0.07 })
    .fromTo(".h-stage [data-enter]", { y: 26, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.7, ease: "power3.out", stagger: 0.08 }, "-=0.7")
    .fromTo("[data-toss]", {
      autoAlpha: 0,
      y: 240,
      x: function (i) { return i % 2 ? 90 : -90; },
      rotation: function (i) { return i % 2 ? 28 : -28; },
    }, {
      autoAlpha: 1, y: 0, x: 0,
      rotation: function (i, el) { return parseFloat(getComputedStyle(el).getPropertyValue("--r")) || 0; },
      duration: 1.1, ease: "expo.out", stagger: 0.09,
    }, "-=0.95")
    .fromTo("[data-pop]", { autoAlpha: 0, scale: 0, rotation: -40 }, {
      autoAlpha: 1, scale: 1, duration: 0.8, ease: "back.out(2)", stagger: 0.08,
      rotation: function (i, el) { return parseFloat(getComputedStyle(el).getPropertyValue("--r")) || 0; },
    }, "-=0.8")
    .fromTo(".h-note", { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: "power2.out" }, "-=0.3");

  // 2. The collage drifts at different depths as the hero scrolls away, and the
  //    headline sinks back behind it. On phones the collage sits closer to the
  //    buttons, so it drifts half as far.
  var heroScroll = { trigger: ".h-hero", start: "top top", end: "bottom top", scrub: true };
  var depth = window.matchMedia("(max-width: 640px)").matches ? 0.5 : 1;
  $$(".h-collage [data-speed]").forEach(function (el) {
    var speed = (parseFloat(el.getAttribute("data-speed")) || 0) * depth;
    gsap.to(el, { yPercent: speed * -170, ease: "none", scrollTrigger: heroScroll });
  });
  gsap.to(".h-stage", { yPercent: 18, scale: 0.94, autoAlpha: 0.35, ease: "none", scrollTrigger: heroScroll });

  // 3. The tagline runs along the ribbon, faster while you scroll, backwards if you scroll up.
  var path = $(".rb-text textPath");
  if (path) {
    var text = path.parentNode;
    var loop = 0;
    try { loop = text.getSubStringLength(0, Math.round(path.textContent.length / 4)); } catch (e) { loop = 0; }
    var offset = 0, push = 0, onScreen = false;
    ScrollTrigger.create({ trigger: ".h-ribbon", start: "top bottom", end: "bottom top", onToggle: function (self) { onScreen = self.isActive; } });
    if (lenis) lenis.on("scroll", function (l) { push = gsap.utils.clamp(-5, 14, l.velocity * 0.3); });
    gsap.ticker.add(function () {
      push *= 0.94;
      if (!onScreen || !loop) return;
      offset -= 1.1 + push;
      if (offset < -loop) offset += loop;
      if (offset > 0) offset -= loop;
      path.setAttribute("startOffset", offset.toFixed(1));
    });
  }

  // 4. The pillars slide sideways on big screens. Each word drifts against the
  //    slide, the stickers spin and the prints bob, so the scene has depth.
  var mm = gsap.matchMedia();
  mm.add("(min-width: 900px) and (min-height: 560px)", function () {
    var section = $(".h-pillars");
    var track = section && $(".hp-track", section);
    if (!track) return;
    section.classList.add("is-sideways");
    var distance = function () { return track.scrollWidth - window.innerWidth; };
    var slide = gsap.to(track, {
      x: function () { return -distance(); },
      ease: "none",
      scrollTrigger: { trigger: section, start: "top top", end: function () { return "+=" + distance(); }, pin: true, scrub: 0.6, invalidateOnRefresh: true, anticipatePin: 1 },
    });
    $$(".hp-pillar", section).forEach(function (panel) {
      var along = function () { return { trigger: panel, containerAnimation: slide, start: "left right", end: "right left", scrub: true }; };
      gsap.fromTo($(".hp-word", panel), { xPercent: 22 }, { xPercent: -22, ease: "none", scrollTrigger: along() });
      var sticker = $(".hp-sticker", panel);
      if (sticker) gsap.fromTo(sticker, { rotation: -35, y: 70 }, { rotation: 30, y: -50, ease: "none", scrollTrigger: along() });
      var print = $(".hp-print", panel);
      if (print) gsap.fromTo(print, { yPercent: 22 }, { yPercent: -18, ease: "none", scrollTrigger: along() });
      var note = $(".hp-note", panel);
      if (note) gsap.fromTo(note, { xPercent: 40 }, { xPercent: -40, ease: "none", scrollTrigger: along() });
    });
    return function () { section.classList.remove("is-sideways"); };
  });

  // 5. The photo wall: each print flies in and lands at its own angle.
  $$("[data-fly]").forEach(function (el, i) {
    gsap.fromTo(el, { y: 170, rotation: i % 2 ? 16 : -16, autoAlpha: 0 }, {
      y: 0, rotation: 0, autoAlpha: 1, ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 98%", end: "top 62%", scrub: 0.8 },
    });
  });

  // 6. The next weekend's photo opens up from a rounded card to the full width.
  var grow = $("[data-grow]");
  if (grow) {
    var growScroll = function () { return { trigger: grow, start: "top 92%", end: "top 28%", scrub: true }; };
    gsap.fromTo(grow, { clipPath: "inset(0% 8% 0% 8% round 32px)" }, { clipPath: "inset(0% 0% 0% 0% round 0px)", ease: "none", scrollTrigger: growScroll() });
    var img = $("img", grow);
    if (img) gsap.fromTo(img, { scale: 1.16 }, { scale: 1, ease: "none", scrollTrigger: growScroll() });
  }

  // 7. The donate band's Q turns like a record while it's on screen.
  var give = $(".give");
  if (give) {
    ScrollTrigger.create({
      trigger: give, start: "top bottom", end: "bottom top",
      onUpdate: function (self) { give.style.setProperty("--spin", (self.progress * 150).toFixed(1) + "deg"); },
    });
  }

  // Fonts and lazy photos can shift things a little once they load.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  window.addEventListener("load", function () { ScrollTrigger.refresh(); });
})();
