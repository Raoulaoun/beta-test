"""Side-by-side and pixel difference between design screenshots and built screens.

Usage: python diff.py <design_dir> <built_dir> <out_dir>
Writes <name>.png (design | built | diff) and prints the share of differing pixels.
"""
import sys
from pathlib import Path
from PIL import Image, ImageChops

design, built, out = map(Path, sys.argv[1:4])
out.mkdir(parents=True, exist_ok=True)
rows = []
for b in sorted(built.glob("*.png")):
    d = design / b.name
    if not d.exists():
        continue
    A, B = Image.open(d).convert("RGB"), Image.open(b).convert("RGB")
    h = max(A.height, B.height)
    pa, pb = Image.new("RGB", (A.width, h), "white"), Image.new("RGB", (B.width, h), "white")
    pa.paste(A, (0, 0)); pb.paste(B, (0, 0))
    diff = ImageChops.difference(pa, pb).convert("L").point(lambda v: 255 if v > 24 else 0)
    share = sum(1 for v in diff.get_flattened_data() if v) / (diff.width * diff.height)
    gap = 24
    canvas = Image.new("RGB", (A.width * 3 + gap * 2, h), (230, 230, 230))
    canvas.paste(pa, (0, 0)); canvas.paste(pb, (A.width + gap, 0))
    canvas.paste(Image.merge("RGB", (diff, Image.new("L", diff.size, 0), Image.new("L", diff.size, 0))), (2 * (A.width + gap), 0))
    canvas.save(out / b.name)
    rows.append((b.name[:-4], A.size, B.size, share))
print("| Screen | Design size | Built size | Pixels differing |")
print("|---|---|---|---|")
for name, a, bsz, share in rows:
    print(f"| {name} | {a[0]}×{a[1]} | {bsz[0]}×{bsz[1]} | {share:.2%} |")
