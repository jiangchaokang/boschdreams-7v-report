#!/usr/bin/env python3
"""Build assets/ from local research outputs. FFmpeg, Pillow, fontTools and flashdreams' world7v; no inference.

Run with the flashdreams venv:  ../../flashdreams/.venv/bin/python tools/build.py [step ...]
Every tile is one stretch to the model's native size (as in training) plus one cover-fit crop; nothing is sharpened or recoloured.
"""
import json
import math
import os
import shutil
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
REPO = Path(os.environ.get("FLASHDREAMS", ROOT.parents[1] / "flashdreams"))
A = ROOT / "assets"
MEDIA = A / "media"
OMNI = REPO.parent / "omni-dreams"
HIW = OMNI / "howitworks"
INFER = OMNI / "assets/logs/infer"
REPLAY = REPO / "datasets/replay"
TOOLS7V = REPO / "integrations_v2/omnidreams/impl/tools"

RIG = ["FW", "CR", "RR", "RT", "RL", "CL", "FT"]  # column order of *_with_hdmap.mp4, of the repair videos and of the figures
REPLAY_NAME = dict(FW="front_wide", CR="cross_right", RR="rear_right", RT="rear", RL="rear_left", CL="cross_left", FT="front_tele")
INFER_NAME = dict(FW="wide120", CR="crossR", RR="rearR", RT="rearTele", RL="rearL", CL="crossL", FT="tele30")
SENSOR = dict(FW="FrontCam02", FT="FrontCam01", CL="SideFrontCam01", CR="SideFrontCam02", RL="SideRearCam01", RR="SideRearCam02", RT="RearCam01")
EXAMPLE, REQUESTED = REPO / "example_data", REPO / "datasets/requested_scenes"


def run(args):
    subprocess.run([str(a) for a in args], check=True)


def encode(name, inputs, rects, size, crf=24, gop=20, rate=None):
    """inputs: [(file, start_s, seconds)]; rects: [(input, prefilter or None, x, y, w, h)]. One decoder later keeps every tile frame-locked.
    rate caps the bitrate (e.g. "3M") so the atlas streams in real time over an ordinary link."""
    uses = {}
    for n, r in enumerate(rects):
        uses.setdefault(r[0], []).append(n)
    seconds = min(s for _, _, s in inputs)
    graph = [f"color=c=black:s={size[0]}x{size[1]}:r=10:d={seconds}[b0]"]
    for i, ns in uses.items():
        graph.append(f"[{i}:v]fps=10,split={len(ns)}" + "".join(f"[s{n}]" for n in ns) if len(ns) > 1 else f"[{i}:v]fps=10[s{ns[0]}]")
    for n, (_, pre, x, y, w, h) in enumerate(rects):
        fit = f"scale={w}:{h}:force_original_aspect_ratio=increase:flags=lanczos,crop={w}:{h},setsar=1"
        graph.append(f"[s{n}]" + (f"{pre}," if pre else "") + f"{fit}[t{n}]")
        graph.append(f"[b{n}][t{n}]overlay={x}:{y}:shortest=1[b{n + 1}]")
    args = [a for f, s, d in inputs for a in ("-ss", s, "-t", d, "-i", f)]
    out = MEDIA / f"{name}.mp4"
    run(["ffmpeg", "-v", "error", "-y", *args, "-filter_complex", ";".join(graph), "-map", f"[b{len(rects)}]", "-an", "-r", 10,
         "-c:v", "libx264", "-preset", "slow", "-crf", crf, *(["-maxrate", rate, "-bufsize", rate] if rate else []),
         "-g", gop, "-pix_fmt", "yuv420p", "-movflags", "+faststart", out])
    poster(out)
    return out


def poster(mp4, t=0):
    run(["ffmpeg", "-v", "error", "-y", "-ss", t, "-i", mp4, "-frames:v", 1, "-c:v", "libwebp", "-quality", 80, mp4.with_suffix(".webp")])


