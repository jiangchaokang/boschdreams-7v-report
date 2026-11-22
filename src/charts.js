import { reduced } from "./rig.js";

// Experiment charts, drawn as compact Tufte-style SVGs from assets/data/results.json.
const NS = "http://www.w3.org/2000/svg";
const C = { ours: "#2ee6ff", ours2: "#b9a7ff", base: "#ffd24d", other: "#7c8694", ok: "#36e27f", bad: "#ff5c6c", grid: "rgba(255,255,255,.10)", dim: "rgba(245,245,247,.62)", text: "#f5f5f7" };
const el = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); parent?.append(e); return e; };
// Inline styles: the report's figure engine injects global `text{}` / `.b{}` rules once it loads.
const txt = (p, x, y, s, o = {}) => { const e = el("text", { x, y, "text-anchor": o.anchor || "start", class: o.cls || "" }, p); e.style.cssText = `fill:${o.fill || C.text};font:${o.fw || 400} ${o.fs || 13}px ${o.cls === "big" ? "var(--display)" : "var(--sans)"};letter-spacing:0;paint-order:stroke;stroke:#000;stroke-width:3px;stroke-linejoin:round`; e.textContent = s; return e; };
const line = (p, x1, y1, x2, y2, o = {}) => el("line", { x1, y1, x2, y2, stroke: o.stroke || C.grid, "stroke-width": o.w || 1, "stroke-dasharray": o.dash || "none" }, p);
const tip = (e, s) => { el("title", {}, e).textContent = s; return e; };
const pct = (a, b) => `${b < a ? "−" : "+"}${Math.abs((100 * (b - a)) / a).toFixed(1)}%`;
const svg = (host, w, h, label) => el("svg", { viewBox: `0 0 ${w} ${h}`, role: "img", "aria-label": label }, host);
const stage = (e, i, step = 55) => { e.classList.add("mk"); e.style.transitionDelay = `${i * step}ms`; return e; };

