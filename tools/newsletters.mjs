// Newsletter templates live in newsletters/*.md. The {{name}} parts are filled from
// the site's events and words. The [[...]] parts are left for the assistant to write,
// or to ask Jake about. Used by `npm run newsletter` and checked by `npm run check`.
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import { ROOT, SRC } from "./photo-rules.mjs";

// The live site. Change this when it moves to its real address.
export const SITE_URL = "https://sgordon1024.github.io/lssq-site/";
export const TEMPLATE_DIR = path.join(ROOT, "newsletters");

// Same rules as the site (eleventy.config.js): Pacific time, arrive at noon unless
// it says otherwise, and the spot drops 30 days out unless `reveal` says otherwise.
const TZ = "America/Los_Angeles";
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const iso = (v) => (!v ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));
export const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const ymd = (v) => iso(v).split("-").map(Number);
const weekday = (v) => {
  const [y, m, d] = ymd(v);
  return DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
};
const addDays = (v, n) => {
  const [y, m, d] = ymd(v);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const lastDay = (e) => iso(e.end || e.start);
const isPast = (e) => lastDay(e) < today();

const longDate = (v) => `${weekday(v)}, ${MONTHS[ymd(v)[1] - 1]} ${ymd(v)[2]}`;
const shortDate = (v) => `${MONTHS[ymd(v)[1] - 1].slice(0, 3)} ${ymd(v)[2]}`;
function datesText(e) {
  const end = lastDay(e);
  return end === iso(e.start) ? longDate(e.start) : `${longDate(e.start)} to ${longDate(end)}`;
}
function shortDates(e) {
  const [start, end] = [iso(e.start), lastDay(e)];
  if (end === start) return shortDate(start);
  return start.slice(0, 7) === end.slice(0, 7) ? `${shortDate(start)} to ${ymd(end)[2]}` : `${shortDate(start)} to ${shortDate(end)}`;
}
// "14:00" → "2pm". YAML can read 12:00 as 720 (minutes), so accept that too.
function arriveText(v) {
  let hm = typeof v === "number" ? [Math.floor(v / 60), v % 60] : /^\d{1,2}:\d{2}$/.test(String(v || "")) ? String(v).split(":").map(Number) : [12, 0];
  const [h, m] = hm;
  if (h === 12 && m === 0) return "noon";
  if (h === 0 && m === 0) return "midnight";
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""}${h < 12 ? "am" : "pm"}`;
}
const mapLink = (coords) => {
  const m = String(coords || "").match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
  return m ? `https://www.google.com/maps/dir/?api=1&destination=${Number(m[1])},${Number(m[2])}` : "";
};
const list = (items) => items.map((i) => `- ${i}`).join("\n");
const ask = (what) => `[[${what}]]`;

// Everything a template can use, as {{name}}. Next weekend's facts are {{next.name}}.
function facts(e, site) {
  const reveal = iso(e.reveal) || addDays(e.start, -30);
  const map = mapLink(e.coords);
  const donate = site.donate?.links || [];
  return {
    title: e.title,
    dates: datesText(e),
    shortDates: shortDates(e),
    firstDay: weekday(e.start),
    arrive: arriveText(e.arrive),
    place: e.place || "",
    region: e.region || "",
    where: [e.place, e.region].filter(Boolean).join(", ") || ask("Where it is. Ask Jake."),
    summary: e.summary || "",
    highlights: e.highlights?.length ? list(e.highlights) : ask("What's planned so far. Ask Jake, or cut this list."),
    bring: e.bring?.length ? list(e.bring) : ask("What to bring. Ask Jake."),
    chat: e.chat || ask("The chat link isn't on the site yet. Ask Jake, or cut this line."),
    spot: map || ask("The spot isn't on the site yet. Add its coordinates to the event first."),
    directions: e.directions || "",
    reveal: longDate(reveal),
    spotLine: map
      ? `Here's the spot: ${map}`
      : reveal <= today()
        ? ask(`The spot was due to drop on ${longDate(reveal)} but isn't on the site yet. Ask Jake when it will, or cut this line.`)
        : `The exact spot drops on ${longDate(reveal)}. We'll send it out.`,
    page: `${SITE_URL}events/${e.slug}/`,
    events: `${SITE_URL}events/`,
    site: SITE_URL,
    donate: donate.length ? list(donate.map((l) => `${l.label}: ${l.url}`)) : ask("The donation links. Ask Jake."),
    instagram: site.contact?.instagram || "",
  };
}
const NAMES = Object.keys(facts({ title: "", start: "2000-01-01", slug: "" }, {}));
export const KNOWN = [...NAMES, ...NAMES.map((n) => `next.${n}`)];

