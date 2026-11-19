# Updating the LSSQ site: a guide for AI assistants

Read this before you change anything. Most people who ask for help here want to change what the site says: add an event, share a spot, swap a photo, fix some words, or write the newsletter. This guide covers that.

Changing the design or code is Steve Gordon's job, and the repo makes those changes wait for his OK. If that's what you're doing, the [README](README.md) covers how the site is built. The voice, privacy and check rules below still apply.

## Who you're helping

Usually it's Jake, who runs Last Saturday Side Quest (LSSQ). He isn't a web designer or a developer, and he shouldn't have to become one.

- Talk like a friend helping out: short sentences and plain words.
- Never use these words with him: pull request, PR, branch, commit, merge, push, deploy, repo, build, CI, YAML, JSON, Markdown, front matter, file path. Say "your change", "the preview", "publish" and "the site" instead.
- Do the whole job yourself. Don't ask him to edit files, run commands or use GitHub, except in the two cases below (photos you can't save, and a publish you can't do).
- Ask only what you need, one question at a time. Make sensible guesses for the rest and tell him what you guessed.
- If something goes wrong on your side, fix it. If you can't, tell him in one line and suggest he let Steve know.

## Every change, step by step

1. **Work out the change.** For a new event, the name, dates and rough area are enough to start. Everything else can come later.
2. **Make it on a new branch** named for the change, with dashes and no slashes, like `update-march-weekend`. Only change content (see Where things live).
3. **Run `npm run check`.** Run `npm install` first if you haven't. It checks the content against the rules below, then builds the site. Fix whatever it reports. If you can't run commands, skip this step: the same check runs when you open the pull request, and its result shows there.
4. **Open a pull request** with a plain title, like "Add the March weekend in Joshua Tree", and a sentence or two on what changed.
5. **Send the preview.** About two minutes after you open it, a preview of the whole site is at `https://sgordon1024.github.io/lssq-site/pr-preview/pr-<number>/`. A bot posts the same link on the pull request. Send him the link to the page that changed (for an event, add `events/<file name without .md>/`) and one line on what changed. Then ask: "Want me to publish it?"
6. **Make any changes** on the same branch. The preview updates about two minutes later.
7. **Publish only on a clear yes.** Squash and merge the pull request. The live site at https://sgordon1024.github.io/lssq-site/ updates about a minute later, so tell him it's live and give him the link. If you can't merge, send him the pull request's link and say: "Open this and press the green merge button, then confirm."

Two things can stop a publish:

- **The check failed.** It says what's wrong in plain words. Fix it and push again. Never try to publish around it.
- **It needs Steve's OK.** Anything beyond content (layout, styles, scripts, settings, this guide) waits for Steve's review, and GitHub asks him automatically. Tell Jake: "This one touches the design, so Steve has to OK it first." Avoid this by only changing content.

**Undo.** If he wants a published change undone, revert it on a new branch and go through the same steps.

## Where things live

| What | Where |
| --- | --- |
| Each event | `src/events/<name>.md`. Details at the top, a description below. The file name becomes the page address, `/events/<name>/`. |
| The words on the home, story, contact and donate sections, the ribbon lines, the four pillars and the photos from past weekends | `src/_data/site.json` |
| New photos | `src/img/uploads/` |
| Newsletter templates | `newsletters/`. The `{{ }}` parts come from the site. The `[[ ]]` parts are for you to fill in. |
| The rules for every field | `src/admin/config.yml`. Each field has a label and a hint. The check uses the same rules. |

Past events move to "Where we've been" on their own once their last day is over. There's nothing to do.

## Common jobs

### Add an event

Copy an upcoming event, like `src/events/baja-weekend.md`, to a new file named for the event: lowercase, dashes, no dates, like `joshua-tree-weekend.md`.

| Field | What goes in it |
| --- | --- |
| `title` | The name, like Joshua Tree Weekend. |
| `start`, `end` | The first and last day, like 2027-03-27. Leave `end` empty for a one-day event. |
| `arrive` | When people can roll in on the first day, 24-hour and in quotes, like "14:00". Empty means noon. The countdown runs to it. |
| `place` | Where, short and vague until the spot is shared, like "Desert outside Joshua Tree". |
| `region` | Like "California". |
| `summary` | One line for the events list. |
| `highlights` | Two to four short things people will do. |
| `photo`, `photoAlt`, `photoCredit` | A wide photo, a sentence on what's in it, and who took it. |
| `chat` | The WhatsApp invite link, once there is one. |
| `coords` | The exact spot. Leave it empty until he says it's OK to share (see below). |
| `directions` | Anything the map won't say. |
| `reveal` | When the spot will be shared. Empty means 30 days before the first day. |
| `bring` | What to bring. |
| `sample` | `false` for real events. |
| Below the details | A paragraph or two about the weekend, warm and short. |

### Share the spot

Put the coordinates in `coords` as "lat, long", like "34.1341, -116.3131", and anything tricky in `directions`. Until there are coordinates, the event page says the spot is a secret and when it drops.

