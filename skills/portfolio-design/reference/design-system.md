# Design system

What the site is made of, so you can explain it, tune it within its rules, and know what not to touch.

## Page order

1. **Preloader**: the alias in huge outlined type fills with colour as a percentage counts up. It waits for the fonts, the portrait, the window load and the first rendered frame, so the hero never pops in half-built.
2. **Hero**: first and last name in giant type (left), title under it, intro and a "see the work" link (top right), the cut-out portrait centred in a WebGL particle galaxy, an outlined marquee of the alias running behind the portrait, the round "Let's talk" orb with the email circling it, hero links and a live local clock along the bottom.
3. **About**: a statement that lights up word by word as you scroll, a square photo, two paragraphs, a sign-off.
4. **What I build**: four huge one-word rows. On hover a card with an animated SVG follows the cursor; on touch screens the animation sits inside the row.
5. **Selected work**: project cards that stack on top of each other as you scroll. Each has a framed preview (with view toggles when there are several images), a fake address bar, the title, tagline, description, stack and links.
6. **Side quests**: up to three small cards with images.
7. **Archive**: every public GitHub repo, live, with language filters, search, a "show all" toggle and an "include forks" switch.
8. **Bands**: two crossing tape strips of phrases, one outlined, one on the accent colour.
9. **Stack**: a physics pit of tool logos you can grab and throw, with grouped lists under it.
10. **Process**: three steps along a line that fills as you scroll.
11. **Contact**: "Let's talk." with an accent full stop, the email in big type, Email and Copy buttons, a grid of profile links.
12. **Footer**: the alias as a giant outlined wordmark (letters fill on hover), a short line, nav, back to top.

Fixed layers on top: grain, custom cursor, header that hides while scrolling down and returns with a backing bar on scroll up, a scroll progress line, the mascot, a toast for copy confirmations, the full-screen menu on small screens.

## Signature interactions

- **Particle galaxy** (`field.js`): a WebGL point cloud in the accent, signal and ice colours. It swirls around the portrait in the hero, flattens into a slow wave lower on the page and reacts to the pointer. It pauses while the tab is hidden; without WebGL 2 the page simply keeps its gradient backdrop.
- **Token view lens** (`portrait.js`): moving over the portrait opens a circular lens that renders the person as ASCII characters, like a model reading pixels. It only opens over the person (alpha-tested), closes when the page scrolls under a still pointer, and plays once on its own as a demo after load.
- **Name effects** (`name.js`): each letter swells as the pointer passes, one "hot" letter glows in the accent colour, a light streak crosses the name on reveal, and fast pointer flicks split the colour channels for a moment.
- **Custom cursor** (`cursor.js`): a dot that tracks the pointer exactly and a ring that trails slightly; it grows a label ("Open live", "View source") over previews and hides over text fields. Touch devices never see it.
- **Mascot** (`mascot.js`): a ghost in the corner that bobs, blinks, falls asleep when idle, comments as sections come into view, reacts to thrown balls and opens a chat with quick-question chips and action buttons (jump to a section, copy email, open a link). On phones it stays tucked away until the visitor scrolls past the hero.
- **Ball pit** (`pit.js`): canvas physics with drag, throw, collisions and gravity; logos are Simple Icons paths drawn into each ball.
- **Smooth scroll** (Lenis) and scroll-driven animation (GSAP ScrollTrigger, SplitText). Everything respects `prefers-reduced-motion`.

## Tokens

Colour roles (set by the theme preset, see `config-schema.md`):

| Token | Role |
|---|---|
| `--bg` `#07080b` | Page background, near black with a blue cast |
| `--ink` | Main text, off-white |
| `--muted`, `--dim` | Secondary and tertiary text |
| `--line` | Hairlines and borders |
| `--ember` (accent) | Buttons, the hot letter, highlights, links |
| `--signal` | Particle tint, secondary highlight, focus states |
| `--ice` | Particle tint, name gradient, the lens |

Type:

- **Mona Sans** (variable: weight 200 to 900, width 75% to 125%) for everything display and body. Display text runs at weight 800 to 880 and width 125% with tight negative tracking.
- **JetBrains Mono** for small labels: HUD tags, address bars, stack lines, numbers.

Both are self-hosted WOFF2 subsets in `template/assets/fonts/`.

Motion: `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)` for reveals, `--ease-io` for curtains. Reveals rise 20 to 40 px and fade in over 0.8 to 1.3 s with small staggers.

## Fitting long content

The layout scales instead of breaking:

- Hero name: `--name-fit` (build time, by letter count).
- Preloader and footer wordmark: `--alias-fit` (build time) plus a measured `--fit` on the footer word once fonts load.
- Contact heading: `--contact-fit` (build time).
- "What I build" titles: `--row-fit`, measured in the browser so all four shrink together.

If a person's content still collides, shorten the copy before changing CSS.

## What not to change

- Section order, the hero composition and the type scale. They are balanced against each other.
- The fonts. The whole display style depends on Mona Sans at 125% width.
- The dark background. Every colour, the grain and the particle blending assume it.
- The `<!--email_off-->` wrappers around the email markup (see `deploy.md`).
- Accessibility basics already in place: one `h1`, skip link, focus styles, `aria` on the chat and toggles, reduced-motion paths, alt text from the config.

Safe to change per person: all copy, the theme preset or custom accent/signal/ice colours, the mascot (name, lines, or off), images, the number of projects (1 to 6), side quests (0 to 3), pit contents, whether the archive and the About photo appear.
