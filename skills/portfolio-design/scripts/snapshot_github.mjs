#!/usr/bin/env node
// Saves a snapshot of a user's PUBLIC repositories to <site>/data/github.json.
// The site loads the same list live in the visitor's browser; this file is the
// fallback when the GitHub API is unreachable or rate limited.
//
//   node snapshot_github.mjs --user <github-username> --site <site-folder>
//
// Uses the unauthenticated public endpoint on purpose, so private repositories
// can never end up in the published file, whatever credentials are around.

import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith("--") ? [...a, [v.slice(2), all[i + 1]]] : a), []));
if (!args.user || !args.site) {
  console.error("Usage: node snapshot_github.mjs --user <github-username> --site <site-folder>");
  process.exit(1);
}

const res = await fetch(`https://api.github.com/users/${encodeURIComponent(args.user)}/repos?per_page=100&sort=pushed`, {
  headers: { Accept: "application/vnd.github+json", "User-Agent": "portfolio-design-skill" },
});
if (!res.ok) {
  // Set the exit code instead of calling process.exit(): exiting while fetch's
  // socket is still closing trips a libuv assertion on Windows.
  console.error(`GitHub answered ${res.status} ${res.statusText}. Try again later (the unauthenticated limit is 60 requests an hour).`);
  process.exitCode = 1;
} else {
  const repos = await res.json();
  const snapshot = {
    generatedAt: new Date().toISOString(),
    repos: repos
      .filter((r) => !r.private)
      .map((r) => ({ name: r.name, description: r.description, url: r.html_url, language: r.language, fork: r.fork, pushedAt: r.pushed_at, topics: r.topics ?? [] })),
  };
  const dir = join(resolve(args.site), "data");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "github.json"), JSON.stringify(snapshot, null, 2) + "\n");
  console.log(`Saved ${snapshot.repos.length} public repositories to ${join(dir, "github.json")}`);
}
