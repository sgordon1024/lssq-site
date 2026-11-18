// Builds the LSSQ site from plain content files: one Markdown file per event in
// src/events/, and the site's words in src/_data/site.json. Jake edits both
// through the editor at /admin/ (Decap CMS).
import { EleventyHtmlBasePlugin } from "@11ty/eleventy";

// Events are in the American West and Baja, so "today" is Pacific time.
const TZ = "America/Los_Angeles";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Dates arrive as "2026-11-27" strings or as Date objects (YAML turns unquoted
// dates into Dates). Either way, work with the YYYY-MM-DD string.
const iso = (value) => {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
};
const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const parts = (value) => {
  const [y, m, d] = iso(value).split("-").map(Number);
  return { y, m, d };
};
const lastDay = (data) => iso(data.end || data.start);
const isPast = (data) => lastDay(data) < today();

// Minutes ahead of UTC in Pacific time at a given moment (-480 in winter, -420 in summer).
function offsetAt(ms) {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" })
    .formatToParts(new Date(ms)).find((p) => p.type === "timeZoneName").value;
  const m = name.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] || 0)) : 0;
}
// A Pacific wall-clock time as an ISO moment the browser can count down to,
// like "2026-11-27T12:00:00-08:00".
function pacific(ymd, hm = "12:00") {
  const { y, m, d } = parts(ymd);
  const [hh, mm] = hm.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  const off = offsetAt(wall - offsetAt(wall) * 60000);
  const pad = (n) => String(Math.abs(n)).padStart(2, "0");
  return `${iso(ymd)}T${pad(hh)}:${pad(mm)}:00${off < 0 ? "-" : "+"}${pad(Math.trunc(off / 60))}:${pad(off % 60)}`;
}
// YAML can read 12:00 as the number 720 (minutes), so accept either.
const arrival = (value) => {
  if (typeof value === "number") return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
  return /^\d{1,2}:\d{2}$/.test(String(value || "")) ? String(value).padStart(5, "0") : "12:00";
};
const addDays = (value, n) => {
  const { y, m, d } = parts(value);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const daysBetween = (a, b) => Math.round((Date.parse(iso(b)) - Date.parse(iso(a))) / 86400000);

// The exact spot is usually picked about a month out. `reveal` overrides the guess.
const revealDate = (data) => iso(data.reveal) || addDays(data.start, -30);
// "31.7246, -116.7196" → { lat, lng }, or null if it isn't a pair of numbers.
const latLng = (value) => {
  const m = String(value || "").match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
  return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null;
};

// Line icons, drawn on a 48 unit grid in the current text color.
const ICONS = {
  sun: '<circle cx="24" cy="24" r="7"/><path d="M36 24h5M32.5 32.5 36 36M24 36v5M15.5 32.5 12 36M12 24H7M15.5 15.5 12 12M24 12V7M32.5 15.5 36 12"/>',
  die: '<g transform="rotate(-12 24 24)"><rect x="10" y="10" width="28" height="28" rx="7"/><circle cx="17.5" cy="17.5" r="2.8" fill="currentColor" stroke="none"/><circle cx="24" cy="24" r="2.8" fill="currentColor" stroke="none"/><circle cx="30.5" cy="30.5" r="2.8" fill="currentColor" stroke="none"/></g>',
  notes: '<path d="M18 33V15l17-4v18"/><ellipse cx="14" cy="33" rx="4.6" ry="3.6" transform="rotate(-20 14 33)" fill="currentColor" stroke="none"/><ellipse cx="31" cy="29" rx="4.6" ry="3.6" transform="rotate(-20 31 29)" fill="currentColor" stroke="none"/>',
  heart: '<path d="M24 38s-13-7.6-13-17a7 7 0 0 1 13-3.6A7 7 0 0 1 37 21c0 9.4-13 17-13 17z"/>',
  pin: '<path d="M24 42s12-11.2 12-21a12 12 0 0 0-24 0c0 9.8 12 21 12 21z"/><circle cx="24" cy="21" r="4"/>',
  mystery: '<path d="M24 42s12-11.2 12-21a12 12 0 0 0-24 0c0 9.8 12 21 12 21z" stroke-dasharray="4 5"/><path d="M20.6 17.8a3.6 3.6 0 1 1 5 3.3c-1 .5-1.6 1.2-1.6 2.5"/><circle cx="24" cy="28.4" r="1.3" fill="currentColor" stroke="none"/>',
};
const icon = (name, cls = "") =>
  `<svg class="icon ${cls}" viewBox="0 0 48 48" width="48" height="48" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name] || ICONS.sun}</svg>`;

// Sticker icons for the home page: solid shapes on the same 48 unit grid, so they stay
// crisp at big sizes. Holes (a die's pips, a smile) are cut out with the even-odd rule.
const ring = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
const round = 'stroke="currentColor" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"';
const line = 'fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round"';
const STICKERS = {
  sun: `<circle cx="24" cy="24" r="9.5"/>${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<rect x="21.5" y="2.5" width="5" height="9" rx="2.5" transform="rotate(${a} 24 24)"/>`).join("")}`,
  sprout: `<path d="M24 30C22 22 16 18 8.5 18.5 8.5 26 15 31 24 30z M24 24.5C25 15 32 8.5 41.5 8.5 41.5 18 34.5 25.5 24 24.5z"/><path d="M24 42C24 35 23.5 29 24.5 21M15 42.5h18" ${line}/>`,
  mug: `<path d="M8 16h25v15a9 9 0 0 1-9 9h-7a9 9 0 0 1-9-9z M33 19.5h3a6.5 6.5 0 0 1 0 13h-3.4v-4.2H36a2.3 2.3 0 0 0 0-4.6h-3z"/><path d="M15.5 5c-2 2.6 2 4.6 0 7.4M24.5 5c-2 2.6 2 4.6 0 7.4" ${line}/>`,
  moon: '<path d="M22.2 7.1A17 17 0 1 0 40.4 28.4 14 14 0 1 1 22.2 7.1z"/>',
  die: `<path transform="rotate(-10 24 24)" d="M15 8h18a7 7 0 0 1 7 7v18a7 7 0 0 1-7 7H15a7 7 0 0 1-7-7V15a7 7 0 0 1 7-7z ${ring(16.5, 16.5, 3)} ${ring(31.5, 16.5, 3)} ${ring(24, 24, 3)} ${ring(16.5, 31.5, 3)} ${ring(31.5, 31.5, 3)}"/>`,
  star: `<path ${round} d="M24 6l5 12.1 13.1 1-10 8.5 3.1 12.8L24 33.5l-11.2 6.9 3.1-12.8-10-8.5 13.1-1z"/>`,
  sparkle: '<path d="M22 6c1.4 11 6.4 16 17 17.5C28.4 25 23.4 30 22 41c-1.4-11-6.4-16-17-17.5C15.6 22 20.6 17 22 6z M39.5 3c.5 3.6 2 5.2 5.5 5.7-3.5.5-5 2.1-5.5 5.7-.5-3.6-2-5.2-5.5-5.7 3.5-.5 5-2.1 5.5-5.7z"/>',
  smiley: `<path d="${ring(24, 24, 19)} ${ring(17.5, 19.5, 2.8)} ${ring(30.5, 19.5, 2.8)} M15.5 27.5h17a8.5 8.5 0 0 1-17 0z"/>`,
  notes: '<path d="M18 11.5l19-5v6l-19 5z M18 11.5h3.6v22H18z M33.4 7h3.6v21.5h-3.6z"/><ellipse cx="15" cy="33.5" rx="6.2" ry="4.7" transform="rotate(-20 15 33.5)"/><ellipse cx="30.6" cy="28.5" rx="6.2" ry="4.7" transform="rotate(-20 30.6 28.5)"/>',
  record: `<path d="${[19, 14.6, 13, 7.6, 6, 1.8].map((r) => ring(24, 24, r)).join(" ")}"/>`,
  mic: `<rect x="17" y="4" width="14" height="22" rx="7"/><path d="M11 20a13 13 0 0 0 26 0M24 33v8M16 42.5h16" ${line}/>`,
  bolt: `<path ${round} d="M28 3.5 10.5 27h11.5l-4 17.5 19.5-25.5H25.5z"/>`,
  heart: '<path d="M24 41.5C9.5 32 5 24.5 5 17.5 5 11.6 9.6 7 15.2 7c3.7 0 6.9 2 8.8 5 1.9-3 5.1-5 8.8-5C38.4 7 43 11.6 43 17.5c0 7-4.5 14.5-19 24z"/>',
  fire: '<path d="M24 3c3 6 11 10 11 19a11 11 0 0 1-22 0c0-4.2 1.8-7.4 4.4-9.6.2 3.4 1.8 5.6 4.2 6.4C20 13 21.6 7.4 24 3z M24 21c2.6 3 4.5 4.8 4.5 7.5a4.5 4.5 0 0 1-9 0c0-2.7 1.9-4.5 4.5-7.5z"/><rect x="7" y="37" width="34" height="6" rx="3" transform="rotate(10 24 40)"/><rect x="7" y="37" width="34" height="6" rx="3" transform="rotate(-10 24 40)"/>',
  tent: `<path ${round} d="M24 7 5 41h38z M24 23l-7.5 18h15z"/>`,
  chat: `<path d="M12 8h24a7 7 0 0 1 7 7v13a7 7 0 0 1-7 7H23l-9 7.5V35h-2a7 7 0 0 1-7-7V15a7 7 0 0 1 7-7z ${ring(16, 21.5, 2.6)} ${ring(24, 21.5, 2.6)} ${ring(32, 21.5, 2.6)}"/>`,
};
const sticker = (name, cls = "") =>
  `<svg class="sticker-icon ${cls}" viewBox="0 0 48 48" width="48" height="48" fill="currentColor" fill-rule="evenodd" aria-hidden="true" focusable="false">${STICKERS[name] || STICKERS.star}</svg>`;

// The home page ribbon: a long, low wave. Each stripe is the center line pushed out
// along its normal (not just moved up or down), so the gaps stay even through every curve.
function ribbonPath(offset = 0) {
  const from = -800, to = 2800, mid = 130, amp = 54, k = (2 * Math.PI) / 1200;
  const pts = [];
  for (let x = from; x <= to; x += 12) {
    const y = mid - amp * Math.sin(k * (x - from));
    const slope = -amp * k * Math.cos(k * (x - from));
    const len = Math.hypot(1, slope);
    pts.push(`${(x + (offset * slope) / len).toFixed(1)} ${(y - offset / len).toFixed(1)}`);
  }
  return "M" + pts.join("L");
}

// "Nov 27 to 29", "Oct 30 to Nov 1", or with the year: "Nov 27 to 29, 2026".
function dates(start, end, withYear = false) {
  const a = parts(start);
  const b = parts(end || start);
  let out = `${MONTHS[a.m - 1]} ${a.d}`;
  if (a.y !== b.y) out += `, ${a.y} to ${MONTHS[b.m - 1]} ${b.d}`;
  else if (a.m !== b.m) out += ` to ${MONTHS[b.m - 1]} ${b.d}`;
  else if (a.d !== b.d) out += ` to ${b.d}`;
  return withYear ? `${out}, ${b.y}` : out;
}

export default function (eleventyConfig) {
  // Lets every link start with "/" and still work under /lssq-site/ or a preview folder.
  eleventyConfig.addPlugin(EleventyHtmlBasePlugin);

  eleventyConfig.addPassthroughCopy({ "src/assets": "assets", "src/brand": "brand", "src/img": "img", "src/admin": "admin" });
  // The homepage's scroll scenes use GSAP (ScrollTrigger) and Lenis, copied in from npm.
  eleventyConfig.addPassthroughCopy({
    "node_modules/gsap/dist/gsap.min.js": "assets/vendor/gsap.min.js",
    "node_modules/gsap/dist/ScrollTrigger.min.js": "assets/vendor/ScrollTrigger.min.js",
    "node_modules/lenis/dist/lenis.min.js": "assets/vendor/lenis.min.js",
    "node_modules/lenis/dist/lenis.css": "assets/vendor/lenis.css",
  });
  eleventyConfig.ignores.add("src/admin/**");

  eleventyConfig.addFilter("dates", dates);
  eleventyConfig.addFilter("day", (value) => parts(value).d);
  eleventyConfig.addFilter("mon", (value) => MONTHS[parts(value).m - 1]);
  eleventyConfig.addFilter("monthYear", (value) => `${MONTHS[parts(value).m - 1]} ${parts(value).y}`);
  eleventyConfig.addFilter("isPast", (data) => isPast(data));
  eleventyConfig.addFilter("head", (list, n) => (list || []).slice(0, n));

  // Countdown: from the first day's arrival time to the end of the last day, Pacific time.
  eleventyConfig.addFilter("startsAt", (data) => pacific(data.start, arrival(data.arrive)));
  eleventyConfig.addFilter("endsAt", (data) => pacific(addDays(lastDay(data), 1), "00:00"));
  eleventyConfig.addFilter("daysUntil", (value) => daysBetween(today(), value));
  eleventyConfig.addFilter("arrival", arrival);

  // Location: the spot is set once there are coordinates; until then, show when it drops.
  eleventyConfig.addFilter("revealDate", revealDate);
  eleventyConfig.addFilter("revealDue", (data) => revealDate(data) <= today());
  eleventyConfig.addFilter("latLng", latLng);
  eleventyConfig.addFilter("mapLink", (coords, kind = "google") => {
    const p = latLng(coords);
    if (!p) return "";
    return kind === "apple"
      ? `https://maps.apple.com/?daddr=${p.lat},${p.lng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
  });
  eleventyConfig.addFilter("mapEmbed", (coords) => {
    const p = latLng(coords);
    if (!p) return "";
    const box = [p.lng - 0.03, p.lat - 0.018, p.lng + 0.03, p.lat + 0.018].map((n) => n.toFixed(4)).join(",");
    return `https://www.openstreetmap.org/export/embed.html?bbox=${box}&layer=mapnik&marker=${p.lat},${p.lng}`;
  });

  eleventyConfig.addShortcode("icon", icon);
  eleventyConfig.addShortcode("sticker", sticker);
  eleventyConfig.addFilter("ribbonPath", ribbonPath);

  const events = (api) => api.getFilteredByTag("events");
  const byStart = (a, b) => iso(a.data.start).localeCompare(iso(b.data.start));

  // Soonest first. An event stays "upcoming" through its last day.
  eleventyConfig.addCollection("upcoming", (api) => events(api).filter((e) => !isPast(e.data)).sort(byStart));
  // Newest first. Events move here on their own once they're over (the site rebuilds daily).
  eleventyConfig.addCollection("past", (api) => events(api).filter((e) => isPast(e.data)).sort(byStart).reverse());

  return {
    dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    pathPrefix: process.env.PATH_PREFIX || "/",
  };
}
