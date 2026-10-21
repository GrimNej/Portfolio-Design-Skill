// Live repository list for "The rest of the pile". Loads public repositories
// from the GitHub API in the visitor's browser (cached for 30 minutes per
// session) and falls back to data/github.json when the API is unreachable or
// rate limited, so the list never renders empty.

import { SITE } from "./site-data.js?v=__BUILD__";

const USER = SITE.github.user;
const API = "https://api.github.com";
const CACHE_KEY = `gh:v2:${USER}`;
const CACHE_TTL = 30 * 60 * 1000;
const PAGE = 8;

const FEATURED = new Set(SITE.github.featured);
const HIDDEN = new Set([USER, ...SITE.github.hidden]); // the profile README repository, plus any opted out

const LANG_COLORS = {
  Python: "#4f8fd1",
  TypeScript: "#3f7fd6",
  JavaScript: "#f1e05a",
  Kotlin: "#a97bff",
  Rust: "#dea584",
  Go: "#00add8",
  HTML: "#e96b46",
  CSS: "#8a5cf6",
  "Jupyter Notebook": "#f08a3c",
  Java: "#d08a3a",
  Swift: "#f05138",
  Shell: "#89e051",
  "C++": "#f34b7d",
  "C#": "#178600",
  Dart: "#00b4ab",
  Ruby: "#cc342d",
  PHP: "#777bb4",
};

// Taglines for repositories without a GitHub description (from their READMEs).
const FALLBACK_DESCRIPTIONS = SITE.github.fallbackDescriptions;

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    return Date.now() - c.at < CACHE_TTL ? c.repos : null;
  } catch {
    return null;
  }
}

function writeCache(repos) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), repos }));
  } catch {
    /* storage unavailable */
  }
}

async function getJSON(url, headers = {}) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return res.json();
}

function normaliseRepo(r) {
  return {
    name: r.name,
    description: r.description || FALLBACK_DESCRIPTIONS[r.name] || null,
    url: r.html_url ?? r.url,
    language: r.language,
    fork: r.fork,
    pushedAt: r.pushed_at ?? r.pushedAt,
    topics: r.topics ?? [],
  };
}

async function loadRepos() {
  const cached = readCache();
  if (cached) return { repos: cached, source: "live" };
  try {
    const live = await getJSON(`${API}/users/${USER}/repos?per_page=100&sort=pushed`, { Accept: "application/vnd.github+json" });
    const repos = live.map(normaliseRepo);
    writeCache(repos);
    return { repos, source: "live" };
  } catch {
    try {
      const snap = await getJSON("data/github.json");
      return { repos: snap.repos.map(normaliseRepo), source: "snapshot" };
    } catch {
      return { repos: [], source: "none" };
    }
  }
}

const rtf = typeof Intl !== "undefined" && Intl.RelativeTimeFormat ? new Intl.RelativeTimeFormat("en", { numeric: "auto" }) : null;
const fmtDate = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" });

function timeAgo(iso) {
  if (!iso) return "";
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const units = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, secs] of units) {
    if (Math.abs(diff) >= secs || unit === "minute") {
      const v = Math.round(diff / secs);
      return rtf ? rtf.format(v, unit) : `${Math.abs(v)} ${unit}s ago`;
    }
  }
  return "";
}

function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else n.setAttribute(k, v);
  }
  for (const c of [].concat(children)) if (c) n.append(c);
  return n;
}

function icon(id, cls = "icon") {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", cls);
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `assets/img/icons.svg#i-${id}`);
  svg.append(use);
  return svg;
}

