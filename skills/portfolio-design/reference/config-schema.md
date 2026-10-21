# portfolio.json reference

One JSON file describes the whole site. `scripts/build.mjs` fills every optional field with a default, so a minimal config only needs the fields marked **required**. File paths are relative to the config file. A full working example is in `examples/portfolio.example.json`.

Length limits are what the layout is tuned for. Going over doesn't break the build, but it makes the QA overlap and overflow checks more likely to fail, and the copy reads worse.

## site

| Field | Default | Notes |
|---|---|---|
| `url` | `https://example.com/` | The final public address with a trailing slash. Used for canonical links, the sitemap, the share image and `CNAME`. |
| `lang` | `en` | `<html lang>`. |
| `titleSuffix` | none | Appended to the page title for search: `Name (Alias) · Title \| suffix`. Keep it under 60 characters. |
| `description` | built from the person and hero intro | Meta description, 140 to 160 characters. |
| `ogDescription` | `hero.intro` | Text under the title on link previews, up to 110 characters. |
| `personDescription` | `description` | Description inside the JSON-LD Person record. |
| `twitter` | none | `@handle` for `twitter:site` and `twitter:creator`. |
| `keywords` | none | Array. Becomes `knowsAbout` in the structured data. |
| `cname` | written for custom domains | Set to `false` to skip writing a `CNAME` file. Never written for `*.github.io` or `example.com`. |

## person (required)

| Field | Default | Notes |
|---|---|---|
| `firstName` **required** | | Hero line one. Names up to 7 letters show at full size; longer ones are scaled down to fit. |
| `lastName` **required** | | Hero line two. Same scaling. |
| `title` **required** | | Under the name, e.g. `Product Engineer`. Up to 32 characters. |
| `email` **required** | | Contact section, orb ring, mascot actions, 404 page. |
| `alias` | first + last name joined | The handle: header logo, preloader, footer wordmark, HUD tag. Up to about 12 characters. |
| `location.city`, `.country` | none | Shown as `City, Country` (About caption, mascot). |
| `location.countryCode` | none | ISO code for structured data. |
| `location.timezone` | `UTC` | IANA name (`Europe/Lisbon`) for the live clock in the hero. |
| `languages` | `["English"]` | Feeds the default About sign-off: "Speaks English and Portuguese." |
| `languageCodes` | none | `["en", "pt"]` for structured data. |
| `photos.portrait` **required** | | Transparent cut-out from `prepare_photos.py`, about 900 px wide, height 1.3 to 1.45 times the width. |
| `photos.portraitAlt` | `Portrait of <full name>` | Describe clothing and expression. |
| `photos.about` | none | Square photo for the About section. Leave out to drop the image. |
| `photos.aboutAlt` | `Photo of <full name>` | |

## socials

Array in the order they should appear in the contact section:

```json
{ "network": "github", "url": "https://github.com/user", "handle": "@user" }
```

Known `network` values get the right icon, label and brand colour: `github`, `x`, `linkedin`, `youtube`, `instagram`, `discord`, `tiktok`, `twitch`, `bluesky`, `threads`, `mastodon`, `reddit`, `dribbble`, `behance`, `medium`, `devto`, `hashnode`, `substack`, `stackoverflow`, `huggingface`, `kaggle`, `leetcode`, `producthunt`, `telegram`, `whatsapp`, `spotify`, `website`. Anything else needs `label` and shows a globe icon. Optional per entry: `label`, `brand` (hex colour).

The `github` entry also switches on the repository archive (see `work.archive`).

## hero

| Field | Default | Notes |
|---|---|---|
| `intro` | generic line | Top right on desktop, under the portrait on phones. 120 to 200 characters. |
| `cta` | `See what I've shipped` | Link under the intro, scrolls to the work. Up to 26 characters. |
| `orb` | `Let's talk` | Label inside the round contact button. Up to 12 characters. |
| `heroLinks` | every social except `website` | Array of `network` names for the link row at the bottom of the hero, at most 4. |
| `hudTag`, `hudStatus` | `ID · <alias>`, `Status · online` | The small mono tags on the portrait frame. |

## about

