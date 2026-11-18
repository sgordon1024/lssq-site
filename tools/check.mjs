// Checks the site's content before it can go live: `npm run check`.
// Every event and the site's words are checked against the same rules as the editor
// (the fields in src/admin/config.yml), plus a few more: dates in order, every photo
// there, described, small enough and not saying where it was taken. `npm run check`
// then builds the site. The messages are for whoever is updating the site.
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import sharp from "sharp";
import { ROOT, SRC, allPhotos, photoProblems, rel, PHOTO_TYPES, OTHER_TYPES, HEIC_TYPES } from "./photo-rules.mjs";

const problems = [];
const error = (file, msg) => problems.push({ file, msg, level: "error" });
const warning = (file, msg) => problems.push({ file, msg, level: "warning" });

const config = yaml.load(await readFile(path.join(SRC, "admin/config.yml"), "utf8"));
const eventRules = config.collections.find((c) => c.name === "events");
const wordRules = config.collections.find((c) => c.name === "site").files.find((f) => f.name === "words");

const empty = (v) => v === undefined || v === null || (typeof v === "string" && !v.trim()) || (Array.isArray(v) && !v.length);
const quote = (v) => `"${String(v).length > 60 ? String(v).slice(0, 57) + "..." : v}"`;
const used = new Map(); // photo path → where it's used

// --- One field, by the editor's widget type --------------------------------

const isoDate = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v));
const realDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().startsWith(s);

async function checkPhoto(file, label, value) {
  const v = String(value).trim();
  if (/^https?:/i.test(v)) return error(file, `${label}: use a photo saved in the site, not a link to one. Photos go in src/img/uploads/.`);
  if (!v.startsWith("/img/")) return error(file, `${label}: ${quote(v)} should start with /img/, like /img/uploads/joshua-tree-1.jpg.`);
  // Match each part of the path exactly. A Mac doesn't mind capital letters; the live site does.
  let dir = SRC;
  for (const part of v.split("/").filter(Boolean)) {
    const names = await readdir(dir).catch(() => []);
    if (!names.includes(part)) {
      const near = names.find((n) => n.toLowerCase() === part.toLowerCase());
      if (near) return error(file, `${label}: the photo is there, but it's called ${near}, not ${part}. Capital letters have to match.`);
      return error(file, `${label}: can't find the photo ${v}. Check the name and that it's in src${path.posix.dirname(v)}/.`);
    }
    dir = path.join(dir, part);
  }
  if (!used.has(v)) used.set(v, `${file} (${label})`);
}

async function checkField(file, rule, value, label) {
  const required = rule.required !== false && rule.widget !== "boolean" && rule.widget !== "hidden";
  if (empty(value)) {
    if (required) error(file, `${label} is missing.`);
    return;
  }
  switch (rule.widget) {
    case "string":
    case "text":
    case "markdown": {
      if (typeof value === "object" && !(value instanceof Date)) return error(file, `${label} should be words, not a list.`);
      const [pattern, why] = rule.pattern || [];
      if (pattern && !new RegExp(pattern).test(String(value))) error(file, `${label}: ${quote(value)}. ${why}.`);
      return;
    }
    case "datetime": {
      if (rule.format === "HH:mm") {
        const ok = typeof value === "number" ? value >= 0 && value < 1440 : /^([01]?\d|2[0-3]):[0-5]\d$/.test(String(value));
        if (!ok) error(file, `${label}: ${quote(value)} should be a time like "14:00" (24-hour, in quotes).`);
        return;
      }
      if (!realDate(isoDate(value))) error(file, `${label}: ${quote(isoDate(value))} should be a date like 2026-03-27.`);
      return;
    }
    case "image":
      return checkPhoto(file, label, value);
    case "boolean":
      if (typeof value !== "boolean") error(file, `${label} should be true or false.`);
      return;
    case "select": {
      const choices = (rule.options || []).map((o) => (typeof o === "object" ? o.value : o));
      const picked = rule.multiple ? value : [value];
      if (!Array.isArray(picked)) return error(file, `${label} should be a list of choices.`);
      for (const p of picked) if (!choices.includes(p)) error(file, `${label}: ${quote(p)} isn't one of the choices: ${choices.join(", ")}.`);
      if (rule.max && picked.length > rule.max) error(file, `${label}: pick up to ${rule.max}, not ${picked.length}.`);
      return;
    }
    case "list": {
      if (!Array.isArray(value)) return error(file, `${label} should be a list.`);
      if (rule.max && value.length > rule.max) error(file, `${label}: up to ${rule.max}, not ${value.length}.`);
      if (rule.min && value.length < rule.min) error(file, `${label}: at least ${rule.min}.`);
      for (const [i, item] of value.entries()) {
        const where = `${label} ${i + 1}`;
        if (rule.field) await checkField(file, rule.field, item, where);
        else if (rule.fields) await checkObject(file, rule.fields, item, where);
      }
      return;
    }
    case "object":
      return checkObject(file, rule.fields, value, label);
  }
}

