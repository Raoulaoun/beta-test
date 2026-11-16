import sys, json, re, gzip, base64, mimetypes, pathlib
src, out = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
html = src.read_text(encoding="utf-8")
def block(kind):
    m = re.search(r'<script type="__bundler/%s">(.*?)</script>' % re.escape(kind), html, re.S)
    return json.loads(m.group(1)) if m else None
manifest, template = block("manifest"), block("template")
page_order, ext = block("page_order") or [], block("ext_resources") or []
EXT = {"text/javascript": ".js", "application/javascript": ".js", "text/css": ".css", "text/html": ".html",
       "image/svg+xml": ".svg", "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp",
       "font/woff2": ".woff2", "font/woff": ".woff", "font/ttf": ".ttf", "application/json": ".json"}
(out / "assets").mkdir(parents=True, exist_ok=True)
paths = {}
for uuid, e in manifest.items():
    data = base64.b64decode(e["data"])
    if e.get("compressed"): data = gzip.decompress(data)
    ext_ = EXT.get(e["mime"].split(";")[0]) or mimetypes.guess_extension(e["mime"]) or ".bin"
    name = f"assets/{uuid}{ext_}"
    (out / name).write_bytes(data)
    paths[uuid] = name
    print(f"{uuid} {e['mime']} {len(data)} page={uuid in page_order}")
for uuid, name in paths.items():
    template = template.replace(uuid, name)
(out / "template.html").write_text(template, encoding="utf-8")
(out / "bundle-meta.json").write_text(json.dumps({"page_order": page_order, "ext_resources": ext}, indent=1))
print("template chars", len(template), "ext_resources", ext, "page_order", page_order)
