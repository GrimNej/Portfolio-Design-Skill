# Copy rules

The design is loud, so the words have to be plain. Every line should sound like the person talking to one visitor, not like a company page.

## Voice

- First person, present tense: "I build...", not "Rowan is a passionate engineer who...".
- Short sentences. One idea each. Fragments are fine in headings ("Idea in. Working thing out.").
- Concrete over abstract: say what the thing does for someone. "Sorts a shared inbox before anyone's had coffee" beats "AI-powered email productivity".
- Confident, not boastful. Let the work prove claims; don't stack adjectives.
- Match the person. A designer, a researcher and a game developer should not sound the same. Use words from their own notes.
- Light humour is welcome where the design invites it (the pit, the mascot, the bands). Don't force jokes into the hero or project descriptions.

## Never

- Clichés: passionate, innovative, cutting-edge, leverage, synergy, seamless, robust, world-class, rockstar, ninja, guru, wizard, unlock, elevate, empower, journey, delve, game-changer, next-level, "in today's fast-paced world", "I'm a lifelong learner".
- Em dashes and en dashes as punctuation. Use a full stop, comma, colon or parentheses instead.
- Corny wordplay and puns stacked on puns. One clever line per section at most.
- Exclamation marks, except inside mascot lines (sparingly).
- Claims you can't back up ("10x engineer", "best in class"), fake metrics, client names they haven't confirmed.
- Pronouns for the person unless they told you theirs. In mascot lines and anywhere else in third person, use their first name.
- Private details: phone number, home address, employer internals, private repo names.

## Field by field

| Field | Job | Length | Example |
|---|---|---|---|
| `person.title` | What they are, memorable | 2 to 4 words | `Product Engineer` |
| `hero.intro` | What they do and for whom, with a hint of attitude | 120 to 200 chars | "I design and build the whole thing: the screens people touch, the APIs behind them and the dashboards that show whether any of it worked." |
| `about.statement` | The one sentence you'd remember them by | 90 to 190 chars | "I'm Rowan. I like the part of a project where a messy idea turns into something you can click." |
| `about.paragraphs` | How they work, what they're like to work with | 2 x 200 to 330 chars | |
| `about.sign` | A small human fact | up to 50 chars | "Speaks English and Portuguese." |
| `build.rows[].title` | One word | up to 11 chars | `Dashboards` |
| `build.rows[].description` | The outcome, then the how | up to 150 chars | "Charts and reports that answer one question each, built on data you can trust." |
| `projects[].tagline` | The project's promise | up to 60 chars | "A shared inbox that sorts itself." |
| `projects[].description` | Problem, what it does, why it's different | 140 to 230 chars | |
| `sideQuests[].description` | One sentence | up to 110 chars | |
| `bands` | Short phrases with rhythm; mix skills and attitude | up to 22 chars each | "Shipped weekly", "Design meets code" |
| `process.steps` | How a project with them goes, in their words | title 22, text 120 | "Clickable in a week" |
| `contact.lede` | Invite a specific kind of message, promise a reply | up to 140 chars | "Got a product idea, a rough prototype or a launch date coming up? Send it over. I reply within a day." |

Project descriptions come from the README and the person's notes. Remove internal jargon, framework lists (they go in `stack`) and anything that only makes sense to the author.

## Mascot lines

The mascot has its own voice: lowercase, short, dry, a little online. Every bubble is one line (the bubble is narrow). Chat answers are one or two lines each.

Good: "this is the part where you say hi." / "certified ball knowledge. grab one and throw it." / "still here? lowkey a good sign."

Rewrite the defaults when the person's audience wouldn't get the slang (a law-firm engineer, an academic) or when they ask for a different character. Keep the mascot helpful: every chat answer should either tell the visitor something true or take them somewhere (actions jump to sections, copy the email or open links).

## Before showing copy to the person

Read every line aloud in your head. Cut words that don't change the meaning. Check the length table. Search the draft for the banned words and for "—" and "–".
