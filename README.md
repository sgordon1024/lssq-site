# LSSQ site

A sample site for Last Saturday Side Quest, built so Jake can update it without a developer. **It isn't LSSQ's official site.** That's [lastsaturdaysidequest.odoo.com](https://lastsaturdaysidequest.odoo.com/). This is part of the [LSSQ Workshop](https://sgordon1024.github.io/lssq/), and the upcoming events in it are made up.

- **Live:** https://sgordon1024.github.io/lssq-site/
- **Updating the site?** Start with [How to update the site](HOW-TO-UPDATE.md). AI assistants read [AGENTS.md](AGENTS.md) first.

## How editing works

**With an AI assistant (the main way).** Jake tells an assistant that can work on GitHub (Claude Code, Codex, Copilot and the like) what he wants. It follows [AGENTS.md](AGENTS.md): makes the change on a branch, runs `npm run check`, opens a pull request, sends him the preview link and publishes when he says so. `CLAUDE.md` and `GEMINI.md` point those tools at the same guide.

**Who can publish what.** `main` only takes pull requests, and only once the **check** passes. Content (events, `site.json`, photos, newsletter templates) can go live on that alone. Anything else needs Steve's review ([CODEOWNERS](.github/CODEOWNERS)), and GitHub asks him automatically. Steve's own code changes go in with an admin merge (`gh pr merge --admin`).

**With the editor (on hold).** The editor at `/admin/` works the same way, but it can't sign in until the helper below is set up. That waits until we know whether Jake wants a point-and-click editor as well. Its steps:

1. Sign in to the editor with GitHub.
2. Change an event or the site words, then **Save**. Every save is a draft (a pull request), so nothing goes live by accident.
3. A preview builds in about two minutes. **View preview** in the editor opens it.
4. **Publish** when it looks right. The live site updates in about a minute.

Past events move to "Where we've been" on their own. The site rebuilds every night.

**The spot.** The exact spot is usually picked about a month out. Until an event has **Coordinates**, its page says the spot is a secret and when it drops (the **Spot drops on** date, or 30 days before the first day). Add the coordinates and the page shows them with a Copy button, Google and Apple Maps buttons and a small map.

**The countdown** on each event's photo runs to **Arrive from** on the first day (noon if it's empty), Pacific time.

## What's where

| Path | What it is |
| --- | --- |
| `src/events/*.md` | One file per event: details up top, the description below |
| `src/_data/site.json` | The words on the home, story and contact pages, the ribbon lines, the pillars (what you'll find, three photos, four stickers, a handwritten note) and the past-weekend photos |
| `src/story.njk` | The Our story page |
| `src/img/lssq/` | Photos from LSSQ's own site |
| `src/img/stock/` | Stock photos from Unsplash, standing in until there are real ones |
| `src/_includes/` | Page layouts and shared pieces |
| `src/index.njk` | The home page: one long scroll of scenes (collage, ribbon, pillars, photo wall, next weekend, donate) |
| `src/assets/site.css`, `site.js` | The design, plus small touches: the stripe wipe between pages, the film grain, the logo drawing in, the countdowns, the Copy button, the stripe echo on phones |
| `src/assets/home.css`, `home.js` | The home page only: its scenes and their movement (smooth scroll, parallax, the sideways pillars) |
| `src/brand/` | Logo and pattern SVGs, copied from the workshop repo. Change them there, not here |
| `src/admin/` | The editor (Decap CMS) and its settings. `config.yml` is also the rulebook `npm run check` uses for every field |
| `src/img/uploads/` | New photos |
| `AGENTS.md` | The guide AI assistants follow to update the site (`CLAUDE.md` and `GEMINI.md` point to it) |
| `HOW-TO-UPDATE.md` | The one-page how-to for Jake |
| `tools/check.mjs` | `npm run check`: checks the content against the editor's rules and the photo rules, and the newsletter templates, in plain words |
| `newsletters/` | Newsletter templates. `{{ }}` parts are filled from the site, `[[ ]]` parts by the assistant or Jake |
| `tools/newsletter.mjs`, `newsletters.mjs` | `npm run newsletter -- <template> [event]`: drafts a newsletter from a template and the site. It only prints the draft. Jake sends it from his Gmail |
| `tools/photos.mjs`, `photo-rules.mjs` | `npm run photos`: gets new photos ready (upright, at most 2000px and 1 MB, no location data, HEIC to JPEG on a Mac) |
| `.github/CODEOWNERS` | Which changes need Steve's review (anything beyond content) |
| `auth/` | The editor's sign-in helper, a small Cloudflare Worker |
| `.github/workflows/` | `deploy.yml` puts `main` live; `preview.yml` builds a preview of every pull request; `check.yml` runs `npm run check` on every pull request, and `main` won't take one that fails |
| `eleventy.config.js` | The build (Eleventy): dates, upcoming and past events, the countdown and spot helpers, the line icons, the solid sticker icons (`{% sticker "name" %}`, for anything big or turned) and the ribbon's evenly spaced stripes |

## Run it locally

```bash
npm install
npm start
```

Then open http://localhost:8080. To try the editor against the files on disk, run `npm run cms` in a second terminal and open http://localhost:8080/admin/.

## Set up sign-in (one time, on hold)

The editor signs in through the worker in `auth/`, which holds the GitHub secret so the public site never does.

1. `cd auth`, then `npx wrangler login` and `npx wrangler deploy`. Note the address it prints.
2. Create a GitHub OAuth App (GitHub, Settings, Developer settings, OAuth Apps). Homepage: `https://sgordon1024.github.io/lssq-site/`. Callback: the worker address plus `/callback`.
3. `npx wrangler secret put GITHUB_CLIENT_ID`, then `npx wrangler secret put GITHUB_CLIENT_SECRET`.
4. Put the worker address in `src/admin/config.yml` as `base_url`.

To let someone edit, add them as a collaborator on this repo. They need a free GitHub account.

## Good to know

- **Photos have to be ready before they go in:** at most 2000px on the long side and 1 MB, with no location data (phones save where each photo was taken, and this repo is public). `npm run photos` does all of that, and the check fails until it's done. If the editor comes back, its uploads will need the same treatment, so it would need a build step that shrinks them.
- Event dates are `YYYY-MM-DD`. "Today" is Pacific time.
- Links in templates start with `/`. The build adds `/lssq-site/` (or the preview's folder) from `PATH_PREFIX`.
- The brand rules (colors, type, logo use) are on the workshop's [brand page](https://sgordon1024.github.io/lssq/brand/).
- **Photo credits:** every stock photo says so in its credit line, and the sample bar says some photos are stock. Unsplash photos are free to use under the Unsplash License. Swap them for real LSSQ photos when Jake has them.
- **Home page movement** uses [GSAP](https://gsap.com) with ScrollTrigger (free under GSAP's no-charge license) and [Lenis](https://lenis.darkroom.engineering) (MIT). Both come from npm and the build copies them into `assets/vendor/`, so nothing loads from another site. Only the home page loads them. With reduced motion, or if they fail to load, the home page is a plain scroll with nothing hidden.
- **The stripe wipe** covers the screen when you click a link to another page of the site, then lifts off the next page. It's skipped with reduced motion and for the editor, files and new tabs.
- GitHub pauses the nightly rebuild after 60 days with no commits. Turn it back on from the Actions tab.
