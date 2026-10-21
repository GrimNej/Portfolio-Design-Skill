# Interview script

Ten short rounds. Ask one round at a time, wait for the answer, then move on. Use `AskUserQuestion` whenever the answer is a choice between a few options (it gives the person buttons plus a free-text "Other"); ask in plain text when you need their own words or files. If they say "you pick" or "skip", choose a sensible default, say what you chose, and keep going.

Keep a running draft of `portfolio.json` as you go, so nothing has to be asked twice. If they already have a site, CV or LinkedIn text, ask for it first and mine it for answers before asking.

## Round 1: identity

Plain text:

> Let's start with the basics. What's your full name, the handle you go by online, a short title for yourself (two to four words), and the email people should contact you at? Also: which city and country are you in, and which languages do you speak?

Check: name length (long first or last names are scaled down; fine, but warn if over 12 letters), title under 32 characters. Work out the IANA timezone from the city and confirm it.

## Round 2: photos

Plain text:

> I need two photos.
> 1. **Portrait** (required): head and shoulders, facing the camera or slightly turned, sharp, good light. A plain background helps but isn't required; I'll cut you out. Higher resolution is better.
> 2. **About photo** (optional): something more candid. It's shown square, and black and white works well.
> Send file paths.

Then run `prepare_photos.py` and show them the cut-out before going further. Ask with `AskUserQuestion`:

- question: "How does the cut-out look?"
- options: "Looks good" / "Edges are rough, try again" / "I'll send another photo"

For the About photo also ask: "Colour or black and white?" (options: "Black and white (Recommended)", "Keep colour").

## Round 3: links

Plain text: "List every profile you want on the site (GitHub, X, LinkedIn, YouTube, Instagram, Dribbble, a blog...), with URLs."

Then `AskUserQuestion`, `multiSelect: true`:

- question: "Which two to four should sit in the hero, right under your name?"
- options: up to four of their links (the ones a visitor would click first for their kind of work; GitHub for developers, Dribbble or Behance for designers, YouTube for creators).

## Round 4: hero and about

Plain text:

> Tell me in a sentence or two what you do and who for, the way you'd say it to a friend. Then a few notes on how you work: what you're fast at, what you won't do, anything people always say about working with you. Rough notes are fine; I'll write it up.

Draft `hero.intro`, `about.statement` and two `about.paragraphs` following `copywriting.md`, then show all of it in one message and ask for edits. Offer two directions if the voice is unclear.

## Round 5: what you build

`AskUserQuestion`, `multiSelect: true`:

- question: "Which kinds of work should the 'What I build' section show? Pick four."
- options (four per question, so ask twice if needed): "AI agents", "Automation", "Knowledge / RAG tools", "MVPs and products", "APIs and backends", "Data and dashboards", "Interfaces and design systems"; plus "Other" for their own.

Map each to a one-word row title and a viz (`agents`, `automation`, `context`, `launch`, `code`, `data`, `design`). Draft a description per row and show them.

## Round 6: projects

If they have GitHub, run `discover_github.mjs` first and summarise the most promising public repos (recent, with a README banner, a live link or stars). Then `AskUserQuestion`, `multiSelect: true`:

- question: "Which of these should be featured? Up to six; the rest can go in the archive."
- options: the four strongest candidates (ask again for more if they want).

For each chosen project, ask in plain text only for what discovery didn't find: what it does for the user (one or two sentences), a live link, a hackathon or client note, the preview image if there's no README banner. Then draft the name / tagline / description / stack and show them.

Side quests: "Any small tools or experiments worth a mention? Up to three." Same treatment, shorter.

No GitHub? Ask for projects directly: name, link, one paragraph, an image or a live URL to screenshot.

## Round 7: archive

Only when there's a GitHub account. Show the full public repo list that the archive will display, then `AskUserQuestion`:

- question: "The archive lists all your public repos, live. Keep it?"
- options: "Keep it (Recommended)", "Keep it, but hide some", "Turn it off"

On "hide some", ask which repos (plain text or multiSelect in batches). Flag anything that looks internal or personal (names containing `internal`, `test`, `private`, `old`, a client's name) and ask about those specifically. Only public repos can ever appear, but public isn't always meant to be featured.

## Round 8: stack

Plain text: "List the languages, frameworks and tools you actually use, roughly grouped (languages, frontend, backend, AI, cloud, design...). Star the ones you use every week."

Turn the starred ones into tier 1 balls, the rest into tier 2, small concepts (SQL, Evals, A11y) into tier 3 text balls. 12 to 24 balls total. Check icon slugs against `data/simple-icons.json`.

## Round 9: process, contact, bands

Offer drafts instead of asking open questions: write three process steps, a contact lede and two sets of band phrases from what you've learned so far. Show them and ask for edits. `AskUserQuestion` works well for the stack heading pun:

- question: "Stack section headline?"
- options: "Ball knowledge. (Recommended)", "Daily drivers.", "Everything I reach for.", plus Other.

## Round 10: look and extras

`AskUserQuestion` (with `preview` showing the three hex values of each):

- question: "Pick a colour theme"
- options: "Ember (orange, the original)", "Violet", "Acid (lime)", "Aqua (teal)"; mention rose and gold, and custom hex colours, in the question text.

`AskUserQuestion`:

- question: "The site has a small ghost mascot that comments on sections and answers questions in a chat. Keep it?"
- options: "Keep it, default voice", "Keep it, but rename it", "Keep it, write its lines in my voice", "No mascot"

Plain text: "What address will the site live at? A custom domain (yourname.com), a GitHub Pages address (username.github.io), or not decided yet?" and "Do you use Cloudflare in front of the domain?" (affects `deploy.md` steps).

## Wrap-up

Summarise everything in one message: name, title, links, rows, projects, archive choices, theme, mascot, address. Ask for a final OK, then build.
