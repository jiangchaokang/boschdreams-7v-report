import { Rig, SEVEN, blit, fit, dpr, reduced } from "./rig.js";
import { drawMap, poseAt, EGO, COL } from "./bev.js";
import { World, loadWorld, steer } from "./world.js";
import { $, $$, radios } from "./sections.js";

const FPS = 10;
// Six steps; each pairs what the agent does (left) with what it produces (right). Seconds per step in autoplay.
const STEPS = [["Read", "the fleet ticket", 9], ["Search", "the recorded fleet", 10.5], ["Design", "the edit in vector space", 13.5],
  ["Verify", "physics and layout", 8.5], ["Generate", "all seven cameras", 13], ["Train & test", "with ground truth", 9.5]];
const DESIGN_PHASES = [
  [0, "1 · Baseline"],
  [2.0, "2 · Place actor"],
  [4.0, "3 · Conflict path"],
  [6.4, "4 · Re-plan ego"],
  [8.8, "5 · Replay edit"],
];
const CAPS = [
  "A failure report arrives from the fleet. The vector replay shows the planner as deployed, driving into it.",
  "Every point is a recorded drive. Each tool the agent calls keeps only the drives that fit; the survivors become the candidate pool.",
  "The edit is built step by step on the chosen drive: a new road user, its path, its timing, then a new plan for this car.",
  "The simulator replays the edit at the closest call and renders the layout the front camera will see.",
  "BoschDreams-7V films the edit with all seven cameras from the recorded first frame. The 3D vector world below runs on the same clock.",
  "The edited world comes with the trajectory this car should have driven. That label is what makes training and testing automatic.",
];
const EVENTS = {
  pedestrian_appears: "Pedestrian steps out", cyclist_appears: "Cyclist darts out", car_appears: "Car noses out", ego_brakes: "Car brakes",
  ego_slowest: "Car at its slowest", lane_clear: "Lane clear, car goes",
  green: "Light turns green", ego_yields_oncoming: "Yields to the oncoming car", oncoming_clear: "Oncoming car through",
  scooter_crosses: "Scooter crosses the exit", scooter_clear: "Exit clear, car turns",
  stall: "A car stalls in the right lane", indicator: "Indicator on", ego_makes_room: "Car makes room", cut_in: "Forced cut-in ahead",
  zip_behind: "Second car zips in behind", car_enters: "A car enters without yielding", ego_yields: "Car yields", car_ahead: "It crosses ahead",
  ego_continues: "Car continues", detour: "Detour into the ego lane", work_zone_speed: "Work-zone speed", extra_room: "Extra room for the workers",
};
const kmh = (v) => `${Math.round(v * 3.6)} km/h`;
const GHOST = (who, where, need, find, path) => ({
  kind: "ghost", fn: "AEB", title: "Ghost probe", sub: who[0].toUpperCase() + who.slice(1), who,
  text: [`AEB brakes late when a ${who} `, [where, "appear"], " and the car is ", ["still at speed", "fail"], "."],
  need, find, path,
  design: (m) => [`spare(w, "${who}") → track ${m.actor}`, path, m.appear_m ? `aeb(): in sight ${m.appear_m} m, ${m.ttc_at_appear} s before contact` : `emerge(): in sight ${m.ttc_at_appear} s before contact`,
    `drive(): brake ${m.ego_brake} m/s², stop ${m.closest_m ?? 1.5} m short`, "resolve(): traffic behind re-flows"],
  checks: (m) => ["0 overlaps between any two road users", `${who[0].toUpperCase() + who.slice(1)} in sight ${m.appear_m ? `${m.appear_m} m, ` : ""}${m.ttc_at_appear} s before the car reaches it`, `Car brakes at ${m.ego_brake} m/s² from ${kmh(m.speed_at_appear)}`, `Closest gap to anyone ${Math.min(...Object.values(m.min_gap)).toFixed(2)} m`],
  gt: (m) => `Brakes at ${m.ego_brake} m/s² ${m.appear_m ? 0.3 : 0.4} s after the ${who} appears, stops ${m.closest_m ?? 1.5} m short and goes once the lane is clear.`,
});
const TICKETS = [
  { key: "ghost_ped", ...GHOST("pedestrian", "steps out between parked trucks", ["Straight urban road", "Parked trucks on the right", "Car near 10 m/s", "Clear daylight", "Hidden until under 2 s away"],
    ["captions ∋ “parked truck”", "ego: straight, 4–10 m/s", "occluders within 5 m of the lane", "rank: sharpest, sunniest first frame"], "path: between two trucks, across both lanes") },
  { key: "ghost_cyclist", ...GHOST("cyclist", "shoots out of a 2.3 m gap between a parked truck and a car", ["Urban road, parked row on the right", "Bike path behind the parked row", "Car near 45 km/h", "Clear daylight", "Hidden until 14 m away"],
    ["captions ∋ “parked truck”, “cyclist”", "ego: straight, 8–13 m/s", "a gap under 3 m in the parked row", "rank: sharpest, sunniest first frame"], "path: along the bike path behind two trucks, through the gap, across both lanes to the bike parking") },
  { key: "ghost_car", ...GHOST("car", "pulls out of a gap in the roadside", ["Suburban road", "Gaps in the roadside", "Car near 8 m/s", "Clear daylight", "A free lane to merge into"],
    ["captions ∋ “roadside trees”", "ego: kerbside lane, 6–10 m/s", "a free lane on the left", "rank: sharpest, sunniest first frame"], "path: out of the roadside gap, across into the left lane") },
  { key: "left", kind: "left", fn: "Planner", title: "Unprotected left", sub: "Junction",
    text: ["On an unprotected left turn the planner ", ["commits too early", "fail"], " against ", ["an oncoming car and a scooter", "appear"], "."],
    need: ["Signalised four-way junction", "Car turns left", "Oncoming traffic", "A scooter on the exit", "Clear daylight"],
    find: ["captions ∋ “intersection”", "ego: turns left by more than 60°", "oncoming lane carries traffic", "rank: sharpest, sunniest first frame"],
    design: (m) => ["retime(): oncoming car to the conflict point", `oncoming car at ${m.oncoming_speed} m/s`, "a scooter crosses the exit behind it", `drive(): wait ${m.wait_oncoming_s} s, then ${m.scooter_wait_s} s`, "resolve(): cars behind re-flow"],
    checks: (m) => ["0 overlaps between any two road users", `Oncoming car at ${m.oncoming_speed} m/s reaches the conflict point`, `Car waits ${m.wait_oncoming_s} s, then ${m.scooter_wait_s} s for the scooter`, `Closest gap ${Math.min(...Object.values(m.min_gap)).toFixed(2)} m`],
    gt: (m) => `Waits ${m.wait_oncoming_s} s for the oncoming car and ${m.scooter_wait_s} s for the scooter, then turns.` },
  { key: "congestion", kind: "congestion", fn: "Planner", title: "Merge in a jam", sub: "Stop and go",
    text: ["In stop-and-go traffic ", ["a car squeezed out of its lane cuts in", "appear"], " and the planner ", ["reacts late", "fail"], "."],
    need: ["Slow multi-lane jam", "A stalled car in the right lane", "A follower forced across", "Clear daylight"],
    find: ["captions ∋ “congestion”", "ego: under 5 m/s, three lanes", "dense traffic on the right", "rank: sharpest, sunniest first frame"],
    design: (m) => ["stall(): a car in the right lane at 1.5 s", "its follower signals and noses in", `cut-in gap ${m.cut_in_gap_m} m`, `drive(): brake ${m.ego_brake} m/s² to make room`, "a second car zips in behind"],
    checks: (m) => ["0 overlaps between any two road users", `Car brakes at ${m.ego_brake} m/s² to make room`, `Cut-in gap ${m.cut_in_gap_m} m, at crawling speed`],
    gt: (m) => `Signals are read early; it brakes at ${m.ego_brake} m/s² and opens a gap for the merging car.` },
  { key: "construction", kind: "construction", fn: "Planner", title: "Work zone", sub: "Lane closed",
    text: ["In a work zone ", ["the right lane is closed and traffic squeezes over", "appear"], "; the planner ", ["keeps its speed and its line", "fail"], "."],
    need: ["Multi-lane road", "Cones along the right lane", "Workers on the road", "Clear daylight"],
    find: ["captions ∋ “cone”, “roadwork”", "ego: straight, 5–12 m/s", "cones within 6 m of the lane", "rank: sharpest, sunniest first frame"],
    design: (m) => ["close(): the right lane with cones", "place two workers in it", "detour(): its car into the ego lane", `drive(): slow to ${m.zone_speed} m/s, keep 0.6 m left`, `brake ${m.ego_brake} m/s²`],
    checks: (m) => ["0 overlaps between any two road users", `Car slows to ${m.zone_speed} m/s in the work zone`, "Keeps 0.6 m further left past the workers", `Car brakes at ${m.ego_brake} m/s²`],
    gt: (m) => `Lets the detouring car in, slows to ${m.zone_speed} m/s and keeps 0.6 m away from the workers.` },
  { key: "roundabout", kind: "roundabout", fn: "Planner", title: "Roundabout", sub: "Failure to yield",
    text: ["At a roundabout ", ["an entering car does not yield", "appear"], " and the circulating planner ", ["holds its speed", "fail"], "."],
    need: ["Two-lane roundabout", "Car circulating", "An entry with traffic", "Clear daylight"],
    find: ["captions ∋ “roundabout”", "ego: circulating, yaw rate > 5°/s", "a car waiting at an entry", "rank: sharpest, sunniest first frame"],
    design: (m) => [`retime(): the entering car ${m.advance_s} s earlier`, "it cuts across the circulating lane", `drive(): yield at ${m.ego_brake} m/s²`, "then exit as recorded", "resolve(): followers re-flow"],
    checks: (m) => ["0 overlaps between any two road users", `Entering car ${m.advance_s} s earlier than recorded`, `Car yields at ${m.ego_brake} m/s²`, `Closest gap ${Math.min(...Object.values(m.min_gap)).toFixed(2)} m`],
    gt: (m) => `Yields at ${m.ego_brake} m/s², lets the entering car cross ahead, then continues to its exit.` },
];

