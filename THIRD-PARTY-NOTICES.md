# Third-party notices

The MIT license in `LICENSE` covers the original code, templates and documentation in this repository. The following bundled files keep their own licenses.

| Component | Files | License |
|---|---|---|
| [GSAP](https://gsap.com) 3.15.0 (core, ScrollTrigger, SplitText) | `skills/portfolio-design/template/assets/vendor/gsap.min.js`, `ScrollTrigger.min.js`, `SplitText.min.js` | GSAP Standard "No Charge" License, <https://gsap.com/standard-license>. Copyright GreenSock. |
| [Lenis](https://github.com/darkroomengineering/lenis) 1.3.25 | `skills/portfolio-design/template/assets/vendor/lenis.min.js` | MIT, Copyright darkroom.engineering |
| [Mona Sans](https://github.com/github/mona-sans) (latin and latin-ext subsets) | `skills/portfolio-design/template/assets/fonts/mona-sans-*.woff2` | SIL Open Font License 1.1, Copyright GitHub, Inc. |
| [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono) (latin subset) | `skills/portfolio-design/template/assets/fonts/jetbrains-mono-latin.woff2` | SIL Open Font License 1.1, Copyright The JetBrains Mono Project Authors |
| [Simple Icons](https://simpleicons.org) 16.35.0 (curated subset) | `skills/portfolio-design/data/simple-icons.json` | CC0 1.0. The logos themselves are trademarks of their owners; use them to refer to the tools, not to imply endorsement. |

Loaded at test time only, not bundled:

| Component | Used by | License |
|---|---|---|
| [axe-core](https://github.com/dequelabs/axe-core) 4.10.3 | `scripts/qa/run_all.py` (from cdnjs) | MPL-2.0 |
| [Playwright](https://playwright.dev) | QA and image rendering scripts | Apache-2.0 |
| [rembg](https://github.com/danielgatis/rembg) with BiRefNet | `scripts/prepare_photos.py` (optional) | MIT (rembg), MIT (BiRefNet) |
