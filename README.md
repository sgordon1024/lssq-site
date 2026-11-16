# LSSQ site

A sample site for Last Saturday Side Quest, built so Jake can update it without a developer. **It isn't LSSQ's official site.** That's [lastsaturdaysidequest.odoo.com](https://lastsaturdaysidequest.odoo.com/). This is part of the [LSSQ Workshop](https://sgordon1024.github.io/lssq/), and the upcoming events in it are made up.

- **Live:** https://sgordon1024.github.io/lssq-site/
- **Editor:** https://sgordon1024.github.io/lssq-site/admin/

## How editing works

1. Sign in to the editor with GitHub.
2. Change an event or the site words, then **Save**. Every save is a draft (a pull request), so nothing goes live by accident.
3. A preview builds in about two minutes. **View preview** in the editor opens it.
4. **Publish** when it looks right. The live site updates in about a minute.

Past events move to "Where we've been" on their own. The site rebuilds every night.

## What's where

| Path | What it is |
| --- | --- |
| `src/events/*.md` | One file per event: details up top, the description below |
| `src/_data/site.json` | The words on the home and contact pages |
| `src/_includes/` | Page layouts and shared pieces |
| `src/assets/site.css`, `site.js` | The design, and two small touches (the logo's first-visit draw-in, the stripe echo on phones) |
| `src/brand/` | Logo and pattern SVGs, copied from the workshop repo. Change them there, not here |
| `src/admin/` | The editor (Decap CMS) and its settings |
| `auth/` | The editor's sign-in helper, a small Cloudflare Worker |
| `.github/workflows/` | `deploy.yml` puts `main` live; `preview.yml` builds a preview of every pull request |
| `eleventy.config.js` | The build (Eleventy): dates, upcoming and past events |

## Run it locally

```bash
npm install
npm start
```

Then open http://localhost:8080. To try the editor against the files on disk, run `npm run cms` in a second terminal and open http://localhost:8080/admin/.

## Set up sign-in (one time)

The editor signs in through the worker in `auth/`, which holds the GitHub secret so the public site never does.

1. `cd auth`, then `npx wrangler login` and `npx wrangler deploy`. Note the address it prints.
2. Create a GitHub OAuth App (GitHub, Settings, Developer settings, OAuth Apps). Homepage: `https://sgordon1024.github.io/lssq-site/`. Callback: the worker address plus `/callback`.
3. `npx wrangler secret put GITHUB_CLIENT_ID`, then `npx wrangler secret put GITHUB_CLIENT_SECRET`.
4. Put the worker address in `src/admin/config.yml` as `base_url`.

To let someone edit, add them as a collaborator on this repo. They need a free GitHub account.

## Good to know

- Event dates are `YYYY-MM-DD`. "Today" is Pacific time.
- Links in templates start with `/`. The build adds `/lssq-site/` (or the preview's folder) from `PATH_PREFIX`.
- The brand rules (colors, type, logo use) are on the workshop's [brand page](https://sgordon1024.github.io/lssq/brand/).
- GitHub pauses the nightly rebuild after 60 days with no commits. Turn it back on from the Actions tab.