function models(host, R) {
  const s = svg(host, 740, 400, "FVD against ego-motion error for 11 models; BoschDreams sits alone in the lower left");
  const names = Object.keys(R).filter((k) => k !== "GT reference");
  const ours = ["BoschDreams 720p 4-step", "BoschDreams 480p 1-step"], base = "Cosmos-Transfer 2.5 (7V)";
  const col = (n) => (n === ours[0] ? C.ours : n === ours[1] ? C.ours2 : n === base ? C.base : C.other);
  const X0 = 56, Y0 = 24, PW = 330, PH = 310;
  const lx = (v) => X0 + (PW * Math.log10(v / 60)) / Math.log10(1500 / 60), ly = (v) => Y0 + PH * (1 - v / 34);
  [0, 10, 20, 30].forEach((v) => { line(s, X0, ly(v), X0 + PW, ly(v)); txt(s, X0 - 8, ly(v) + 4, v, { fill: C.dim, fs: 12, anchor: "end" }); });
  [75, 150, 400, 1000].forEach((v) => { line(s, lx(v), Y0 + PH, lx(v), Y0 + PH + 5, { stroke: "rgba(255,255,255,.3)" }); txt(s, lx(v), Y0 + PH + 20, v, { fill: C.dim, fs: 12, anchor: "middle" }); });
  line(s, X0, Y0 + PH, X0 + PW, Y0 + PH, { stroke: "rgba(255,255,255,.28)" });
  txt(s, X0 + PW / 2, Y0 + PH + 42, "FVD, log scale (lower is better)", { fill: C.dim, fs: 12, anchor: "middle" });
  txt(s, 0, 0, "Ego ADE, m (lower is better)", { fill: C.dim, fs: 12, anchor: "middle" }).setAttribute("transform", `translate(16,${Y0 + PH / 2}) rotate(-90)`);
  stage(el("rect", { x: X0 + 2, y: ly(9), width: lx(120) - X0 - 2, height: ly(0) - ly(9) - 2, rx: 6, fill: C.ours, "fill-opacity": 0.08, stroke: C.ours, "stroke-dasharray": "5 4" }, s), 10);
  const short = { "BoschDreams 720p 4-step": "Ours 720p", "BoschDreams 480p 1-step": "Ours 480p", "Cosmos-Transfer 2.5 (7V)": "Cosmos 2.5 (7V)", "FastVideo Causal Wan2.2": "FastVideo Wan", "HY-WorldPlay": "WorldPlay", "OmniDreams-1V": "Omni-1V" };
  const labelPos = {
    "BoschDreams 720p 4-step": [10, 14, "start"],
    "BoschDreams 480p 1-step": [10, -8, "start"],
    "Cosmos-Transfer 2.5 (7V)": [10, 4, "start"],
    "Cosmos 2.5 1V": [-8, -8, "end"],
    "OmniDreams-1V": [9, 13, "start"],
    "LingBot": [0, 17, "middle"],
    "Wan2.2": [9, 5, "start"],
    "Causal Forcing": [-9, 4, "end"],
    "FastVideo Causal Wan2.2": [-9, 14, "end"],
    "Self-Forcing": [-9, -8, "end"],
    "HY-WorldPlay": [-9, 5, "end"],
  };
  [...names.filter((n) => !n.startsWith("Bosch")), ...ours.slice().reverse()].forEach((n, i) => {
    const v = R[n], x = lx(v.fvd), y = ly(v.ade), big = n.startsWith("Bosch"), g = stage(el("g", {}, s), i, 60);
    const [dx, dy, an] = labelPos[n] || [10, 4, "start"];
    tip(el("circle", { cx: x, cy: y, r: big ? 6.5 : 4.5, fill: col(n) }, g), `${n}: FVD ${v.fvd}, ADE ${v.ade} m`);
    txt(g, x + dx, y + dy, short[n] || n, { fill: col(n), fs: big ? 13 : 11, fw: big ? 600 : 400, anchor: an });
  });
  const MET = [["fvd", "FVD", -1, true], ["ade", "Ego ADE", -1], ["ftd", "Trajectory FTD", -1], ["subjq", "Perceptual", 1], ["vcons", "Temporal cons.", 1], ["apres", "Agent persist.", 1]];
  MET.forEach(([k, lab, dir, log], i) => {
    const y = 42 + i * 58, SX = 528, SW = 152, vals = names.filter((n) => R[n][k] != null), f = (v) => (log ? Math.log10(v) : v);
    const lo = Math.min(...vals.map((n) => f(R[n][k]))), hi = Math.max(...vals.map((n) => f(R[n][k]))), pos = (v) => SX + SW * (dir > 0 ? (f(v) - lo) / (hi - lo) : (hi - f(v)) / (hi - lo));
    const rank = 1 + vals.filter((n) => dir * (R[n][k] - R[ours[0]][k]) > 0).length, g = stage(el("g", {}, s), 5 + i, 80);
    txt(g, 420, y + 4, lab, { fs: 13, fw: 500 });
    line(g, SX, y, SX + SW, y, { stroke: "rgba(255,255,255,.26)", w: 1.4 });
    if (R["GT reference"][k] && dir > 0) tip(line(g, pos(R["GT reference"][k]), y - 9, pos(R["GT reference"][k]), y + 9, { stroke: "#fff", w: 1.8 }), `Recorded video: ${R["GT reference"][k]}`);
    [...vals.filter((n) => !ours.includes(n)), ...ours.slice().reverse()].forEach((n) => tip(el("circle", { cx: pos(R[n][k]), cy: y, r: n === ours[0] ? 5.5 : 3.8, fill: col(n), "fill-opacity": n.startsWith("Bosch") || n === base ? 1 : 0.65 }, g), `${n}: ${R[n][k]}`));
    txt(g, SX + SW + 10, y + 4, `#${rank}/${vals.length}`, { fill: rank === 1 ? C.ours : C.text, fs: 13, fw: 700 });
  });
  txt(s, 528, 386, "worse ←   → better   |  white tick = recorded", { fill: C.dim, fs: 11 });
}

