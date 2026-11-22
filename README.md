# BoschDreams 7V — homepage

A static page with no framework and no build step for the code. Each section makes one claim, says how to read the evidence, then lets the reader test it. Every frame on the page is real model output or recorded data, and every number is computed from simulated trajectories or taken from the report.

| Section | Claim | How it is shown |
|---|---|---|
| Hero | Seven cameras, one generated world | A lens moving through vector world → layout → generated → all seven views |
| Film | Everything in six minutes | Right under the opening: seven chapters (one file each) on one bar, with speed, volume, keyboard and full screen |
| Data | Trained on recorded drives, judged against them | The recorded corpus by condition, then generated scenes with a layout wipe and a zoomable top-down scene |
| Agent | Each ticket becomes a world | Seven tickets × six steps on one stage. Read: the ticket, a vector replay of the planner as deployed, its speed and the front camera. Search: the fleet as a field of points that the agent's tools narrow into a candidate pool of real first frames. Design: the edit built step by step in top-down view with the speed profile. Verify: checks, the closest call spotlit, the simulator's layout. Generate: 7V (four front, three rear) with a Recorded / Agent's edit switch and the 3D vector world on one clock. Train & test: the recorded and the ground-truth trajectory side by side |
| Futures | One decision, many futures | Three scenes; every future in front-wide and tele on one clock, any future in all seven cameras, a zoomable top-down map, a distance tree and outcomes from the trajectories; plays through all scenes |
| Drive | The world follows a new route | One 39.7 s take: a 3D world that zooms and that a director camera frames beat by beat, all seven cameras below |
| Static | Rewrite the road, generate it from noise | Five curated static-map corner cases screened from 16 barrier-gated scenarios (2 Highway: off-ramp diverge gore, work-zone lane drop; 2 Urban: mid-block crosswalk & refuge island, protected left-turn bay; 1 Complex corner case: dual-barrier contraflow S-shift). Paired Upper (Before · original road) vs. Lower (After · edited corner case) pure-noise generation across 4 front cameras side by side (`CL · FW · FT · CR`), high-contrast translucent colored semantic overlays (cyan lanes, amber yellow/work-zone, coral curbs/islands, violet crosswalks, mint stop bars/arrows), interactive progress bar & scrubber, guided 3-phase comparison flow bar, and synchronized zoomable top-down geometry diff |
| Repair | It repairs 3D Gaussian renders | All seven views of each failure mode, a divider sweeping between render and repair (or recording), the report's metrics |
| Inside, Experiments | How it works; how it measures up | Six animated report figures and four charts, each headline number under the chart it comes from |
| Footer | Who, what to cite, what it cannot do yet | The paper's title over a slow colour drift, then team, BibTeX and scope |

Pure black throughout with Bosch multicolor Supergraphic accent ribbons and hairline structure. Every section opens with a numbered kicker over a Bosch Supergraphic rule, a two-line claim and one sentence on how to read the evidence. Colour carries meaning: red marks the agent's edits, cyan the ego and new road geometry, yellow pedestrians and riders, green a pass, and ultra-thin translucent glowing gray lines mark all static map elements. The arXiv URL lives in one place, `<meta name="arxiv">` in `index.html`; until it is set the arXiv buttons show as not yet available.

## Publish

The page is published from `main` of https://github.com/jiangchaokang/BoschDreams-7V to https://jiangchaokang.github.io/BoschDreams-7V/ by `.github/workflows/publish.yml` (checks, then deploys only `index.html`, `src/` and `assets/`).

```bash
tools/release.sh "what changed"     # checks, commits everything, pushes to main; the workflow deploys
```

Once, on GitHub: Settings → Pages → Source: GitHub Actions. The repository uses plain Git (no LFS: Pages cannot serve LFS objects); every file is under 100 MB and the site is about 0.6 GB. All links are relative, so the page works under the `/BoschDreams-7V/` path.

## Run and check

```bash
./serve.sh                                   # http://localhost:8766; replaces an earlier server of this page; --port N to change
python3 tools/check_site.py                  # markup, links, atlases, scene, edit, world and film data, streamable bitrates
export CHROME=../../flashdreams/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome
../../flashdreams/.venv/bin/python tools/check_browser.py   # every interaction at 1440 / 390, videos play, reduced motion, no JavaScript
../../flashdreams/.venv/bin/python tools/shots.py 1440 "#drive"   # look at one section
```

