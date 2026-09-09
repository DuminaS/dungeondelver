"""
One-off: downscale the large navy/gold class emblem JPGs into small webp
"medallions" for the UI ( public/logos/<class>.webp ).

The source art already sits on a uniform navy (#041a2f) field, so we don't key
transparency — we just trim a few px of edge scan-artifacts, downscale, and keep
the navy. Every crest ends up an identical self-contained navy tile.

Source: ~/Downloads/JPG Icons/JPG Icons/*.jpg  (override with argv[1])
"""
import sys
from pathlib import Path
from PIL import Image

SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / "Downloads" / "JPG Icons" / "JPG Icons"
OUT = Path(__file__).resolve().parent.parent / "public" / "logos"
OUT.mkdir(parents=True, exist_ok=True)

SIZE = 384
INSET = 0.035   # trim this fraction off each edge (kills stray white hairlines)
NAVY = (4, 26, 47)

def process(path: Path) -> None:
    im = Image.open(path).convert("RGB")
    w, h = im.size
    m = int(min(w, h) * INSET)
    im = im.crop((m, m, w - m, h - m))
    # paste onto a clean navy square in case the crop left a sliver
    side = max(im.size)
    canvas = Image.new("RGB", (side, side), NAVY)
    canvas.paste(im, ((side - im.size[0]) // 2, (side - im.size[1]) // 2))
    canvas = canvas.resize((SIZE, SIZE), Image.LANCZOS)
    name = path.stem.lower()
    canvas.save(OUT / f"{name}.webp", quality=86, method=6)
    print(f"  {name}.webp  {(OUT / f'{name}.webp').stat().st_size // 1024} kB")

def main() -> None:
    files = sorted(SRC.glob("*.jpg")) + sorted(SRC.glob("*.jpeg")) + sorted(SRC.glob("*.png"))
    if not files:
        sys.exit(f"no source images in {SRC}")
    print(f"processing {len(files)} crests -> {OUT}")
    for f in files:
        process(f)

if __name__ == "__main__":
    main()