// Geometry for the failure and the ground truth: the gap between two boxes is a vertex-to-box distance.
const box = (p, L, W) => [p[0], p[1], p[2], L, W];
const egoBox = (p) => box([p[0] + 1.4 * Math.cos(p[2]), p[1] + 1.4 * Math.sin(p[2]), p[2]], 4.8, 1.9);
const corners = ([x, y, h, L, W]) => [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([a, b]) => [x + Math.cos(h) * a * L / 2 - Math.sin(h) * b * W / 2, y + Math.sin(h) * a * L / 2 + Math.cos(h) * b * W / 2]);
const toBox = (q, [x, y, h, L, W]) => { const dx = q[0] - x, dy = q[1] - y, u = dx * Math.cos(h) + dy * Math.sin(h), v = -dx * Math.sin(h) + dy * Math.cos(h); return Math.hypot(Math.max(0, Math.abs(u) - L / 2), Math.max(0, Math.abs(v) - W / 2)); };
const gapOf = (A, B) => Math.min(...corners(A).map((q) => toBox(q, B)), ...corners(B).map((q) => toBox(q, A)));
const speedOf = (P) => P.map((_, i) => { const a = P[Math.max(0, i - 2)], b = P[Math.min(P.length - 1, i + 2)], n = Math.min(P.length - 1, i + 2) - Math.max(0, i - 2); return n ? (Math.hypot(b[0] - a[0], b[1] - a[1]) * FPS) / n : 0; });

