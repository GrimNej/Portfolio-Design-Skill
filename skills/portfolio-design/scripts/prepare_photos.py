"""Prepare the two portfolio photos.

    python prepare_photos.py --portrait photo.jpg [--about photo2.jpg] --out <site>/assets/img
        [--about-focus 0.5,0.35] [--about-gray] [--model birefnet-portrait]

Portrait: the background is removed (rembg with the BiRefNet portrait model),
any see-through patches inside the silhouette are filled (matting often leaves
holes in large dark areas such as a black shirt), the result is cropped to the
person and saved as assets/img/portrait.webp (900 px wide, transparent).

About photo: centre-cropped to a square around --about-focus (x,y as 0-1
fractions, default a little above centre so faces stay in frame), optionally
converted to black and white, saved as assets/img/about.webp (1000 x 1000).

Requirements: pip install "rembg[cpu]" pillow numpy  (the first run downloads
the ~1 GB BiRefNet model). If rembg is unavailable, pass a portrait that is
already a transparent PNG with --no-cutout.
"""
import argparse
import sys
from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter, ImageOps

try:
    import numpy as np
except ImportError:  # pragma: no cover
    sys.exit("numpy is required: pip install numpy")


def cutout(src: Path, model: str) -> Image.Image:
    try:
        from rembg import new_session, remove
    except ImportError:
        sys.exit('rembg is not installed. Run: pip install "rembg[cpu]"  (or pass --no-cutout with a transparent PNG)')
    im = Image.open(src).convert("RGB")
    session = new_session(model)
    return remove(
        im,
        session=session,
        alpha_matting=True,
        alpha_matting_foreground_threshold=240,
        alpha_matting_background_threshold=20,
        alpha_matting_erode_size=8,
    )


def fill_holes(im: Image.Image) -> Image.Image:
    """Make everything not connected to the transparent border fully opaque."""
    a = np.array(im.getchannel("A"))
    h, w = a.shape
    low = a < 24
    outside = np.zeros_like(low)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if low[y, x] and not outside[y, x]:
                outside[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if low[y, x] and not outside[y, x]:
                outside[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w and low[ny, nx] and not outside[ny, nx]:
                outside[ny, nx] = True
                q.append((ny, nx))
    interior = Image.fromarray((~outside).astype(np.uint8) * 255).filter(ImageFilter.MinFilter(9))
    fixed = np.maximum(a, np.array(interior))
    print(f"  filled {int((fixed > a).sum())} see-through pixels inside the silhouette")
    out = im.copy()
    out.putalpha(Image.fromarray(fixed))
    return out


def save_portrait(im: Image.Image, dest: Path, width: int = 900) -> None:
    bbox = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    if not bbox:
        sys.exit("The cut-out came back empty. Use a photo where the person is clearly visible.")
    im = im.crop(bbox)
    im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    ratio = im.height / im.width
    if not 1.15 <= ratio <= 1.7:
        print(f"  ! portrait aspect is {ratio:.2f} (height/width). Head-and-shoulders crops around 1.3-1.45 look best.")
    im.save(dest, "WEBP", quality=86, method=6)
    print(f"  portrait -> {dest} ({im.width}x{im.height})")


def save_about(src: Path, dest: Path, focus: tuple, gray: bool, size: int = 1000) -> None:
    im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    side = min(im.size)
    fx, fy = focus
    left = int(max(0, min(im.width - side, fx * im.width - side / 2)))
    top = int(max(0, min(im.height - side, fy * im.height - side / 2)))
    im = im.crop((left, top, left + side, top + side)).resize((size, size), Image.LANCZOS)
    if gray:
        im = ImageOps.grayscale(im).convert("RGB")
    im.save(dest, "WEBP", quality=82, method=6)
    print(f"  about    -> {dest} ({size}x{size})")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--portrait", type=Path, required=True)
    ap.add_argument("--about", type=Path)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--about-focus", default="0.5,0.4")
    ap.add_argument("--about-gray", action="store_true")
    ap.add_argument("--model", default="birefnet-portrait")
    ap.add_argument("--no-cutout", action="store_true", help="the portrait is already a transparent PNG")
    a = ap.parse_args()

    a.out.mkdir(parents=True, exist_ok=True)
    print("Preparing photos")
    portrait = ImageOps.exif_transpose(Image.open(a.portrait)).convert("RGBA") if a.no_cutout else cutout(a.portrait, a.model)
    save_portrait(fill_holes(portrait), a.out / "portrait.webp")
    if a.about:
        fx, fy = (float(v) for v in a.about_focus.split(","))
        save_about(a.about, a.out / "about.webp", (fx, fy), a.about_gray)
    print("Done. Point person.photos.portrait / .about in portfolio.json at these files.")


if __name__ == "__main__":
    main()
