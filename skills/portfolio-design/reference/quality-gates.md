# Quality gates

`scripts/qa/run_all.py` drives a real Chromium through the built site. Every check is something that actually went wrong while this design was being built, so treat a failure as a real bug until you've looked at the screenshot.

```bash
python scripts/qa/run_all.py --url http://127.0.0.1:4321/ --out portfolio/qa            # everything (10 to 15 minutes)
python scripts/qa/run_all.py --url http://127.0.0.1:4321/ --only smoke,chat             # a subset
python scripts/qa/run_all.py --url http://127.0.0.1:4321/ --full                        # overlap audit at 23 screen sizes
python scripts/qa/run_all.py --url https://their-domain/ --only smoke,live              # after deploying
python scripts/qa/run_all.py --url http://127.0.0.1:4321/ --browser "C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe" --only smoke
```

Output: PASS / WARN / FAIL lines, `report.md`, and screenshots (`shots/` for every screen at desktop and phone size, plus hero, lens, chat and any failing layout). Exit code 1 if anything failed. WARN means "look at it yourself", for example the particle field when the test browser has no WebGL.

## The checks

| Check | What it proves | Usual fix when it fails |
|---|---|---|
| `smoke` | No JavaScript errors on desktop or phone; the curtain lifts; the galaxy, name reveal and portrait load; the email isn't rewritten; the orb ring has its text; one `h1`; the header hides on scroll down and returns with its bar on scroll up | Read the error. A config typo (bad icon, missing image) is the common cause. |
| `shots` | Saves every screen for you to review | Nothing to fix; look at them. |
| `overflow` | At 23 screen sizes nothing sticks out sideways, display words aren't cut off in their boxes, and the hero name, intro, orb and links don't touch | Shorten the long text (title, intro, row title, alias, project name). |
| `overlap` | No two pieces of text overlap anywhere on the page at any scroll position, including while a "What I build" row is hovered (titles slide sideways) | Shorten the text that collides; the report names both elements and the scroll position. |
| `hover` | Row previews, the cursor label and the portrait lens all go away when the page scrolls under a pointer that doesn't move | A template regression; compare with the original template files. |
| `chat` | The mascot chat opens with a greeting, every quick question gets an answer, the chips keep coming after all topics are asked, Copy email and Take me there work, Escape closes it, it fits on a phone, a thrown ball gets a reaction | Usually a mascot config error: a topic without `q`/`a`, an `order` key that doesn't exist, an action with neither `go`, `href` nor `copy`. |
| `name` | Gradient-filled hero letters are drawn in full (text drawn with `background-clip: text` can lose the right edge of the last letter) | Keep the trailing padding in `.hero__word .ch` from the template. |
| `cursor` | The cursor dot is on the pointer within two frames and the ring settles | Don't add smoothing to the dot. |
| `preload` | With the portrait delayed by 3 s, the curtain waits for it and the percentage counts up | Keep `waitForReady()` in `main.js`. |
| `a11y` | axe-core finds no serious or critical issues (contrast, names, roles) | Usually a custom accent that is too dark or text on an image; pick a brighter accent. |
| `live` | Deployed site answers 200, email isn't rewritten by Cloudflare, unknown paths give a real 404, robots.txt, sitemap.xml, favicon and the share image are served | See `deploy.md`. |

## Look at it yourself

The automated checks can't judge taste. Before showing the person, go through `shots/` and check:

- The cut-out: clean hair edge, no halo, no background left between arm and body, head not cropped.
- Line breaks: no single word alone on the last line of the hero intro or About statement; project titles on one line.
- Images: project previews sharp and on-topic, nothing private visible in screenshots (tokens, emails, other people's data).
- Contrast of each project's `accent` against the dark card.
- The pit: logos recognisable, no blank balls (an unknown icon slug shows the name as text, which is fine for tier 3, odd for tier 1).
- The mascot's lines read naturally for this person.
- The share card (`assets/img/og.jpg`): name readable, portrait well placed.

## Known traps (already handled; keep them handled)

- **Cloudflare Email Address Obfuscation** rewrites any email it finds in the HTML into a `<span class="__cf_email__">` and a script. Inside the SVG `<textPath>` of the orb ring that breaks the ring in every browser. The build wraps email markup in `<!--email_off-->` and `<!--/email_off-->`, which Cloudflare respects. Don't remove them.
- **Hover states that outlive the pointer**: with smooth scrolling the page moves under a still mouse, and `mouseleave` never fires. Rows, cursor labels and the lens re-check what's under the pointer on scroll.
- **Preloader lifting too early** on slow connections showed a half-loaded hero. It now waits for fonts, the portrait, `load` and one rendered frame, with a timeout so it can never hang.
- **Cursor lag**: easing the dot made it feel broken. The dot is exact, only the ring eases.
- **Header bar** covering text when it slides back in: the backing bar only appears when the header returns over content.
- **Stale assets after a deploy**: every asset URL carries `?v=<build time>`, so browsers and CDNs fetch fresh files.
- **Phone chat** taller than the screen: it is capped to the viewport and scrolls inside.
- **Repos you didn't mean to show**: the archive uses the public API only and hides the profile README repo; still review the list with the person (`hidden` in the config).