def pack(a, x0=0):
    """FW (2a x 2b) above the six other views (a x b): 2a x 5b. The page lays the tiles out, not the video."""
    b = round(a * 704 / 1280) // 2 * 2
    return {"FW": [x0, 0, 2 * a, 2 * b]} | {c: [x0 + i % 2 * a, (2 + i // 2) * b, a, b] for i, c in enumerate(RIG[1:])}, (2 * a, 5 * b)


# ---- sources: per camera (file, stretch-to-native prefilter) ----
def replay(name, root=REPLAY, pre=None):
    return lambda c: (root / name / f"{REPLAY_NAME[c]}.mp4", pre if c == "FW" else None)


def infer(run_dir, sid):
    return lambda c: (INFER / run_dir / f"{sid}_{INFER_NAME[c]}.mp4", None)


def dataset_layout(root, sid, native):
    return lambda c: (root / "control_input_hdmap_bbox" / SENSOR[c] / f"{sid}.mp4", f"scale={native[0]}:{native[1]}")


def hdmap_row(path, row):
    return lambda c: (path, f"crop=1280:704:{RIG.index(c) * 1280}:{row * 704}")


def layered(name, layers, a, start, seconds, **kw):
    """layers: {layer: source}; layer atlases sit side by side and share one clock."""
    inputs, rects, clip = [], [], {}
    for k, (layer, src) in enumerate(layers.items()):
        tiles, size = pack(a, k * 2 * a)
        clip[layer] = tiles
        for c in RIG:
            f, pre = src(c)
            if (f, start, seconds) not in inputs:
                inputs.append((f, start, seconds))
            rects.append((inputs.index((f, start, seconds)), pre, *tiles[c]))
    size = (2 * a * len(layers), size[1])
    encode(name, inputs, rects, size, **kw)
    return name, {"size": size, **clip}


HDMAP_NIGHT = INFER / "sgf720_v2_step140_ema_test8/1937891814051774466_with_hdmap.mp4"
HDMAP_TRUCK = INFER / "corner_case_step135_ema_h24_calib/1942607596894375936_with_hdmap.mp4"
CROSSWALK = "1937957130429628417"
SCENES = {  # one word each; every scene carries its own layout layer
    "riders": ({"tiles": replay("1942452470432759808_vru"), "layout": dataset_layout(EXAMPLE, "1942452470432759808", (832, 480))}, 416, 8),
    "crosswalk": ({"tiles": replay(CROSSWALK), "layout": dataset_layout(REQUESTED, CROSSWALK, (1280, 704))}, 480, 6),
    "night": ({"tiles": hdmap_row(HDMAP_NIGHT, 1), "layout": hdmap_row(HDMAP_NIGHT, 0)}, 480, 10),
    "highway": ({"tiles": replay("1942441694649221120_sunny"), "layout": dataset_layout(EXAMPLE, "1942441694649221120", (832, 480))}, 416, 10),
    "truck": ({"tiles": hdmap_row(HDMAP_TRUCK, 1), "layout": hdmap_row(HDMAP_TRUCK, 0)}, 480, 0),
    "scooters": ({"tiles": replay("1937957130429628417_drive2")}, 480, 4),  # a driven replay: RGB only, no layout was rendered
}
KIT = REPO / "datasets/world_agent/work"  # the agent's designs, generations and their scenes
GENS = KIT / "scenes/replay"
DRIVE = (KIT / "scenes", "1942467747572711424", KIT / "design/oneshot.json")  # scene root, scene, edit
AERIAL = {"drive-aerial": ("aerial_tilt", "aerial"), "drive-junction": ("junction", "junction"), "drive-orbit": ("orbit", "orbit")}  # page take: (gen label, layout)
AERIAL_SECONDS = {"drive-aerial": 3.6}  # takes the page cuts short; the rest play 18.9 s
COSMOS = Path("/workspace/vol-lsl001/data/cosmos_cn")
TRAIN = COSMOS / "cosmos_cn_train_data/videos"
BEV = {  # clip: (scene json, driven replay or None); the window follows the clip's start in SCENES
    "riders": (EXAMPLE / "scene_jsons/1942452470432759808.json", None),
    "crosswalk": (REQUESTED / f"scene_jsons/{CROSSWALK}.json", None),
    "night": (COSMOS / "cosmos_cn_frames/1937891814051774466.json", None),
    "highway": (EXAMPLE / "scene_jsons/1942441694649221120.json", None),
    "truck": (COSMOS / "cosmos_cn_frames/1942607596894375936.json", None),
    "scooters": (REQUESTED / f"scene_jsons/{CROSSWALK}.json", REPLAY / f"{CROSSWALK}_drive2/drive.json"),
}
SEVEN = ["CL", "FW", "FT", "CR", "RL", "RT", "RR"]  # front row left to right, then the rear row


def seven(x0, y0, a=640, b=352):
    """One 7V layer: the four front-facing views in a row, the three rear-facing ones below (4a x 2b)."""
    return {c: [x0 + i % 4 * a, y0 + i // 4 * b, a, b] for i, c in enumerate(SEVEN)}


# Generations (work/gen.json labels) with SGF+ v3 720p step_000255 EMA, 4 steps.
AGENT = {  # gen-<label>: the recorded drive and the agent's edit, on one clock
    "ghost_ped": "1942587650617679872", "ghost_cyclist": "1942587650617679872", "ghost_car": "1942603819499999232",
    "left": "1942614620717797376", "congestion": "1942606046193295360", "construction": "1942614958795694080",
    "roundabout": "1942467747572711424",
}
FUTURES = {"hub": "SLRU", "lturn": ("wrong", "avg", "opt"), "xwalk": ("wrong", "avg", "opt")}
SECONDS = {"xwalk": 9.5}
TAG = "f255_"


def studio(*only):
    """gen-<label>: rec over edit; cf-<case>: one layer per future. Every layer is a full 7V at native aspect, no crop."""
    gen = json.loads((KIT / "gen.json").read_text())
    rec = lambda sid: lambda c: (TRAIN / SENSOR[c] / f"{sid}.mp4", "scale=1280:704")
    run_of = lambda label: replay(gen.get("f290_" + label) or gen[TAG + label], GENS)
    jobs = {f"gen-{k}": lambda sid=sid, k=k: {"rec": rec(sid), "edit": run_of(k)} for k, sid in AGENT.items()}
    jobs |= {f"cf-{k}": lambda k=k, bs=bs: {b: run_of(f"{k}_{b}") for b in bs} for k, bs in FUTURES.items()}
    made = {}
    for name, spec in jobs.items():
        if only and name.split("-", 1)[1] not in only:
            continue
        layers = spec()
        inputs, rects, clip, sec = [], [], {}, SECONDS.get(name.split("-", 1)[1], 19.6)
        for k, (layer, src) in enumerate(layers.items()):
            clip[layer] = seven(0, k * 704)
            for c in SEVEN:
                f, pre = src(c)
                inputs.append((f, 0, sec))
                rects.append((len(inputs) - 1, pre, *clip[layer][c]))
        size = (2560, 704 * len(layers))
        encode(name, inputs, rects, size, crf=21, rate=f"{3 * len(layers)}M")
        made[name] = {"size": size, "seconds": sec, **clip}
    for f in (KIT / "layout").glob("*.mp4"):  # the simulator's view of each design, front camera
        if f.stem in AGENT and (not only or f.stem in only):
            run(["ffmpeg", "-v", "error", "-y", "-i", f, "-vf", "scale=960:528", "-c:v", "libx264", "-crf", 23, "-g", 10, "-pix_fmt", "yuv420p",
                 "-movflags", "+faststart", MEDIA / f"layout-{f.stem}.mp4"])
    m = json.loads((MEDIA / "manifest.json").read_text())
    (MEDIA / "manifest.json").write_text(json.dumps(m | made, separators=(",", ":")) + "\n")


def pool():
    """First frames of the best-ranked drives the agent's search returns for each ticket: one strip per ticket."""
    from PIL import Image
    (A / "pool").mkdir(parents=True, exist_ok=True)
    for kind in ("ghost", "left", "congestion", "construction", "roundabout"):
        sids = [x["sid"] for x in json.loads((KIT / f"find/find_{kind}.json").read_text())]
        frames = []
        for sid in sids:
            f = TRAIN / "FrontCam02" / f"{sid}.mp4"
            if not f.is_file():
                continue
            png = Path(os.environ.get("TMPDIR", "/tmp")) / f"pool_{sid}.png"
            run(["ffmpeg", "-v", "error", "-y", "-ss", 0.5, "-i", f, "-frames:v", 1, "-vf", "scale=320:176", png])
            frames.append(Image.open(png).convert("RGB"))
            if len(frames) == 12:
                break
        strip = Image.new("RGB", (320 * len(frames), 176))
        for i, im in enumerate(frames):
            strip.paste(im, (320 * i, 0))
        strip.save(A / "pool" / f"{kind}.webp", quality=78)
        print(f"pool/{kind}.webp {len(frames)} drives")
RESTORED = HIW / "paper_making/restoration_video"  # restore_frames.py --video: <family>_v<view>_<row>.mp4, 960 x 640, views in RIG order
REPAIRS = {"seams": "0000_chunk_seam", "ghosts": "1200_foreground_noise", "road": "2400_road_noise", "blur": "3601_underfit_long", "holes": "4802_world_invisible"}


def fix7(name, fam):
    """The 3DGS render, the repair and the recording, each a full 7V layer at the restorer's native 3:2."""
    inputs, rects, clip = [], [], {}
    for k, row in enumerate(("degraded", "restored", "gt")):
        clip[row] = seven(0, k * 800, 600, 400)
        for c in SEVEN:
            inputs.append((RESTORED / f"{fam}_v{RIG.index(c)}_{row}.mp4", 0, 8.7))
            rects.append((len(inputs) - 1, None, *clip[row][c]))
    encode(f"fix-{name}", inputs, rects, (2400, 2400), crf=20, rate="10M")
    return f"fix-{name}", {"size": (2400, 2400), **clip}


def drive(name="drive", take="oneshot", layout="oneshot", sec=39.7):
    """A take's seven cameras, and below them the layout each was conditioned on (the page's overlay): 2560 x 1408."""
    gen = json.loads((KIT / "gen.json").read_text())
    rgb = replay(gen.get(TAG + take) or gen[take], GENS)
    tiles, over = seven(0, 0), []
    for c in SEVEN:
        x, y, w, h = tiles[c]
        over.append((len(SEVEN), f"crop={w}:{h}:{x}:{y}", x, y + 704, w, h))
    inputs = [(rgb(c)[0], 0, sec) for c in SEVEN] + [(KIT / f"layout7v/{layout}.mp4", 0, sec)]
    encode(name, inputs, [(i, None, *tiles[c]) for i, c in enumerate(SEVEN)] + over, (2560, 1408), crf=21, gop=10, rate="8M")
    return name, {"size": (2560, 1408), "seconds": sec, "tiles": tiles, "layout": seven(0, 704)}
MONTAGE = [  # front-wide shots for the opening's acceleration: (source, start s); cuts shorten as the pace rises
    (INFER / "sgf720_v2_step140_ema_test8/1937891814051774466_wide120.mp4", 10),
    (REPLAY / "1942441694649221120_sunny/front_wide.mp4", 9),
    (REPLAY / "1942452470432759808_vru/front_wide.mp4", 10),
    (INFER / "corner_case_step135_ema_h24_calib/1942607596894375936_wide120.mp4", 2),
    (REPLAY / "L1942454445211746304/front_wide.mp4", 58),
    (REPLAY / "1942467927915343872_drive1/front_wide.mp4", 13),
    (REPLAY / "1942467747572711424_drive3/front_wide.mp4", 18),
    (REPLAY / "1942467747572711424_drive1/front_wide.mp4", 18),
    (REPLAY / "1942450686716903424_raw/front_wide.mp4", 10),
    (REPLAY / "1942450969396215808_snow/front_wide.mp4", 10),
    (INFER / "sgf720_v2_step140_ema_test8/1936445377286868993_wide120.mp4", 4),
    (REPLAY / "1942441992864235520_sunny/front_wide.mp4", 10),
    (REPLAY / "1943169506737451008_drive2/front_wide.mp4", 18),
    (REPLAY / "1942442358490103808_night/front_wide.mp4", 10),
    (REPLAY / "1937957130429628417_drive2/front_wide.mp4", 18),
    (REPLAY / "1942441939483328512_sunny/front_wide.mp4", 10),
]


def hero():
    """The opening scene: front-wide generated and layout at full size, the six other views small, all on one clock."""
    gen, lay = replay(CROSSWALK), dataset_layout(REQUESTED, CROSSWALK, (1280, 704))
    small = {c: [(i % 3) * 426, 1408 + (i // 3) * 234, 426, 234] for i, c in enumerate(RIG[1:])}
    files = [gen("FW")[0], lay("FW")[0]] + [gen(c)[0] for c in RIG[1:]]
    rects = [(0, None, 0, 0, 1280, 704), (1, lay("FW")[1], 0, 704, 1280, 704)] + [(2 + i, None, *small[c]) for i, c in enumerate(RIG[1:])]
    encode("hero", [(f, 3, 30) for f in files], rects, (1280, 1876), crf=25)
    return "hero", {"size": (1280, 1876), "first": 30, "tiles": {"FW": [0, 0, 1280, 704], **small}, "layout": {"FW": [0, 704, 1280, 704]}}


def montage():
    cuts = [max(0.2, round(1.1 * 0.84 ** i, 1)) for i in range(len(MONTAGE))]
    inputs = [a for f, s in MONTAGE for a in ("-ss", s, "-t", 2, "-i", f)]
    parts = "".join(f"[{i}:v]fps=10,scale=1280:704:force_original_aspect_ratio=increase,crop=1280:704,setsar=1,trim=duration={d},setpts=PTS-STARTPTS[v{i}];"
                    for i, d in enumerate(cuts))
    graph = parts + "".join(f"[v{i}]" for i in range(len(cuts))) + f"concat=n={len(cuts)}:v=1:a=0[out]"
    out = MEDIA / "montage.mp4"
    run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", graph, "-map", "[out]", "-an", "-r", 10, "-c:v", "libx264",
         "-preset", "slow", "-crf", 24, "-g", 10, "-pix_fmt", "yuv420p", "-movflags", "+faststart", out])
    return "montage", {"size": (1280, 704), "cuts": cuts}


def media(*only):
    MEDIA.mkdir(parents=True, exist_ok=True)
    jobs = {"hero": hero, "montage": montage, "drive": drive}
    jobs |= {n: (lambda n=n, t=t, l=l: drive(n, t, l, AERIAL_SECONDS.get(n, 18.9))) for n, (t, l) in AERIAL.items()}
    jobs |= {n: (lambda n=n, l=l, a=a, s=s: layered(n, l, a, s, 8)) for n, (l, a, s) in SCENES.items()}
    jobs |= {f"fix-{n}": (lambda n=n, f=f: fix7(n, f)) for n, f in REPAIRS.items()}
    with ThreadPoolExecutor(max_workers=8) as pool:
        made = dict(f.result() for f in [pool.submit(j) for k, j in jobs.items() if not only or k in only])
    old = json.loads((MEDIA / "manifest.json").read_text()) if (MEDIA / "manifest.json").is_file() else {}
    (MEDIA / "manifest.json").write_text(json.dumps(old | made, separators=(",", ":")) + "\n")


CHAPTERS = [  # one per act of the film's timeline: title, what it shows, poster time inside the chapter (s)
    ("Opening", "Seven cameras, generated while you steer", 7.5),
    ("One step", "Layout in, one denoising step, seven cameras out", 7),
    ("Method", "Network, training, streaming and the loop, as six living figures", 13),
    ("Controllable", "Ticket agent, counterfactuals, four decisions and rewritten roads", 18),
    ("Closed loop", "Zero-human evaluation, real-time play, any weather and 3½ minutes in one take", 8),
    ("Restoration", "Repairing what 3D Gaussian splatting breaks", 12),
    ("Results", "Benchmarks, 10.85 FPS real-time streaming and ablations from the report", 5.5),
]


def film():
    """The promo film cut at its acts into self-contained chapters, so any chapter starts at once."""
    out, src = MEDIA / "film", REPO / "docs/make_video/out/BoschDreams_film.mp4"
    out.mkdir(parents=True, exist_ok=True)
    t = json.loads((REPO / "docs/make_video/out/timeline.json").read_text())
    cuts = [x["a"] for x in t["ACTS"]] + [t["END"]]
    assert len(cuts) == len(CHAPTERS) + 1, "one chapter per act"
    chapters = []
    for i, ((title, line, at), a, b) in enumerate(zip(CHAPTERS, cuts, cuts[1:])):
        f = out / f"{i}.mp4"
        run(["ffmpeg", "-v", "error", "-y", "-ss", a, "-to", b, "-i", src, "-vf", "scale=1920:1080:flags=lanczos", "-c:v", "libx264", "-preset", "medium",
             "-crf", 22, "-g", 60, "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", f])
        poster(f, at)
        chapters.append({"title": title, "line": line, "start": round(a, 2), "seconds": round(b - a, 2), "src": f"assets/media/film/{i}.mp4"})
    (out / "chapters.json").write_text(json.dumps(chapters, indent=1) + "\n")


# ---- the 3D vector world: map, ego and actors exported from world7v (what the serve cockpit draws) ----
def world(*only):
    sys.path.insert(0, str(TOOLS7V.parents[1]))
    from impl.tools import world7v as W

    def export(name, scene_json, sid, edits=None, seconds=None):
        s = W.WorldScene(str(scene_json), None, sid)
        rec = np.asarray(s.replay_track()["ego"])
        n = s.n_frames
        if edits:
            e = json.loads(Path(edits).read_text())
            s.set_edits(e["tracks"])
            s.set_ego_edit(e["ego"]["xy"], e["ego"]["yaw"], e["ego"].get("z"), e["ego"].get("pitch"))
            n = len(e["ego"]["xy"])
        n = min(n, round(seconds * s.fps)) if seconds else n
        T = np.array([s.ego_T(i) for i in range(n)])
        ego = np.c_[T[:, 0, 3], T[:, 1, 3], np.unwrap(np.arctan2(T[:, 1, 0], T[:, 0, 0]))]
        ox, oy = ego[0, :2]
        r1, r2 = (lambda v: round(float(v), 1)), (lambda v: round(float(v), 2))
        tracks = {}
        for i in range(n):
            for a in s.actors(i, edits=True):
                x, y = a["position"][:2]
                if math.hypot(x - ego[i, 0], y - ego[i, 1]) > 140:
                    continue
                t = tracks.setdefault(a["track_id"], {"c": a["category"], "s": [r2(v) for v in a["size"]], "f": i, "p": []})
                if a["track_id"] in s.edited:
                    t["e"] = 1
                if t["f"] + len(t["p"]) // 3 != i:  # a gap: keep the first segment only
                    continue
                t["p"] += [r1(x - ox), r1(y - oy), r2(a["yaw"])]
        for t in tracks.values():  # parked: one pose
            p = t["p"]
            if max(abs(p[j] - p[j % 3]) for j in range(len(p))) < 0.3:
                t["p"], t["n"] = p[:3], len(p) // 3
        out = {
            "fps": s.fps, "n": n,
            "ego": [v for x, y, h in ego for v in (r2(x - ox), r2(y - oy), round(float(h), 3))],
            "speed": [r1(v) for v in np.r_[np.hypot(*np.diff(ego[:, :2], axis=0).T), 0][:n] * s.fps],
            "map": [{"t": m["type"], "lt": m["lane_type"], "lc": m["lane_color"], "g": m["geometry"] == "polygon_3d",
                     "p": [r1(v - o) for q in m["points"] for v, o in zip(q, (ox, oy))]} for m in s.map_json()["elements"]],
            "tracks": list(tracks.values()),
        }
        if edits:
            out["recorded"] = [r1(v - o) for q in rec[:n:5] for v, o in zip(q[:2], (ox, oy))]
            out["events"] = [[t, k] for t, k in json.loads(Path(edits).with_suffix(".meta.json").read_text())["events"] if not seconds or t < seconds]
            if "pitch" in e["ego"]:  # aerial: altitude above the recorded pose and look-down, per frame
                z, p = (np.asarray(e["ego"][k], float)[:n] for k in ("z", "pitch"))
                out["ego3"] = [round(float(v), 3) for i in range(n) for v in (ego[i, 0] - ox, ego[i, 1] - oy, z[i] - z[0], ego[i, 2], p[i])]
        (A / "world").mkdir(parents=True, exist_ok=True)
        (A / "world" / f"{name}.json").write_text(json.dumps(out, separators=(",", ":")))
        print(f"world/{name}.json {len(out['tracks'])} tracks, {(A / 'world' / f'{name}.json').stat().st_size >> 10} KB")

    want = lambda name: not only or name in only
    if want("crosswalk"):
        export("crosswalk", REQUESTED / f"scene_jsons/{CROSSWALK}.json", CROSSWALK)
    root, sid, edits = DRIVE
    if want("drive"):
        export("drive", root / f"scene_jsons/{sid}.json", sid, edits)
    for name in AERIAL:  # each take's own scene, from its design's meta
        design = KIT / f"design/{name.removeprefix('drive-')}.json"
        aid = json.loads(design.with_suffix(".meta.json").read_text())["scene"]
        if want(name):
            export(name, KIT / f"scenes/scene_jsons/{aid}.json", aid, design, AERIAL_SECONDS.get(name))
    for label, sid in AGENT.items():
        if want(label):
            export(label, KIT / f"scenes/scene_jsons/{sid}.json", sid, KIT / f"design/{label}.json")


def bev():
    """Top-down data under each generated scene: map, ego and actors over the clip's 8 s, in the frame of its first pose."""
    sys.path.insert(0, str(TOOLS7V.parents[1]))
    from impl.tools import world7v as W

    kinds = {"lane_line": 0, "road_edge": 1, "crosswalks": 2, "wait_lines": 3}
    (A / "bev").mkdir(parents=True, exist_ok=True)
    for name, (js, drive) in BEV.items():
        s = W.WorldScene(str(js), None, js.stem)
        tr = s.replay_track(W.Drive.load(drive) if drive else None)
        f0 = SCENES[name][2] * 10
        ego = np.array(tr["ego"][f0:f0 + 80])
        o = ego[0, :2]
        rel = lambda q: [round(float(q[0] - o[0]), 1), round(float(q[1] - o[1]), 1)]
        near = lambda q, r: np.hypot(*(ego[:, :2] - q[:2]).T).min() < r
        d = {"n": len(ego), "ego": [[*rel(e), round(float(e[3]), 3)] for e in ego], "map": [], "tracks": {}}
        for e in s.map_json()["elements"]:
            pts = [rel(q) for q in e["points"] if near(np.asarray(q, float), 60)]
            if e["type"] in kinds and len(pts) > 1:
                d["map"].append([kinds[e["type"]], pts])
        for i, acts in enumerate(tr["actors"][f0:f0 + 80]):
            for a in acts:
                if math.hypot(a["position"][0] - ego[i, 0], a["position"][1] - ego[i, 1]) < 45:
                    t = d["tracks"].setdefault(a["track_id"], {"c": a["category"], "s": [round(v, 2) for v in a["size"][:2]], "p": {}})
                    t["p"][i] = [*rel(a["position"]), round(a["yaw"], 2)]
        (A / "bev" / f"{name}.json").write_text(json.dumps(d, separators=(",", ":")))
        print(f"bev/{name}.json {len(d['map'])} lines, {len(d['tracks'])} tracks", flush=True)


def vendor():
    v, m = A / "vendor", A / "models"
    (v / "three/addons/loaders").mkdir(parents=True, exist_ok=True)
    (v / "three/addons/utils").mkdir(parents=True, exist_ok=True)
    m.mkdir(parents=True, exist_ok=True)
    for src, dst in (("three.module.js", "three/three.module.js"), ("three.core.js", "three/three.core.js"),
                     ("GLTFLoader.js", "three/addons/loaders/GLTFLoader.js"), ("BufferGeometryUtils.js", "three/addons/utils/BufferGeometryUtils.js"),
                     ("SkeletonUtils.js", "three/addons/utils/SkeletonUtils.js")):
        shutil.copy2(TOOLS7V / f"web7v_{src}", v / dst)
    for f in ("sedanSports", "truck", "pedestrian_raw"):
        shutil.copy2(TOOLS7V / f"web7v_{f}.glb", m / f"{f}.glb")
    for f in ("gsap.min.js", "ScrollTrigger.min.js"):
        shutil.copy2(REPO / "node_modules/gsap/dist" / f, v / f)


def fonts():
    from fontTools import subset
    (A / "fonts").mkdir(parents=True, exist_ok=True)
    noto = Path("/usr/share/fonts/truetype/noto")
    for src, dst in (("NotoSansDisplay-Light", "display-light"), ("NotoSansDisplay-SemiBold", "display-semibold"),
                     ("NotoSans-Regular", "text-regular"), ("NotoSans-Medium", "text-medium"),
                     ("NotoSansMono-Regular", "mono-regular")):
        opts = subset.Options()
        opts.layout_features = ["kern", "liga", "tnum", "sups"]
        f = subset.load_font(str(noto / f"{src}.ttf"), opts)
        s = subset.Subsetter(opts)
        s.populate(unicodes=list(range(0x20, 0x7F)) + [0xB7, 0xD7, 0x2013, 0x2014, 0x2019, 0x201C, 0x201D, 0x2026, 0xB0, 0x2190, 0x2191, 0x2192, 0x2193, 0x2212, 0x2248, 0x2264, 0x2265, 0xB2, 0x2020])
        s.subset(f)
        subset.save_font(f, str(A / "fonts" / f"{dst}.ttf"), opts)


def figures():
    """Unmodified copies of the report's figure engine; it requests its assets as assets/<folder>/... relative to the page."""
    t = A / "figures"
    (t / "figs").mkdir(parents=True, exist_ok=True)
    shutil.copy2(HIW / "bd.js", t / "bd.js")
    for f in (HIW / "figs").glob("fig*.js"):
        shutil.copy2(f, t / "figs" / f.name)
    for f in ("data.js", "scene.js"):
        shutil.copy2(HIW / "assets" / f, t / f)
    shutil.copy2(HIW / "assets/math/index.js", t / "math.js")
    for folder in ("clip", "denoise", "math", "vec"):
        shutil.copytree(HIW / "assets" / folder, A / folder, dirs_exist_ok=True)
    shutil.copy2(HIW / "latex/report.pdf", A / "BoschDreams-technical-report.pdf")


STEPS = {"vendor": vendor, "fonts": fonts, "figures": figures, "world": world, "bev": bev, "media": media, "studio": studio, "pool": pool, "film": film}

if __name__ == "__main__":
    step, *args = sys.argv[1:] or [None]
    for name in [step] if step else STEPS:
        print(f"[build] {name}", flush=True)
        STEPS[name](*args)