function initArchive(root, repos, source) {
  const list = root.querySelector("[data-archive-list]");
  const search = root.querySelector("[data-archive-search]");
  const filters = root.querySelector("[data-archive-filters]");
  const more = root.querySelector("[data-archive-more]");
  const forks = root.querySelector("[data-archive-forks]");
  const status = root.querySelector("[data-archive-status]");

  // Documented repositories first, then by most recent push.
  const all = repos
    .filter((r) => !HIDDEN.has(r.name))
    .sort((a, b) => Number(Boolean(b.description)) - Number(Boolean(a.description)) || new Date(b.pushedAt) - new Date(a.pushedAt));
  let lang = "All";
  let query = "";
  let expanded = false;

  if (status && source === "snapshot") {
    status.textContent = "GitHub isn't answering right now, so this is a saved copy of my repositories.";
    root.querySelector(".archive__note .live__dot")?.classList.add("is-stale");
  }

  const langs = {};
  all.filter((r) => !r.fork).forEach((r) => {
    if (r.language) langs[r.language] = (langs[r.language] || 0) + 1;
  });
  const top = Object.entries(langs)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([l]) => l);

  filters.replaceChildren(
    ...["All", ...top].map((l) => el("button", { type: "button", "aria-pressed": l === lang ? "true" : "false", "data-lang": l, text: l }))
  );

  filters.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-lang]");
    if (!b) return;
    lang = b.dataset.lang;
    filters.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    render();
  });
  search.addEventListener("input", () => {
    query = search.value.trim().toLowerCase();
    render();
  });
  forks.addEventListener("change", render);
  more.addEventListener("click", () => {
    expanded = !expanded;
    render();
  });

  function row(r) {
    const isNew = Date.now() - new Date(r.pushedAt).getTime() < 21 * 86400000;
    const name = el("span", { class: "repo__name" }, [r.name.replace(/-/g, "‑")]);
    if (FEATURED.has(r.name)) name.append(el("span", { class: "repo__badge", text: "featured" }));
    if (r.fork) name.append(el("span", { class: "repo__badge", text: "fork" }));
    if (isNew && !r.fork) name.append(el("span", { class: "repo__badge repo__badge--new", text: "fresh" }));
    const desc = el("span", { class: r.description ? "repo__desc" : "repo__desc repo__desc--empty", text: r.description || "No description yet." });
    const langEl = el("span", { class: "repo__lang", style: r.language ? `--lang: ${LANG_COLORS[r.language] || "#8c92a7"}` : null }, [
      el("i", { "aria-hidden": "true" }),
      r.language || "Mixed",
    ]);
    const date = el("span", { class: "repo__date", title: `Last updated ${fmtDate.format(new Date(r.pushedAt))}`, text: timeAgo(r.pushedAt) });
    const a = el("a", { href: r.url, target: "_blank", rel: "noopener", "data-cursor": "Open repo" }, [name, desc, langEl, date, icon("arrow-ur", "icon repo__go")]);
    return el("li", { class: "repo" }, [a]);
  }

  function render() {
    const matches = all.filter((r) => {
      if (!forks.checked && r.fork) return false;
      if (lang !== "All" && r.language !== lang) return false;
      if (!query) return true;
      return [r.name, r.description, r.language, ...(r.topics || [])].filter(Boolean).join(" ").toLowerCase().includes(query);
    });
    const visible = expanded || query ? matches : matches.slice(0, PAGE);
    list.replaceChildren(...(matches.length ? visible.map(row) : [el("li", { class: "repos__empty", text: "Nothing matches that. Try another filter." })]));
    more.hidden = Boolean(query) || matches.length <= PAGE;
    more.textContent = expanded ? "Show fewer" : `Show all ${matches.length} repositories`;
  }

  render();
}

export async function initGitHub() {
  const archive = document.querySelector("[data-archive]");
  if (!archive) return;
  const list = archive.querySelector("[data-archive-list]");
  list.replaceChildren(...Array.from({ length: 5 }, () => el("li", { class: "repo__skeleton", "aria-hidden": "true" })));

  const { repos, source } = await loadRepos();
  if (repos.length) initArchive(archive, repos, source);
  else {
    list.replaceChildren(
      el("li", { class: "repos__empty" }, [
        "GitHub couldn't be reached right now. ",
        el("a", { class: "arrow-link", href: `https://github.com/${USER}?tab=repositories`, target: "_blank", rel: "noopener", text: "Browse my repositories on GitHub" }),
      ])
    );
  }
}