function runtime(host, RT, M) {
  const s = svg(host, 740, 400, "Per-camera frames per second at 480p against the 10 Hz camera clock");
  const rows = RT.filter((r) => r.group === "480p (4-step)" || /^[12]-step/.test(r.config));
  const X0 = 166, BW = 290, sx = (v) => X0 + (BW * v) / 12;
  [0, 4, 8, 12].forEach((v) => { line(s, sx(v), 336, sx(v), 342, { stroke: "rgba(255,255,255,.3)" }); txt(s, sx(v), 358, v, { fill: C.dim, fs: 12, anchor: "middle" }); });
  line(s, X0, 336, X0 + BW, 336, { stroke: "rgba(255,255,255,.25)" });
  line(s, sx(10), 16, sx(10), 336, { stroke: C.base, w: 1.8, dash: "5 4" });
  txt(s, sx(10) - 6, 12, "10 Hz clock", { fill: C.base, fs: 12, fw: 600, anchor: "end" });
  rows.forEach((r, i) => {
    const y = 30 + i * 50, last = i === rows.length - 1, g = stage(el("g", {}, s), i, 100);
    const name = r.group.startsWith("480p (4") ? `4-step · ${r.config.replace("Eager baseline", "eager")}` : r.config.replace("compile + FP8", "c+FP8");
    txt(g, X0 - 10, y + 20, name, { fs: 13, fw: last ? 600 : 400, anchor: "end", fill: last ? C.ours : C.text });
    tip(el("rect", { x: X0, y: y + 4, width: (BW * r.fps) / 12, height: 24, rx: 4, fill: last ? C.ours : "#4b5968", class: "bar" }, g), `${r.fps} fps per camera, ${r.ms} ms per chunk (8 frames × 7 cameras)`);
    txt(g, X0 + (BW * r.fps) / 12 + 8, y + 21, `${r.fps.toFixed(2)}`, { fs: 13, fw: 600, fill: last ? C.ours : C.text });
  });
  txt(s, X0 + BW / 2, 384, "frames per second per camera (480p, 8 × H20)", { fill: C.dim, fs: 12, anchor: "middle" });
  const UX = 524, g = stage(el("g", {}, s), rows.length, 100);
  txt(g, UX, 34, "Passes / chunk", { fs: 14, fw: 600 });
  for (let i = 0; i < 70; i++) el("circle", { cx: UX + 5 + (i % 10) * 18, cy: 56 + Math.floor(i / 10) * 16, r: 4.8, fill: C.other }, g);
  txt(g, UX, 180, "7V baseline · 70 passes", { fill: C.dim, fs: 12 });
  [0, 1].forEach((i) => el("circle", { cx: UX + 5 + i * 18, cy: 204, r: 5.5, fill: C.ours }, g));
  txt(g, UX + 44, 208, "ours · 2 passes", { fill: C.ours, fs: 12, fw: 600 });
  txt(g, UX, 262, "35× fewer passes", { fill: C.ours, fs: 20, fw: 600 });
  txt(g, UX, 292, `FVD ${M["Cosmos-Transfer 2.5 (7V)"].fvd} → ${M["BoschDreams 480p 1-step"].fvd}`, { fill: C.dim, fs: 12 });
  const hi = RT.filter((r) => r.group.startsWith("720p"));
  txt(g, UX, 336, `720p 4-step: ${hi[0].ms}→${hi.at(-1).ms} ms`, { fs: 12 });
  txt(g, UX, 354, `exact kernels · ${hi.at(-1).fps} fps/cam`, { fill: C.dim, fs: 12 });
}

function stages(host, S) {
  const K = Object.keys(S), s = svg(host, 740, 400, "FVD, ego ADE and speed across the four training stages");
  const XS = K.map((_, i) => 195 + i * 124);
  const PANEL = [["fvd7", "7-cam FVD", [70, 145], -1], ["ade", "Ego ADE (m)", [4, 20], -1], ["fps", "FPS / cam (log)", [0.1, 10], 1, true]];
  K.forEach((k, i) => {
    const [a, b] = k.split(" · ");
    txt(s, XS[i], 366, a, { fill: C.dim, fs: 12, fw: 600, anchor: "middle" });
    txt(s, XS[i], 384, b.replace("Causal student", "Causal").replace("Self-Forcing", "Self-Forc.").replace("Antiphon Forcing", "Antiphon"), { fs: 12, anchor: "middle" });
  });
  PANEL.forEach(([k, lab, [lo, hi], dir, log], p) => {
    const y0 = 22 + p * 112, ph = 74, f = (v) => (log ? Math.log10(v) : v), y = (v) => y0 + ph * (1 - (f(v) - f(lo)) / (f(hi) - f(lo)));
    txt(s, 8, y0 + 26, lab, { fs: 13, fw: 600 });
    txt(s, 8, y0 + 44, dir < 0 ? "lower better" : "higher better", { fill: C.dim, fs: 11 });
    line(s, XS[0] - 20, y0 + ph + 8, XS.at(-1) + 20, y0 + ph + 8, { stroke: "rgba(255,255,255,.16)" });
    el("path", { d: "M" + K.map((kk, i) => `${XS[i]},${y(S[kk][k])}`).join(" L"), fill: "none", stroke: C.ours, "stroke-width": 2.2, pathLength: 1, class: "draw" }, s);
    K.forEach((kk, i) => {
      const v = S[kk][k], g = stage(el("g", {}, s), i, 140), last = i === K.length - 1;
      tip(el("circle", { cx: XS[i], cy: y(v), r: last ? 5.5 : 4.5, fill: last ? C.ours : "#000", stroke: C.ours, "stroke-width": 2 }, g), `${kk}: ${v}`);
      txt(g, XS[i], y(v) - 10, v < 1 ? v.toFixed(2) : v.toFixed(v < 20 ? 2 : 1), { fs: 12, fw: last ? 700 : 500, fill: last ? C.ours : C.text, anchor: "middle" });
    });
  });
}

