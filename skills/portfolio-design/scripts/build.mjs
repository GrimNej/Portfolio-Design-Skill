#!/usr/bin/env node
// Builds a complete portfolio site from a portfolio.json config.
//
//   node build.mjs --config path/to/portfolio.json [--out path/to/site]
//
// The output folder (default: the config's folder) receives index.html,
// 404.html, robots.txt, sitemap.xml, favicon.svg, .nojekyll, the assets/ tree
// (template CSS/JS/fonts/vendor, generated icon sprite and site-data.js) and a
// .render/ folder that scripts/render_images.py turns into og.jpg and the
// apple-touch icon. Image paths in the config are resolved relative to the
// config file and copied into assets/img or assets/work.
//
// No dependencies: Node 18+ only.

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync, statSync, rmSync } from "node:fs";
import { dirname, resolve, join, basename, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL = resolve(HERE, "..");
const TEMPLATE = join(SKILL, "template");

/* ---------------------------------------------------------------- arguments */

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]?.startsWith("--") ? true : all[i + 1] ?? true]] : acc), [])
);
if (!args.config) {
  console.error("Usage: node build.mjs --config portfolio.json [--out site-folder]");
  process.exit(1);
}
const CONFIG_PATH = resolve(args.config);
const CONFIG_DIR = dirname(CONFIG_PATH);
const OUT = resolve(args.out || CONFIG_DIR);
const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
const BUILD = new Date().toISOString().replace(/\D/g, "").slice(0, 12);

