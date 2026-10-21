# Deploying

The build output (`portfolio/site/`) is a plain static site: HTML, CSS, JavaScript modules, fonts and images. Any static host works. GitHub Pages is the default because the archive already talks to GitHub and it's free.

**Ask before every step that publishes something**: creating a repo, pushing, enabling Pages, changing DNS. Show the person exactly what will become public (the site folder) first.

## GitHub Pages

Two options:

| | User site | Project site |
|---|---|---|
| Repo name | `<user>.github.io` | anything, e.g. `portfolio` |
| Address | `https://<user>.github.io/` | `https://<user>.github.io/portfolio/` |
| `site.url` | `https://<user>.github.io/` | `https://<user>.github.io/portfolio/` |

All asset paths in the build are relative, so both work without changes. Set `site.url` to the final address (or the custom domain) before the last build, because canonical links, the sitemap and the share image use it.

With the GitHub CLI, after the person approves:

```bash
cd portfolio/site
git init -b main
git add -A
git commit -m "Portfolio site"
gh repo create <user>/<user>.github.io --public --source . --push
gh api -X POST repos/<user>/<user>.github.io/pages -f "source[branch]=main" -f "source[path]=/"
```

If the repo already exists, clone it, replace its contents with `site/` (keep its history), commit on a branch and open a pull request, or push to `main` only if the person says so.

The site includes `.nojekyll`, so GitHub serves the files as they are. First deploys take a minute or two; check with:

```bash
gh api repos/<user>/<user>.github.io/pages --jq .status
```

## Custom domain

1. Set `site.url` to `https://their-domain/` and rebuild. The build writes a `CNAME` file with the host name (skip it with `"cname": false`).
2. DNS at the registrar or Cloudflare:
   - Apex (`their-domain`): four `A` records to `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` (and optionally `AAAA` to `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`).
   - `www`: a `CNAME` to `<user>.github.io`.
3. In the repo's Pages settings, confirm the custom domain and turn on **Enforce HTTPS** once the certificate is issued.

## Behind Cloudflare

Cloudflare in front of GitHub Pages works well. Check these settings for the zone:

- **Scrape Shield → Email Address Obfuscation.** When it's on, Cloudflare rewrites every email address in the HTML. The build wraps the email markup in `<!--email_off-->` comments, which Cloudflare honours, so the site works either way. If the live check reports rewritten emails, the wrappers were lost (edited HTML by hand?) or the HTML is cached from an old build: rebuild, redeploy, purge the cache.
- **SSL/TLS mode: Full.** "Flexible" can cause redirect loops with Enforce HTTPS on GitHub.
- **Rocket Loader: off.** It defers and rewrites script tags, which can break the start-up order of the modules.
- **Caching**: assets carry `?v=<build>` so new deploys show up without a purge. HTML is cached for a short time by default; purge it after a deploy if the change is urgent.
- DNS records for Pages can be proxied (orange cloud) once HTTPS works.

## Other hosts

Netlify, Vercel, Cloudflare Pages, S3 or any web server: upload the contents of `site/` as the site root. Make sure `404.html` is served for unknown paths (Netlify and Cloudflare Pages do it automatically) and the `.nojekyll` and `CNAME` files are harmless to keep.

## After deploying

```bash
python scripts/qa/run_all.py --url https://their-domain/ --only smoke,live --out portfolio/qa-live
```

Then open the site on a phone. Share the link in a chat app to see the preview card (it uses `assets/img/og.jpg`).

## Updating

Change `portfolio.json`, rebuild, rerun QA, then commit and push the new `site/` contents. Snapshot the GitHub archive again now and then so the fallback list stays fresh (`snapshot_github.mjs`).