| Field | Default | Notes |
|---|---|---|
| `label` | `About` | Section eyebrow. |
| `statement` | `I'm <first>, <alias> online.` | The big line that lights up word by word as you scroll. 90 to 190 characters. |
| `paragraphs` | `[]` | One or two paragraphs, 200 to 330 characters each. |
| `sign` | `Speaks <languages>.` | Short bold sign-off under the paragraphs. |
| `caption` | `City, Country` | Under the About photo. |

## build ("What I build")

| Field | Default | Notes |
|---|---|---|
| `label`, `heading`, `aside` | `What I build`, `Four things I could build in my sleep.`, generic | `heading` up to 48 characters. |
| `rows` **exactly 4** | | `{ "title", "description", "viz" }` |

Row `title`: one word, up to 11 characters (titles are huge; the page scales all four down together if the widest would not fit). `description`: up to 150 characters. `viz` is the animated preview that follows the cursor on hover:

| viz | Shows | Fits |
|---|---|---|
| `agents` | A planner node fanning out to tools and converging on "done" | AI agents, orchestration |
| `automation` | Boxes riding a conveyor through ingest / transform / ship | pipelines, bots, scripting |
| `context` | Documents turning into dots that cluster around a query | RAG, search, knowledge tools |
| `launch` | A browser window assembling itself, then a check mark | MVPs, products, launches |
| `code` | An editor typing lines, caret blinking, "build passing" | APIs, backends, libraries |
| `data` | Bars rising with a trend line tracing over them | dashboards, analytics, ML |
| `design` | Shapes breathing on a grid with a moving pointer | UI, design systems, brand |

## work

| Field | Default | Notes |
|---|---|---|
| `label`, `heading`, `aside` | `Selected work`, `Stuff I've shipped.`, generic | |
| `projects` **at least 1** | | Up to 6. Each one is a stacked card. |
| `sideQuestsHeading` | `Side quests` | |
| `sideQuests` | `[]` | Up to 3 smaller cards. |
| `archive` | on when a GitHub user is known | See below. |

### Project

| Field | Notes |
|---|---|
| `name` | Up to 16 characters. |
| `tagline` | One line, up to 60 characters. |
| `description` | 140 to 230 characters. What it does for someone, not how it's built. |
| `stack` | 3 to 6 short names, joined with ` / `. |
| `media` | 1 to 3 images: `{ "src", "alt", "label", "position" }`. Two or more add view toggle buttons (`label` names them). `position` is a CSS `object-position` such as `50% 0%` for tall screenshots. Wide images (16:9) work best. SVG, WebP, PNG, JPEG. |
| `links` | `{ "label", "href" }`. The first is the accent link and the target of the preview. |
| `accent` | Hex colour for the card's details. Pick it from the banner. |
| `address` | Text in the fake address bar under the preview (defaults to the first link without `https://`). |
| `note` | Small line such as a hackathon name. Optional. |
| `repo` | GitHub repo name: tags it "featured" in the archive. |
| `language` | Shown in the archive badge colour. |
| `cursor` | Cursor label over the preview. Defaults to `Open live`, or `View source` when the first link is GitHub. |
| `lightPreview` | `true` when the image has a light background (adds a dark frame). |

### Side quest

`{ "name", "description", "meta", "href", "image", "alt", "repo", "cursor" }`. `meta` is the small mono line (`Rust / CLI`). `description` up to 110 characters.

### archive

| Field | Default | Notes |
|---|---|---|
| `githubUser` | taken from the `github` social | Set to `null` to turn the archive off. |
| `heading` | `The rest of the pile` | |
| `note` | "Everything else on my GitHub, synced live..." | |
| `hidden` | `[]` | Repo names never to show. The profile README repo (same name as the user) is always hidden. |
| `fallbackDescriptions` | `{}` | `{ "repo": "text" }` for repos with no GitHub description. |

The archive loads live from the public GitHub API in the visitor's browser and falls back to `data/github.json` (written by `snapshot_github.mjs`) when rate limited.

## bands

Two tape strips that scroll across the page between Work and Stack.

| Field | Default |
|---|---|
| `outline` | `["Building", "Shipping", "Learning", "Iterating"]` (outlined text) |
| `accent` | `["Ball knowledge", "Locked in", "Shipped, not pitched", "Always building"]` (on the accent colour) |