/* ------------------------------------------------------------------ helpers */

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const attr = (s) => esc(s).replace(/"/g, "&quot;");
const ext = (href) => (/^https?:/.test(href) ? ' target="_blank" rel="noopener"' : "");
const extMe = (href) => (/^https?:/.test(href) ? ' target="_blank" rel="me noopener"' : "");
const pad2 = (n) => String(n).padStart(2, "0");
const fail = (msg) => {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
};

function hexToRgb(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex([r, g, b]) {
  return "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
}
function mix(a, b, t) {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex(x.map((v, i) => v + (y[i] - v) * t));
}

/* ------------------------------------------------------------------- themes */

const PRESETS = {
  ember: { accent: "#ff6b3d", signal: "#8b9cff", ice: "#6fe3ff" },
  acid: { accent: "#c4f542", signal: "#6ee7c8", ice: "#7cc4ff" },
  violet: { accent: "#9b7bff", signal: "#6fe3ff", ice: "#ff8ad8" },
  rose: { accent: "#ff4d8d", signal: "#a78bfa", ice: "#7ee0ff" },
  gold: { accent: "#ffb547", signal: "#8b9cff", ice: "#6fe3ff" },
  aqua: { accent: "#2ee6c5", signal: "#8b9cff", ice: "#ffd36e" },
};

function theme(t = {}) {
  const base = { ...PRESETS[t.preset || "ember"], ...Object.fromEntries(Object.entries(t).filter(([k]) => ["accent", "signal", "ice"].includes(k))) };
  return {
    ...base,
    accentRgb: hexToRgb(base.accent).join(", "),
    accentInk: mix(base.accent, "#000000", 0.91),
    accentSoft: mix(base.accent, "#ffffff", 0.55),
    accentDeep: mix(base.accent, "#000000", 0.42),
    accentLight: mix(base.accent, "#fff1dc", 0.55),
    signalRgb: hexToRgb(base.signal).join(", "),
    signalLight: mix(base.signal, "#ffffff", 0.7),
    iceRgb: hexToRgb(base.ice).join(", "),
    icePale: mix(base.ice, "#ffffff", 0.78),
  };
}

/* ---------------------------------------------------------------- networks */

const NETWORKS = {
  github: { label: "GitHub", icon: "github", brand: "#f0f3fa" },
  x: { label: "X", icon: "x", brand: "#f0f3fa" },
  linkedin: { label: "LinkedIn", icon: "linkedin", brand: "#2b8cf0" },
  youtube: { label: "YouTube", icon: "youtube", brand: "#ff3b3b" },
  instagram: { label: "Instagram", icon: "instagram", brand: "#ff3d8b" },
  discord: { label: "Discord", icon: "discord", brand: "#7c86ff" },
  tiktok: { label: "TikTok", icon: "tiktok", brand: "#f0f3fa" },
  twitch: { label: "Twitch", icon: "twitch", brand: "#a970ff" },
  bluesky: { label: "Bluesky", icon: "bluesky", brand: "#3f9bff" },
  threads: { label: "Threads", icon: "threads", brand: "#f0f3fa" },
  mastodon: { label: "Mastodon", icon: "mastodon", brand: "#8c8dff" },
  reddit: { label: "Reddit", icon: "reddit", brand: "#ff5a1f" },
  dribbble: { label: "Dribbble", icon: "dribbble", brand: "#ff5c9d" },
  behance: { label: "Behance", icon: "behance", brand: "#3b7bff" },
  medium: { label: "Medium", icon: "medium", brand: "#f0f3fa" },
  devto: { label: "DEV", icon: "devdotto", brand: "#f0f3fa" },
  hashnode: { label: "Hashnode", icon: "hashnode", brand: "#4d7cff" },
  substack: { label: "Substack", icon: "substack", brand: "#ff8a3d" },
  stackoverflow: { label: "Stack Overflow", icon: "stackoverflow", brand: "#ff9a3d" },
  huggingface: { label: "Hugging Face", icon: "huggingface", brand: "#ffd21e" },
  kaggle: { label: "Kaggle", icon: "kaggle", brand: "#3fc3f0" },
  leetcode: { label: "LeetCode", icon: "leetcode", brand: "#ffa116" },
  producthunt: { label: "Product Hunt", icon: "producthunt", brand: "#ff6154" },
  telegram: { label: "Telegram", icon: "telegram", brand: "#3fb0ff" },
  whatsapp: { label: "WhatsApp", icon: "whatsapp", brand: "#3fd17a" },
  spotify: { label: "Spotify", icon: "spotify", brand: "#3fd17a" },
  website: { label: "Website", icon: "globe", brand: "#f0f3fa", ui: true },
};

/* ----------------------------------------------------------------- defaults */

function withDefaults(c) {
  const p = c.person || fail("config.person is required");
  for (const k of ["firstName", "lastName", "title", "email"]) if (!p[k]) fail(`config.person.${k} is required`);
  const first = p.firstName;
  const full = `${p.firstName} ${p.lastName}`;
  const alias = p.alias || full.replace(/\s+/g, "");
  const loc = p.location || {};
  const place = [loc.city, loc.country].filter(Boolean).join(", ");
  const socials = (c.socials || []).map((s) => {
    const n = NETWORKS[s.network] || { label: s.label || s.network, icon: "globe", brand: "#f0f3fa", ui: true };
    return { ...n, ...s, label: s.label || n.label, handle: s.handle || "", brand: s.brand || n.brand };
  });
  const github = socials.find((s) => s.network === "github");
  const githubUser = c.work?.archive?.githubUser ?? (github ? github.url.replace(/\/+$/, "").split("/").pop() : null);
  const projects = c.work?.projects || [];
  if (!projects.length) fail("config.work.projects needs at least one project");
  const languages = p.languages || ["English"];
  const languageLine = languages.length === 1 ? languages[0] : `${languages.slice(0, -1).join(", ")}${languages.length > 2 ? "," : ""} and ${languages.at(-1)}`;

  const cfg = {
    site: {
      url: "https://example.com/",
      lang: "en",
      ...c.site,
    },
    person: { ...p, alias, full, place, languages, languageLine, location: { timezone: "UTC", ...loc } },
    socials,
    hero: {
      intro: `${first} builds things on the internet. Have a look around, then say hi.`,
      cta: "See what I've shipped",
      orb: "Let's talk",
      hudTag: `ID · ${alias}`,
      hudStatus: "Status · online",
      heroLinks: null,
      ...c.hero,
    },
    about: {
      label: "About",
      statement: `I'm ${first}, ${alias} online.`,
      paragraphs: [],
      sign: `Speaks ${languageLine}.`,
      caption: place,
      ...c.about,
    },
    build: {
      label: "What I build",
      heading: "Four things I could build in my sleep.",
      aside: "The things I build most, start to finish.",
      rows: [],
      ...c.build,
    },
    work: {
      label: "Selected work",
      heading: "Stuff I've shipped.",
      aside: "Every preview is the real thing: the project's own banner or its live app.",
      sideQuestsHeading: "Side quests",
      sideQuests: [],
      ...c.work,
      projects,
      archive: {
        enabled: Boolean(githubUser),
        heading: "The rest of the pile",
        note: "Everything else on my GitHub, synced live. New repos land here the moment I push them.",
        hidden: [],
        fallbackDescriptions: {},
        ...(c.work?.archive || {}),
        githubUser,
      },
    },
    bands: {
      outline: ["Building", "Shipping", "Learning", "Iterating"],
      accent: ["Ball knowledge", "Locked in", "Shipped, not pitched", "Always building"],
      ...c.bands,
    },
    stack: {
      label: "Stack",
      heading: "Ball knowledge.",
      aside: "Every tool in my rotation, in one pit. Grab one and throw it.",
      groups: [],
      pit: [],
      ...c.stack,
    },
    process: {
      label: "How it goes",
      heading: "Idea in. Working thing out.",
      steps: [
        { title: "Verdict first", text: "You pitch it, and I tell you straight whether it's real, before anyone spends money finding out." },
        { title: "Prototype fast", text: "Working software beats a slide deck. You get something to click early, not a promise." },
        { title: "Keep it moving", text: "Things change weekly. I build so the next version slots in without a rewrite." },
      ],
      ...c.process,
    },
    contact: {
      label: "Contact",
      heading: "Let's talk",
      lede: "Got an idea or a deadline closing in? Send it over. I read everything and reply fast.",
      emailSubject: `Hey ${first}`,
      emailButton: "Email me",
      copyButton: "Copy address",
      ...c.contact,
    },
    footer: { line: `${full}. ${p.title}.`, ...c.footer },
    theme: theme(c.theme),
    mascot: c.mascot?.enabled === false ? { enabled: false } : mascotDefaults(c, { first, full, alias, place, githubUser, projects, socials, email: p.email }),
    seo: c.seo || {},
  };
  if (cfg.build.rows.length !== 4) fail("config.build.rows needs exactly four rows ({ title, description, viz })");
  if (cfg.process.steps.length !== 3) fail("config.process.steps needs exactly three steps");
  for (const r of cfg.build.rows) if (!VIZ[r.viz]) fail(`Unknown viz "${r.viz}". Use one of: ${Object.keys(VIZ).join(", ")}`);
  if (!cfg.person.photos?.portrait) fail("config.person.photos.portrait is required (a cut-out PNG/WebP made by prepare_photos.py)");
  return cfg;
}

function mascotDefaults(c, { first, full, alias, place, projects, socials, email }) {
  const m = c.mascot || {};
  const name = m.name || "Grim";
  const fav = projects[0];
  const mailto = `mailto:${email}?subject=${encodeURIComponent(c.contact?.emailSubject || `Hey ${first}`)}`;
  const reach = socials.filter((s) => ["x", "linkedin", "github", "bluesky", "instagram"].includes(s.network)).slice(0, 3);
  const topics = {
    who: {
      q: `Who's ${first}?`,
      a: [`${full}, ${alias} online. ${c.person.title}${place ? ` from ${place}` : ""}.`, m.whoLine || `${first} builds things and ships them. that's the whole personality.`],
      actions: [{ label: "Read the about", go: "#about" }],
    },
    work: {
      q: "Show me the work",
      a: [`${projects.length} project${projects.length > 1 ? "s" : ""} up top, all real.`, `my pick is ${fav.name}. ${m.favoriteReason || (fav.tagline || "").toLowerCase()}`.trim()],
      actions: [{ label: "Take me there", go: "#work" }, ...(fav.links?.[0] ? [{ label: `Open ${fav.name}`, href: fav.links[0].href }] : [])],
    },
    stack: {
      q: `What's ${first}'s stack?`,
      a: [m.stackLine || "a lot of it. too much to list in a chat bubble.", "there's a pit full of logos down there. you can throw them."],
      actions: [{ label: "Go to the pit", go: "#stack" }],
    },
    hire: {
      q: `Can ${first} build my idea?`,
      a: ["send it over. you'll get a straight answer on whether it's real, then a working version.", "no glazing. if it's mid, you'll hear it."],
      actions: [{ label: `Email ${first}`, href: mailto }],
    },
    contact: {
      q: `How do I reach ${first}?`,
      a: [`email is fastest. ${first} reads everything.`],
      actions: [
        { label: "Copy email", copy: true },
        { label: "Write an email", href: mailto },
        ...reach.map((s) => ({ label: s.label, href: s.url })),
      ],
    },
    phone: { q: "What's on your phone?" },
    ...(m.extraTopic ? { extra: m.extraTopic } : {}),
  };
  return {
    enabled: true,
    name,
    lines: {
      hello: { text: m.hello || `yo, i'm ${name.toLowerCase()}. ${first}'s ghost. tap me, i know everything here.` },
      build: { text: m.buildLine || `this is what ${first} builds. tap me if you want the short version.`, topic: m.extraTopic ? "extra" : "who" },
      work: { text: `my pick is ${fav.name}. tap me for the tour.`, topic: "work" },
      archive: { text: "the full archive. updates itself, no cap." },
      stack: { text: "certified ball knowledge. grab one and throw it.", topic: "stack" },
      contact: { text: "this is the part where you say hi.", topic: "contact" },
      footer: { text: "that's the whole site. now go say hi.", topic: "contact" },
      idle: { text: "still here? lowkey a good sign." },
      fast: { text: "slow down, i'm still reading." },
      copied: { text: "copied. now go send it." },
      ...(m.lines || {}),
    },
    greetings: {
      first: [`yo, i'm ${name.toLowerCase()}. ${first}'s ghost.`, `ask me anything about ${first}.`],
      woken: ["huh? oh. hi.", "i was resting my eyes. what's up?"],
      again: ["back again? what do you need?"],
      ...(m.greetings || {}),
    },
    throws: m.throws || ["nice throw.", "that one had aura.", "yeet.", "physics is cooking.", "do it again."],
    phone: m.phone || [
      "release notes. always release notes.",
      "a 400-reply thread about which framework is best. still not settled.",
      `${first}'s notifications. another push just landed.`,
      "a new tool dropped. third one today.",
    ],
    topics: { ...topics, ...(m.topics || {}) },
    order: m.order || ["who", ...(m.extraTopic ? ["extra"] : []), "work", "contact", "stack", "hire"],
  };
}

/* --------------------------------------------------------------------- icons */

const ICONS = JSON.parse(readFileSync(join(SKILL, "data/simple-icons.json"), "utf8")).icons;

async function iconPath(slug) {
  if (ICONS[slug]) return ICONS[slug].path;
  try {
    const res = await fetch(`https://cdn.jsdelivr.net/npm/simple-icons@16.35.0/icons/${slug}.svg`);
    if (!res.ok) return null;
    const m = (await res.text()).match(/ d="([^"]+)"/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

const UI_ICONS = {
  "arrow-ur": '<path d="M7 17 17 7M8.5 7H17v8.5"/>',
  "arrow-r": '<path d="M4 12h15M13 6l6 6-6 6"/>',
  "arrow-d": '<path d="M12 4v15M6 13l6 6 6-6"/>',
  "arrow-up": '<path d="M12 20V5M6 11l6-6 6 6"/>',
  copy: '<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2.5"/><path d="M15.5 8.5V6.5a2.5 2.5 0 0 0-2.5-2.5H6.5A2.5 2.5 0 0 0 4 6.5V13a2.5 2.5 0 0 0 2.5 2.5h2"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7.5 8 5.5 8-5.5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.3 3.6 5.1 3.6 8.5s-1.2 6.2-3.6 8.5c-2.4-2.3-3.6-5.1-3.6-8.5s1.2-6.2 3.6-8.5z"/>',
};

async function buildSprite(cfg) {
  let out = '<svg xmlns="http://www.w3.org/2000/svg" style="display:none">\n';
  const slugs = new Set(cfg.socials.filter((s) => !s.ui).map((s) => s.icon));
  for (const slug of slugs) {
    const d = await iconPath(slug);
    if (d) out += `<symbol id="i-${slug}" viewBox="0 0 24 24"><path fill="currentColor" d="${d}"/></symbol>\n`;
    else console.warn(`  ! no icon found for "${slug}"; the link will show without one`);
  }
  for (const [id, body] of Object.entries(UI_ICONS)) {
    out += `<symbol id="i-${id}" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</g></symbol>\n`;
  }
  out += '<symbol id="i-spark" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2c.6 4.9 3.1 7.4 8 8-4.9.6-7.4 3.1-8 8-.6-4.9-3.1-7.4-8-8 4.9-.6 7.4-3.1 8-8z" transform="translate(0 2)"/></symbol>\n';
  return out + "</svg>\n";
}

async function buildTools(cfg) {
  const tools = [];
  for (const t of cfg.stack.pit) {
    const path = t.icon ? await iconPath(t.icon) : null;
    if (t.icon && !path) console.warn(`  ! no icon for "${t.icon}"; "${t.name}" will show as a text ball`);
    tools.push({ name: t.name, tier: t.tier || 2, color: t.color || ICONS[t.icon]?.hex || cfg.theme.accent, path });
  }
  return tools;
}

/* ---------------------------------------------------------------- assets io */

function copyDir(src, dst, transform) {
  mkdirSync(dst, { recursive: true });
  for (const name of readdirSync(src)) {
    const s = join(src, name);
    const d = join(dst, name);
    if (statSync(s).isDirectory()) copyDir(s, d, transform);
    else if (transform && /\.(js|css)$/.test(name)) writeFileSync(d, transform(readFileSync(s, "utf8"), name));
    else copyFileSync(s, d);
  }
}

// Resolve a config image path; copy it into the site if it lives elsewhere. Returns the site-relative path.
function place(file, folder) {
  if (!file) return null;
  if (/^https?:/.test(file)) return file;
  const abs = resolve(CONFIG_DIR, file);
  if (!existsSync(abs)) fail(`Image not found: ${file} (resolved to ${abs})`);
  const rel = relative(OUT, abs).replace(/\\/g, "/");
  if (!rel.startsWith("..") && !rel.includes(":")) return rel;
  mkdirSync(join(OUT, folder), { recursive: true });
  const dest = join(OUT, folder, basename(abs));
  copyFileSync(abs, dest);
  return `${folder}/${basename(abs)}`;
}

// Read width/height from PNG, WebP, JPEG or SVG headers so <img> tags never shift layout.
function size(file) {
  const abs = /^https?:/.test(file) ? null : resolve(OUT, file);
  if (!abs || !existsSync(abs)) return [1600, 900];
  const b = readFileSync(abs);
  const e = extname(abs).toLowerCase();
  try {
    if (e === ".png") return [b.readUInt32BE(16), b.readUInt32BE(20)];
    if (e === ".webp") {
      const kind = b.toString("ascii", 12, 16);
      if (kind === "VP8X") return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
      if (kind === "VP8 ") return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
      if (kind === "VP8L") {
        const bits = b.readUInt32LE(21);
        return [1 + (bits & 0x3fff), 1 + ((bits >> 14) & 0x3fff)];
      }
    }
    if (e === ".jpg" || e === ".jpeg") {
      let i = 2;
      while (i < b.length) {
        const marker = b[i + 1];
        const len = b.readUInt16BE(i + 2);
        if (marker >= 0xc0 && marker <= 0xc3) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
        i += 2 + len;
      }
    }
    if (e === ".svg") {
      const m = b.toString("utf8").match(/viewBox="[\d.\s-]*?\s([\d.]+)\s+([\d.]+)"/);
      if (m) return [Math.round(+m[1]), Math.round(+m[2])];
    }
  } catch {
    /* fall through */
  }
  return [1600, 900];
}

/* -------------------------------------------------------------- viz panels */

const VIZ = {
  agents: `<svg class="viz viz--agents" viewBox="0 0 320 200" data-viz-panel>
              <g class="viz__links"><path d="M60 100 L160 45" /><path d="M60 100 L160 100" /><path d="M60 100 L160 155" /><path d="M160 45 L260 100" /><path d="M160 100 L260 100" /><path d="M160 155 L260 100" /></g>
              <g class="viz__pulses">
                <circle r="4" class="p1"><animateMotion dur="2.2s" repeatCount="indefinite" path="M60 100 L160 45 L260 100" /></circle>
                <circle r="4" class="p2"><animateMotion dur="2.2s" begin="0.7s" repeatCount="indefinite" path="M60 100 L160 100 L260 100" /></circle>
                <circle r="4" class="p3"><animateMotion dur="2.2s" begin="1.4s" repeatCount="indefinite" path="M60 100 L160 155 L260 100" /></circle>
              </g>
              <g class="viz__nodes"><circle cx="60" cy="100" r="17" class="n-main" /><circle cx="160" cy="45" r="11" /><circle cx="160" cy="100" r="11" /><circle cx="160" cy="155" r="11" /><circle cx="260" cy="100" r="17" class="n-out" /></g>
              <g class="viz__labels"><text x="60" y="140">plan</text><text x="160" y="24">search</text><text x="200" y="92">code</text><text x="160" y="186">call</text><text x="260" y="140">done</text></g>
            </svg>`,
  automation: `<svg class="viz viz--auto" viewBox="0 0 320 200" data-viz-panel>
              <path class="viz__belt" d="M16 132 H304" />
              <g class="viz__stations"><rect x="66" y="66" width="44" height="44" /><rect x="138" y="66" width="44" height="44" /><rect x="210" y="66" width="44" height="44" /></g>
              <g class="viz__gear"><path d="M88 80v-5M88 96v-5M80 88h-5M101 88h-5" /><circle cx="88" cy="88" r="5" /></g>
              <g class="viz__gear viz__gear--2"><path d="M160 80v-5M160 96v-5M152 88h-5M173 88h-5" /><circle cx="160" cy="88" r="5" /></g>
              <g class="viz__gear"><path d="M232 80v-5M232 96v-5M224 88h-5M245 88h-5" /><circle cx="232" cy="88" r="5" /></g>
              <g class="viz__boxes"><rect class="b1" x="0" y="120" width="20" height="12" /><rect class="b2" x="0" y="120" width="20" height="12" /><rect class="b3" x="0" y="120" width="20" height="12" /><rect class="b4" x="0" y="120" width="20" height="12" /></g>
              <g class="viz__labels"><text x="88" y="166">ingest</text><text x="160" y="166">transform</text><text x="232" y="166">ship</text></g>
            </svg>`,
  context: `<svg class="viz viz--rag" viewBox="0 0 320 200" data-viz-panel>
              <g class="viz__docs"><rect x="24" y="44" width="46" height="60" /><rect x="36" y="56" width="46" height="60" /><rect x="48" y="68" width="46" height="60" /><path d="M58 86h26M58 96h26M58 106h18" /></g>
              <g class="viz__vecs" data-rag-dots></g>
              <circle class="viz__query" cx="212" cy="100" r="36" />
              <g class="viz__labels"><text x="70" y="156">context</text><text x="212" y="176">what matters</text></g>
            </svg>`,
  launch: `<svg class="viz viz--mvp" viewBox="0 0 320 200" data-viz-panel>
              <rect class="viz__window" x="36" y="24" width="248" height="150" />
              <path class="viz__bar" d="M36 46 H284" />
              <g class="viz__dots"><circle cx="50" cy="35" r="3" /><circle cx="60" cy="35" r="3" /><circle cx="70" cy="35" r="3" /></g>
              <g class="viz__blocks"><rect class="k1" x="54" y="62" width="96" height="13" /><rect class="k2" x="54" y="84" width="136" height="8" /><rect class="k3" x="54" y="100" width="116" height="8" /><rect class="k4" x="54" y="124" width="62" height="24" /><rect class="k5" x="200" y="62" width="66" height="86" /></g>
              <g class="viz__ship"><circle cx="266" cy="35" r="11" /><path d="m261 35 3.5 3.5L271 32" /></g>
            </svg>`,
  code: `<svg class="viz viz--code" viewBox="0 0 320 200" data-viz-panel>
              <rect class="viz__window" x="36" y="24" width="248" height="150" />
              <path class="viz__bar" d="M36 46 H284" />
              <g class="viz__dots"><circle cx="50" cy="35" r="3" /><circle cx="60" cy="35" r="3" /><circle cx="70" cy="35" r="3" /></g>
              <g class="viz__code"><rect class="c1" x="54" y="62" width="36" height="8" /><rect class="c2" x="96" y="62" width="74" height="8" /><rect class="c3" x="70" y="80" width="112" height="8" /><rect class="c4" x="70" y="98" width="70" height="8" /><rect class="c5" x="146" y="98" width="56" height="8" /><rect class="c6" x="70" y="116" width="96" height="8" /><rect class="c7" x="54" y="134" width="28" height="8" /></g>
              <rect class="viz__caret" x="88" y="132" width="3" height="12" />
              <g class="viz__labels"><text x="232" y="160">build passing</text></g>
            </svg>`,
  data: `<svg class="viz viz--data" viewBox="0 0 320 200" data-viz-panel>
              <path class="viz__axis" d="M50 28 V160 H290" />
              <g class="viz__bars"><rect class="d1" x="68" y="104" width="28" height="56" /><rect class="d2" x="110" y="84" width="28" height="76" /><rect class="d3" x="152" y="112" width="28" height="48" /><rect class="d4" x="194" y="66" width="28" height="94" /><rect class="d5" x="236" y="44" width="28" height="116" /></g>
              <path class="viz__trend" d="M82 98 L124 78 L166 106 L208 58 L250 36" />
              <g class="viz__labels"><text x="170" y="186">signal over noise</text></g>
            </svg>`,
  design: `<svg class="viz viz--design" viewBox="0 0 320 200" data-viz-panel>
              <g class="viz__grid"><path d="M40 40 H280 M40 100 H280 M40 160 H280 M80 20 V180 M160 20 V180 M240 20 V180" /></g>
              <circle class="viz__shape s1" cx="96" cy="100" r="32" />
              <rect class="viz__shape s2" x="128" y="68" width="64" height="64" rx="6" />
              <path class="viz__shape s3" d="M240 66 L274 132 H206 Z" />
              <path class="viz__pointer" d="M0 0 L0 16 L4 12 L8 20 L11 18 L7 11 L13 11 Z"><animateMotion dur="4.4s" repeatCount="indefinite" path="M110 150 C 150 60, 200 160, 240 100 S 140 40, 110 150" /></path>
              <g class="viz__labels"><text x="160" y="194">pixel-perfect</text></g>
            </svg>`,
};

/* ------------------------------------------------------------------ mascot */

function mascotSvg(t) {
  return `<svg class="grim__svg" viewBox="0 0 120 132" aria-hidden="true">
          <defs>
            <linearGradient id="grim-cloak" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b3250" /><stop offset="0.55" stop-color="#161a28" /><stop offset="1" stop-color="#0d1019" /></linearGradient>
            <radialGradient id="grim-screen" cx="0.5" cy="0.4" r="0.7"><stop offset="0" stop-color="${t.icePale}" /><stop offset="1" stop-color="${mix(t.ice, "#1b6f99", 0.35)}" /></radialGradient>
            <radialGradient id="grim-light" cx="0.5" cy="1" r="0.9"><stop offset="0" stop-color="${t.ice}" stop-opacity="0.45" /><stop offset="1" stop-color="${t.ice}" stop-opacity="0" /></radialGradient>
            <filter id="grim-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.8" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
          <ellipse class="grim__shadow" cx="60" cy="127" rx="24" ry="4" />
          <g class="grim__float">
            <g class="grim__body">
              <path class="grim__cloak" d="M66 4 C84 7 101 25 102 58 L102 104 Q96 115 88.5 106 Q81 96 74.5 106 Q67 116 60 106 Q53 96 45.5 106 Q39 116 31.5 106 Q24 96 18 104 L18 60 C18 31 38 6 66 4 Z" />
              <path class="grim__rim" d="M66 4 C84 7 101 25 102 58" />
              <ellipse class="grim__face" cx="60" cy="55" rx="28" ry="24" />
              <ellipse class="grim__light" cx="60" cy="72" rx="26" ry="11" />
              <g class="grim__look">
                <g class="grim__eyes" filter="url(#grim-glow)"><ellipse class="grim__eye" cx="49" cy="54" rx="4.6" ry="6.4" /><ellipse class="grim__eye" cx="71" cy="54" rx="4.6" ry="6.4" /></g>
                <g class="grim__happy" filter="url(#grim-glow)"><path d="M43.5 57 Q49 48.5 54.5 57" /><path d="M65.5 57 Q71 48.5 76.5 57" /></g>
              </g>
              <ellipse class="grim__blush" cx="41" cy="66" rx="4" ry="2.2" /><ellipse class="grim__blush" cx="79" cy="66" rx="4" ry="2.2" />
              <g class="grim__phone">
                <rect x="47" y="77" width="26" height="33" rx="5" class="grim__phone-body" />
                <rect x="50" y="80" width="20" height="25" rx="2.5" class="grim__screen" />
                <g class="grim__feed"><path d="M53 86h11M53 91h14M53 96h9M53 101h12" /></g>
                <circle cx="67.5" cy="82.5" r="2.4" class="grim__ping" />
              </g>
              <ellipse class="grim__hand" cx="46" cy="96" rx="5.2" ry="4.4" /><ellipse class="grim__hand" cx="74" cy="96" rx="5.2" ry="4.4" />
            </g>
          </g>
          <g class="grim__zzz"><text x="96" y="22">z</text><text x="104" y="12">z</text></g>
        </svg>`;
}

function favicon(t) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <defs>
    <linearGradient id="cloak" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4b569a"/><stop offset="0.6" stop-color="#232a42"/><stop offset="1" stop-color="#11141f"/></linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${t.ice}" stop-opacity="0.6"/><stop offset="1" stop-color="${t.ice}" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="120" height="120" rx="28" fill="#0a0b11"/>
  <path d="M63 9C84 12 102 32 103 64V104Q96.5 115 88.5 106Q81 97 74 106Q67 115 60 106Q53 97 46 106Q39 115 31.5 106Q24 97 17 104V66C17 34 37 10 63 9Z" fill="url(#cloak)" stroke="${t.signal}" stroke-opacity="0.6" stroke-width="2.5"/>
  <path d="M63 9C84 12 102 32 103 64" fill="none" stroke="${t.signalLight}" stroke-opacity="0.7" stroke-width="3" stroke-linecap="round"/>
  <ellipse cx="60" cy="59" rx="31" ry="27" fill="#04050a"/>
  <ellipse cx="60" cy="61" rx="30" ry="24" fill="url(#glow)" opacity="0.45"/>
  <ellipse cx="47" cy="57" rx="7.5" ry="10.5" fill="${t.icePale}"/>
  <ellipse cx="73" cy="57" rx="7.5" ry="10.5" fill="${t.icePale}"/>
  <ellipse cx="38" cy="72" rx="5" ry="2.8" fill="${t.accent}" opacity="0.55"/>
  <ellipse cx="82" cy="72" rx="5" ry="2.8" fill="${t.accent}" opacity="0.55"/>
</svg>
`;
}

/* --------------------------------------------------------------- the page */

const icon = (id, cls = "icon") => `<svg class="${cls}" aria-hidden="true"><use href="assets/img/icons.svg#i-${id}" /></svg>`;
const spark = (cls) => `<svg class="${cls}"><use href="assets/img/icons.svg#i-spark" /></svg>`;

function projectHtml(p, i) {
  const media = p.media || [];
  const first = (p.links || [])[0] || { href: "#" };
  const cursor = p.cursor || (first.kind === "source" || /github\.com/.test(first.href) ? "View source" : "Open live");
  const imgs = media
    .map((m, j) => {
      const [w, h] = size(m.src);
      return `<img${j === 0 ? ' class="is-active"' : ""} src="${attr(m.src)}" width="${w}" height="${h}" loading="lazy" alt="${attr(m.alt || `${p.name} preview`)}"${m.position ? ` style="object-position: ${attr(m.position)}"` : ""} />`;
    })
    .join("\n                  ");
  const views =
    media.length > 1
      ? `\n                  <span class="shot__views" role="group" aria-label="${attr(p.name)} preview">${media
          .map((m, j) => `<button type="button" aria-pressed="${j === 0}" data-view="${j}">${esc(m.label || `View ${j + 1}`)}</button>`)
          .join("")}</span>`
      : "";
  const links = (p.links || [])
    .map((l, j) => `<a class="arrow-link${j === 0 ? " arrow-link--accent" : ""}" href="${attr(l.href)}"${ext(l.href)}><span data-roll>${esc(l.label)}</span>${icon("arrow-ur")}</a>`)
    .join("\n                    ");
  return `
            <article class="project" style="--accent: ${attr(p.accent || "var(--ember)")}" data-project>
              <div class="project__media">
                <a class="shot${p.lightPreview ? " shot--light" : ""}" href="${attr(first.href)}"${ext(first.href)} data-cursor="${attr(cursor)}" data-cursor-mode="media" aria-label="${attr(`${cursor}: ${p.name}`)}" data-shot>
                  ${imgs}
                </a>
                <div class="shot__bar">
                  <span class="shot__url">${esc(p.address || first.href.replace(/^https?:\/\//, "").replace(/\/$/, ""))}</span>${views}
                </div>
              </div>
              <div class="project__body">
                <div class="project__head">
                  <span class="project__no">${pad2(i + 1)}</span>
                  <h3 class="project__title" data-split>${esc(p.name)}</h3>
                </div>
                <div class="project__text">
                  <p class="project__tag">${esc(p.tagline)}</p>
                  <p class="project__desc">${esc(p.description)}</p>
                </div>
                <div class="project__side">
                  <p class="project__stack">${esc((p.stack || []).join(" / "))}</p>${p.note ? `\n                  <p class="project__note">${esc(p.note)}</p>` : ""}
                  <p class="project__links">
                    ${links}
                  </p>
                </div>
              </div>
            </article>`;
}

function sideQuestHtml(q) {
  const [w, h] = q.image ? size(q.image) : [0, 0];
  return `
              <li class="mini" data-reveal>
                <a href="${attr(q.href)}"${ext(q.href)} data-cursor="${attr(q.cursor || "View source")}" data-cursor-mode="media">
                  ${q.image ? `<span class="mini__img"><img src="${attr(q.image)}" width="${w}" height="${h}" loading="lazy" alt="${attr(q.alt || `${q.name} preview`)}" /></span>` : ""}
                  <span class="mini__title">${esc(q.name)} ${icon("arrow-ur")}</span>
                  <span class="mini__desc">${esc(q.description)}</span>
                  <span class="mini__lang">${esc(q.meta || "")}</span>
                </a>
              </li>`;
}

function channelHtml(s) {
  return `<li data-reveal><a class="channel" href="${attr(s.url)}"${extMe(s.url)} style="--brand: ${attr(s.brand)}">${icon(s.icon, "icon channel__icon")}<span class="channel__name">${esc(s.label)}</span><span class="channel__handle">${esc(s.handle)}</span>${icon("arrow-ur", "icon channel__go")}</a></li>`;
}

function page(cfg, sizes) {
  const { person: P, hero: H, about: A, build: B, work: W, bands, stack: S, process: R, contact: C, theme: T, mascot: M, site } = cfg;
  const url = site.url.replace(/\/?$/, "/");
  const mail = `mailto:${P.email}`;
  const mailSubject = `${mail}?subject=${encodeURIComponent(C.emailSubject)}`;
  const heroLinks = (H.heroLinks ? H.heroLinks.map((n) => cfg.socials.find((s) => s.network === n)).filter(Boolean) : cfg.socials.filter((s) => s.network !== "website")).slice(0, 4);
  const nameLen = Math.max(P.firstName.length, P.lastName.length);
  const fits = {
    name: Math.min(1, 7.6 / nameLen).toFixed(3),
    alias: Math.min(1, 7.5 / P.alias.length).toFixed(3),
    contact: Math.min(1, 10.5 / C.heading.length).toFixed(3),
  };
  const seoTitle = `${P.full} (${P.alias}) · ${P.title}${site.titleSuffix ? ` | ${site.titleSuffix}` : ""}`;
  const description = site.description || `${P.full}, aka ${P.alias}, is a ${P.title}${P.place ? ` from ${P.place}` : ""}. ${H.intro}`;
  const ogDescription = site.ogDescription || H.intro;
  const sameAs = cfg.socials.filter((s) => /^https?:/.test(s.url)).map((s) => s.url);
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", "@id": `${url}#website`, url, name: P.alias, alternateName: P.full, inLanguage: site.lang, publisher: { "@id": `${url}#person` } },
      { "@type": "ProfilePage", "@id": `${url}#profile`, url, name: `${P.full} (${P.alias})`, isPartOf: { "@id": `${url}#website` }, dateModified: new Date().toISOString().slice(0, 10), mainEntity: { "@id": `${url}#person` } },
      {
        "@type": "Person",
        "@id": `${url}#person`,
        name: P.full,
        givenName: P.firstName,
        familyName: P.lastName,
        alternateName: [P.alias],
        jobTitle: P.title,
        description: site.personDescription || description,
        url,
        image: `${url}${sizes.portraitPath}`,
        email: mail,
        ...(P.location.city ? { address: { "@type": "PostalAddress", addressLocality: P.location.city, ...(P.location.countryCode ? { addressCountry: P.location.countryCode } : {}) } } : {}),
        ...(P.languageCodes ? { knowsLanguage: P.languageCodes } : {}),
        ...(site.keywords?.length ? { knowsAbout: site.keywords } : {}),
        sameAs,
        workExample: W.projects.map((p) => ({
          "@type": "SoftwareSourceCode",
          name: p.name,
          ...(p.links?.find((l) => !/github\.com/.test(l.href)) ? { url: p.links.find((l) => !/github\.com/.test(l.href)).href } : {}),
          ...(p.links?.find((l) => /github\.com/.test(l.href)) ? { codeRepository: p.links.find((l) => /github\.com/.test(l.href)).href } : {}),
          description: p.description,
          ...(p.language ? { programmingLanguage: p.language } : {}),
        })),
      },
    ],
  };
  const ldText = JSON.stringify(ld, null, 2).replace(/</g, "\\u003c").split("\n").map((l) => "      " + l).join("\n");
  const bandSet = (items) => items.map((t) => `<span>${esc(t)}</span>${spark("band__spark")}`).join("");
  const toolbox = S.groups.map((g) => `<div data-reveal><dt>${esc(g.title)}</dt><dd>${esc(Array.isArray(g.items) ? g.items.join(", ") : g.items)}</dd></div>`).join("\n            ");

  return `<!doctype html>
<html lang="${attr(site.lang)}" class="no-js">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${esc(seoTitle)}</title>
    <meta name="description" content="${attr(description)}" />
    <meta name="author" content="${attr(P.full)}" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <meta name="theme-color" content="#07080b" />
    <meta name="color-scheme" content="dark" />
    <link rel="canonical" href="${attr(url)}" />
    <link rel="sitemap" type="application/xml" href="/sitemap.xml" />

    <meta property="og:type" content="profile" />
    <meta property="og:site_name" content="${attr(P.alias)}" />
    <meta property="og:url" content="${attr(url)}" />
    <meta property="og:title" content="${attr(`${P.full} (${P.alias}) · ${P.title}`)}" />
    <meta property="og:description" content="${attr(ogDescription)}" />
    <meta property="og:image" content="${attr(url)}assets/img/og.jpg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${attr(`${P.full}, ${P.alias}, ${P.title}`)}" />
    <meta property="profile:first_name" content="${attr(P.firstName)}" />
    <meta property="profile:last_name" content="${attr(P.lastName)}" />
    <meta property="profile:username" content="${attr(P.alias)}" />
    <meta name="twitter:card" content="summary_large_image" />${site.twitter ? `\n    <meta name="twitter:site" content="${attr(site.twitter)}" />\n    <meta name="twitter:creator" content="${attr(site.twitter)}" />` : ""}
    <meta name="twitter:title" content="${attr(`${P.full} (${P.alias}) · ${P.title}`)}" />
    <meta name="twitter:description" content="${attr(ogDescription)}" />
    <meta name="twitter:image" content="${attr(url)}assets/img/og.jpg" />

    <link rel="icon" href="favicon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="assets/img/apple-touch-icon.png" />
    <link rel="preload" href="assets/fonts/mona-sans-latin.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="preload" href="${attr(sizes.portraitPath)}" as="image" fetchpriority="high" />
    <link rel="stylesheet" href="assets/css/main.css?v=${BUILD}" />
    <style>:root { --name-fit: ${fits.name}; --alias-fit: ${fits.alias}; --contact-fit: ${fits.contact}; }</style>
    <script>
      document.documentElement.classList.replace("no-js", "js");
      setTimeout(function () {
        if (!window.__booted) document.documentElement.classList.add("reveal-all");
      }, 3500);
      setTimeout(function () {
        var p = document.querySelector("[data-preloader]");
        if (p && !p.classList.contains("is-done")) document.documentElement.classList.add("reveal-all");
      }, 12000);
    </script>

    <script type="application/ld+json">
${ldText}
    </script>
  </head>

  <body>
    <!--email_off-->
    <a class="skip-link" href="#main">Skip to content</a>

    <div class="preloader" aria-hidden="true" data-preloader>
      <span class="preloader__word">${esc(P.alias)}</span>
      <span class="preloader__pct"><span data-preloader-pct>0</span>%</span>
    </div>

    <canvas class="field" aria-hidden="true" data-field></canvas>
    <div class="atmosphere" aria-hidden="true"></div>
    <div class="grain" aria-hidden="true"></div>

    <div class="cursor is-hidden" aria-hidden="true" data-cursor-root>
      <div class="cursor__ring"></div>
      <div class="cursor__dot"></div>
      <div class="cursor__label" data-cursor-label></div>
    </div>

    <div class="progress" aria-hidden="true"><span data-progress></span></div>
    <div class="header-bg" aria-hidden="true" data-header-bg></div>
    <header class="header" data-header>
      <a class="wordmark" href="#top" aria-label="${attr(P.alias)}, back to top"><span aria-hidden="true">&copy;</span> ${esc(P.alias)}</a>
      <nav class="nav" aria-label="Primary">
        <a href="#about" data-nav="about"><span data-roll>About</span></a>
        <a href="#work" data-nav="work"><span data-roll>Work</span></a>
        <a href="#stack" data-nav="stack"><span data-roll>Stack</span></a>
        <a href="#contact" data-nav="contact"><span data-roll>Contact</span></a>
      </nav>
      <button class="menu-btn" type="button" aria-expanded="false" aria-controls="menu" data-menu-toggle>
        <span data-menu-label>Menu</span>
      </button>
    </header>

    <div class="menu" id="menu" data-menu data-lenis-prevent hidden>
      <nav class="menu__nav" aria-label="Mobile">
        <a href="#about"><span>01</span>About</a>
        <a href="#work"><span>02</span>Work</a>
        <a href="#stack"><span>03</span>Stack</a>
        <a href="#contact"><span>04</span>Contact</a>
      </nav>
      <div class="menu__foot">
        <a class="menu__mail" href="${attr(mail)}">${esc(P.email)}</a>
        <p class="menu__links">
          ${cfg.socials.map((s) => `<a href="${attr(s.url)}"${extMe(s.url)}>${esc(s.label)}</a>`).join("\n          ")}
        </p>
      </div>
    </div>

    <main id="main">
      <!-- Hero -->
      <section class="hero" id="top" data-scene="halo">
        <div class="hero__content wrap">
          <div class="hero__id">
            <h1 class="hero__name">
              <span class="hero__line" aria-hidden="true"><span class="hero__word" data-name>${esc(P.firstName)}</span></span>
              <span class="hero__line" aria-hidden="true"><span class="hero__word" data-name>${esc(P.lastName)}</span></span>
              <span class="sr-only">${esc(P.full)}, also known as ${esc(P.alias)}</span>
            </h1>
            <p class="hero__title" data-hero-in><span data-scramble>${esc(P.title)}</span></p>
          </div>

          <div class="hero__pitch" data-hero-in>
            <p class="hero__intro">${esc(H.intro)}</p>
            <a class="arrow-link" href="#work"><span data-roll>${esc(H.cta)}</span>${icon("arrow-d")}</a>
          </div>
        </div>

        <div class="hero__stage">
          <figure class="portrait" data-portrait>
            <div class="portrait__glow" aria-hidden="true"></div>
            <div class="portrait__frame">
              <img class="portrait__img" src="${attr(sizes.portraitPath)}" width="${sizes.portrait[0]}" height="${sizes.portrait[1]}" alt="${attr(P.photos.portraitAlt || `Portrait of ${P.full}`)}" fetchpriority="high" decoding="async" data-portrait-img />
            </div>
            <canvas class="portrait__lens" aria-hidden="true" data-portrait-canvas></canvas>
            <div class="hud" aria-hidden="true" data-hud>
              <span class="hud__c hud__c--tl"></span><span class="hud__c hud__c--tr"></span>
              <span class="hud__c hud__c--bl"></span><span class="hud__c hud__c--br"></span>
              <span class="hud__tag hud__tag--top">${esc(H.hudTag)}</span>
              <span class="hud__tag hud__tag--bottom"><i></i>${esc(H.hudStatus)}</span>
            </div>
          </figure>
        </div>

        <div class="marquee hero__marquee" aria-hidden="true" data-marquee>
          <div class="marquee__row" data-marquee-row>
            <div class="marquee__set">
              <span class="marquee__word">${esc(P.alias)}</span>
              ${spark("marquee__spark")}
              <span class="marquee__word marquee__word--ghost">${esc(P.alias)}</span>
              ${spark("marquee__spark")}
            </div>
          </div>
        </div>

        <a class="orb hero__orb" href="#contact" data-magnetic data-orb data-cursor="Say hi">
          <span class="orb__fill" aria-hidden="true"></span>
          <span class="orb__label">${esc(H.orb)}</span>
          <svg class="orb__ring" viewBox="0 0 200 200" aria-hidden="true">
            <defs><path id="orb-path" d="M100 100 m-82 0 a82 82 0 1 1 164 0 a82 82 0 1 1 -164 0" /></defs>
            <text><textPath href="#orb-path" textLength="508" lengthAdjust="spacing">${esc(`${P.email} · `.repeat(Math.max(1, Math.floor(56 / (P.email.length + 3)))))}</textPath></text>
          </svg>
        </a>

        <div class="hero__foot wrap" data-hero-in>
          <p class="hero__socials">
            ${heroLinks.map((s) => `<a href="${attr(s.url)}"${extMe(s.url)}><span data-roll>${esc(s.label)}</span></a>`).join("\n            ")}
          </p>
          <p class="clock">${esc(P.location.city || "Local time")} <time data-clock>--:--</time></p>
        </div>
      </section>

      <!-- About -->
      <section class="section about" id="about" data-scene="terrain" aria-labelledby="about-label">
        <div class="wrap">
          <p class="label" id="about-label">${esc(A.label)}</p>
          <p class="statement" data-words>${esc(A.statement)}</p>

          <div class="about__grid">${
            sizes.aboutPath
              ? `
            <figure class="about__photo" data-tilt data-clip>
              <div class="about__photo-inner">
                <img src="${attr(sizes.aboutPath)}" width="${sizes.about[0]}" height="${sizes.about[1]}" loading="lazy" decoding="async" alt="${attr(P.photos.aboutAlt || `Photo of ${P.full}`)}" />
              </div>
              <figcaption>${esc(A.caption)}</figcaption>
            </figure>`
              : ""
          }

            <div class="about__copy">
              ${A.paragraphs.map((t) => `<p data-reveal>${esc(t)}</p>`).join("\n              ")}
              <p data-reveal class="about__sign">${esc(A.sign)}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- What I build -->
      <section class="section build" id="build" data-scene="terrain" aria-labelledby="build-title">
        <div class="wrap">
          <header class="section-head">
            <p class="label">${esc(B.label)}</p>
            <h2 id="build-title" class="h2" data-split>${esc(B.heading)}</h2>
            <p class="section-head__aside" data-reveal>${esc(B.aside)}</p>
          </header>

          <ol class="rows" data-rows>
            ${B.rows
              .map(
                (r, i) => `<li class="row" data-viz="${i}">
              <span class="row__no">${pad2(i + 1)}</span>
              <h3 class="row__title">${esc(r.title)}</h3>
              <p class="row__desc">${esc(r.description)}</p>
            </li>`
              )
              .join("\n            ")}
          </ol>
        </div>

        <div class="viz-float" aria-hidden="true" data-viz-float>
          <div class="viz-float__inner">
            ${B.rows.map((r) => VIZ[r.viz]).join("\n            ")}
          </div>
        </div>
      </section>

      <!-- Work -->
      <section class="section work" id="work" data-scene="deep" aria-labelledby="work-title">
        <div class="wrap">
          <header class="section-head">
            <p class="label">${esc(W.label)}</p>
            <h2 id="work-title" class="h2" data-split>${esc(W.heading)}</h2>
            <p class="section-head__aside" data-reveal>${esc(W.aside)}</p>
          </header>

          <div class="projects" data-projects>${W.projects.map(projectHtml).join("\n")}
          </div>${
            W.sideQuests.length
              ? `

          <div class="more">
            <h3 class="sub-head" data-reveal>${esc(W.sideQuestsHeading)}</h3>
            <ul class="more__grid">${W.sideQuests.map(sideQuestHtml).join("")}
            </ul>
          </div>`
              : ""
          }${
            W.archive.enabled
              ? `

          <div class="archive" data-archive>
            <div class="archive__head">
              <div>
                <h3 class="sub-head" data-reveal>${esc(W.archive.heading)}</h3>
                <p class="archive__note" data-reveal>
                  <span class="live__dot" aria-hidden="true"></span>
                  <span data-archive-status>${esc(W.archive.note)}</span>
                </p>
              </div>
              <div class="archive__tools" data-reveal>
                <label class="search">
                  ${icon("search")}
                  <span class="sr-only">Filter repositories</span>
                  <input type="search" placeholder="Filter repositories" autocomplete="off" data-archive-search />
                </label>
                <div class="filters" role="group" aria-label="Filter by language" data-archive-filters></div>
              </div>
            </div>
            <ol class="repos" data-archive-list aria-live="polite">
              <noscript>
                <li class="repo"><a href="https://github.com/${attr(W.archive.githubUser)}?tab=repositories">Browse all public repositories on GitHub</a></li>
              </noscript>
            </ol>
            <div class="archive__foot">
              <button class="arrow-link" type="button" data-archive-more hidden>Show all repositories</button>
              <label class="toggle">
                <input type="checkbox" data-archive-forks />
                <span class="toggle__ui" aria-hidden="true"></span>
                Include forks
              </label>
              <a class="arrow-link" href="https://github.com/${attr(W.archive.githubUser)}?tab=repositories" target="_blank" rel="noopener"><span data-roll>Open my GitHub</span>${icon("arrow-ur")}</a>
            </div>
          </div>`
              : ""
          }
        </div>
      </section>

      <!-- Crossing tape bands -->
      <div class="bands" aria-hidden="true">
        <div class="band band--dark" data-marquee data-direction="-1">
          <div class="marquee__row" data-marquee-row>
            <div class="marquee__set">${bandSet(bands.outline)}</div>
          </div>
        </div>
        <div class="band band--ember" data-marquee data-direction="1">
          <div class="marquee__row" data-marquee-row>
            <div class="marquee__set">${bandSet(bands.accent)}</div>
          </div>
        </div>
      </div>

      <!-- Stack: ball pit -->
      <section class="section pit-section" id="stack" data-scene="terrain" aria-labelledby="stack-title">
        <div class="wrap">
          <header class="section-head">
            <p class="label">${esc(S.label)}</p>
            <h2 id="stack-title" class="h2" data-split>${esc(S.heading)}</h2>
            <p class="section-head__aside" data-reveal>${esc(S.aside)}</p>
          </header>

          <div class="pit" data-pit>
            <canvas class="pit__canvas" aria-hidden="true" data-pit-canvas></canvas>
            <p class="pit__hint" aria-hidden="true"><span>Drag</span> and throw</p>
          </div>

          <dl class="toolbox">
            ${toolbox}
          </dl>
        </div>
      </section>

      <!-- Process -->
      <section class="section process" id="process" data-scene="terrain" aria-labelledby="process-title">
        <div class="wrap">
          <header class="section-head">
            <p class="label">${esc(R.label)}</p>
            <h2 id="process-title" class="h2" data-split>${esc(R.heading)}</h2>
          </header>
          <ol class="steps" data-steps>
            ${R.steps
              .map(
                (st, i) => `<li class="step">
              <span class="step__node" aria-hidden="true"></span>
              <p class="step__no">${pad2(i + 1)}</p>
              <h3 class="step__title">${esc(st.title)}</h3>
              <p>${esc(st.text)}</p>
            </li>`
              )
              .join("\n            ")}
            <span class="steps__rail" aria-hidden="true"><span data-steps-fill></span></span>
          </ol>
        </div>
      </section>

      <!-- Contact -->
      <section class="section contact" id="contact" data-scene="vortex" aria-labelledby="contact-title">
        <div class="wrap">
          <div class="contact__head">
            <p class="label label--ember">${esc(C.label)}</p>
            <h2 id="contact-title" class="contact__title" data-split>${esc(C.heading)}<span class="is-ember">.</span></h2>
            <p class="contact__lede" data-reveal>${esc(C.lede)}</p>
          </div>

          <div class="contact__mail" data-reveal>
            <a class="mail-link" href="${attr(mailSubject)}" data-cursor="Write">
              <span class="mail-link__text">${esc(P.email)}</span>
            </a>
            <div class="contact__actions">
              <a class="orb orb--sm" href="${attr(mailSubject)}" data-magnetic data-cursor="Write">
                <span class="orb__fill" aria-hidden="true"></span>
                <span class="orb__label">${esc(C.emailButton)}</span>
              </a>
              <button class="copy-btn" type="button" data-copy="${attr(P.email)}">
                ${icon("copy")}
                <span data-copy-label>${esc(C.copyButton)}</span>
              </button>
            </div>
          </div>

          <ul class="channels" aria-label="Other ways to reach me">
            ${cfg.socials.map(channelHtml).join("\n            ")}
          </ul>
        </div>
      </section>
    </main>

    <footer class="footer">
      <div class="wrap">
        <a class="footer__word" href="#top" aria-label="Back to top" data-footer-word>
          <span aria-hidden="true">${esc(P.alias)}</span>
        </a>
        <div class="footer__row">
          <p>&copy; <span data-year>${new Date().getFullYear()}</span> ${esc(cfg.footer.line)}</p>
          <nav class="footer__nav" aria-label="Footer">
            <a href="#about">About</a><a href="#work">Work</a><a href="#stack">Stack</a><a href="#contact">Contact</a>
          </nav>
          <a class="footer__top" href="#top">Back to top ${icon("arrow-up")}</a>
        </div>
      </div>
    </footer>
${
  M.enabled
    ? `
    <!-- ${esc(M.name)}: the site's mascot and guide. Tap to chat. -->
    <div class="grim" data-grim>
      <p class="grim__bubble" aria-hidden="true" data-grim-bubble></p>
      <div class="grim__chat" id="grim-chat" role="dialog" aria-label="Chat with ${attr(M.name)}" data-grim-chat data-lenis-prevent hidden>
        <div class="grim__chat-head">
          <span class="grim__avatar" aria-hidden="true"><i></i><i></i></span>
          <div class="grim__who">
            <p class="grim__name">${esc(M.name)}</p>
            <p class="grim__status"><span class="live__dot" aria-hidden="true"></span>online, obviously</p>
          </div>
          <button class="grim__close" type="button" aria-label="Close chat" data-grim-close>${icon("close")}</button>
        </div>
        <div class="grim__log" role="log" aria-live="polite" aria-label="Messages" data-grim-log></div>
        <div class="grim__chips" role="group" aria-label="Ask ${attr(M.name)}" data-grim-chips></div>
        <button class="grim__hide" type="button" data-grim-hide>Hide ${esc(M.name)} for this visit</button>
      </div>
      <button class="grim__btn" type="button" aria-label="Chat with ${attr(M.name)}, the site mascot" aria-expanded="false" aria-controls="grim-chat" data-grim-btn>
        ${mascotSvg(T)}
      </button>
    </div>
`
    : ""
}
    <div class="toast" role="status" aria-live="polite" data-toast></div>

    <!--/email_off-->
    <script src="assets/vendor/gsap.min.js?v=${BUILD}" defer></script>
    <script src="assets/vendor/ScrollTrigger.min.js?v=${BUILD}" defer></script>
    <script src="assets/vendor/SplitText.min.js?v=${BUILD}" defer></script>
    <script src="assets/vendor/lenis.min.js?v=${BUILD}" defer></script>
    <script type="module" src="assets/js/main.js?v=${BUILD}"></script>
  </body>
</html>
`;
}

function page404(cfg) {
  const P = cfg.person;
  return `<!doctype html>
<html lang="${attr(cfg.site.lang)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Page not found · ${esc(P.alias)}</title>
    <meta name="robots" content="noindex" />
    <meta name="theme-color" content="#07080b" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="/assets/css/main.css?v=${BUILD}" />
    <style>
      .lost { position: relative; z-index: 2; display: grid; place-items: center; min-height: 100svh; padding: 48px var(--gutter); text-align: center; }
      .lost__inner { display: grid; justify-items: center; gap: 22px; max-width: 640px; }
      .lost .lost__code { font-size: clamp(7rem, 30vw, 16rem); font-weight: 860; font-stretch: 120%; letter-spacing: -0.06em; line-height: 0.85; color: rgba(206, 214, 255, 0.14); }
      .lost .lost__code span { color: var(--ember); }
      .lost h1 { font-size: clamp(1.8rem, 1.2rem + 2.4vw, 3rem); font-weight: 780; font-stretch: 110%; letter-spacing: -0.03em; line-height: 1.05; }
      .lost p { color: var(--ink-2); }
      .lost__actions { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 28px; margin-top: 8px; }
    </style>
  </head>
  <body>
    <!--email_off-->
    <div class="atmosphere" aria-hidden="true"></div>
    <main class="lost">
      <div class="lost__inner">
        <p class="lost__code" aria-hidden="true">4<span>0</span>4</p>
        <h1>Nothing lives at this address.</h1>
        <p>The page may have moved. Everything is on the home page, and ${esc(P.firstName)} is one email away.</p>
        <div class="lost__actions">
          <a class="orb orb--sm" href="/"><span class="orb__fill" aria-hidden="true"></span><span class="orb__label">Home</span></a>
          <a class="arrow-link" href="mailto:${attr(P.email)}">${esc(P.email)}</a>
        </div>
      </div>
    </main>
    <!--/email_off-->
  </body>
</html>
`;
}

/* ------------------------------------------------------------- render cards */

function ogCard(cfg, sizes) {
  const P = cfg.person;
  const T = cfg.theme;
  return `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="../assets/css/main.css">
<style>
body{margin:0;width:1200px;height:630px;overflow:hidden;background:#07080b}
.og{position:relative;width:1200px;height:630px;overflow:hidden;background:radial-gradient(520px 420px at 773px 230px,rgba(${T.signalRgb},.22),transparent 70%),#07080b}
.og canvas{position:absolute;inset:0;z-index:1}
.mq{position:absolute;left:-40px;bottom:46px;z-index:2;white-space:nowrap;font:870 190px/0.9 "Mona Sans";font-stretch:125%;letter-spacing:-.05em;color:#eceef4}
.mq b{color:transparent;-webkit-text-stroke:2px rgba(236,238,244,.85);font-weight:870}
.pic{position:absolute;left:560px;bottom:-10px;height:600px;z-index:3;filter:drop-shadow(0 0 1px rgba(200,210,255,.55)) drop-shadow(0 0 28px rgba(${T.signalRgb},.3))}
.copy{position:absolute;left:64px;top:60px;z-index:4;max-width:560px}
h1{margin:0;font:840 calc(104px * ${Math.min(1, 7.6 / Math.max(P.firstName.length, P.lastName.length)).toFixed(3)})/.88 "Mona Sans";font-stretch:120%;letter-spacing:-.048em;color:#eceef4}
h1 span{display:block;background:linear-gradient(100deg,#fff 0%,${T.signalLight} 38%,${T.signal} 88%);-webkit-background-clip:text;background-clip:text;color:transparent;padding-right:.1em}
.t{margin-top:18px;font:720 32px "Mona Sans";font-stretch:112%;letter-spacing:-.02em;color:#eceef4}
.u{position:absolute;right:56px;top:66px;z-index:4;font:650 22px "Mona Sans";color:${T.accent}}
.u:before{content:"";display:inline-block;width:9px;height:9px;background:${T.accent};margin-right:10px;vertical-align:middle}
</style></head><body><div class="og"><canvas id="c" width="1200" height="630"></canvas>
<div class="mq">${esc(P.alias)} <b>${esc(P.alias)}</b></div>
<img class="pic" src="../${attr(sizes.portraitPath)}">
<div class="copy"><h1>${esc(P.firstName)}<span>${esc(P.lastName)}</span></h1><p class="t">${esc(P.title)}</p></div>
<p class="u">${esc(cfg.site.url.replace(/^https?:\/\//, "").replace(/\/$/, ""))}</p></div>
<script>
const c=document.getElementById('c').getContext('2d');const cx=773,cy=200;
const g=()=>{let u=0,v=0;while(!u)u=Math.random();while(!v)v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(6.283*v)};
function dots(n,f){for(let i=0;i<n;i++){const [x,y,a,s,col]=f();c.fillStyle='rgba('+col+','+a+')';c.beginPath();c.arc(x,y,s,0,7);c.fill();}}
for(const [R,n,a] of [[230,3600,.8],[285,1500,.5]]){const tilt=1.18,roll=.32;dots(n,()=>{const t=Math.random()*6.283,r=R*(1+g()*.015);let x=Math.cos(t)*r,z=Math.sin(t)*r;const y1=-z*Math.sin(tilt),x2=x*Math.cos(roll)-y1*Math.sin(roll),y2=x*Math.sin(roll)+y1*Math.cos(roll);return[cx+x2,cy+y2,a,1.1,'${T.iceRgb}']})}
dots(240,()=>[Math.random()*1200,Math.random()*630,Math.random()*.5,Math.random()*1.2,'220,226,255']);
</script></body></html>`;
}

/* --------------------------------------------------------------------- main */

async function main() {
  const cfg = withDefaults(raw);
  console.log(`Building ${cfg.person.full} (${cfg.person.alias}) → ${OUT}`);
  mkdirSync(OUT, { recursive: true });

  // Template assets, with the build version and theme applied.
  const T = cfg.theme;
  copyDir(join(TEMPLATE, "assets"), join(OUT, "assets"), (text, name) => {
    let t = text.replace(/__BUILD__/g, BUILD);
    if (name === "main.css") {
      t = t.replace(
        /\/\* theme:start[\s\S]*?\/\* theme:end \*\//,
        `/* theme:start (generated by build.mjs) */
  --ember: ${T.accent};
  --ember-rgb: ${T.accentRgb};
  --ember-ink: ${T.accentInk};
  --ember-soft: ${T.accentSoft};
  --ember-deep: ${T.accentDeep};
  --ice: ${T.ice};
  --ice-rgb: ${T.iceRgb};
  --ice-pale: ${T.icePale};
  --signal: ${T.signal};
  --signal-rgb: ${T.signalRgb};
  --signal-light: ${T.signalLight};
  /* theme:end */`
      );
    }
    return t;
  });

  // Images from the config.
  const P = cfg.person;
  const portraitPath = place(P.photos.portrait, "assets/img");
  const aboutPath = P.photos.about ? place(P.photos.about, "assets/img") : null;
  for (const p of cfg.work.projects) for (const m of p.media || []) m.src = place(m.src, "assets/work");
  for (const q of cfg.work.sideQuests) if (q.image) q.image = place(q.image, "assets/work");
  const sizes = { portraitPath, portrait: size(portraitPath), aboutPath, about: aboutPath ? size(aboutPath) : null };

  // Generated assets.
  mkdirSync(join(OUT, "assets/img"), { recursive: true });
  writeFileSync(join(OUT, "assets/img/icons.svg"), await buildSprite(cfg));
  const siteData = {
    email: P.email,
    timezone: P.location.timezone,
    theme: { accent: T.accent, accentLight: T.accentLight, signal: T.signal, ice: T.ice },
    github: cfg.work.archive.enabled
      ? {
          user: cfg.work.archive.githubUser,
          featured: cfg.work.projects.map((p) => p.repo).filter(Boolean).concat(cfg.work.sideQuests.map((q) => q.repo).filter(Boolean)),
          hidden: cfg.work.archive.hidden,
          fallbackDescriptions: cfg.work.archive.fallbackDescriptions,
        }
      : { user: null, featured: [], hidden: [], fallbackDescriptions: {} },
    tools: await buildTools(cfg),
    mascot: cfg.mascot.enabled ? cfg.mascot : null,
    console: { title: cfg.seo.consoleTitle || "You found the console. Respect.", body: `Like what you see? ${P.email}` },
  };
  writeFileSync(join(OUT, "assets/js/site-data.js"), `// Generated by build.mjs from portfolio.json. Edit the config, not this file.\nexport const SITE = ${JSON.stringify(siteData, null, 2)};\n`);

  // Pages and metadata.
  const url = cfg.site.url.replace(/\/?$/, "/");
  writeFileSync(join(OUT, "index.html"), page(cfg, sizes));
  writeFileSync(join(OUT, "404.html"), page404(cfg));
  writeFileSync(join(OUT, "favicon.svg"), favicon(T));
  writeFileSync(join(OUT, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${url}sitemap.xml\n`);
  writeFileSync(
    join(OUT, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${url}</loc>
    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
    <image:image><image:loc>${url}${portraitPath}</image:loc></image:image>${aboutPath ? `\n    <image:image><image:loc>${url}${aboutPath}</image:loc></image:image>` : ""}
  </url>
</urlset>
`
  );
  writeFileSync(join(OUT, ".nojekyll"), "");
  const host = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (cfg.site.cname !== false && !/github\.io$/.test(host) && host !== "example.com") writeFileSync(join(OUT, "CNAME"), host);

  // Cards for render_images.py (og.jpg + apple-touch-icon.png).
  rmSync(join(OUT, ".render"), { recursive: true, force: true });
  mkdirSync(join(OUT, ".render"), { recursive: true });
  writeFileSync(join(OUT, ".render/og.html"), ogCard(cfg, sizes));
  writeFileSync(join(OUT, ".render/icon.html"), `<!doctype html><body style="margin:0;background:#0a0b11"><img src="../favicon.svg" width="180" height="180" style="display:block"></body>`);

  console.log(`✔ Built. Next: python scripts/render_images.py --site "${OUT}"  (social card + touch icon)`);
}

main().catch((e) => fail(e.stack || e.message));
