import { Rig, SEVEN, blit, fit, dpr, reduced } from "./rig.js";
import { drawMap, zoomable, EGO } from "./bev.js";
import { $, $$, radios } from "./sections.js";

const FPS = 10;
// Each scene forks at one moment. Names, colours and what each decision means; every number comes from the trajectories.
const CASES = {
  hub: { name: "Junction", start: 0, premise: "A busy signalised junction. At 1.5 s the car commits to one of four routes; crossing traffic and the cars behind re-plan around it.", B: {
    S: ["Straight on", "#7dd3fc"], L: ["Left turn", "#fbbf24"], R: ["Right turn", "#34d399"], U: ["U-turn", "#f472b6"] },
    close: "Same first frame, four routes along the map's own lane connectors. Every route is filmed with all seven cameras, so a planner is tested on all of them, not only on the one that was driven." },
  lturn: { name: "Unprotected left", start: 6.5, premise: "Green light, left turn. An oncoming car rushes the junction at 10 m/s and a scooter crosses the exit behind it.", B: {
    wrong: ["Commit early", "#ff3347", "Collision"], avg: ["Wait at the line", "#ffb340", "Over-cautious"], opt: ["Pocket yield", "#36e27f", "Safe, decisive"] },
    close: "The recording only shows the turn that was made. Closed loop plays every timing out against traffic that keeps moving, so the planner learns where the safe window is." },
  xwalk: { name: "Hidden cyclist", start: 0, premise: "A cyclist sweeps across the junction from behind traffic on the right, hidden until the last moment.", B: {
    wrong: ["Cruise on", "#ff3347", "Collision"], avg: ["Panic stop", "#ffb340", "Over-cautious"], opt: ["Predict and yield", "#36e27f", "Safe, smooth"] },
    close: "A log cannot tell these apart: it only holds what was driven. Closed loop plays each decision out, films the collision with seven cameras and turns it into a test." },
};
const ROWS = [["Distance driven", "progress", "m", 0], ["Time standing", "stopped", "s", 1], ["Closest gap to anyone", "min_gap", "m", 2]];
const along = (p) => { let s = 0; return p.map((q, i) => (i ? (s += Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1])) : 0)); };

