---
name: portfolio-design
description: Interviews a person and builds them a complete, award-style personal portfolio site in one design (WebGL particle galaxy, cut-out portrait with an ASCII "token view" lens, animated name, custom cursor, chat mascot, physics ball pit of their tools, live GitHub archive), then previews it, runs browser QA and deploys it once they approve. Use when someone asks for a portfolio, personal website, developer homepage or "a site like grimnej.com".
---

# Portfolio Design

This skill rebuilds one specific portfolio design for anyone. The design is fixed and already tuned. Your job is to collect the person's material, write their copy in the right voice, generate the site, prove it works and ship it when they say so.

Everything lives in this skill folder:

| Path | What it is |
|---|---|
| `template/assets/` | The site's CSS, JavaScript modules, fonts and vendor libraries (GSAP, Lenis). Never edit per person: the build copies and themes it. |
| `scripts/build.mjs` | Turns a `portfolio.json` into the finished static site. Node 18+, no dependencies. |
| `scripts/prepare_photos.py` | Cuts the portrait out (background removal) and squares the about photo. |
| `scripts/discover_github.mjs` | Lists a GitHub user's public repos with README taglines and banner images, to pick projects. |
| `scripts/snapshot_github.mjs` | Saves the public repo list the archive falls back to. |
| `scripts/render_images.py` | Renders the share card (`og.jpg`) and the touch icon. |
| `scripts/serve.py` | Local preview server for the built site. |
| `scripts/qa/run_all.py` | Browser quality gates. A build is not done until it passes. |
| `examples/portfolio.example.json` | A complete config for a fictional person, with placeholder images. |
| `reference/` | Config schema, interview script, design system, copy rules, QA gates, deploy guide. |

In the commands below, `scripts/...` means this skill's folder (use the absolute path when you run them) and `portfolio/...` is the person's project folder in their working directory.

Read `reference/config-schema.md` before writing a config and `reference/copywriting.md` before writing any copy.

## Ground rules

- **Nothing goes public without a clear yes.** No `git push`, no deploy, no repo creation until the person approves that specific step. Building and previewing locally is fine.
- **Privacy.** Only public GitHub data is ever used (both GitHub scripts call the unauthenticated API on purpose). Before the archive goes live, show the list of public repos it will display and ask which to hide. Never put a phone number, street address or private repo on the page unless they ask for it.
- **Their photos stay theirs.** Work on copies inside the project folder. Don't upload them anywhere except the site they approve.
- **The design is the product.** Don't add sections, swap fonts or restyle components because a person asks for something vague. Adjust content, theme preset, mascot and copy. If they want something structural, say what it would cost and confirm first.
- **Copy is written, not filled in.** Their notes are raw material. Draft every line in their voice, keep to the length limits and show it to them before building the final version.

## Workflow

### 1. Check the toolchain

```bash
node --version          # 18 or newer
python --version        # 3.10 or newer
python -m pip install playwright pillow numpy
python -m playwright install chromium
```

Background removal for the portrait needs `python -m pip install "rembg[cpu]"` (downloads a ~1 GB model on first run). If that isn't possible, ask for a portrait that already has a transparent background and use `--no-cutout`.

Agree on a project folder with the person (default: `./portfolio/` in the current directory). Layout:

```
portfolio/
  portfolio.json      # the config you write
  photos/             # their original photos (never published as-is)
  work/               # project banners and screenshots
  site/               # build output: this folder is what gets deployed
```

### 2. Interview

Follow `reference/interview.md`. It runs in ten short rounds and uses `AskUserQuestion` for every choice that has sensible options (theme, mascot, which repos to feature, which links go in the hero). Free-form material (bio notes, project descriptions) is asked for in plain text. Ask one round at a time, and offer to draft anything they don't feel like writing.

Areas, in order:

