"""
One-off: turn the large navy/gold class JPGs into small transparent PNGs
for the UI ( public/logos/<class>.png ). Re-run if the source art changes.

Source: ~/Downloads/JPG Icons/JPG Icons/*.jpg  (override with argv[1])
"""
import sys
from pathlib import Path
from PIL import Image

SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / "Downloads" / "JPG Icons" / "JPG Icons"
OUT = Path(__file__).resolve().parent.parent / "public" / "logos"
OUT.mkdir(parents=True, exist_ok=True)

SIZE = 400          # output square
KEY_HARD = 60       # <= this distance from bg colour -> fully transparent
KEY_SOFT = 120      # feather band up to here

def process(path: Path) -> None:
    im = Image.open(path).convert("RGB")
    im.thumbnail((SIZE * 2, SIZE * 2), Image.LANCZOS)
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    # background colour = average of an 8px strip round the border (robust to
    # a stray corner pixel or vignette)
    edge = []
    for x in range(0, w, 3):
        edge += [px[x, 2], px[x, h - 3]]
    for y in range(0, h, 3):
        edge += [px[2, y], px[w - 3, y]]
    bg = tuple(sum(c[i] for c in edge) // len(edge) for i in range(3))
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            d = ((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2) ** 0.5
            if d <= KEY_HARD:
                px[x, y] = (r, g, b, 0)
            elif d < KEY_SOFT:
                a = int(255 * (d - KEY_HARD) / (KEY_SOFT - KEY_HARD))
                px[x, y] = (r, g, b, a)
    # trim to content, then pad square
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    side = max(im.size)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(im, ((side - im.size[0]) // 2, (side - im.size[1]) // 2), im)
    canvas = canvas.resize((SIZE, SIZE), Image.LANCZOS)
    name = path.stem.lower()
    canvas.save(OUT / f"{name}.webp", quality=82, method=6)
    print(f"  {name}.webp  {(OUT / f'{name}.webp').stat().st_size // 1024} kB")

def main() -> None:
    files = sorted(SRC.glob("*.jpg")) + sorted(SRC.glob("*.png")) + sorted(SRC.glob("*.jpeg"))
    if not files:
        sys.exit(f"no source images in {SRC}")
    print(f"processing {len(files)} crests -> {OUT}")
    for f in files:
        process(f)

if __name__ == "__main__":
    main()
