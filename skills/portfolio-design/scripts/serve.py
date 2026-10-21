"""Serve a built site locally for preview and QA.

    python serve.py --site <site-folder> [--port 4321]

Python's stock `http.server` keeps a listen backlog of five connections, so a
page that requests a dozen modules, fonts and images at once (or a QA run that
opens pages back to back) can get "connection refused". This server takes a
deeper backlog, serves every request on its own thread, sends no-cache headers
so a rebuild shows up on reload, and answers unknown paths with 404.html like
GitHub Pages does.
"""
import argparse
import functools
import http.server
import socketserver
from pathlib import Path


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_error(self, code, message=None, explain=None):
        page = Path(self.directory) / "404.html"
        if code == 404 and page.exists():
            body = page.read_bytes()
            self.send_response(404)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(body)
            return
        super().send_error(code, message, explain)

    def log_message(self, *args):
        pass


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True
    request_queue_size = 128


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--site", type=Path, required=True)
    ap.add_argument("--port", type=int, default=4321)
    ap.add_argument("--host", default="127.0.0.1")
    a = ap.parse_args()
    site = a.site.resolve()
    if not (site / "index.html").exists():
        raise SystemExit(f"{site / 'index.html'} not found. Run build.mjs first.")
    httpd = Server((a.host, a.port), functools.partial(Handler, directory=str(site)))
    print(f"Serving {site} at http://{a.host}:{a.port}/  (Ctrl+C to stop)", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
