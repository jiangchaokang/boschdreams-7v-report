#!/usr/bin/env python3
"""Static integrity checks: one h1, ordered headings, alt text, local resources, atlases, scene and world data."""
import json
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
A = ROOT / "assets"


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids, self.links, self.headings, self.images, self.clips = [], [], [], [], []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if "id" in a:
            self.ids.append(a["id"])
        self.links += [a[k] for k in ("src", "href", "poster") if k in a]
        if tag in ("h1", "h2", "h3"):
            self.headings.append(int(tag[1]))
        if tag == "img":
            self.images.append(a)
        if "data-clip" in a:
            self.clips.append(a["data-clip"])


page = Page()
page.feed((ROOT / "index.html").read_text())
assert len(page.ids) == len(set(page.ids)), "duplicate ids"
assert page.headings.count(1) == 1 and all(b - a <= 1 for a, b in zip(page.headings, page.headings[1:])), "heading order"
assert all("alt" in i and "width" in i for i in page.images), "image without alt or size"
for link in page.links:
    if not link.startswith(("http", "#", "data:", "mailto:")):
        assert (ROOT / link).is_file(), f"missing {link}"
manifest = json.loads((A / "media/manifest.json").read_text())
for clip in set(page.clips) | {"hero", "montage", "drive"}:
    assert clip in manifest and (A / f"media/{clip}.mp4").stat().st_size > 10000, f"missing clip {clip}"
for name, c in manifest.items():
    for layer, rects in c.items():
        if isinstance(rects, dict) and name != "hero":
            expected = 4 if name.startswith("static-") else 7
            assert len(rects) == expected, f"{name}/{layer} expected {expected} cameras, got {len(rects)}"
strip = json.loads((A / "media/data/strip.json").read_text())
assert len(strip) == 9 and all((ROOT / s["src"]).is_file() and s["drives"] > 0 for s in strip), "data reel"
for clip in ("riders", "crosswalk", "scooters", "night", "highway", "truck"):
    d = json.loads((A / f"bev/{clip}.json").read_text())
    assert len(d["ego"]) == d["n"] == 80 and d["map"] and d["tracks"], f"bev {clip}"
AGENT = ("ghost_ped", "ghost_cyclist", "ghost_car", "left", "congestion", "construction", "roundabout")
FUTURES = {"hub": 4, "lturn": 3, "xwalk": 3}
for case in AGENT:
    d = json.loads((A / f"edit/{case}.json").read_text())
    assert len(d["ego"]) == d["n"] and d["map"] and "edit" in d["branches"] and "gt" in d["meta"]["edit"], f"edit {case}"
    assert {"rec", "edit"} <= set(manifest[f"gen-{case}"]), f"atlas gen-{case}"
    assert (A / f"media/layout-{case}.mp4").is_file() and (A / f"world/{case}.json").is_file(), f"layout or world {case}"
for kind in ("ghost", "left", "congestion", "construction", "roundabout"):
    assert (A / f"pool/{kind}.webp").is_file(), f"pool {kind}"
for case, n in FUTURES.items():
    d = json.loads((A / f"edit/{case}.json").read_text())
    assert len(d["branches"]) == n and 0 < d["fork"] < d["n"] and all("progress" in m for m in d["meta"].values()), f"futures {case}"
    assert set(d["branches"]) <= set(manifest[f"cf-{case}"]), f"atlas cf-{case}"
for e in ("xwalk", "lturn"):
    m = json.loads((A / f"edit/{e}.json").read_text())
    assert m["meta"]["wrong"]["contact"] * 10 > m["fork"] and not m["meta"]["opt"]["contact"], f"{e}: only the wrong decision collides, after the decision"
for f in ("seams", "ghosts", "road", "blur", "holes"):
    assert {"degraded", "restored", "gt"} <= set(manifest[f"fix-{f}"]), f"fix {f}"
STATIC = ("hwy1", "hwy2", "urb1", "urb2", "corner1")
for f in STATIC:
    assert {"edit", "base", "edit_clean", "base_clean"} <= set(manifest[f"static-{f}"]), f"static {f}"
    d = json.loads((A / f"bev/static-{f}.json").read_text())
    assert all(d[k] for k in ("title", "change", "why")), f"static copy {f}"
    assert len(d["edit"]["ego"]) == d["n"] and d["edit"]["map"] and d["edit"]["new"] and d["edit"]["tracks"], f"static bev edit {f}"
    assert len(d["base"]["ego"]) == d["n"] and d["base"]["map"], f"static bev base {f}"
for f in ["drive", *(f"gen-{c}" for c in AGENT), *(f"cf-{c}" for c in FUTURES), *(f"static-{c}" for c in STATIC)]:
    mbit = (A / f"media/{f}.mp4").stat().st_size * 8 / 1e6 / manifest[f].get("seconds", 39.7 if f == "drive" else 19.6)
    assert mbit < 12, f"{f} streams at {mbit:.1f} Mbit/s; it would stall on an ordinary link"
for w in ("crosswalk", "drive", *AGENT):
    d = json.loads((A / f"world/{w}.json").read_text())
    assert len(d["ego"]) == 3 * d["n"] and d["map"] and d["tracks"], f"world {w}"
drive = json.loads((A / "world/drive.json").read_text())
assert [e for _, e in drive["events"]] == ["cyclist", "lead_brakes", "u_turn", "wreck", "median", "trees"] and any(t.get("e") for t in drive["tracks"]), "drive beats"
assert manifest["drive"]["size"] == [2560, 704] and drive["n"] == 397, "drive atlas"
chapters = json.loads((A / "media/film/chapters.json").read_text())
assert len(chapters) == 7 and all((ROOT / c["src"]).is_file() and (ROOT / c["src"]).with_suffix(".webp").is_file() for c in chapters), "film chapters"
for f in ("vendor/three/three.module.js", "vendor/three/three.core.js", "vendor/three/addons/loaders/GLTFLoader.js", "models/sedanSports.glb",
          "vendor/gsap.min.js", "vendor/ScrollTrigger.min.js", "figures/bd.js", "figures/figs/fig6.js", "fonts/display-light.ttf", "fonts/mono-regular.ttf"):
    assert (A / f).is_file(), f"missing assets/{f}"
css = (ROOT / "src/site.css").read_text()
assert "transition: all" not in css and "prefers-reduced-motion" in css
print(f"Static checks passed: {len(page.ids)} ids, {len(page.links)} links, {len(manifest)} clips")
