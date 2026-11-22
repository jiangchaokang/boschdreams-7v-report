#!/usr/bin/env python3
"""paper_data.py: the report's experiment tables (omni-dreams/howitworks/latex) -> assets/data/results.json, the single
source for every chart in the film and on this page. Rows are found by their label; cells keep the paper's numbers."""
import json
import re
from pathlib import Path

TEX = Path("/workspace/rbwm/bosch_dreams/omni-dreams/howitworks/latex/sections")
OUT = Path(__file__).resolve().parents[1] / "assets/data/results.json"


def cells(text, label):
    line = next(l for l in text.splitlines() if label in l and "&" in l)
    out = []
    for c in line.split("&")[1:]:
        c = re.sub(r"\\(best|secbest|textbf|textit|subrow|mathbf)\{([^{}]*)\}", r"\2", c).replace("$", "").replace("\\\\", "")
        m = re.findall(r"-?\d+\.?\d*", c.split("(")[0])
        out.append(float(m[0]) if m and "na" not in c and "tbd" not in c else None)
    return out


s7, s9, s6 = ((TEX / f).read_text() for f in ("s07_experiments.tex", "s09_supplementary.tex", "s06_fixer.tex"))
MAIN = ["objq", "subjq", "vcons", "fvd", "acons", "apres", "ade", "dtw", "ftd", "match", "conf"]
models = {
    "GT reference": "GT Measured Reference} & 7V", "Causal Forcing": "Causal Forcing~", "LingBot": "LingBot~", "Wan2.2": "Wan2.2~\\citep",
    "FastVideo Causal Wan2.2": "FastVideo Causal", "HY-WorldPlay": "HY-WorldPlay~", "Self-Forcing": "Self-Forcing~\\citep",
    "Cosmos-Transfer 2.5 (7V)": "Cosmos-Transfer~2.5$^*$~", "Cosmos 2.5 1V": "Cosmos~2.5~1V~", "OmniDreams-1V": "OmniDreams-1V~",
    "BoschDreams 480p 1-step": "(ours, 1-step)", "BoschDreams 720p 4-step": "(ours, 4-step)"}
main = {k: dict(zip(MAIN, cells(s7, v)[1:])) for k, v in models.items()}

ABL = ["fps", "subjq", "vcons", "fvd7", "fvdfw", "acons", "apres", "match", "ade"]
stages = {"I · Teacher": "(1) Stage~I", "II · Causal student": "(2) Stage~II", "III · Self-Forcing": "(3) Stage~III",
          "IV · + LAK": "(4) + Stage~IV", "IV · Antiphon Forcing": "(5) + \\textbf{Antiphon"}
steps = {"480p · 1 step": "N_{\\text{step}}=1", "480p · 2 steps": "N_{\\text{step}}=2", "480p · 4 steps": "480p ($832\\times 480$), $N_{\\text{step}}=4",
         "720p · 4 steps": "720p ($1280"}
ablation = {k: dict(zip(ABL, cells(s7, v))) for k, v in stages.items()}
config = {k: dict(zip(ABL, cells(s7, v))) for k, v in steps.items()}

runtime = []
for line in s9.split("label{tab:supp_efficiency}")[1].split("bottomrule")[0].splitlines():
    if "&" in line and "ms" not in line and "Configuration" not in line:
        group = re.sub(r"\\\w+\{|\}", "", line.split("&")[0].replace("\\rowcolor{boschblue!7}", "")).strip()
        name = re.sub(r"\\\w+\{|\}", "", line.split("&")[1]).strip()
        ms, fps = cells(line, line.split("&")[0])[1:3]
        runtime.append({"group": group, "config": name, "ms": ms, "fps": fps})

VIEWS = ["Front Wide", "Front Tele", "Cross Left", "Cross Right", "Rear Tele", "Rear Left", "Rear Right"]


def per_view(block):
    return {v: dict(zip(["objq", "subjq", "vcons", "fvd"], cells(block, f"& {v} &")[1:5])) for v in VIEWS}


blocks = {"GT reference": "GT Measured Reference (600)", "480p 1-step": "(480p, 1-step)}", "720p 4-step": "(720p, 4-step)}",
          "480p 2-step": "(480p, 2-step)}", "480p 4-step": "(480p, 4-step)}", "Stage IV LAK": "Stage IV LAK (", "Stage III": "Stage III Self-Forcing ("}
views, pv = {}, s9[s9.index("label{tab:pervview_all}"):]
for k, key in blocks.items():
    body = pv[pv.index(key):]
    views[k] = per_view(body[:min(body.find(m) % (len(body) + 1) for m in ("midrule", "bottomrule"))])

fixer = {}
for fam in ["Chunk seams", "Under-fitting", "Missing background", "Foreground noise", "Road noise"]:
    c = re.sub(r"\\mathbf\{([^}]*)\}", r"\1", next(l for l in s6.splitlines() if l.strip().startswith(fam)))
    n = [float(x) for x in re.findall(r"-?\d+\.\d+|\b\d+\b", c.replace("\\rightarrow", " "))]
    fixer[fam] = {"psnr": n[0:2], "ssim": n[3:5], "lpips": n[5:7], "fid": n[7:9], "fvd": n[9:11], "fbd": n[11:13]}

data = {"source": "BoschDreams-7V technical report, November 2026", "main": main, "ablation": ablation, "config": config,
        "runtime": runtime, "views": views, "fixer": fixer}
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(data, indent=1))
assert main["BoschDreams 720p 4-step"]["ade"] == 4.90 and main["Cosmos-Transfer 2.5 (7V)"]["fvd"] == 106.99
assert config["480p · 1 step"]["fps"] == 10.85 and ablation["III · Self-Forcing"]["fvd7"] == 128.44
assert views["720p 4-step"]["Rear Tele"]["fvd"] == 97.99 and fixer["Chunk seams"]["psnr"] == [21.97, 24.09]
assert [r["ms"] for r in runtime][-1] == 3945 and len(runtime) == 10
print("wrote", OUT)