export async function setupAgent(manifest) {
  const root = $("#agent"), stage = $(".ag-stage", root), panes = $$(".st", stage), steps = $(".steps", root);
  const rig = new Rig($("#agent-rig"), manifest, { order: SEVEN, layer: "edit", watch: stage, userPaused: true });
  const cv = (s) => $(s, root), readMap = cv(".read-map"), pip = cv(".read-pip"), readSpeed = cv(".read-speed"), field = cv(".field"), designMap = cv(".design-map"), designSpeed = cv(".design-speed");
  const verifyMap = cv(".verify-map"), layout = cv(".sim video"), trainMap = cv(".train-map"), trainSpeed = cv(".train-speed"), worldBox = cv(".gen-world");
  layout.loop = true;
  layout.preload = "auto";
  const D = {}, closed = new Set();
  let t = 0, s = 0, stepClock = 0, animClock = 0, auto = !reduced, visible = false, loading = false, c = TICKETS[0], d = null, token = 0, world = null, worldKey = null, userLayer = false;

  $(".tickets", root).innerHTML = TICKETS.map((x, i) => `<button type="button" role="tab" aria-selected="${!i}" data-fn="${x.fn}"><small>${x.fn}</small><b>${x.title}</b><em>${x.sub}</em></button>`).join("");
  const tabs = $$("[role=tab]", root);
  steps.innerHTML = STEPS.map(([verb, what], k) => `<li><button type="button"><i>0${k + 1}</i><b>${verb}</b><small>${what}</small></button></li>`).join("")
    + `<li class="ctl"><button class="icon-btn solid ag-play" type="button" aria-label="Pause"><svg class="icon"><use href="#i-pause"/></svg></button></li>`;
  const rows = $$("li:not(.ctl) button", steps), play = $(".ag-play", root);

  const phaseBar = $(".design-phases", root);
  if (phaseBar) {
    phaseBar.innerHTML = DESIGN_PHASES.map(([at, label], k) => `<button type="button" data-at="${at}" data-ph="${k}">${label}</button>`).join("");
    $$("button", phaseBar).forEach((b) => b.addEventListener("click", () => {
      setAuto(false);
      animClock = +b.dataset.at + 0.05;
      stepClock = animClock;
    }));
  }
  const phaseBtns = phaseBar ? $$("button", phaseBar) : [];

  // Everything a ticket needs, derived once from its exported world: events, speeds, the failure and the closest call.
  async function load(x) {
    if (D[x.key]) return D[x.key];
    const m = await fetch(`assets/edit/${x.key}.json`).then((r) => r.json());
    const br = m.branches.edit, meta = m.meta.edit, gt = br[EGO].p, n = m.n;
    const actors = Object.keys(br).filter((id) => id !== EGO), main = meta.metrics?.actor && br[meta.metrics.actor] ? [meta.metrics.actor] : actors;
    const ed = Object.fromEntries(actors.map((id) => [id, br[id]]));
    const ev = (meta.events || []).map(([at, k]) => [at, EVENTS[k] || k]);
    const fe = Math.round((ev[0]?.[0] ?? 5) * FPS);
    const closest = (egoAt) => {
      let best = { g: 1e9, f: fe };
      for (let f = 0; f < n; f++) for (const id of main) {
        const p = poseAt(m, br, id, f), tr = m.tracks[id];
        if (!p || !tr) continue;
        const g = gapOf(egoBox(egoAt(f)), box(p, tr.s[0], tr.s[1]));
        if (g < best.g) best = { g, f, id, p };
      }
      return best;
    };
    const rec = (f) => m.ego[Math.min(f, m.ego.length - 1)], gtAt = (f) => gt[Math.min(f, gt.length - 1)];
    const vRec = speedOf(m.ego.slice(0, n)), vGt = speedOf(gt.slice(0, n));
    const fail = closest(rec), safe = closest(gtAt);
    const at = (f) => gtAt(f), mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, a[2]];
    const start = main.map((id) => br[id]).sort((a, b) => a.f - b.f)[0];
    const focus = mid(at(fe), start ? start.p[Math.max(0, fe - start.f)] || start.p[0] : at(fe));
    return (D[x.key] = { m, br, ed, meta, ev, fe, n, main, fail, safe, rec, gtAt, vRec, vGt, focus, T: (n - 1) / FPS });
  }

  // The chosen drive's first frame, from the atlas poster (frame 0 of the recording).
  const thumb = (cv) => {
    const img = rig.cur.poster, r = manifest[`gen-${c.key}`]?.rec?.FW;
    const draw = () => { if (r) { fit(cv); blit(cv.getContext("2d"), img, r, cv.width, cv.height); } };
    img.complete ? draw() : img.addEventListener("load", draw, { once: true });
  };
  const verb = (k) => `${String(k + 1).padStart(2, "0")} · ${STEPS[k][0]}`;
  const failText = () => {
    const f = d.fail, v = d.vRec[f.f] || 0;
    return f.g < 0.05 ? `Contact at ${(f.f / FPS).toFixed(1)} s, at ${kmh(v)}` : `Passes ${f.g.toFixed(1)} m from it at ${kmh(v)}, without braking`;
  };

  async function pick(i, k = 0) {
    const my = ++token;
    loading = true;
    t = i; c = TICKETS[i];
    tabs.forEach((b, j) => b.setAttribute("aria-selected", String(j === i)));
    const loaded = await load(c);
    if (my !== token) return;
    d = loaded;
    loading = false;
    const mt = d.meta.metrics || {};
    $(".fn-tag", root).textContent = `${c.fn} · fleet ticket`;
    $(".t-text", root).innerHTML = c.text.map((x) => (Array.isArray(x) ? `<mark data-at="${x[1]}">${x[0]}</mark>` : x)).join("");
    $(".t-want", root).textContent = "Wanted: reproduce it in simulation with all seven cameras, then train and test on it.";
    const tl = [...d.ev.slice(0, 2).map(([at, txt]) => [at, txt, ""]), [d.fail.f / FPS, `As deployed: ${failText().toLowerCase()}`, "bad"]].sort((a, b) => a[0] - b[0]);
    $(".timeline", root).innerHTML = tl.map(([at, txt, cls]) => `<li class="${cls}" data-f="${Math.round(at * FPS)}"><time>${at.toFixed(1)} s</time>${txt}</li>`).join("");
    $(".spec", root).innerHTML = c.need.map((x) => `<li>${x}</li>`).join("");
    $(".st-search .log", root).innerHTML = [`find.py ${c.kind}`, ...c.find, "send the best to the candidate pool"].map((x) => `<li>${x}</li>`).join("");
    $(".st-design .log", root).innerHTML = [`w = World(“${c.title.toLowerCase()}”, best candidate)`, ...c.design(mt)].map((x) => `<li>${x}</li>`).join("");
    $(".st-verify .checks", root).innerHTML = c.checks(mt).map((x) => `<li><svg class="icon"><use href="#i-check"/></svg>${x}</li>`).join("");
    $(".g-rec-t", root).textContent = failText() + ".";
    $(".g-gt-t", root).textContent = c.gt(mt);
    $(".gen-note", root).textContent = `${d.n} frames per camera at 720p, four denoising steps, from one recorded first frame.`;
    $(".pool", root).innerHTML = `<canvas class="pick"></canvas>` + Array.from({ length: 5 }, (_, j) => `<i style="background-image:url(assets/pool/${c.kind}.webp);background-position:${((j + 1) * 100) / 11}% 0"></i>`).join("");
    const t0 = Math.max(0, d.fe / FPS - 3);
    rig.setClip(`gen-${c.key}`, t0);
    layout.src = `assets/media/layout-${c.key}.mp4`;
    layout.load();
    go(k);
  }

  function go(k) {
    s = k;
    stepClock = reduced ? STEPS[k][2] : 0;
    animClock = reduced ? STEPS[k][2] : 0;
    rows.forEach((b, j) => { b.classList.toggle("done", j < k); b.toggleAttribute("aria-current", j === k); b.style.setProperty("--p", j < k ? 1 : 0); });
    panes.forEach((p, j) => p.classList.toggle("on", j === k));
    $(".ag-step", root).textContent = verb(k);
    $(".ag-cap", root).textContent = CAPS[k];
    $$(".t-text mark, .timeline li, .spec li, .log li, .checks li, .loop li, .pool > *", root).forEach((x) => x.classList.remove("on", "cur", "hit"));
    const t0 = Math.max(0, d.fe / FPS - 3);
    rig.userPaused = !(k === 0 || k === 4);
    if (k === 0) rig.layer = "edit";
    if (k === 0 || k === 4) rig.time = t0;
    if (k === 4) { userLayer = false; setLayer(auto ? "rec" : "edit"); ensureWorld(); }
    rig.sync();
    if (k === 3) {
      const startLayout = () => { layout.currentTime = t0; layout.play().catch(() => {}); };
      if (layout.readyState >= 1) startLayout();
      else layout.addEventListener("loadedmetadata", startLayout, { once: true });
    } else layout.pause();
    if (k === 1) requestAnimationFrame(() => thumb($(".pool canvas", root)));
  }

  const setLayer = (layer) => { rig.layer = layer; $$(".gen-pick [role=radio]", root).forEach((b) => b.setAttribute("aria-checked", String(b.dataset.layer === layer))); rig.draw(); };
  async function ensureWorld() {
    if (worldKey === c.key) return;
    worldKey = c.key;
    const data = await loadWorld(c.key);
    if (worldKey !== c.key) return;
    world?.dispose();
    world = new World(worldBox, data);
    world.view = { pitch: 0.55, dist: 30, yaw: 0, fp: 0, fov: 40 };
    steer(world, world.canvas);
  }

  // Search: the fleet as a galaxy of points; each tool keeps a fraction, the survivors fly into the candidate pool.
  const FIELD = (() => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const g = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
    const hubs = Array.from({ length: 8 }, () => [0.12 + rnd() * 0.76, 0.15 + rnd() * 0.7, 0.03 + rnd() * 0.07, 0.01 + rnd() * 0.04, rnd() * 3.14]);
    return Array.from({ length: 3600 }, () => {
      const [hx, hy, sa, sb, th] = hubs[Math.floor(rnd() * hubs.length)], u = g() * sa, v = g() * sb, wide = rnd() < 0.14;
      return { x: wide ? rnd() : hx + u * Math.cos(th) - v * Math.sin(th), y: wide ? rnd() : hy + u * Math.sin(th) + v * Math.cos(th), z: 0.25 + rnd() * 0.75, r: [rnd(), rnd(), rnd(), rnd()], tw: rnd() * 6.28 };
    });
  })();
  const KEEP = [0.12, 0.35, 0.45, 0.4];
  const PASS = FIELD.map((q) => { let k = 0; while (k < 4 && q.r[k] < KEEP[k]) k++; return k; });
  const FINAL = FIELD.map((_, i) => i).filter((i) => PASS[i] === 4).slice(0, 6);
  function drawField(e) {
    fit(field);
    const x = field.getContext("2d"), W = field.width, H = field.height, k = dpr(), T0 = 0.8, dT = 1.45;
    x.clearRect(0, 0, W, H);
    x.globalCompositeOperation = "lighter";
    const stage = Math.max(-1, Math.min(4, Math.floor((e - T0) / dT))), sweep = ((e - T0) % dT) / dT, fly = Math.max(0, Math.min(1, (e - (T0 + 4 * dT)) / 1.0));
    const spin = performance.now() / 90000, cs = Math.cos(spin), sn = Math.sin(spin), pool = $$(".pool > *", root), fr = field.getBoundingClientRect();
    for (let i = 0; i < FIELD.length; i++) {
      const q = FIELD[i], dx = q.x - 0.5, dy = (q.y - 0.5) * 0.6, px = (0.5 + (dx * cs - dy * sn) * 1.08) * W, py = (0.5 + (dx * sn + dy * cs) / 0.6) * H;
      let a = Math.min(1, e / 0.7) * (0.28 + 0.5 * q.z);
      const judged = stage > PASS[i] || (stage === PASS[i] && px / W < sweep);
      if (stage >= 0 && PASS[i] < 4 && judged) a *= 0.16;
      const hot = stage > 0 && !judged;
      if (fly > 0 && FINAL.includes(i)) {
        const j = FINAL.indexOf(i), r = pool[j]?.getBoundingClientRect(), u = fly * fly * (3 - 2 * fly);
        const tx = r ? (r.left + r.width / 2 - fr.left) * k : px, ty = H - 6 * k, cx = px + (tx - px) * u, cy = py + (ty - py) * u;
        x.strokeStyle = "rgba(255,51,71,.38)"; x.lineWidth = k; x.beginPath(); x.moveTo(px, py); x.lineTo(cx, cy); x.stroke();
        x.fillStyle = COL.edit; x.beginPath(); x.arc(cx, cy, (3 + 3 * u) * k, 0, 7); x.fill();
        continue;
      }
      const sz = (hot ? 2.0 + stage * 0.5 : 1.3 + q.z * 1.4) * k;
      x.fillStyle = hot ? `rgba(255,${110 - stage * 18},${120 - stage * 22},${Math.min(1, a * 2.6)})` : `rgba(150,180,255,${a})`;
      x.fillRect(px - sz / 2, py - sz / 2, sz, sz);
      if (hot && stage > 2) { x.fillStyle = "rgba(255,51,71,.18)"; x.beginPath(); x.arc(px, py, 8 * k, 0, 7); x.fill(); }
    }
    x.globalCompositeOperation = "source-over";
    if (stage >= 0 && stage < 4) { const g = x.createLinearGradient(sweep * W - 40 * k, 0, sweep * W, 0); g.addColorStop(0, "rgba(255,51,71,0)"); g.addColorStop(1, "rgba(255,51,71,.16)"); x.fillStyle = g; x.fillRect(sweep * W - 40 * k, 0, 40 * k, H); x.fillStyle = "rgba(255,90,105,.85)"; x.fillRect(sweep * W, 0, k, H); }
    $$(".spec li", root).forEach((li, j) => { li.classList.toggle("on", e > 0.2 + j * 0.15); li.classList.toggle("hit", stage > Math.min(3, j)); });
    $$(".st-search .log li", root).forEach((li, j) => { li.classList.toggle("on", stage >= j - 1 || (j === 0 && e > 0.4)); li.classList.toggle("cur", stage === j - 1); });
    pool.forEach((p, j) => p.classList.toggle("on", fly >= 1 && e > T0 + 4 * dT + 1.0 + j * 0.1));
    $(".pool-n", root).textContent = fly >= 1 ? "chosen: sharpest first frame, clear sky" : "";
  }

  // A small speed-over-time chart: recorded (dashed) and edited or ground truth (cyan), drawn up to `grow`.
  function speedChart(cv, f0, f1, grow, head, events = 2) {
    fit(cv);
    const x = cv.getContext("2d"), k = dpr(), W = cv.width, H = cv.height, pad = 30 * k;
    x.clearRect(0, 0, W, H);
    const vmax = Math.max(4, ...d.vRec.slice(f0, f1), ...d.vGt.slice(f0, f1)) * 1.1;
    const X = (f) => pad + ((f - f0) / (f1 - f0)) * (W - pad - 8 * k), Y = (v) => H - 18 * k - (v / vmax) * (H - 30 * k);
    x.font = `${11 * k}px 'BD Mono', monospace`; x.fillStyle = "rgba(245,245,247,.45)";
    x.fillText(`${Math.round(vmax * 3.6)} km/h`, 0, 12 * k);
    x.fillText(`${(f0 / FPS).toFixed(0)} s`, pad, H - 2 * k);
    x.fillText(`${(f1 / FPS).toFixed(0)} s`, W - 34 * k, H - 2 * k);
    x.strokeStyle = "rgba(255,255,255,.1)"; x.lineWidth = k;
    x.beginPath(); x.moveTo(pad, Y(0)); x.lineTo(W, Y(0)); x.stroke();
    const plot = (v, color, dash, upto) => {
      x.setLineDash(dash.map((q) => q * k)); x.strokeStyle = color; x.lineWidth = 2 * k; x.beginPath();
      for (let f = f0; f <= Math.min(f1, upto); f++) f === f0 ? x.moveTo(X(f), Y(v[f])) : x.lineTo(X(f), Y(v[f]));
      x.stroke(); x.setLineDash([]);
    };
    plot(d.vRec, "rgba(255,255,255,.7)", [4, 4], f1);
    plot(d.vGt, COL.ego, [], f0 + (f1 - f0) * grow);
    d.ev.slice(0, events).forEach(([at, txt], j) => { const px = X(at * FPS); if (px < pad || px > W) return; x.fillStyle = COL.edit; x.fillRect(px - k / 2, (6 + 14 * j) * k, k, H - (24 + 14 * j) * k); x.fillStyle = "rgba(245,245,247,.75)"; x.fillText(txt, px + 5 * k, (14 + 14 * j) * k); });
    if (head != null) { x.fillStyle = "#fff"; x.fillRect(X(head) - k / 2, 0, k, H - 18 * k); }
  }

  const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
  function drawDesign(e) {
    const ph = Math.max(0, DESIGN_PHASES.findLastIndex(([at]) => e >= at));
    const base = { view: d.focus, span: 60, y: 0.55, hi: new Set(d.main), dim: 0.5 };
    phaseBtns.forEach((b, j) => { b.classList.toggle("done", j < ph); b.toggleAttribute("aria-current", j === ph); });
    $$(".st-design .log li", root).forEach((li, j) => { li.classList.toggle("on", j <= ph + (ph >= 3 ? 1 : 0)); li.classList.toggle("cur", j === Math.min(5, ph + (ph >= 3 ? 1 : 0))); });
    const f0 = Math.max(0, d.fe - 25), f1 = Math.min(d.n - 1, Math.max(d.fe + 45, d.safe.f + 22));
    const fs = Math.min(...d.main.map((id) => d.br[id].f));
    const recPath = { p: d.m.ego.slice(f0, f1 + 1), color: "rgba(255,255,255,.55)", width: 1.8, dash: [6, 5] };
    const mt = d.meta.metrics || {};

    if (ph === 0) {
      // Phase 1: Baseline recording driving smoothly through the unedited scene.
      const u = ease(e / 2.0), f = Math.round(f0 + (d.fe - f0) * u);
      drawMap(designMap, d.m, {}, f, { ...base, ego: d.rec(f), paths: [recPath], trails: false, hi: null,
        marks: [{ p: d.rec(f), r: 14, color: "rgba(255,255,255,.8)", text: `Recorded · ${kmh(d.vRec[f])}` }] });
      speedChart(designSpeed, f0, f1, 0, f);
    } else if (ph === 1) {
      // Phase 2: AI places the new/edited road user with a pulsing targeting reticle.
      const u = ease((e - 2.0) / 1.4), pulse = 10 + 9 * Math.sin(e * 7);
      const start = Object.fromEntries(d.main.map((id) => [id, { f: fs, p: [d.br[id].p[0]] }]));
      const marks = d.main.map((id) => ({ p: d.br[id].p[0], r: pulse + (1 - u) * 18, color: COL.edit, text: `+ ${d.m.tracks[id]?.c || "actor"}` }));
      drawMap(designMap, d.m, start, fs, { ...base, ego: d.rec(fs), paths: [recPath], trails: false, marks });
      speedChart(designSpeed, f0, f1, 0, fs);
    } else if (ph === 2) {
      // Phase 3: AI synthesizes the actor's conflict path intersecting Ego's original recorded path.
      const u = ease((e - 4.0) / 2.0);
      const grow = Object.fromEntries(d.main.map((id) => [id, u]));
      const marks = [];
      if (u > 0.45 && d.fail.p) {
        const hitText = mt.ttc_at_appear ? `Conflict · TTC ${mt.ttc_at_appear} s` : `Conflict · ${(d.fail.f / FPS).toFixed(1)} s`;
        marks.push({ p: d.fail.p, r: 12 + 5 * Math.sin(e * 8), color: COL.edit, cross: d.fail.g < 0.05, text: hitText });
      }
      drawMap(designMap, d.m, d.ed, Math.round(fs + (d.fe - fs) * u), { ...base, ego: d.rec(d.fe), paths: [recPath], grow, trails: true, marks });
      speedChart(designSpeed, f0, f1, 0, d.fe);
    } else if (ph === 3) {
      // Phase 4: AI re-plans Ego's safe ground-truth trajectory (cyan) and re-flows followers.
      const u = ease((e - 6.4) / 2.0);
      const gtSeg = d.br[EGO].p.slice(f0, Math.max(f0 + 2, Math.round(f0 + (f1 - f0) * u)));
      const marks = [];
      if (u > 0.5 && d.safe.p) marks.push({ p: d.gtAt(d.safe.f), r: 14, color: COL.ok, text: `Re-planned · ${d.safe.g.toFixed(1)} m clear` });
      drawMap(designMap, d.m, d.ed, d.safe.f, { ...base, ego: d.gtAt(Math.round(f0 + (d.safe.f - f0) * u)), rec: d.rec(d.safe.f),
        paths: [recPath, { p: gtSeg, color: COL.ego, width: 3.0 }], trails: true, marks });
      speedChart(designSpeed, f0, f1, u, Math.round(f0 + (f1 - f0) * u));
    } else {
      // Phase 5: Dynamic replay of the complete edited world in motion from f0 to f1.
      const u = Math.min(1, (e - 8.8) / 4.2), f = Math.round(f0 + (f1 - f0) * u);
      const ep = d.gtAt(f), ap = poseAt(d.m, d.br, d.safe.id, f);
      const opts = { span: 56, y: 0.6, hi: new Set(d.main), dim: 0.5, rec: d.rec(f), trails: true };
      if (Math.abs(f - d.safe.f) < 10 && ap) {
        const a = [ep[0] + 1.4 * Math.cos(ep[2]), ep[1] + 1.4 * Math.sin(ep[2])];
        opts.measure = { a, b: ap, text: `safe gap ${gapOf(egoBox(ep), box(ap, d.m.tracks[d.safe.id].s[0], d.m.tracks[d.safe.id].s[1])).toFixed(1)} m` };
      }
      drawMap(designMap, d.m, d.br, f, opts);
      speedChart(designSpeed, f0, f1, 1, f);
    }
  }

  function drawVerify(e) {
    const t0 = Math.max(0, d.fe / FPS - 3);
    const curT = layout.readyState >= 2 && !layout.paused ? layout.currentTime : t0 + (e % Math.max(3, d.T - t0));
    const f = Math.min(d.n - 1, Math.floor(curT * FPS)), sf = d.safe.f, near = Math.max(0, 1 - Math.abs(f - sf) / 14);
    const ep = d.gtAt(f), ap = poseAt(d.m, d.br, d.safe.id, f);
    const opts = { fans: true, hot: "FW", span: 64 - 28 * ease(near), y: 0.62, hi: new Set(d.main), dim: 0.6 };
    if (near > 0.2 && ap) {
      const a = [ep[0] + 1.4 * Math.cos(ep[2]), ep[1] + 1.4 * Math.sin(ep[2])];
      Object.assign(opts, { measure: { a, b: ap, text: `gap ${gapOf(egoBox(ep), box(ap, d.m.tracks[d.safe.id].s[0], d.m.tracks[d.safe.id].s[1])).toFixed(1)} m` }, spot: { p: [(a[0] + ap[0]) / 2, (a[1] + ap[1]) / 2], r: 60 + 20 * (1 - near), a: 0.55 * near } });
    }
    drawMap(verifyMap, d.m, d.br, f, opts);
    $$(".st-verify .checks li", root).forEach((li, j) => li.classList.toggle("on", e > 0.6 + j * 0.75));
  }

  function drawTrain(e) {
    const f0 = Math.max(0, d.fe - 20), f1 = Math.min(d.n - 1, Math.max(d.fail.f, d.safe.f) + 6), f = Math.min(f1, f0 + Math.floor(e * FPS * 1.1));
    const marks = [];
    const mid = (a, b) => [(a[0] + 1.4 * Math.cos(a[2]) + b[0]) / 2, (a[1] + 1.4 * Math.sin(a[2]) + b[1]) / 2];
    if (f >= d.fail.f && d.fail.p) marks.push({ p: mid(d.rec(d.fail.f), d.fail.p), r: 18, color: COL.edit, cross: d.fail.g < 0.05, dy: -16, text: `As recorded · ${d.fail.g < 0.05 ? "contact" : `${d.fail.g.toFixed(1)} m`} at ${kmh(d.vRec[d.fail.f])}` });
    if (f >= d.safe.f && d.safe.p) marks.push({ p: mid(d.gtAt(d.safe.f), d.safe.p), r: 18, color: COL.ok, dy: 16, text: `Ground truth · ${d.safe.g.toFixed(1)} m at ${kmh(d.vGt[d.safe.f])}` });
    drawMap(trainMap, d.m, d.ed, f, { view: d.focus, span: 64, y: 0.55, ego: d.gtAt(f), rec: d.rec(f), hi: new Set(d.main), dim: 0.5, trails: true,
      paths: [{ p: d.m.ego.slice(0, d.n), color: "rgba(255,255,255,.75)", width: 1.6, dash: [5, 5] }, { p: d.br[EGO].p, color: COL.ego, width: 2.6 }], marks });
    speedChart(trainSpeed, f0, f1, 1, f);
    $$(".loop li", root).forEach((li, j) => li.classList.toggle("on", e > 3.6 + j * 0.95));
  }

  function drawRead() {
    const f = Math.min(d.n - 1, Math.floor(rig.time * FPS)), t1 = Math.min(d.T, Math.max(d.fe, d.fail.f) / FPS + 2.5);
    if (rig.time > t1 && rig.playing) rig.time = Math.max(0, d.fe / FPS - 3);
    const marks = d.main.map((id) => poseAt(d.m, d.br, id, f)).filter(Boolean).map((p) => ({ p, r: 12, color: COL.edit }));
    const near = Math.abs(f - d.fail.f) < 8, rp = d.rec(f);
    const opts = { ego: rp, span: 52, y: 0.62, hi: new Set(d.main), dim: 0.5, trails: false, marks,
      paths: [{ p: d.m.ego.slice(f, Math.min(d.n, f + 40)), color: "rgba(255,255,255,.75)", width: 1.6, dash: [4, 4] }] };
    if (near && d.fail.p) opts.measure = { a: [rp[0] + 1.4 * Math.cos(rp[2]), rp[1] + 1.4 * Math.sin(rp[2])], b: d.fail.p, text: d.fail.g < 0.05 ? "contact" : `${d.fail.g.toFixed(1)} m · ${kmh(d.vRec[d.fail.f])}` };
    drawMap(readMap, d.m, d.ed, f, opts);
    speedChart(readSpeed, Math.max(0, d.fe - 30), Math.min(d.n - 1, Math.round(t1 * FPS)), 0, f, 1);
    $$(".t-text mark", root).forEach((mk) => mk.classList.toggle("on", f >= (mk.dataset.at === "fail" ? d.fail.f - 4 : d.fe)));
    $$(".timeline li", root).forEach((li) => li.classList.toggle("on", f >= +li.dataset.f));
  }

  let last = performance.now(), raf = 0;
  function tick(now) {
    const dt = Math.min(0.08, (now - last) / 1000);
    last = now;
    if (visible && !document.hidden && d && !loading) {
      const dur = STEPS[s][2];
      animClock += dt;
      if (auto) stepClock += dt;
      // When paused on a step, smoothly loop its animation so Design / Search / Train never freeze on a still frame.
      if (!auto && !reduced && animClock > dur + 0.8 && (s === 1 || s === 2 || s === 5)) animClock = 0;
      const e = auto ? stepClock : animClock;
      const prog = Math.min(1, e / dur);
      rows[s].style.setProperty("--p", prog.toFixed(3));
      tabs[t].style.setProperty("--tp", ((s + prog) / 6).toFixed(4));
      if (s === 0) drawRead();
      if (s === 1) drawField(e);
      if (s === 2) drawDesign(e);
      if (s === 3) drawVerify(e);
      if (s === 4) {
        if (auto && !userLayer && e > 3.2 && rig.layer === "rec") setLayer("edit");
        if (world) world.render(rig.time * FPS, dt);
      }
      if (s === 5) drawTrain(e);
      if (auto && stepClock >= dur) {
        if (s < 5) go(s + 1);
        else next();
      }
    }
    raf = visible ? requestAnimationFrame(tick) : 0;
  }
  function next() {
    if (loading) return;
    closed.add(t);
    tabs[t].classList.add("closed");
    if (closed.size === TICKETS.length) { closed.clear(); tabs.forEach((b) => b.classList.remove("closed")); }
    pick((t + 1) % TICKETS.length, 0);
  }

  rig.onframe = () => { if (s === 0 && rig.buf && rig.bufClip?.edit) { fit(pip); blit(pip.getContext("2d"), rig.buf, rig.bufClip.edit.FW, pip.width, pip.height); } };
  const setAuto = (on) => {
    auto = on;
    if (on && stepClock >= STEPS[s][2] * 0.85) { stepClock = 0; animClock = 0; }
    else if (on) stepClock = Math.min(animClock, STEPS[s][2] * 0.8);
    play.setAttribute("aria-label", on ? "Pause" : "Play");
    $("use", play).setAttribute("href", on ? "#i-pause" : "#i-play");
  };
  play.addEventListener("click", () => setAuto(!auto));
  rows.forEach((b, k) => b.addEventListener("click", () => { setAuto(false); go(k); }));
  tabs.forEach((b, i) => b.addEventListener("click", () => { setAuto(false); pick(i, s); }));
  radios($(".gen-pick", root), (b) => { userLayer = true; setLayer(b.dataset.layer); });
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) { last = performance.now(); if (!raf) raf = requestAnimationFrame(tick); } }, { threshold: 0.15 }).observe(stage);
  setAuto(auto);
  await pick(0);
  raf ||= requestAnimationFrame(tick);
}
