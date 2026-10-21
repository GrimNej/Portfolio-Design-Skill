"""Render the social share card and the touch icon for a built site.

    python render_images.py --site <site-folder>

build.mjs writes <site>/.render/og.html and icon.html; this script serves the
site locally, screenshots them to assets/img/og.jpg (1200x630) and
assets/img/apple-touch-icon.png (180x180), then removes .render/.

Requirements: pip install playwright && playwright install chromium
"""
import argparse
import functools
import http.server
import shutil
import socketserver
import sys
import threading
from pathlib import Path


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve(root: Path):
    handler = functools.partial(QuietHandler, directory=str(root))
    httpd = socketserver.ThreadingTCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, httpd.server_address[1]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", type=Path, required=True)
    a = ap.parse_args()
    site = a.site.resolve()
    render = site / ".render"
    if not (render / "og.html").exists():
        sys.exit(f"{render / 'og.html'} not found. Run build.mjs first.")
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        sys.exit("Playwright is required: pip install playwright && playwright install chromium")

    httpd, port = serve(site)
    try:
        with sync_playwright() as p:
            b = p.chromium.launch()
            pg = b.new_page(viewport={"width": 1200, "height": 630})
            pg.goto(f"http://127.0.0.1:{port}/.render/og.html", wait_until="networkidle")
            pg.wait_for_timeout(1200)
            pg.screenshot(path=str(site / "assets/img/og.jpg"), type="jpeg", quality=88)
            pg.set_viewport_size({"width": 180, "height": 180})
            pg.goto(f"http://127.0.0.1:{port}/.render/icon.html", wait_until="networkidle")
            pg.wait_for_timeout(300)
            pg.screenshot(path=str(site / "assets/img/apple-touch-icon.png"))
            b.close()
    finally:
        httpd.shutdown()
    shutil.rmtree(render, ignore_errors=True)
    print(f"Rendered assets/img/og.jpg and assets/img/apple-touch-icon.png in {site}")


if __name__ == "__main__":
    main()