export async function setupFutures(manifest) {
  const root = $("#futures"), stageEl = $(".cf-stage", root), cols = $(".cf-cols", root), map = $(".cf-map", root), tree = $(".tree canvas", root);
  const pulse = $(".cf-pulse", root), play = $(".cf-play", root), box = $(".cf-bars", root);
  const rig = new Rig($("#cf-rig"), manifest, { order: SEVEN, loop: false, watch: root });
  const data = {}, zoom = { span: 70, px: 0, py: 0 };
  let key, c, m, keys = [], br, cells = [], S = {}, forked = 0, armed = true, token = 0, auto = true, seen = false, forkTween = null, forkTimer = 0;
  const cancelFork = () => { forkTween?.kill(); forkTween = null; clearTimeout(forkTimer); pulse.classList.remove("on"); };
  const n = () => m.n, fork = () => m.fork, T = () => (n() - 1) / FPS;
  const ego = (b) => m.branches[b][EGO].p.slice(0, n());
  const col = (b) => c.B[b][1];
  const frame = () => Math.min(n() - 1, Math.floor(rig.time * FPS));

  const paintMap = (f = frame()) => {
    if (!m) return;
    const grown = (b) => ego(b).slice(fork() - 1, Math.max(fork() + 1, Math.round(fork() + (n() - fork()) * forked)));
    const paths = [{ p: ego(br).slice(0, fork()), color: "rgba(255,255,255,.85)", width: 2.6 }, ...(f < fork() ? [] : keys.map((b) => ({ p: grown(b), color: col(b), width: b === br ? 3.2 : 1.4 })))];
    drawMap(map, m, m.branches[br], f, { paths, zoom, y: 0.6 });
  };
  // Every future's front-wide and tele views, read from the same decoded frame.
  const paintCols = () => {
    if (!rig.buf || stageEl.dataset.mode !== "cols") return;
    const f = frame();
    for (const cell of cells) {
      const layer = rig.bufClip?.[cell.b];
      if (!layer) continue;
      for (const { cv, ctx, cam } of cell.views) { fit(cv); blit(ctx, rig.buf, layer[cam], cv.width, cv.height); }
      const hit = m.meta[cell.b].contact;
      cell.el.classList.toggle("contact", hit != null && f >= hit * FPS && f < hit * FPS + 25);
      cell.el.classList.toggle("told", f >= fork());
    }
  };

  // Distance driven over time: one trunk to the decision, then a line per future; ahead of the playhead they are faint.
  const PAD = { l: 48, r: 160, t: 16, b: 26 };
  const geo = () => ({ w: tree.clientWidth - PAD.l - PAD.r, h: tree.clientHeight - PAD.t - PAD.b, top: Math.ceil(Math.max(...keys.map((b) => S[b].at(-1))) / 50) * 50 });
  const X = (i, g) => PAD.l + (i / (n() - 1)) * g.w, Y = (d, g) => PAD.t + g.h - (d / g.top) * g.h;
  const treeCtx = tree.getContext("2d");
  const paintTree = (f = frame()) => {
    const k = dpr(), g = geo(), x = treeCtx;
    fit(tree);
    x.setTransform(k, 0, 0, k, 0, 0);
    x.clearRect(0, 0, tree.clientWidth, tree.clientHeight);
    x.font = "12px 'BD Mono', monospace";
    x.fillStyle = "rgba(245,245,247,.45)";
    x.strokeStyle = "rgba(255,255,255,.08)";
    const every = [1, 2, 4, 5, 10].find((u) => (u * FPS * g.w) / (n() - 1) >= 48) || 10;
    for (let s = 0; s <= T(); s += every) { const px = X(s * FPS, g); x.fillText(`${s} s`, px - 8, PAD.t + g.h + 18); x.beginPath(); x.moveTo(px, PAD.t); x.lineTo(px, PAD.t + g.h); x.stroke(); }
    for (let d = 0; d <= g.top; d += g.top / 4) x.fillText(`${d} m`, 0, Y(d, g) + 4);
    x.strokeStyle = "rgba(255,255,255,.55)";
    x.setLineDash([3, 4]);
    x.beginPath(); x.moveTo(X(fork(), g), PAD.t); x.lineTo(X(fork(), g), PAD.t + g.h); x.stroke();
    x.setLineDash([]);
    x.fillStyle = "rgba(245,245,247,.75)";
    x.fillText("decision", X(fork(), g) + 6, PAD.t + 10);
    const line = (b, from, to, color, w) => {
      x.strokeStyle = color; x.lineWidth = w; x.beginPath();
      for (let i = from; i <= to; i++) i > from ? x.lineTo(X(i, g), Y(S[b][i], g)) : x.moveTo(X(i, g), Y(S[b][i], g));
      x.stroke();
    };
    x.setLineDash([2, 4]);
    for (const b of keys) line(b, fork(), n() - 1, col(b) + "77", 1.2);
    x.setLineDash([]);
    for (const b of [...keys.filter((b) => b !== br), br]) if (f > fork()) line(b, fork(), f, col(b), b === br ? 3 : 1.6);
    line(br, 0, Math.min(f, fork()), "#fff", 3);
    for (const b of keys) {
      const hit = m.meta[b].contact;
      if (hit != null && hit * FPS <= f) {
        const px = X(hit * FPS, g), py = Y(S[b][Math.round(hit * FPS)], g);
        x.strokeStyle = "#fff"; x.lineWidth = 2.2;
        x.beginPath(); x.moveTo(px - 6, py - 6); x.lineTo(px + 6, py + 6); x.moveTo(px + 6, py - 6); x.lineTo(px - 6, py + 6); x.stroke();
        if (b === br) { x.fillStyle = "#fff"; x.fillText(`contact ${hit.toFixed(1)} s`, px + 10, py - 8); }
      }
    }
    const ends = keys.map((b) => [b, Y(S[b].at(-1), g) + 4]).sort((p, q) => p[1] - q[1]);
    ends.forEach((e, j) => { if (j) e[1] = Math.max(e[1], ends[j - 1][1] + 17); });
    for (const [b, y] of ends) {
      x.fillStyle = col(b);
      x.globalAlpha = b === br ? 1 : 0.65;
      x.font = `${b === br ? 500 : 400} 13px 'BD Text', sans-serif`;
      x.fillText(`${c.B[b][0]} · ${m.meta[b].progress.toFixed(0)} m`, X(n() - 1, g) + 12, y);
      x.globalAlpha = 1;
    }
    x.strokeStyle = "#fff"; x.lineWidth = 1;
    x.beginPath(); x.moveTo(X(f, g), PAD.t - 6); x.lineTo(X(f, g), PAD.t + g.h + 4); x.stroke();
  };
  const paint = () => { if (!m) return; const f = frame(); paintMap(f); paintCols(); paintTree(f); };

  const bars = () => {
    const shown = ROWS.filter(([, k]) => keys.every((b) => m.meta[b][k] != null) && new Set(keys.map((b) => m.meta[b][k])).size > 1);
    box.style.setProperty("--n", keys.length);
    box.innerHTML = `<div class="bar-row"><b></b>${keys.map((b) => `<span class="label" style="color:${col(b)}">${c.B[b][0]}</span>`).join("")}</div>` + shown.map(([label, k, unit, dp]) => {
      const vals = keys.map((b) => m.meta[b][k]), max = Math.max(...vals, 1e-6);
      const text = (b, v) => (k === "min_gap" && m.meta[b].contact != null ? `contact at ${m.meta[b].contact.toFixed(1)} s` : `${v.toFixed(dp)} ${unit}`);
      return `<div class="bar-row"><b>${label}</b>${keys.map((b, i) => `<span class="cbar" style="--v:${vals[i] / max};--c:${col(b)}"><i></i><em>${text(b, vals[i])}</em></span>`).join("")}</div>`;
    }).join("");
    if (seen) { box.classList.remove("in"); void box.offsetWidth; box.classList.add("in"); }
  };
  new IntersectionObserver(([e]) => { if (e.isIntersecting && !seen) { seen = true; box.classList.add("in"); } }, { threshold: 0.3 }).observe(box);

  const select = (b) => {
    br = b;
    cells.forEach((x) => x.el.setAttribute("aria-pressed", String(x.b === b)));
    rig.layer = b;
    $(".cf-seven-name", root).textContent = c.B[b][0];
    rig.draw();
    paint();
  };
  const mode = (to) => { stageEl.dataset.mode = to; rig.resize(); paint(); };

  async function show(k) {
    const my = ++token;
    cancelFork();
    const d = (data[k] ||= await fetch(`assets/edit/${k}.json`).then((r) => r.json()));
    if (my !== token) return;
    [key, c, m, keys] = [k, CASES[k], d, Object.keys(CASES[k].B)];
    $$(".cf-cases [role=radio]", root).forEach((x) => x.setAttribute("aria-checked", String(x.dataset.case === k)));
    S = Object.fromEntries(keys.map((b) => [b, along(ego(b))]));
    armed = true; forked = 0;
    Object.assign(zoom, { px: 0, py: 0 });
    rig.setClip(`cf-${k}`, c.start || 0);
    cols.style.setProperty("--n", keys.length);
    cols.innerHTML = keys.map((b) => `<button type="button" class="fut" data-b="${b}" style="--c:${col(b)}" aria-label="${c.B[b][0]}: follow this future">
      <header><b>${c.B[b][0]}</b>${c.B[b][2] ? `<em>${c.B[b][2]}</em>` : ""}</header>
      <div><canvas data-cam="FW"></canvas><span class="vlab">Front wide</span></div>
      <div><canvas data-cam="FT"></canvas><span class="vlab">Front tele</span></div><div class="hit">Contact</div></button>`).join("");
    cells = $$(".fut", cols).map((el) => ({
      el, b: el.dataset.b,
      views: $$("canvas", el).map((cv) => ({ cv, ctx: cv.getContext("2d", { alpha: false }), cam: cv.dataset.cam })),
    }));
    cells.forEach((x) => x.el.addEventListener("click", () => (br === x.b ? mode("seven") : select(x.b))));
    pulse.textContent = `Decision · ${(fork() / FPS).toFixed(1)} s`;
    $(".cf-premise", root).textContent = c.premise;
    $(".cf-close", root).textContent = c.close;
    bars();
    select(keys[keys.length - 1]);
    mode("cols");
  }

  // The fork: brief dramatic beat at the decision while the paths branch out, then play on cleanly.
  rig.onframe = () => {
    if (!m) return;
    const f = frame();
    if (armed && f >= fork() && f < fork() + 6 && !reduced && !rig.userPaused) {
      armed = false;
      rig.video.pause();
      pulse.classList.add("on");
      forkTween = gsap.to({ v: 0 }, { v: 1, duration: 0.9, ease: "power2.out", onUpdate() { forked = this.targets()[0].v; paintMap(frame()); },
        onComplete: () => { forkTimer = setTimeout(() => { pulse.classList.remove("on"); rig.sync(); }, 220); } });
    }
    if (f < Math.max(5, Math.round((c.start || 0) * FPS) + 3)) { armed = true; forked = 0; }
    if (f > fork() + 6) forked = 1;
    paint();
  };
  const order = Object.keys(CASES);
  rig.el.addEventListener("ended", () => {
    if (auto) show(order[(order.indexOf(key) + 1) % order.length]);
    else { rig.time = c.start || 0; rig.sync(); }
  });
  $(".cf-cases", root).innerHTML = order.map((k, i) => `<button type="button" role="radio" aria-checked="${!i}" data-case="${k}">${CASES[k].name}<small>${Object.keys(CASES[k].B).length} futures</small></button>`).join("");
  radios($(".cf-cases", root), (x) => { auto = false; show(x.dataset.case); });
  $(".cf-back", root).addEventListener("click", () => mode("cols"));
  play.addEventListener("click", () => { cancelFork(); rig.toggle(); });
  rig.el.addEventListener("playstate", () => {
    const on = !rig.userPaused;
    play.setAttribute("aria-label", on ? "Pause" : "Play");
    $("use", play).setAttribute("href", on ? "#i-pause" : "#i-play");
  });
  const scrub = (e) => {
    cancelFork();
    const g = geo(), r = tree.getBoundingClientRect(), i = Math.max(0, Math.min(n() - 1, Math.round(((e.clientX - r.left - PAD.l) / g.w) * (n() - 1))));
    if (e.type === "pointerdown" && i > fork()) {
      const y = e.clientY - r.top, near = keys.reduce((a, b) => (Math.abs(Y(S[b][i], g) - y) < Math.abs(Y(S[a][i], g) - y) ? b : a));
      if (Math.abs(Y(S[near][i], g) - y) < 16) select(near);
    }
    armed = false; forked = 1;
    rig.time = i / FPS + 0.05;
  };
  tree.addEventListener("pointerdown", (e) => { tree.setPointerCapture(e.pointerId); scrub(e); });
  tree.addEventListener("pointermove", (e) => { if (e.buttons) scrub(e); });
  zoomable(map, zoom, () => paintMap(), map.parentElement, [24, 220]);
  new ResizeObserver(paint).observe(root);
  await show("hub");
}
