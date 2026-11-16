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