function cameras(host, V, CF) {
  const s = svg(host, 740, 400, "Per-camera FVD on the rig headings, and speed against ego-motion error for each configuration");
  const CAMS = [["Front Wide", -14], ["Front Tele", 14], ["Cross Right", 52], ["Rear Right", 130], ["Rear Tele", 180], ["Rear Left", -130], ["Cross Left", -52]];
  const SER = [["Stage III", "#6b7280"], ["480p 1-step", C.ours2], ["720p 4-step", C.ours]];
  const CX = 175, CY = 188, R = 126, rr = (v) => (R * v) / 160;
  const P = (d, r) => [CX + r * Math.sin((d * Math.PI) / 180), CY - r * Math.cos((d * Math.PI) / 180)];
  [50, 100, 150].forEach((v) => { el("circle", { cx: CX, cy: CY, r: rr(v), fill: "none", stroke: C.grid }, s); txt(s, CX + 3, CY - rr(v) - 3, v, { fill: C.dim, fs: 10 }); });
  CAMS.forEach(([n, d]) => { const [x, y] = P(d, R + 4); line(s, CX, CY, x, y); const [lx, ly] = P(d, R + 24); txt(s, lx, ly + 4, n.replace("Front ", "F.").replace("Cross ", "C.").replace("Rear ", "R."), { fill: C.dim, fs: 11, anchor: "middle" }); });
  SER.forEach(([k, c], i) => {
    const g = stage(el("g", {}, s), i, 180);
    tip(el("polygon", { points: CAMS.map(([n, d]) => P(d, rr(V[k][n].fvd)).join(",")).join(" "), fill: c, "fill-opacity": i ? 0.16 : 0.05, stroke: c, "stroke-width": i ? 2.2 : 1.4, "stroke-dasharray": i ? "none" : "5 4" }, g),
      `${k}: ` + CAMS.map(([n]) => `${n} ${V[k][n].fvd}`).join(", "));
  });
  SER.forEach(([k, c], i) => { const g = el("g", {}, s); el("rect", { x: 18 + i * 116, y: 370, width: 10, height: 10, rx: 5, fill: c }, g); txt(g, 33 + i * 116, 379, k, { fs: 12 }); });

  const X0 = 420, XW = 290, Y0 = 36, YH = 280, sx = (v) => X0 + (XW * v) / 12, sy = (v) => Y0 + (YH * (v - 4.5)) / 2;
  [0, 4, 8, 12].forEach((v) => { line(s, sx(v), Y0 + YH, sx(v), Y0 + YH + 5, { stroke: "rgba(255,255,255,.3)" }); txt(s, sx(v), Y0 + YH + 20, v, { fill: C.dim, fs: 12, anchor: "middle" }); });
  [5, 5.5, 6].forEach((v) => { line(s, X0, sy(v), X0 + XW, sy(v)); txt(s, X0 - 8, sy(v) + 4, v.toFixed(1), { fill: C.dim, fs: 12, anchor: "end" }); });
  line(s, X0, Y0 + YH, X0 + XW, Y0 + YH, { stroke: "rgba(255,255,255,.28)" });
  line(s, sx(10), Y0 - 8, sx(10), Y0 + YH, { stroke: C.base, w: 1.8, dash: "5 4" });
  txt(s, sx(10), Y0 - 14, "10 Hz", { fill: C.base, fs: 12, fw: 600, anchor: "middle" });
  txt(s, X0 + XW / 2, Y0 + YH + 42, "FPS / camera · ADE (m) · area ∝ cross-view matches", { fill: C.dim, fs: 11, anchor: "middle" });
  const cfOff = { "480p · 4 steps": [10, 4, "start"], "480p · 2 steps": [-10, -14, "end"], "480p · 1 step": [-10, 8, "end"], "720p · 4 steps": [12, 0, "start"] };
  ["480p · 4 steps", "480p · 2 steps", "480p · 1 step", "720p · 4 steps"].forEach((k, i) => {
    const v = CF[k], c = k.startsWith("720") ? C.ours : C.ours2, x = sx(v.fps), y = sy(v.ade), r = 4.5 + (v.match - 280) / 12, g = stage(el("g", {}, s), 3 + i, 140);
    const [dx, dy, an] = cfOff[k] || [10, 0, "start"];
    tip(el("circle", { cx: x, cy: y, r, fill: c, "fill-opacity": 0.88 }, g), `${k}: ${v.fps} fps, ADE ${v.ade} m, V-cons ${v.vcons}, matches ${v.match}`);
    txt(g, x + dx, y + dy, k, { fill: c, fs: 12, fw: 600, anchor: an });
    txt(g, x + dx, y + dy + 14, `ADE ${v.ade.toFixed(2)} m`, { fill: C.dim, fs: 11, anchor: an });
  });
}

