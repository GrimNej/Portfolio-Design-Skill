"""Quality gates for a portfolio built with this skill.

    python run_all.py --url http://127.0.0.1:4321/ [--out qa-report] [--only smoke,overlap] [--full] [--live]

Every check prints PASS / WARN / FAIL. A summary goes to <out>/report.md with
screenshots for a visual pass. The exit code is 1 when anything failed.

Checks
  smoke     loads with no JavaScript errors on desktop and phone; the curtain
            lifts; particle field, name reveal, portrait and the header (hides
            on scroll down, returns with its bar on scroll up) all work
  shots     a screenshot of every screen of the page at 1440x900 and 390x844
  overflow  nothing sticks out sideways at 23 screen sizes; the hero name,
            pitch, orb and footer row never touch
  overlap   no two pieces of text overlap at any scroll position (6 screen
            sizes, 23 with --full); hovers each "What I build" row as well
  hover     row previews, the cursor label and the portrait lens all clear
            when the page scrolls under a pointer that stays still
  chat      the mascot: open, ask every question, actions, copy email, Escape,
            phone layout, reaction to a thrown ball
  name      gradient-filled hero letters are not cut off at their right edge
  cursor    the custom cursor dot keeps up with the pointer
  preload   the curtain waits for a slow portrait instead of lifting early
  a11y      axe-core audit (serious and critical issues fail)
  live      deployed-site checks: Cloudflare email rewriting, 404 status,
            robots.txt, sitemap.xml, share image (automatic for public URLs)

Requirements: pip install playwright pillow && playwright install chromium
"""
import argparse
import asyncio
import io
import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urljoin, urlparse

from playwright.async_api import async_playwright

GL = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
AXE = "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.3/axe.min.js"
ALL_SIZES = [(320, 568), (360, 740), (375, 667), (390, 844), (412, 915), (430, 932), (600, 960), (768, 1024), (820, 1180), (1024, 768), (1024, 1366), (1180, 820), (1280, 720), (1366, 768), (1440, 900), (1536, 864), (1680, 1050), (1906, 896), (1920, 1080), (2560, 1440), (667, 375), (844, 390), (932, 430)]
QUICK_SIZES = [(360, 740), (390, 844), (768, 1024), (1280, 720), (1440, 900), (1920, 1080)]
# GitHub's unauthenticated API allows 60 calls an hour; the archive falls back to data/github.json.
NOISE = re.compile(r"403|429|api\.github\.com|rate limit|favicon", re.I)


class Report:
    def __init__(self, out: Path):
        self.out = out
        self.rows = []

    def check(self, name, ok, detail="", warn=False):
        status = "PASS" if ok else ("WARN" if warn else "FAIL")
        self.rows.append((status, name, detail))
        print(f"{status} {name}" + (f"  [{detail}]" if detail else ""), flush=True)

    def write(self):
        failed = [r for r in self.rows if r[0] == "FAIL"]
        warned = [r for r in self.rows if r[0] == "WARN"]
        lines = [f"# QA report\n", f"{len(self.rows) - len(failed) - len(warned)} passed, {len(warned)} warnings, {len(failed)} failed\n", "| | Check | Detail |", "|---|---|---|"]
        for s, n, d in self.rows:
            lines.append(f"| {s} | {n} | {str(d).replace('|', '/')[:300]} |")
        (self.out / "report.md").write_text("\n".join(lines) + "\n", encoding="utf8")
        print(f"\n{len(self.rows) - len(failed) - len(warned)} passed, {len(warned)} warnings, {len(failed)} failed. Report: {self.out / 'report.md'}")
        return not failed


async def open_page(b, url, w, h, settle=4000, mobile=None, scale=1):
    mobile = (w < 700 or h < 450) if mobile is None else mobile
    ctx = await b.new_context(viewport={"width": w, "height": h}, is_mobile=mobile, has_touch=mobile, device_scale_factor=scale)
    pg = await ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: m.type == "error" and not NOISE.search(m.text) and errs.append(m.text))
    await pg.goto(url, wait_until="networkidle", timeout=60000)
    if not mobile:
        await pg.mouse.move(2, 2)
    try:
        await pg.wait_for_function("!document.querySelector('[data-preloader]') || document.querySelector('[data-preloader]').classList.contains('is-done')", timeout=30000)
    except Exception:
        pass
    await pg.wait_for_timeout(settle)
    return ctx, pg, errs