async function checkObject(file, rules, value, label = "") {
  const at = (r) => (label ? `${label}, ${r.label}` : r.label);
  if (typeof value !== "object" || value === null || Array.isArray(value)) return error(file, `${label || "This"} should be a group of fields.`);
  for (const rule of rules) await checkField(file, rule, value[rule.name], at(rule));

  // Every photo needs a description of what's in it, for people who can't see it.
  for (const rule of rules.filter((r) => r.widget === "image")) {
    if (empty(value[rule.name])) continue;
    const alt = rules.find((r) => r.name === `${rule.name}Alt` || (rule.name === "photo" && r.name === "alt"));
    if (alt && empty(value[alt.name])) error(file, `${at(alt)} is missing. Say in a sentence what's in the photo, for people who can't see it.`);
  }

  const known = new Set(rules.map((r) => r.name));
  for (const key of Object.keys(value)) {
    if (!known.has(key) && key !== "body") warning(file, `${label ? label + ": " : ""}"${key}" isn't a field the site knows, so it won't show. Known fields: ${[...known].join(", ")}.`);
  }
}

// --- Events -----------------------------------------------------------------

const eventDir = path.join(ROOT, eventRules.folder);
const eventFiles = (await readdir(eventDir)).filter((f) => f.endsWith(".md")).sort();
const frontRules = eventRules.fields.filter((r) => r.name !== "body");
const bodyRule = eventRules.fields.find((r) => r.name === "body");

for (const name of eventFiles) {
  const file = `${eventRules.folder}/${name}`;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*\.md$/.test(name)) error(file, `The file name becomes the page address, so use lowercase letters, numbers and dashes only, like joshua-tree-weekend.md.`);
  const text = await readFile(path.join(eventDir, name), "utf8");
  const parts = text.match(/^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n([\s\S]*))?$/);
  if (!parts) {
    error(file, "The details at the top need to sit between two lines of three dashes (---), with the description below.");
    continue;
  }
  let data;
  try {
    data = yaml.load(parts[1]) || {};
  } catch (e) {
    error(file, `The details at the top can't be read (line ${(e.mark?.line ?? 0) + 2}): ${e.reason}. Often it's a colon or # in a value: put the whole value in "quotes".`);
    continue;
  }
  await checkObject(file, frontRules, data);
  await checkField(file, bodyRule, parts[2] || "", bodyRule.label);
  if (/\{[{%]/.test(parts[2] || "")) error(file, `${bodyRule.label}: take out the {{ or {% in it. The site reads those as code.`);

  const start = isoDate(data.start);
  const end = data.end ? isoDate(data.end) : "";
  if (realDate(start) && end && realDate(end) && end < start) error(file, `The last day (${end}) is before the first day (${start}).`);
  if (realDate(start) && data.reveal && realDate(isoDate(data.reveal)) && isoDate(data.reveal) > start) {
    warning(file, `The spot drops on ${isoDate(data.reveal)}, after the event starts (${start}).`);
  }
}

// --- The site's words -------------------------------------------------------

try {
  const words = JSON.parse(await readFile(path.join(ROOT, wordRules.file), "utf8"));
  await checkObject(wordRules.file, wordRules.fields, words);
} catch (e) {
  if (e instanceof SyntaxError) error(wordRules.file, `It can't be read: ${e.message}. Often it's a missing comma or quote mark near there.`);
  else throw e;
}

// --- Every photo file -------------------------------------------------------

const photos = await allPhotos();
for (const full of photos) {
  const file = rel(full);
  const ext = path.extname(full).toLowerCase();
  const web = "/" + path.relative(SRC, full).split(path.sep).join("/");
  if (HEIC_TYPES.includes(ext)) {
    error(file, "This is an iPhone HEIC photo, which browsers can't show. Run npm run photos on a Mac to turn it into a JPEG, or save it as a JPEG.");
    continue;
  }
  if (!PHOTO_TYPES.includes(ext) && !OTHER_TYPES.includes(ext)) {
    error(file, `The site can't use ${ext || "this kind of"} files. Use JPEG, PNG or WebP photos.`);
    continue;
  }
  if (PHOTO_TYPES.includes(ext)) {
    const input = await readFile(full);
    const meta = await sharp(input).metadata().catch(() => null);
    if (!meta) error(file, "This photo can't be opened. It may be damaged; try saving it again.");
    else for (const why of photoProblems(meta, input.length)) error(file, `${why[0].toUpperCase()}${why.slice(1)}. Run npm run photos to fix it.`);
  }
  if (!used.has(web)) warning(file, "No page uses this photo. Delete it if it's not needed.");
}

// --- Report -----------------------------------------------------------------

const errors = problems.filter((p) => p.level === "error");
const warnings = problems.filter((p) => p.level === "warning");
const byFile = new Map();
for (const p of problems) byFile.set(p.file, [...(byFile.get(p.file) || []), p]);
for (const [file, list] of byFile) {
  console.log(`\n${list.some((p) => p.level === "error") ? "✗" : "!"} ${file}`);
  for (const p of list) console.log(`  ${p.level === "error" ? "-" : "~"} ${p.msg}`);
}
if (process.env.GITHUB_ACTIONS) {
  for (const p of problems) console.log(`::${p.level} file=${p.file}::${p.msg.replace(/\n/g, " ")}`);
}

const counted = `${eventFiles.length} events, the site's words and ${photos.length} photos`;
if (errors.length) {
  console.log(`\n✗ ${errors.length} thing${errors.length === 1 ? "" : "s"} to fix in ${counted}. Nothing can go live until they're fixed.`);
  process.exitCode = 1;
} else {
  console.log(`\n✓ Checked ${counted}. All good${warnings.length ? ` (${warnings.length} note${warnings.length === 1 ? "" : "s"} above, nothing blocking)` : ""}.`);
}