function fixer(host, F) {
  const s = svg(host, 920, 248, "PSNR and FVD before and after repair for each of the five 3DGS failure modes");
  const fams = Object.keys(F), px = (v) => 210 + ((v - 21) / 5) * 260, fx = (v) => 570 + ((300 - v) / 200) * 290;
  txt(s, 210, 18, "PSNR (dB) · higher is better", { fill: C.dim, fs: 12 }); txt(s, 570, 18, "FVD · lower is better", { fill: C.dim, fs: 12 });
  [21, 23, 25].forEach((v) => { line(s, px(v), 26, px(v), 226); txt(s, px(v), 242, v, { fill: C.dim, fs: 12, anchor: "middle" }); });
  [300, 200, 100].forEach((v) => { line(s, fx(v), 26, fx(v), 226); txt(s, fx(v), 242, v, { fill: C.dim, fs: 12, anchor: "middle" }); });
  fams.forEach((n, i) => {
    const y = 48 + i * 38, f = F[n], g = stage(el("g", {}, s), i, 90);
    txt(g, 0, y + 4, n, { fs: 13, fw: 500 });
    for (const [k, X] of [["psnr", px], ["fvd", fx]]) {
      const [a, b] = f[k]; line(g, X(a), y, X(b), y, { stroke: "rgba(255,255,255,.35)", w: 2.5 });
      tip(el("circle", { cx: X(a), cy: y, r: 5, fill: C.bad }, g), `${n}, 3DGS render: ${k.toUpperCase()} ${a}`);
      tip(el("circle", { cx: X(b), cy: y, r: 6, fill: C.ok }, g), `${n}, repaired: ${k.toUpperCase()} ${b}`);
      txt(g, Math.max(X(a), X(b)) + 10, y + 4, k === "psnr" ? `+${(b - a).toFixed(2)} dB` : pct(a, b), { fill: C.ok, fs: 12, fw: 600 });
    }
  });
}

export async function setupCharts() {
  const R = await fetch("assets/data/results.json").then((r) => r.json());
  const make = { models: (h) => models(h, R.main), runtime: (h) => runtime(h, R.runtime, R.main), stages: (h) => stages(h, R.ablation), cameras: (h) => cameras(h, R.views, R.config), fixer: (h) => fixer(h, R.fixer) };
  for (const host of document.querySelectorAll("[data-chart]")) {
    make[host.dataset.chart](host.querySelector(".plot"));
    if (reduced) { host.classList.add("in"); continue; }
    new IntersectionObserver(([e], o) => { if (e.isIntersecting) { host.classList.add("in"); o.disconnect(); } }, { threshold: 0.25 }).observe(host);
  }
}