async def wheel_to(pg, target, step=500):
    """Scroll with the mouse wheel while the pointer stays put, like a visitor."""
    for _ in range(90):
        y = await pg.evaluate("scrollY")
        if abs(y - target) < 60:
            break
        await pg.mouse.wheel(0, max(-step, min(step, target - y)))
        await pg.wait_for_timeout(70)
    await pg.wait_for_timeout(1300)


async def reveal_all(pg, h):
    total = await pg.evaluate("document.documentElement.scrollHeight")
    for y in range(0, total, max(h // 2, 200)):
        await pg.evaluate(f"window.scrollTo(0,{y})")
        await pg.wait_for_timeout(90)
    await pg.wait_for_timeout(1800)
    return total


async def top_of(pg, sel):
    return await pg.evaluate(f"(() => {{ const e = document.querySelector({json.dumps(sel)}); return e ? e.getBoundingClientRect().top + scrollY : null; }})()")


# ------------------------------------------------------------------ smoke

STATE = """() => {
  const img = document.querySelector('[data-portrait-img]');
  const ring = document.querySelector('.orb textPath, textPath');
  return {
    curtain: !document.querySelector('[data-preloader]') || document.querySelector('[data-preloader]').classList.contains('is-done'),
    field: !!document.querySelector('[data-field].is-ready'),
    name: !!document.querySelector('.hero__name.is-open'),
    portrait: !!img && img.complete && img.naturalWidth > 0,
    cf: document.querySelectorAll('.__cf_email__, [data-cfemail], a[href*="/cdn-cgi/l/email-protection"]').length,
    ring: ring ? ring.textContent.includes('@') : null,
    h1: document.querySelectorAll('h1').length,
    title: document.title,
  };
}"""


async def smoke(b, R, a):
    for w, h in [(1440, 900), (390, 844)]:
        tag = "desktop" if w > 700 else "phone"
        ctx, pg, errs = await open_page(b, a.url, w, h, settle=4500)
        st = await pg.evaluate(STATE)
        R.check(f"{tag}: loading curtain lifts", st["curtain"])
        R.check(f"{tag}: particle field renders", st["field"], "no WebGL in this browser?" if not st["field"] else "", warn=True)
        R.check(f"{tag}: name reveal ran", st["name"])
        R.check(f"{tag}: portrait loaded", st["portrait"])
        R.check(f"{tag}: email text not rewritten by a CDN", st["cf"] == 0, f"{st['cf']} rewritten nodes")
        if st["ring"] is not None:
            R.check(f"{tag}: 'Let's talk' ring text intact", st["ring"])
        R.check(f"{tag}: exactly one h1", st["h1"] == 1, str(st["h1"]))
        await pg.screenshot(path=str(R.out / f"hero-{tag}.png"))
        if tag == "desktop":
            for _ in range(6):
                await pg.mouse.wheel(0, 300)
                await pg.wait_for_timeout(90)
            await pg.wait_for_timeout(700)
            hidden = await pg.evaluate("document.querySelector('[data-header]').classList.contains('is-hidden')")
            R.check("header slides away while scrolling down", hidden)
            await pg.mouse.wheel(0, -240)
            await pg.wait_for_timeout(800)
            back = await pg.evaluate("!document.querySelector('[data-header]').classList.contains('is-hidden') && document.querySelector('[data-header-bg]').classList.contains('is-on')")
            R.check("header returns with its bar on scroll up", back)
            await reveal_all(pg, h)
            await pg.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)")
            await pg.wait_for_timeout(1500)
        R.check(f"{tag}: no JavaScript errors", not errs, "; ".join(errs[:3]))
        await ctx.close()


# ------------------------------------------------------------------ shots

async def shots(b, R, a):
    folder = R.out / "shots"
    folder.mkdir(exist_ok=True)
    for w, h in [(1440, 900), (390, 844)]:
        tag = "desktop" if w > 700 else "phone"
        ctx, pg, _ = await open_page(b, a.url, w, h, settle=4000)
        total = await reveal_all(pg, h)
        n = 0
        for y in range(0, total, int(h * 0.9)):
            await pg.evaluate(f"window.scrollTo(0,{y})")
            await pg.wait_for_timeout(700)
            n += 1
            await pg.screenshot(path=str(folder / f"{tag}-{n:02d}.png"))
        R.check(f"screenshots for visual review ({tag})", True, f"{n} files in {folder}")
        await ctx.close()


# ------------------------------------------------------------------ overflow

OVERFLOW = """() => {
  const vw = innerWidth;
  const bad = [];
  document.querySelectorAll('main *, header *, footer *').forEach(el => {
    if (el.closest('.marquee, .hero__marquee, .bands, .footer__word, .orb__ring, .portrait__glow, svg, canvas, .sr-only, .viz-float, .menu')) return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') return;
    if (r.right > vw + 1.5 || r.left < -1.5) bad.push((typeof el.className === 'string' && el.className ? el.className.split(' ')[0] : el.tagName) + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
  });
  // Hero pieces: compare the visible text lines (clipped by any overflow:hidden
  // parent, screen-reader-only text skipped) and the orb as the circle it is.
  const text = s => {
    const root = document.querySelector(s);
    if (!root) return [];
    const out = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const p = n.parentElement;
      if (!n.textContent.trim() || !p || p.closest('.sr-only, svg')) continue;
      let c = [-1e9, -1e9, 1e9, 1e9];
      for (let a = p; a && a !== document.body; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') { const q = a.getBoundingClientRect(); c = [Math.max(c[0], q.left), Math.max(c[1], q.top), Math.min(c[2], q.right), Math.min(c[3], q.bottom)]; }
      }
      const r = document.createRange();
      r.selectNodeContents(n);
      for (const q of r.getClientRects()) {
        const b = [Math.max(q.left, c[0]), Math.max(q.top + q.height * 0.15, c[1]), Math.min(q.right, c[2]), Math.min(q.bottom - q.height * 0.15, c[3])];
        if (b[2] - b[0] > 1 && b[3] - b[1] > 1) out.push(b);
      }
    }
    return out;
  };
  const orbEl = document.querySelector('.hero__orb');
  const o = orbEl ? orbEl.getBoundingClientRect() : null;
  const inCircle = (b) => { const cx = (o.left + o.right) / 2, cy = (o.top + o.bottom) / 2, rad = o.width / 2 - 1; const x = Math.max(b[0], Math.min(cx, b[2])), y = Math.max(b[1], Math.min(cy, b[3])); return (x - cx) ** 2 + (y - cy) ** 2 < rad * rad; };
  const hit = (A, B) => A.some(a => B.some(b => a[0] < b[2] - 1 && b[0] < a[2] - 1 && a[1] < b[3] - 1 && b[1] < a[3] - 1));
  const hitOrb = (A) => !!o && o.width > 0 && A.some(inCircle);
  const name = text('.hero__id'), pitch = text('.hero__pitch'), foot = text('.hero__foot');
  const collide = Object.entries({ 'name/pitch': hit(name, pitch), 'pitch/orb': hitOrb(pitch), 'orb/foot': hitOrb(foot), 'name/orb': hitOrb(name), 'pitch/foot': hit(pitch, foot) }).filter(([, v]) => v).map(([k]) => k);
  // Display words in boxes that hide overflow: the text itself must fit, not just the box.
  document.querySelectorAll('[data-footer-word], .preloader__word, .contact__title, .row__title, [data-name], h2').forEach(el => {
    const box = el.getBoundingClientRect();
    if (!box.width) return;
    const r = document.createRange();
    r.selectNodeContents(el);
    const t = r.getBoundingClientRect();
    const hides = getComputedStyle(el).overflowX !== 'visible';
    if (t.right > vw + 1.5 || t.left < -1.5 || (hides && (t.left < box.left - 2 || t.right > box.right + 2)))
      bad.push('text cut: "' + el.textContent.trim().slice(0, 24) + '" ' + Math.round(t.left) + '..' + Math.round(t.right) + ' in ' + Math.round(box.left) + '..' + Math.round(box.right));
  });
  return { sw: document.documentElement.scrollWidth, vw, bad: [...new Set(bad)].slice(0, 6), collide };
}"""


async def overflow(b, R, a):
    for w, h in ALL_SIZES:
        ctx, pg, errs = await open_page(b, a.url, w, h, settle=3500)
        top = await pg.evaluate(OVERFLOW)
        await reveal_all(pg, h)
        low = await pg.evaluate(OVERFLOW)
        bad = sorted(set(top["bad"] + low["bad"]))
        ok = top["sw"] <= w + 1 and low["sw"] <= w + 1 and not bad and not top["collide"]
        detail = f"page width {max(top['sw'], low['sw'])}" + (f"; sticking out: {', '.join(bad)}" if bad else "") + (f"; hero collisions: {', '.join(top['collide'])}" if top["collide"] else "") + (f"; errors: {errs[0]}" if errs else "")
        R.check(f"{w}x{h}: fits the screen", ok and not errs, detail)
        if not ok:
            await pg.evaluate("window.scrollTo(0,0)")
            await pg.wait_for_timeout(500)
            await pg.screenshot(path=str(R.out / f"overflow-{w}x{h}.png"))
        await ctx.close()


# ------------------------------------------------------------------ overlap

COLLISIONS = r"""
() => {
  const EXCL = '.marquee, .bands, .footer__word, .sr-only, svg, .hud, .grim, .cursor, .preloader, .menu, .viz-float, .toast, .orb__ring, script, style, noscript, .pit__hint';
  const vw = innerWidth, vh = innerHeight;
  const shown = (el) => { let o = 1; for (let n = el; n && n !== document.documentElement; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden') return 0; o *= parseFloat(cs.opacity); } return o; };
  const owner = (el) => { for (let n = el; n; n = n.parentElement) { const d = getComputedStyle(n).display; if (d !== 'inline' && d !== 'contents') return n; } return el; };
  const groups = new Map();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    if (!t.textContent.trim()) continue;
    const p = t.parentElement;
    if (!p || p.closest(EXCL) || shown(p) < 0.2) continue;
    const r = document.createRange();
    r.selectNodeContents(t);
    let clip = { l: -1e9, r: 1e9, t: -1e9, b: 1e9 };
    for (let n = p; n && n !== document.body; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') { const q = n.getBoundingClientRect(); clip = { l: Math.max(clip.l, q.left), r: Math.min(clip.r, q.right), t: Math.max(clip.t, q.top), b: Math.min(clip.b, q.bottom) }; }
    }
    // A glyph is shorter than the font's full line box: trim 18% top and bottom.
    const rects = [...r.getClientRects()]
      .map(q => { const h = q.height * 0.18; return { l: Math.max(q.left, clip.l), r: Math.min(q.right, clip.r), t: Math.max(q.top + h, clip.t), b: Math.min(q.bottom - h, clip.b) }; })
      .filter(q => q.r - q.l > 1 && q.b - q.t > 1 && q.b > 0 && q.t < vh && q.r > 0 && q.l < vw);
    if (!rects.length) continue;
    const o = owner(p);
    if (!groups.has(o)) groups.set(o, []);
    groups.get(o).push(...rects);
  }
  const owners = [...groups.keys()];
  const label = (el) => { const c = typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''; return el.tagName.toLowerCase() + c + ' "' + el.textContent.trim().slice(0, 28) + '"'; };
  const barOn = document.querySelector('[data-header-bg]')?.classList.contains('is-on');
  const hits = [];
  for (let i = 0; i < owners.length; i++) for (let j = i + 1; j < owners.length; j++) {
    const a = owners[i], b = owners[j];
    if (a.contains(b) || b.contains(a)) continue;
    if (barOn && (a.closest('.header') || b.closest('.header'))) continue; // the header bar covers page text by design
    const pa = a.closest('[data-project]'), pb = b.closest('[data-project]');
    if (pa && pb && pa !== pb) continue; // stacked project cards cover each other by design
    let hit = null;
    for (const x of groups.get(a)) { for (const y of groups.get(b)) { const w = Math.min(x.r, y.r) - Math.max(x.l, y.l), h = Math.min(x.b, y.b) - Math.max(x.t, y.t); if (w > 2 && h > 2) { hit = [Math.round(w), Math.round(h)]; break; } } if (hit) break; }
    if (hit) hits.push(label(a) + '  x  ' + label(b) + '  (' + hit[0] + 'x' + hit[1] + 'px)');
  }
  return hits;
}
"""


async def overlap(b, R, a):
    for w, h in ALL_SIZES if a.full else QUICK_SIZES:
        ctx, pg, _ = await open_page(b, a.url, w, h, settle=3500)
        total = await reveal_all(pg, h)
        found = {}
        y = 0
        while y < total:
            await pg.evaluate(f"window.scrollTo(0,{y})")
            await pg.wait_for_timeout(350)
            for hit in await pg.evaluate(COLLISIONS):
                found.setdefault(hit, y)
            y += int(h * 0.8)
        if w >= 1024 and h >= 600:
            for i in range(await pg.locator(".row").count()):
                await pg.evaluate(f"document.querySelectorAll('.row')[{i}].scrollIntoView({{block: 'center'}})")
                await pg.wait_for_timeout(400)
                bb = await pg.locator(".row").nth(i).bounding_box()
                await pg.mouse.move(bb["x"] + 40, bb["y"] + bb["height"] / 2)
                await pg.wait_for_timeout(950)
                for hit in await pg.evaluate(COLLISIONS):
                    found.setdefault("[hovering a row] " + hit, -1)
            await pg.mouse.move(2, 2)
        R.check(f"{w}x{h}: no overlapping text", not found, "; ".join(f"y={v}: {k}" for k, v in list(found.items())[:4]))
        await ctx.close()


# ------------------------------------------------------------------ hover

async def hover(b, R, a):
    ctx, pg, errs = await open_page(b, a.url, 1440, 900, settle=5000)
    await pg.evaluate("window.__lens=[];document.addEventListener('portrait:lens',e=>window.__lens.push(e.detail))")
    rows = await pg.locator(".row").count()
    if rows:
        t = await top_of(pg, ".row:last-child")
        await wheel_to(pg, t - 450)
        rb = await pg.locator(".row").last.bounding_box()
        await pg.mouse.move(rb["x"] + 320, rb["y"] + rb["height"] / 2, steps=8)
        await pg.wait_for_timeout(700)
        op = float(await pg.evaluate("getComputedStyle(document.querySelector('[data-viz-float]')).opacity"))
        R.check("row preview appears on hover", op > 0.9, f"opacity {op:.2f}")
        await wheel_to(pg, 0, step=700)
        op = float(await pg.evaluate("getComputedStyle(document.querySelector('[data-viz-float]')).opacity"))
        R.check("row preview clears after scrolling away", op < 0.05, f"opacity {op:.2f}")

    fb = await pg.locator(".portrait__frame").bounding_box()
    if fb:
        await pg.mouse.move(fb["x"] + fb["width"] * 0.5, fb["y"] + fb["height"] * 0.55, steps=10)
        await pg.wait_for_timeout(800)
        on = await pg.evaluate("window.__lens.at(-1) === true")
        R.check("token-view lens opens over the person", on, warn=True, detail="" if on else "pointer at 50%/55% of the photo may be off the cut-out")
        await pg.screenshot(path=str(R.out / "lens.png"), clip={"x": fb["x"], "y": fb["y"], "width": fb["width"], "height": fb["height"]})
        if on:
            await pg.mouse.wheel(0, 600)
            await pg.wait_for_timeout(900)
            R.check("lens closes when the page scrolls under the pointer", await pg.evaluate("window.__lens.at(-1) === false"))
        await wheel_to(pg, 0)

    if await pg.locator("[data-shot]").count():
        t = await top_of(pg, "[data-shot]")
        await wheel_to(pg, t - 120)
        sb = await pg.locator("[data-shot]").first.bounding_box()
        x, y = sb["x"] + sb["width"] * 0.5, sb["y"] + sb["height"] * 0.5
        await pg.mouse.move(x, y, steps=8)
        await pg.wait_for_timeout(500)
        R.check("cursor label shows over a project preview", await pg.evaluate("document.querySelector('.cursor').classList.contains('has-label')"))
        await wheel_to(pg, 0, step=800)
        # The label must clear, unless the pointer now rests on another labelled element.
        stale = None
        for _ in range(10):
            stale = await pg.evaluate(
                f"""() => {{ const el = document.elementFromPoint({x}, {y}); const want = el && el.closest('[data-cursor]');
                  const on = document.querySelector('.cursor').classList.contains('has-label'); const text = document.querySelector('[data-cursor-label]')?.textContent || '';
                  return on && !(want && want.dataset.cursor === text) ? text : null; }}"""
            )
            if not stale:
                break
            await pg.wait_for_timeout(250)
        R.check("cursor label clears after scrolling away", not stale, f"still showing '{stale}'" if stale else "")
    R.check("hover pass: no JavaScript errors", not errs, "; ".join(errs[:3]))
    await ctx.close()


# ------------------------------------------------------------------ chat

async def wait_chips(pg):
    await pg.wait_for_function("document.querySelectorAll('.grim__chip').length > 0", timeout=12000)


async def chat(b, R, a):
    ctx, pg, errs = await open_page(b, a.url, 1440, 900, settle=4500)
    if not await pg.locator("[data-grim]").count():
        R.check("mascot chat", True, "mascot disabled, skipped")
        await ctx.close()
        return
    email = await pg.get_attribute("[data-copy]", "data-copy")
    await pg.evaluate("window.__throws=0;document.addEventListener('pit:throw',()=>window.__throws++)")
    await wheel_to(pg, await top_of(pg, "#about"))
    gb = await pg.locator("[data-grim-btn]").bounding_box()
    await pg.mouse.click(gb["x"] + gb["width"] / 2, gb["y"] + gb["height"] / 2)
    await wait_chips(pg)
    n = await pg.locator(".grim__log .msg--grim").count()
    chips = await pg.locator(".grim__chip").all_inner_texts()
    R.check("chat opens with a greeting and quick questions", n >= 1 and len(chips) >= 2, f"{n} lines; {chips}")
    R.check("keyboard focus moves into the chat", await pg.evaluate("!!document.activeElement.closest('[data-grim-chat]')"))
    asked = []
    for _ in range(12):
        chips = await pg.locator(".grim__chip").all_inner_texts()
        fresh = [c for c in chips if c not in asked]
        if not fresh:
            break
        label = fresh[0]
        before = await pg.locator(".grim__log .msg--grim").count()
        await pg.locator(".grim__chip", has_text=label).first.click()
        await wait_chips(pg)
        after = await pg.locator(".grim__log .msg--grim").count()
        R.check(f"answers '{label}'", after > before, f"{after - before} new lines")
        asked.append(label)
    R.check("every question gets asked and the chat keeps offering chips", len(asked) >= 3, f"{len(asked)} asked")
    await pg.wait_for_timeout(800)
    await pg.screenshot(path=str(R.out / "chat-desktop.png"))
    acts = await pg.locator(".msg__action").all_inner_texts()
    if "Copy email" in acts and email:
        await pg.locator(".msg__action", has_text="Copy email").first.click()
        await pg.wait_for_timeout(1500)
        toast = await pg.evaluate("document.querySelector('[data-toast]')?.textContent || ''")
        R.check("'Copy email' copies and confirms", email in toast, toast)
    if "Take me there" in acts:
        await pg.locator(".msg__action", has_text="Take me there").first.click()
        await pg.wait_for_timeout(2300)
        top = await pg.evaluate("document.querySelector('#work').getBoundingClientRect().top")
        R.check("'Take me there' scrolls to the work", abs(top) < 160, f"#work top {top:.0f}px")
    if not await pg.evaluate("document.querySelector('[data-grim-chat]').hidden"):
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(300)
    R.check("Escape (or an action) closes the chat and focus returns", await pg.evaluate("document.querySelector('[data-grim-chat]').hidden"))

    pit = await top_of(pg, "[data-pit]")
    if pit is not None:
        await wheel_to(pg, pit - 200)
        await pg.wait_for_timeout(1500)
        pb = await pg.locator("[data-pit]").bounding_box()
        reacted = ""
        for i in range(14):
            x = pb["x"] + pb["width"] * (0.08 + i * 0.065)
            y = pb["y"] + pb["height"] - 45
            await pg.mouse.move(x, y)
            await pg.mouse.down()
            await pg.mouse.move(x - 260, y - 300, steps=3)
            await pg.mouse.up()
            await pg.wait_for_timeout(500)
            if await pg.evaluate("window.__throws") > 0:
                reacted = await pg.evaluate("document.querySelector('[data-grim-bubble]').classList.contains('is-on') ? document.querySelector('[data-grim-bubble]').textContent : ''")
                break
        R.check("mascot reacts to a thrown ball", bool(reacted), reacted or "no throw registered (try by hand)", warn=True)
    R.check("chat pass: no JavaScript errors (desktop)", not errs, "; ".join(errs[:3]))
    await ctx.close()

    ctx, pg, errs = await open_page(b, a.url, 390, 844, settle=4500)
    R.check("phone: mascot stays out of the first screen", await pg.evaluate("document.querySelector('[data-grim]').classList.contains('is-tucked')"))
    await pg.evaluate("window.scrollTo(0, document.querySelector('#about').offsetTop)")
    await pg.wait_for_timeout(1200)
    await pg.tap("[data-grim-btn]")
    await wait_chips(pg)
    box = await pg.locator("[data-grim-chat]").bounding_box()
    fits = box["x"] >= 0 and box["y"] >= 0 and box["x"] + box["width"] <= 390 and box["y"] + box["height"] <= 844
    R.check("phone: chat fits on screen", fits, json.dumps({k: round(v) for k, v in box.items()}))
    await pg.tap(".grim__chip >> nth=0")
    await wait_chips(pg)
    await pg.wait_for_timeout(900)
    await pg.screenshot(path=str(R.out / "chat-phone.png"))
    if await pg.locator(".msg__action").count():
        await pg.tap(".msg__action >> nth=0")
        await pg.wait_for_timeout(1800)
        R.check("phone: an action closes the chat", await pg.evaluate("document.querySelector('[data-grim-chat]').hidden"))
    R.check("chat pass: no JavaScript errors (phone)", not errs, "; ".join(errs[:3]))
    await ctx.close()


# ------------------------------------------------------------------ name

def right_edge(png, thresh=120):
    from PIL import Image

    im = Image.open(io.BytesIO(png)).convert("L")
    px = im.load()
    for x in range(im.width - 1, -1, -1):
        if any(px[x, y] > thresh for y in range(im.height)):
            return x
    return -1


async def name(b, R, a):
    for w, h in [(1920, 1080), (1440, 900), (1024, 768), (390, 844)]:
        ctx, pg, _ = await open_page(b, a.url, w, h, settle=6000, scale=2)
        await pg.add_style_tag(content="[data-field],.hero__stage,.hero__marquee,.grim,.atmosphere,.grain,.hud{visibility:hidden!important}")
        worst = []
        for i in range(await pg.locator("[data-name]").count()):
            last = pg.locator("[data-name]").nth(i).locator(".ch").last
            bb = await last.bounding_box()
            if not bb:
                continue
            clip = {"x": bb["x"] + bb["width"] * 0.3, "y": bb["y"], "width": bb["width"] * 1.1, "height": bb["height"]}
            await pg.wait_for_timeout(1500)
            rest = await pg.screenshot(clip=clip)
            await pg.add_style_tag(content=".hero__word .ch{-webkit-text-fill-color:#fff!important}")
            await pg.wait_for_timeout(300)
            solid = await pg.screenshot(clip=clip)
            await pg.evaluate("document.querySelectorAll('style').forEach(s => s.textContent.includes('-webkit-text-fill-color:#fff') && s.remove())")
            d = abs(right_edge(rest) - right_edge(solid))
            if d > 2:
                worst.append(f"word {i + 1}: {d / 2:.0f}px cut")
        R.check(f"{w}x{h}: name letters drawn in full", not worst, "; ".join(worst))
        await ctx.close()


# ------------------------------------------------------------------ cursor

CURSOR = """() => { const read = (s) => { const m = new DOMMatrix(getComputedStyle(document.querySelector(s)).transform); return [m.m41, m.m42]; }; return { dot: read('.cursor__dot'), ring: read('.cursor__ring') }; }"""


async def cursor(b, R, a):
    ctx, pg, _ = await open_page(b, a.url, 1440, 900, settle=3500)
    if not await pg.locator(".cursor__dot").count():
        R.check("custom cursor", True, "not present, skipped")
        await ctx.close()
        return
    await pg.mouse.move(300, 300)
    await pg.wait_for_timeout(300)
    await pg.mouse.move(1100, 650)
    await pg.wait_for_timeout(34)
    pos = await pg.evaluate(CURSOR)
    dot = ((pos["dot"][0] - 1100) ** 2 + (pos["dot"][1] - 650) ** 2) ** 0.5
    await pg.wait_for_timeout(250)
    pos = await pg.evaluate(CURSOR)
    ring = ((pos["ring"][0] - 1100) ** 2 + (pos["ring"][1] - 650) ** 2) ** 0.5
    R.check("cursor dot keeps up with the pointer", dot < 3, f"{dot:.1f}px behind after two frames")
    R.check("cursor ring settles on the pointer", ring < 12, f"{ring:.1f}px off after 280ms")
    await ctx.close()


# ------------------------------------------------------------------ preload

async def preload(b, R, a):
    ctx = await b.new_context(viewport={"width": 1440, "height": 900})
    pg = await ctx.new_page()
    t0 = time.time()
    arrived = {}

    async def slow(route):
        await asyncio.sleep(3)
        await route.continue_()
        arrived["t"] = time.time() - t0

    await pg.route(re.compile(r".*/assets/img/portrait\.[a-z]+(\?.*)?$"), slow)
    await pg.goto(a.url, wait_until="commit")
    seen, lifted = [], None
    for _ in range(120):
        await pg.wait_for_timeout(150)
        st = await pg.evaluate("() => ({ pct: document.querySelector('[data-preloader-pct]')?.textContent, done: document.querySelector('[data-preloader]')?.classList.contains('is-done') })")
        if st["pct"] and (not seen or seen[-1] != st["pct"]):
            seen.append(st["pct"])
        if st["done"]:
            lifted = time.time() - t0
            break
    ready = await pg.evaluate("(() => { const i = document.querySelector('[data-portrait-img]'); return !!i && i.complete && i.naturalWidth > 0; })()")
    R.check("curtain waits for a slow portrait", lifted is not None and ready, f"portrait at {arrived.get('t', 0):.1f}s, curtain lifted at {lifted or 0:.1f}s")
    R.check("curtain counts up while loading", len(seen) >= 3, " ".join(seen[:8]))
    await ctx.close()


# ------------------------------------------------------------------ a11y

async def a11y(b, R, a):
    for w, h in [(1440, 900), (390, 844)]:
        ctx, pg, _ = await open_page(b, a.url, w, h, settle=4000)
        await reveal_all(pg, h)
        await pg.evaluate("document.querySelectorAll('[data-reveal]').forEach(e=>e.classList.add('is-in'))")
        await pg.evaluate("window.scrollTo(0,0)")
        await pg.wait_for_timeout(800)
        try:
            await pg.add_script_tag(url=AXE)
        except Exception as e:
            R.check(f"{w}x{h}: accessibility audit", False, f"could not load axe-core ({e})", warn=True)
            await ctx.close()
            continue
        res = await pg.evaluate("axe.run(document, {resultTypes: ['violations']}).then(r => r.violations.map(v => ({id: v.id, impact: v.impact, n: v.nodes.length, where: v.nodes.slice(0, 3).map(n => n.target.join(' '))})))")
        serious = [v for v in res if v["impact"] in ("serious", "critical")]
        minor = [v for v in res if v not in serious]
        R.check(f"{w}x{h}: no serious accessibility issues", not serious, "; ".join(f"{v['id']} x{v['n']} ({', '.join(v['where'])})" for v in serious))
        if minor:
            R.check(f"{w}x{h}: minor accessibility notes", False, "; ".join(f"{v['id']} x{v['n']}" for v in minor), warn=True)
        await ctx.close()


# ------------------------------------------------------------------ live

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 portfolio-qa"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


async def live(b, R, a):
    code, body = fetch(a.url)
    html = body.decode("utf8", "replace")
    R.check("live: home page answers 200", code == 200, str(code))
    rewritten = "__cf_email__" in html or "/cdn-cgi/l/email-protection" in html
    R.check(
        "live: email addresses are not rewritten by Cloudflare",
        not rewritten,
        "Cloudflare Email Address Obfuscation is changing the HTML. Keep the <!--email_off--> wrappers, or turn the feature off under Scrape Shield" if rewritten else "",
    )
    code, _ = fetch(urljoin(a.url, f"this-page-does-not-exist-{int(time.time())}"))
    R.check("live: unknown paths return 404", code == 404, str(code))
    for path in ["robots.txt", "sitemap.xml", "favicon.svg"]:
        code, _ = fetch(urljoin(a.url, path))
        R.check(f"live: /{path} is served", code == 200, str(code))
    m = re.search(r'<meta property="og:image" content="([^"]+)"', html)
    if m:
        code, img = fetch(m.group(1))
        R.check("live: share image is served", code == 200 and len(img) > 5000, f"{code}, {len(img)} bytes")
    if urlparse(a.url).scheme == "http":
        R.check("live: served over HTTPS", False, "the URL is http://", warn=True)


# ------------------------------------------------------------------ main

CHECKS = {"smoke": smoke, "shots": shots, "overflow": overflow, "overlap": overlap, "hover": hover, "chat": chat, "name": name, "cursor": cursor, "preload": preload, "a11y": a11y, "live": live}


async def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url", required=True)
    ap.add_argument("--out", type=Path, default=Path("qa-report"))
    ap.add_argument("--only", help="comma-separated list of checks")
    ap.add_argument("--skip", default="", help="comma-separated list of checks to leave out")
    ap.add_argument("--full", action="store_true", help="overlap audit at all 23 screen sizes")
    ap.add_argument("--live", action="store_true", help="run the deployed-site checks even for a local URL")
    ap.add_argument("--browser", help="path to a Chromium-based browser (Brave, Chrome, Edge) to test with instead")
    a = ap.parse_args()
    if not a.url.endswith("/"):
        a.url += "/"
    a.out.mkdir(parents=True, exist_ok=True)
    local = urlparse(a.url).hostname in ("127.0.0.1", "localhost", "0.0.0.0")
    names = a.only.split(",") if a.only else [n for n in CHECKS if n != "live" or not local or a.live]
    names = [n for n in names if n not in a.skip.split(",")]
    R = Report(a.out)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=GL, executable_path=a.browser) if a.browser else await p.chromium.launch(args=GL)
        for n in names:
            print(f"\n== {n}", flush=True)
            try:
                await CHECKS[n](b, R, a)
            except Exception as e:  # a crashed check is a failed check
                R.check(f"{n}: check ran to the end", False, f"{type(e).__name__}: {str(e).splitlines()[0][:200]}")
        await b.close()
    sys.exit(0 if R.write() else 1)


if __name__ == "__main__":
    asyncio.run(main())