function splitFront(text) {
  const parts = text.match(/^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n([\s\S]*))?$/);
  if (!parts) throw new Error("The details at the top need to sit between two lines of three dashes (---), with the email below.");
  return { data: yaml.load(parts[1]) || {}, body: parts[2] || "" };
}

export async function loadEvents() {
  const dir = path.join(SRC, "events");
  const events = [];
  for (const name of (await readdir(dir)).filter((f) => f.endsWith(".md"))) {
    try {
      const { data } = splitFront(await readFile(path.join(dir, name), "utf8"));
      if (data.title && data.start) events.push({ ...data, slug: name.slice(0, -3) });
    } catch {
      // An event that can't be read is the check's job to report.
    }
  }
  return events.sort((a, b) => iso(a.start).localeCompare(iso(b.start)));
}

export const loadSite = async () => JSON.parse(await readFile(path.join(SRC, "_data/site.json"), "utf8"));

export async function loadTemplates() {
  const names = (await readdir(TEMPLATE_DIR).catch(() => [])).filter((f) => f.endsWith(".md") && f !== "README.md").sort();
  const templates = [];
  for (const name of names) {
    const t = { slug: name.slice(0, -3), file: `newsletters/${name}` };
    try {
      Object.assign(t, splitFront(await readFile(path.join(TEMPLATE_DIR, name), "utf8")));
    } catch (e) {
      t.error = e.mark ? `The details at the top can't be read (line ${e.mark.line + 2}): ${e.reason}. Often it's a colon or # in a value: put the whole value in "quotes".` : e.message;
    }
    templates.push(t);
  }
  return templates;
}

// Plain-words problems with one template, for the check.
export function templateProblems(t) {
  if (t.error) return [t.error];
  const out = [];
  const d = t.data;
  if (typeof d.name !== "string" || !d.name.trim()) out.push("Give it a name, like: name: The next weekend");
  if (typeof d.send !== "string" || !d.send.trim()) out.push("Say when to send it, like: send: About a month out.");
  if (!["next", "last"].includes(d.event)) out.push('Say which weekend it\'s about: "event: next" for the next one, or "event: last" for the one that just happened.');
  if (!Array.isArray(d.subjects) || !d.subjects.length || d.subjects.some((s) => typeof s !== "string")) out.push("Give it at least one subject line under subjects:");
  if (!t.body.trim()) out.push("The email itself goes below the details.");
  const text = [t.body, ...(Array.isArray(d.subjects) ? d.subjects : [])].join("\n");
  for (const [, name] of text.matchAll(/\{\{\s*([^}]*?)\s*\}\}/g)) {
    if (!KNOWN.includes(name)) out.push(`{{${name}}} isn't something the site knows. These are: ${NAMES.join(", ")}, and next. before any of them for the weekend after.`);
  }
  if (/[{}]/.test(text.replace(/\{\{[^{}]*\}\}/g, ""))) out.push("There's a stray { in it. The parts the site fills in look like {{title}}.");
  return out;
}

// Fills one template. Picks the event from `slug`, or else from the template's `event`.
export function render(t, events, site, slug) {
  let e;
  if (slug) {
    e = events.find((x) => x.slug === slug);
    if (!e) throw new Error(`There's no event called ${slug}. The events are: ${events.map((x) => x.slug).join(", ")}.`);
  } else if (t.data.event === "last") {
    e = events.filter(isPast).at(-1);
    if (!e) throw new Error("No weekend has happened yet, so there's nothing to say thanks for.");
  } else {
    e = events.find((x) => !isPast(x));
    if (!e) throw new Error("There's no upcoming weekend on the site yet. Add it first.");
  }
  const after = events.find((x) => iso(x.start) > iso(e.start) && !isPast(x));
  const own = facts(e, site);
  const next = after ? facts(after, site) : null;
  const value = (name) => (name.startsWith("next.") ? next?.[name.slice(5)] : own[name]);
  const fill = (line) => line.replace(/\{\{\s*([^}]*?)\s*\}\}/g, (_, name) => value(name) ?? "");

  const lines = [];
  for (const line of t.body.split(/\r?\n/)) {
    if (!next && /\{\{\s*next\./.test(line)) {
      lines.push(ask("There's no next weekend on the site yet. Add it first, or cut this line."));
      continue;
    }
    const only = line.match(/^\s*\{\{\s*([^}]*?)\s*\}\}\s*$/);
    if (only && !value(only[1])) continue; // a line that's only an empty fact, like no directions
    lines.push(fill(line));
  }
  const body = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return {
    event: e,
    subjects: t.data.subjects.map(fill),
    body,
    todo: (body.match(/\[\[/g) || []).length,
  };
}
