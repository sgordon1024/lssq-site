// Drafts a newsletter from a template and the site: `npm run newsletter -- <template> [event]`.
// With no template, it lists them. It only prints the draft. It never sends anything.
import { loadTemplates, loadEvents, loadSite, render, templateProblems } from "./newsletters.mjs";

const [slug, eventSlug] = process.argv.slice(2);
const templates = await loadTemplates();

if (!slug) {
  console.log("Newsletter templates. Run npm run newsletter -- <name> to draft one.\n");
  for (const t of templates) console.log(`  ${t.slug.padEnd(18)} ${t.data?.name || "?"}. ${t.data?.send || ""}`);
  process.exit(0);
}

const t = templates.find((x) => x.slug === slug);
if (!t) {
  console.log(`✗ There's no template called ${slug}. They are: ${templates.map((x) => x.slug).join(", ")}.`);
  process.exit(1);
}
const problems = templateProblems(t);
if (problems.length) {
  console.log(`✗ ${t.file} needs fixing first:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}

let draft;
try {
  draft = render(t, await loadEvents(), await loadSite(), eventSlug);
} catch (e) {
  console.log(`✗ ${e.message}`);
  process.exit(1);
}

const line = "-".repeat(60);
console.log(`${t.data.name}, for ${draft.event.title} (${draft.event.slug})`);
if (draft.event.sample) console.log("! This event is a made-up sample, not a real weekend.");
console.log(`\nSubject, pick one:\n${draft.subjects.map((s) => `  ${s}`).join("\n")}\n\n${line}\n${draft.body}\n${line}\n`);
console.log(
  draft.todo
    ? `${draft.todo} part${draft.todo === 1 ? "" : "s"} in [[ ]] to write or cut. Then it's ready to paste into Gmail, with everyone in BCC.`
    : "Ready to paste into Gmail, with everyone in BCC.",
);