Four to six short phrases each, up to 22 characters per phrase.

## stack

| Field | Default | Notes |
|---|---|---|
| `label`, `heading`, `aside` | `Stack`, `Ball knowledge.`, `Every tool in my rotation, in one pit. Grab one and throw it.` | |
| `groups` | `[]` | `{ "title", "items": [...] }`, 3 to 5 groups listed under the pit. |
| `pit` | `[]` | The balls. 12 to 24 entries. |

Pit entry: `{ "name", "icon", "color", "tier" }`. `icon` is a Simple Icons slug; the 200+ bundled ones are in `data/simple-icons.json` (others are fetched from the Simple Icons CDN at build time). `color` is the ball's tint (defaults to the brand colour). `tier`: `1` big, `2` medium (default), `3` small text-only ball. Without an `icon` the ball shows its name.

## process

`label` (`How it goes`), `heading` (`Idea in. Working thing out.`), and `steps`: **exactly 3** `{ "title", "text" }`. Title up to 22 characters, text up to 120.

## contact

| Field | Default |
|---|---|
| `label` | `Contact` |
| `heading` | `Let's talk` (up to 14 characters; it is scaled to fit) |
| `lede` | "Got an idea or a deadline closing in? Send it over. I read everything and reply fast." |
| `emailSubject` | `Hey <first>` |
| `emailButton`, `copyButton` | `Email me`, `Copy address` |

## footer

`line`: `<Full name>. <Title>.`

## theme

```json
{ "preset": "ember" }
```

| Preset | Accent | Signal | Ice |
|---|---|---|---|
| `ember` | `#ff6b3d` orange | `#8b9cff` | `#6fe3ff` |
| `acid` | `#c4f542` lime | `#6ee7c8` | `#7cc4ff` |
| `violet` | `#9b7bff` violet | `#6fe3ff` | `#ff8ad8` |
| `rose` | `#ff4d8d` pink | `#a78bfa` | `#7ee0ff` |
| `gold` | `#ffb547` amber | `#8b9cff` | `#6fe3ff` |
| `aqua` | `#2ee6c5` teal | `#8b9cff` | `#ffd36e` |

Override any of `accent`, `signal`, `ice` with a hex value. Accent is buttons, highlights and the hot letter in the name; signal and ice tint the particle galaxy, the name gradient and the lens. Keep the accent bright: it sits on a near-black background and carries dark text inside buttons.

## mascot

A small ghost that floats in the corner, drops one-line comments as sections scroll into view, and opens a chat with quick-question chips.

| Field | Default | Notes |
|---|---|---|
| `enabled` | `true` | `false` removes it entirely. |
| `name` | `Grim` | |
| `hello` | "yo, i'm <name>. <first>'s ghost..." | First bubble. |
| `whoLine` | generic | Second line of the "Who's <first>?" answer. |
| `buildLine` | generic | Bubble at the "What I build" section. |
| `stackLine` | generic | First line of the stack answer. |
| `favoriteReason` | the first project's tagline | Why the mascot's favourite project (the first one) is its pick. |
| `extraTopic` | none | One extra chat topic: `{ "q", "a": [lines], "actions": [{ "label", "go": "#section" } or { "label", "href" }] }`. |
| `lines` | defaults per section | Override any bubble: keys `hello`, `build`, `work`, `archive`, `stack`, `contact`, `footer`, `idle`, `fast`, `copied`. Each `{ "text", "topic" }`. |
| `greetings` | defaults | `{ "first": [...], "woken": [...], "again": [...] }` lines when the chat opens. |
| `throws` | defaults | Reactions when a ball is thrown hard in the pit. |
| `phone` | defaults | Answers to "What's on your phone?", rotated. |
| `topics` | who, work, stack, hire, contact, phone | Override or add topics: `{ "key": { "q", "a", "actions" } }`. |
| `order` | `["who", ("extra"), "work", "contact", "stack", "hire"]` | Which chips appear first. |

The default voice is lowercase, dry and online. Rewrite the lines when it doesn't fit the person; see `copywriting.md`.

## seo

`consoleTitle`: the line printed in the browser console for curious visitors.
