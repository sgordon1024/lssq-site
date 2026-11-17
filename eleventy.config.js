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
