#!/usr/bin/env node
// Scans a GitHub user's PUBLIC repositories to help pick featured projects.
//
//   node discover_github.mjs --user <github-username> [--out discovery.json] [--download <folder> --repos a,b,c]
//
// For every non-fork repository (most recently pushed first) it records the
// description, language, stars, homepage and topics, then reads the README to
// find a tagline (first bold line or first paragraph), banner/screenshot
// images (badges are skipped) and live links. With --download, the first
// image of each listed repository is saved to <folder>/<repo>.<ext> so it can
// be used as a project preview.
//
// Only public data is read: the unauthenticated GitHub API and raw README files.

import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve, extname } from "node:path";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith("--") ? [...a, [v.slice(2), all[i + 1]]] : a), []));
if (!args.user) {
  console.error("Usage: node discover_github.mjs --user <github-username> [--out discovery.json] [--download <folder> --repos a,b]");
  process.exit(1);
}
const USER = args.user;
const UA = { "User-Agent": "portfolio-design-skill" };

async function json(url) {
  const res = await fetch(url, { headers: { Accept: "application/vnd.github+json", ...UA } });
  if (!res.ok) {
    console.error(`GitHub answered ${res.status} ${res.statusText}. Try again later (the unauthenticated limit is 60 requests an hour).`);
    return null;
  }
  return res.json();
}

async function readme(repo, branch) {
  for (const name of ["README.md", "readme.md", "Readme.md", "README.MD"]) {
    const url = `https://raw.githubusercontent.com/${USER}/${repo}/${branch}/${name}`;
    const res = await fetch(url, { headers: UA });
    if (res.ok) return { text: await res.text(), base: url.slice(0, url.lastIndexOf("/") + 1) };
  }
  return null;
}

const BADGE = /shields\.io|badge|badgen|img\.shields|travis-ci|codecov|github\.com\/.*\/workflows|readme-typing-svg|skillicons|vercel\.app\/api|komarev|github-readme-stats|forthebadge/i;

function analyse(md, base) {
  const images = [];
  for (const m of md.matchAll(/!\[([^\]]*)\]\(<?([^)>\s]+)>?(?:\s+"[^"]*")?\)|<img[^>]*?src=["']([^"']+)["'][^>]*?(?:alt=["']([^"']*)["'])?/gi)) {
    const src = m[2] || m[3];
    const alt = m[1] || m[4] || "";
    if (!src || BADGE.test(src)) continue;
    const abs = /^https?:/.test(src) ? src : new URL(src.replace(/^\.\//, ""), base).href;
    if (!images.find((i) => i.src === abs)) images.push({ src: abs, alt });
  }
  const text = md.replace(/<[^>]+>/g, " ").replace(/!\[[^\]]*\]\([^)]*\)/g, " ");
  const bold = text.match(/\*\*([^*\n]{12,160})\*\*/);
  const para = text.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, " ").trim()).find((p) => p.length > 40 && !/^[#|>-]/.test(p) && !/https?:\/\//.test(p));
  const links = [...new Set([...md.matchAll(/https?:\/\/[^\s)"'<>\]]+/g)].map((m) => m[0]))].filter(
    (u) => !/github\.com|githubusercontent|shields\.io|badge|npmjs|pypi|creativecommons|opensource\.org|apache\.org\/licenses/i.test(u)
  );
  return { tagline: bold?.[1]?.trim() || null, summary: para || null, images: images.slice(0, 6), liveLinks: links.slice(0, 5) };
}

const listed = await json(`https://api.github.com/users/${encodeURIComponent(USER)}/repos?per_page=100&sort=pushed`);
if (!listed) process.exitCode = 1;
const repos = (listed || []).filter((r) => !r.private);
const out = [];
for (const r of repos) {
  const entry = {
    name: r.name,
    fork: r.fork,
    description: r.description,
    language: r.language,
    stars: r.stargazers_count,
    pushedAt: r.pushed_at,
    homepage: r.homepage || null,
    topics: r.topics || [],
    url: r.html_url,
  };
  if (!r.fork) {
    const rm = await readme(r.name, r.default_branch || "HEAD");
    if (rm) Object.assign(entry, analyse(rm.text, rm.base));
  }
  out.push(entry);
}

if (listed) {
  const file = resolve(args.out || "discovery.json");
  writeFileSync(file, JSON.stringify({ user: USER, generatedAt: new Date().toISOString(), repos: out }, null, 2) + "\n");
  const own = out.filter((r) => !r.fork);
  console.log(`${own.length} public repositories (+${out.length - own.length} forks) written to ${file}\n`);
  for (const r of own.slice(0, 25)) {
    console.log(`- ${r.name.padEnd(34)} ${String(r.language || "").padEnd(12)} ${r.pushedAt.slice(0, 10)}  images:${(r.images || []).length}  ${r.description || r.tagline || ""}`.slice(0, 160));
  }

  if (args.download) {
    const dir = resolve(args.download);
    mkdirSync(dir, { recursive: true });
    const wanted = (args.repos || "").split(",").map((s) => s.trim()).filter(Boolean);
    for (const name of wanted) {
      const r = out.find((x) => x.name === name);
      const img = r?.images?.[0];
      if (!img) {
        console.log(`  ! ${name}: no README image found`);
        continue;
      }
      const res = await fetch(img.src, { headers: UA });
      if (!res.ok) {
        console.log(`  ! ${name}: ${res.status} for ${img.src}`);
        continue;
      }
      const type = res.headers.get("content-type") || "";
      const e = type.includes("svg") ? ".svg" : type.includes("png") ? ".png" : type.includes("webp") ? ".webp" : type.includes("gif") ? ".gif" : extname(new URL(img.src).pathname) || ".png";
      const dest = join(dir, `${name}${e}`);
      writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
      console.log(`  saved ${dest}`);
    }
  }
}