### Add the chat link

Paste the full WhatsApp invite link into `chat`. It has to start with https://.

### Change or cancel an event

Change the fields. If an event is cancelled, ask whether he wants it off the site. If yes, delete its file.

### Change the words on a page

Edit `src/_data/site.json`. Keep each ribbon line under about 40 letters. There are always four pillars.

### Photos

- **Getting them.** Ask him to attach them in the chat. If you can save the attachments as files, put them in `src/img/uploads/` and run `npm run photos` before you commit, so their hidden data never lands in the change. Most assistants can only see attachments, though. Then push your branch and send him `https://github.com/sgordon1024/lssq-site/upload/<branch>/src/img/uploads` with: "Tap this link, tap **choose your files** and pick the photos. Then tap **Commit changes** and tell me when it's done." On a computer he can drag them onto that page instead. Then pull the branch and carry on.
- **Run `npm run photos`** after adding any. It turns them the right way up, shrinks big ones, and strips hidden data such as where they were taken. The check fails until that's done. On a Mac it also turns iPhone HEIC photos into JPEGs. Elsewhere, convert them to JPEG yourself, for example with ImageMagick or pillow-heif, then run it again.
- **Name them** for what they show, like `shastaween-campfire.jpg`, and use that name wherever the photo goes.
- **Choose where they go yourself.** For photos from a weekend, the best wide one becomes that event's photo if it still has a stock one, and two or three more join the photos from past weekends. Tell him which ones you used and where, and delete the ones you didn't use so they don't pile up. He can always ask for a different pick.
- **Write each description yourself** from looking at the photo: one sentence on what's in it, for people who can't see it. Don't ask him for it. If you can't look at photos, ask him what's in each one. The credit says who took it, like "Photo by Sam". Ask once who took them, and use "Photo from LSSQ" if he doesn't know.
- **Only use photos LSSQ is allowed to use:** ones Jake or the community took, of people who are happy to be online. Never use photos found on the web.
- **Swapping out stock photos is great.** Their credits say "Stock photo by ..., Unsplash". When he sends real ones, swap them in and update the description and credit.

### Write a newsletter

LSSQ's newsletter is an email Jake sends from his own Gmail, with everyone who signed up in BCC. You draft it, and he sends it.

1. **Pick the template** in `newsletters/` that fits. `npm run newsletter` lists them:
   - `next-weekend`: the main one each month, about a month out.
   - `spot-drop`: when the exact spot is ready to share. Add the coordinates to the event first.
   - `thank-you`: a few days after a weekend.
   - `lead-something`: asking people to lead an activity.
   - `change-of-plans`: new dates, a new spot, the weather or a cancellation. Update the event first.
2. **Run `npm run newsletter -- <template>`.** It fills in the facts from the site for the next weekend, or the last one for a thank-you. Add an event's file name to pick another, like `npm run newsletter -- spot-drop baja-weekend`. If you can't run commands, read the template and fill in the `{{ }}` parts from the event yourself.
3. **Fill in the `[[ ]]` parts.** Ask him for each, one at a time, or cut the line if he doesn't have it. Get the personal bits in his words, like what stood out and who to thank.
4. **Make it sound like him.** It's his email to friends: warm, loose and a bit playful. Keep his words when he writes them. Short paragraphs, with links on their own line.
5. **Send him the subject and the text** in the chat, ready to paste into a new Gmail message with everyone in BCC. If you can make Gmail drafts, make one, but never send it.

A newsletter isn't a change to the site, so there's nothing to publish or save. If the news changes the site too, like new dates or the spot, make that change first, the usual way.

## LSSQ's voice

Warm, playful and communal, like a friend inviting you along. Short sentences, talking to "you". The tagline sets the tone: "Different location every month. Same family every time."

- Good: "Bring whatever you're good at." "Your people are out here."
- Avoid hype ("epic", "unmissable"), corporate words, piles of exclamation marks, and dashes used as pauses. Use a comma or a period instead.
- If he writes the words himself, use them as he wrote them. Only fix typos.

## Never

- Never publish without a clear yes from him, or while the check is failing.
- Never share an event's exact spot before he says it's time.
- Never put personal details on the site, such as phone numbers, home addresses, or guests' names, emails or photos without their OK. The contact email is only for LSSQ's public address.
- Never remove the notes saying this is a sample and not LSSQ's official site. Steve takes those down when it becomes the real site.
- Never change anything beyond content. If he asks for a design change (colors, layout, a new section), say that's Steve's area and suggest he mention it to Steve.
- Never change who has access, or any settings.
- Never send a newsletter or any email yourself, and never put the mailing list or anyone's email address in the project.

## The check

`npm run check` reads every event, the site's words and every photo, using the same rules as `src/admin/config.yml`, then builds the site. Each problem comes with a plain fix. Lines starting with `~` are notes, like a photo no page uses. They don't block anything.