1. **Identity**: full name, the alias or handle they go by, a short title, email, city and country (timezone for the live clock), languages.
2. **Photos**: a head-and-shoulders portrait (the hero cut-out) and an optional second photo for the About section.
3. **Links**: every profile they want listed; pick two to four for the hero row.
4. **Hero and About**: what they do in one breath, then two short paragraphs about how they work.
5. **What they build**: four kinds of work, one word each, with a line of description and a hover animation (`agents`, `automation`, `context`, `launch`, `code`, `data`, `design`).
6. **Projects**: up to six featured projects and up to three side quests. Run `discover_github.mjs` first and propose candidates.
7. **Archive**: whether to show all public repos, and which to hide.
8. **Stack**: grouped tool lists, and the 12 to 24 tools that become balls in the pit.
9. **Process, contact, bands**: three process steps, the contact line, the two scrolling tape bands.
10. **Look and extras**: theme preset, mascot (name, voice, or off), site URL and where it will be hosted.

### 3. Gather project material

```bash
node scripts/discover_github.mjs --user <github-user> --out portfolio/discovery.json
node scripts/discover_github.mjs --user <github-user> --out portfolio/discovery.json --download portfolio/work --repos RepoA,RepoB
```

The first run lists public repos with their README tagline, images and live links. The second saves the first README image of each chosen repo. Every featured project needs at least one preview image. Good sources, in order: the README banner, a screenshot of the live app (use Playwright at 1600x900), a generated banner in the style of `examples/assets/*.svg`. Check each image: no secrets in screenshots, nothing blurry, wide format (16:9 or close).

### 4. Prepare the photos

```bash
python scripts/prepare_photos.py --portrait portfolio/photos/portrait.jpg \
  --about portfolio/photos/about.jpg --about-gray --out portfolio/photos/out
```

Open the result and look at it. The cut-out must have clean edges, no see-through patches and the head near the top. If the about photo crops a face badly, rerun with `--about-focus x,y` (0 to 1 fractions of the image). Point `person.photos.portrait` and `.about` in the config at the files in `out/`.

### 5. Write the config and build

Write `portfolio/portfolio.json` (schema: `reference/config-schema.md`; working example: `examples/portfolio.example.json`). Paths inside it are relative to the config file. Then:

```bash
node scripts/build.mjs --config portfolio/portfolio.json --out portfolio/site
node scripts/snapshot_github.mjs --user <github-user> --site portfolio/site   # only if the archive is on
python scripts/render_images.py --site portfolio/site
```

The build stops with a clear message when a required field is missing. Warnings about unknown icons mean that ball shows its name as text; pick a slug from `data/simple-icons.json` or leave it.

### 6. Preview

Serve the site in the background and give the person the URL:

```bash
python scripts/serve.py --site portfolio/site --port 4321
```

Use this server rather than `python -m http.server`: the stock one drops connections when the page requests many files at once, which shows up as random QA failures. It also sends no-cache headers (a rebuild shows on reload) and serves `404.html` for unknown paths like GitHub Pages.

### 7. Quality gates

```bash
python scripts/qa/run_all.py --url http://127.0.0.1:4321/ --out portfolio/qa
```

All checks must pass (`reference/quality-gates.md` explains each one and how to fix the usual failures). Then look at the screenshots in `portfolio/qa/shots/` yourself, section by section, desktop and phone. Automated checks catch collisions and overflow; your eyes catch awkward line breaks, weak images and copy that reads wrong. Fix, rebuild, rerun. Run `--full` once before deploying.

### 8. Review with the person

Walk them through the preview: hero, About, rows, projects, archive, pit, process, contact, mascot chat. Collect changes, apply them to the config (not to the built files), rebuild and rerun QA.

### 9. Deploy (only after a clear yes)

Follow `reference/deploy.md`: GitHub Pages (user site or project site), custom domain, and the Cloudflare settings that matter. After deploying, run the live checks:

```bash
python scripts/qa/run_all.py --url https://their-domain/ --only smoke,live --out portfolio/qa-live
```

If the "email not rewritten" check fails, Cloudflare's Email Address Obfuscation is on and breaking the "Let's talk" ring; the fix is in `reference/deploy.md`.

## Changing things later

Edit `portfolio.json`, rebuild, rerun QA, redeploy. Each build stamps new `?v=` version strings on every asset, so browsers and CDNs pick up the change without a manual cache purge.
