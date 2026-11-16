import sys, json, re, shutil, pathlib
src, dst = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
if dst.exists(): shutil.rmtree(dst)
shutil.copytree(src / "assets", dst / "assets") if (src / "assets").exists() and any((src / "assets").iterdir()) else None
t = (src / "template.html").read_text(encoding="utf-8")
meta = json.loads((src / "bundle-meta.json").read_text())
missing = [p for p in re.findall(r'assets/[0-9a-f-]{36}\.\w+', t) if not (src / p).exists()]
res = {}
for e in meta["ext_resources"]:
    p = next((q for q in (src / "assets").glob(e["uuid"] + ".*")), None) if (src / "assets").exists() else None
    if p: res[e["id"]] = "assets/" + p.name
t = re.sub(r'\s+integrity="[^"]*"', "", t); t = re.sub(r'\s+crossorigin="[^"]*"', "", t)
inj = "<script>window.__resources = " + json.dumps(res).replace("</", "<\\/") + ";</script>"
m = re.search(r"<head[^>]*>", t, re.I)
t = t[:m.end()] + inj + t[m.end():] if m else inj + t
# Drop the Claude Design editor badge; it is tooling chrome, not part of the product screens.
t = re.sub(r'<div id="__claude_design_branding">.*?</div>\s*(?=</body>|<script|$)', "", t, flags=re.S)
dst.mkdir(parents=True, exist_ok=True); (dst / "index.html").write_text(t, encoding="utf-8")
print(dst.name, "missing assets:", missing, "resources:", list(res))