The server never lets the browser reuse page code (`no-store`) and tags every media file with an ETag of its size and time, so a rebuilt video is never mixed with a cached one. Atlases stay at about 5–6 Mbit/s (drive 2.5) so they play in real time over an ordinary link.

## Code

```
index.html   the page
src/         main.js wires everything. lens.js (hero), sections.js (data, repair, drive, film, figures),
             agent.js, futures.js, bev.js (top-down), rig.js (seven synchronized views), world.js (3D), charts.js, car.js
tools/       build.py (assets), serve.py, check_site.py, check_browser.py, shots.py, export_figures.py, paper_data.py, release.sh
assets/      built by tools/build.py
```

## Rebuild assets

```bash
../../flashdreams/.venv/bin/python tools/build.py [vendor fonts figures world bev media studio pool film] [names ...]
```

`studio` builds the agent atlases (`gen-<ticket>.mp4`: recorded over edited, each a full 7V layer) and the futures atlases (`cf-<case>.mp4`: one 7V layer per future); `pool` the search's candidate first frames. `media` builds the hero, montage, drive (7V), scenes and repairs (`fix-<mode>.mp4`, render / repair / recording at the restorer's native 3:2). `world` exports the 3D worlds, one per agent edit. `film` cuts the master at its acts into `assets/media/film/`.

## Where the generated media come from

All agent, futures and drive generations use SGF+ v3 720p `step_000255` (EMA), exported with
`GPUS=7 bash run_singleview/elastic_forcing/sgf_train.sh export --work $W --checkpoint $W/checkpoints/step_000255.pt --ema` to `omni-dreams/.../7v_sgf_v3_720p_c32/export/step_000255_ema/model.pt`, at 4 steps with seven views; `build.py` reads the `f255_` labels in `work/gen.json`. Scenes were picked for a sharp, sunny first frame. The tools live in `flashdreams/datasets/world_agent/tools`:

1. `design.py ghost_ped ghost_cyclist ghost_car` builds the ghost probe edits. `aeb()` (the cyclist) is AEB-grade: the rider leaves the pavement through a 2.3 m gap in a parked row that is in the first frame, appears 14 m ahead (TTC 1.1 s at 45 km/h), the ego brakes at 8.5 m/s² and stops 0.7 m short; it never leaves the road. `emerge()` times the pedestrian and the car. `oneshot.py` builds the drive take. The cyclist is generated with `step_000290` (EMA): `build.py` prefers an `f290_` label over `f255_`.
2. `scene.py check SID EDITS` is the acceptance gate: overlaps, speed and braking limits.
3. `CK=<model.pt> serve.sh` runs the 7-GPU Edit Generate cockpit (`DATA=datasets/requested_scenes` for the drive take). `genqueue.py LABEL=SID:EDITS ...` generates each edit into `work/scenes/replay` and records it in `work/gen.json`.
4. `export.py [case ...]` writes the page's `assets/edit/<case>.json`, including futures outcomes and, for each ticket, the outcome of the recorded ego in the edited world against the ground truth. `layouts.py` writes the simulator's front-camera layouts.
5. `build.py studio | pool | media drive | world` encodes the atlases and exports the worlds. The repairs come from `omni-dreams/howitworks/paper_making/restore_frames.py --views 0 1 2 3 4 5 6 --video`.
6. Static edits (v3 paired pure-noise, 16-scenario screening → top 5): `static_edit_v3.py plan` (16 paired baseline + edited scenarios across highway, urban & complex corner cases with strict vehicle + static-barrier collision gate >= 0.45 m) → `static_edit_v3.py layout` → `torchrun --nproc_per_node=7 static_gen_v3.py` (pure noise, `step_000290` EMA) → visual keyframe screening to top 5 (2 Highway, 2 Urban, 1 Complex) → `static_edit_v3.py compose` (high-contrast translucent colored semantic overlays, zero gray) → `static_edit_v3.py page`.
