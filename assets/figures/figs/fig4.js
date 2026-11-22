/* Figure 4 · One chunk */
BD.figure("fig4", (F, BD) => {
  const { C, CAM, pad3, lerp, ease, clamp01 } = BD;
  const S = { inp: 0, flow: 1, pass: 2, write: 3, few: 4, cache: 5, cost: 6, wall: 7 };
  const SIG = ["1.00", "0.94", "0.83", "0.63"];
  const sg = (v) => `σ = ${v}`;
  const panel = (id, x, y, w, h, step, fill, stroke) => F.node(id, { x, y, w, h, kind: "ink", fill: fill || "#fbfdff", stroke: stroke || "#e2e8f0", rx: 22, step });

  // ═══ (a) inputs ═══════════════════════════════════════════════════════════════════════
  panel("pa", 28, 24, 244, 536, S.inp, "#fffdf8", "#fde68a");
  F.text(50, 62, "(a)  Inputs", { cls: "h2", step: S.inp, id: "a-t" });
  const inMaps = [84, 92].map((f, i) => F.img(`assets/clip/hdmap_v0_f${pad3(f)}_s.jpg`, 50, 82, 176, 97, { id: `in-map${i}`, step: S.inp, rx: 6, stroke: C.cond, sw: 2 }));
  F.text(50, 216, "layout map", { cls: "b", fill: C.cond, step: S.inp, id: "in-l1" });
  F.text(50, 238, "× 7 cameras", { cls: "xs", step: S.inp, id: "in-l2" });
  F.img("assets/clip/gen_v0_f076_s.jpg", 50, 270, 94, 52, { id: "in-m1", step: S.inp, rx: 5, stroke: C.mem, sw: 2.4 });
  F.img("assets/clip/gen_v0_f084_s.jpg", 156, 270, 94, 52, { id: "in-m2", step: S.inp, rx: 5, stroke: C.mem, sw: 2.4 });
  F.text(50, 346, "memory", { cls: "b", fill: C.mem, step: S.inp, id: "in-l3" });
  F.text(50, 368, "the two chunks before", { cls: "xs", step: S.inp, id: "in-l4" });
  F.math("window", 150, 408, { step: S.inp, id: "in-win", anchor: "middle", s: 0.85 });
  F.chip(50, 446, "caption", { fill: "#ffedd5", color: "#9a3412", size: 19.5, step: S.inp, id: "in-cap" });
  F.chip(50, 486, "noise ε", { fill: "#f1f5f9", color: "#334155", size: 19.5, step: S.inp, id: "in-eps" });

  // ═══ (b) the passes ═══════════════════════════════════════════════════════════════════
  panel("pb", 290, 24, 740, 536, S.flow);
  F.text(312, 62, "(b)  Denoise: predict, re-noise, repeat", { cls: "h2", step: S.flow, id: "b-t" });
  const CX = [380, 535, 690, 845], AX0 = 364, AX1 = 1000, AYT = 96, AYB = 250, shiftSig = (u) => 5 * u / (1 + 4 * u);
  const xOf = (u) => 380 + (1 - u) * 620, yOf = (sigma) => AYB - sigma * (AYB - AYT);
  const chart = F.group({ id: "chart", step: S.flow });
  F.el("path", { d: `M${AX0},${AYT - 8} V${AYB} H${AX1 + 10}`, fill: "none", stroke: "#475569", "stroke-width": 1.8 }, chart);
  F.el("line", { x1: xOf(1), y1: yOf(1), x2: xOf(0), y2: yOf(0), stroke: "#cbd5e1", "stroke-dasharray": "5 4" }, chart);
  F.el("path", { d: "M" + Array.from({ length: 63 }, (_, i) => { const u = 1 - i / 62; return `${xOf(u).toFixed(1)},${yOf(shiftSig(u)).toFixed(1)}`; }).join(" L"), fill: "none", stroke: "#94a3b8", "stroke-width": 2.6 }, chart);
  F.el("text", { x: AX0 - 8, y: AYT + 4, "text-anchor": "end", class: "xs" }, chart).textContent = "1";
  F.el("text", { x: AX0 - 8, y: AYB + 4, "text-anchor": "end", class: "xs" }, chart).textContent = "0";
  F.el("text", { x: AX0 + 8, y: AYT - 12, class: "xs" }, chart).textContent = "σ after the shift";
  F.text(xOf(0.62) + 8, yOf(0.62) + 26, "without shift", { cls: "xs", parent: chart, fill: "#94a3b8" });
  F.text(xOf(0.15), yOf(shiftSig(0.15)) + 36, "with shift, s = 5", { cls: "xs", parent: chart, fill: "#475569" });
  F.el("text", { x: AX1, y: AYB + 24, "text-anchor": "end", class: "xs" }, chart).textContent = "uniform step u: 1 → 0";
  const P = CX.map((cx, j) => [cx, yOf(shiftSig([1, 0.75, 0.5, 0.25][j]))]);
  const chords = [0, 1, 2].map((j) => F.el("path", { d: `M${P[j][0] + 8},${P[j][1] + (P[j + 1][1] - P[j][1]) * 0.05} L${P[j + 1][0] - 9},${P[j + 1][1] - (P[j + 1][1] - P[j][1]) * 0.05}`, stroke: C.data, "stroke-width": 3, fill: "none", "marker-end": "url(#a-data)" }, chart));
  P.forEach(([x, y]) => F.el("circle", { cx: x, cy: y, r: 7, fill: "#fff", stroke: C.data, "stroke-width": 3.4 }, chart));
  const hop = F.el("circle", { r: 6, fill: C.data, stroke: "#fff", "stroke-width": 2 }, chart);
  F.math("shift", 906, 112, { parent: chart, anchor: "middle", s: 0.9 });
  P.forEach(([x, y]) => F.el("line", { x1: x, y1: y + 10, x2: x, y2: 292, stroke: "#cbd5e1", "stroke-dasharray": "3 4" }, chart));
  const passG = [];
  for (let j = 0; j < 4; j++) {
    const g = F.el("g", {}, F.layer), x = CX[j] - 60;
    F.reg(g, { id: `pass${j}`, step: S.pass });
    passG.push(g);
    F.text(CX[j], 318, sg(SIG[j]), { cls: "b", parent: g, anchor: "middle" });
    F.img(`assets/denoise/k1_v0_s${j}_x0.jpg`, x, 328, 120, 69, { parent: g, rx: 5, stroke: C.data });
    F.text(CX[j], 426, `pass ${j + 1}`, { cls: "xs", parent: g, anchor: "middle" });
    if (j < 3) F.el("path", { d: `M${CX[j] + 64},${363} H${CX[j + 1] - 64}`, stroke: "#475569", "stroke-width": 2.4, "marker-end": "url(#a-copy)" }, g);
  }
  F.text(312, 466, "predict the clean estimate", { cls: "xs", step: S.pass, id: "m-pass-l" });
  F.math("pass", 470, 500, { step: S.pass, id: "m-pass", anchor: "middle" });
  F.text(700, 466, "re-noise to the next σ", { cls: "xs", step: S.pass, id: "m-ren-l" });
  F.math("renoise", 850, 500, { step: S.pass, id: "m-ren", anchor: "middle" });

  // ═══ (c) fewer steps ══════════════════════════════════════════════════════════════════
  panel("pc", 1048, 24, 524, 536, S.few);
  F.text(1070, 62, "(c)  Fewer steps, same clip", { cls: "h2", step: S.few, id: "c-t" });
  const COLX = [1066, 1234, 1402], CW = 156, CHH = 86, CROP = [300, 90, 230, 126], RF = 126, RZ = 292, RN = 414;
  const zoom = [];
  [1, 2, 4].forEach((n, i) => {
    const x = COLX[i], g = F.el("g", {}, F.layer), href = `assets/clip/steps${n}_v0_f092_m.jpg`;
    F.reg(g, { id: `few${i}`, step: S.few });
    F.text(x + CW / 2, 100, `${n} step${n > 1 ? "s" : ""}`, { cls: "b", parent: g, anchor: "middle", fill: n === 4 ? C.ink : "#334155" });
    F.img(href, x, RF, CW, CHH, { parent: g, rx: 6 });
    const src = { x: x + CW * CROP[0] / 640, y: RF + CHH * CROP[1] / 352, width: CW * CROP[2] / 640, height: CHH * CROP[3] / 352 };
    const link = F.el("path", { fill: "#fbbf24", "fill-opacity": 0.14, stroke: "#d97706", "stroke-width": 1.2 }, g);
    F.el("rect", { ...src, fill: "none", stroke: "#d97706", "stroke-width": 2 }, g);
    F.imgCrop(href, x, RZ, CW, CHH, [640, 352], CROP, { parent: g, rx: 6, stroke: "#d97706", sw: 2 });
    F.img(`assets/clip/steps${n}_v1_f092_m.jpg`, x, RN, CW, CHH, { parent: g, rx: 6 });
    if (!i) { F.pill(0, x + 6, RF + 6, { parent: g }); F.pill(1, x + 6, RN + 6, { parent: g }); }
    zoom.push({ x, src, link });
  });

  // ═══ (d) write, (e) caches, (f) cost ══════════════════════════════════════════════════
  const RY = 580, RH = 236;
  panel("pd", 28, RY, 532, RH, S.write, "#fcfbff", "#ddd6fe");
  F.text(50, RY + 38, "(d)  Write: commit to memory", { cls: "h2", step: S.write, id: "d-t" });
  F.img("assets/denoise/k1_v0_write_xt.jpg", 50, RY + 56, 150, 87, { id: "d-img", step: S.write, rx: 6, stroke: C.mem, sw: 2 });
  F.text(50, RY + 166, sg("0.13"), { cls: "b", step: S.write, id: "d-sig", fill: C.mem });
  F.node("kvm", { x: 262, y: RY + 66, w: 166, h: 66, kind: "mem", title: "KV memory", sub: "M = (K, V)", step: S.write });
  F.edge("d-kv", [[202, RY + 100], [260, RY + 100]], { kind: "mem", step: S.write, from: "d-img", to: "kvm", draw: [0.2, 0.6] });
  F.math("ctxnoise", 292, RY + 168, { step: S.write, id: "m-ctx", anchor: "middle", s: 0.95 });
  F.math("ctxwrite", 306, RY + 204, { step: S.write, id: "m-cw", anchor: "middle", s: 0.95 });

  panel("pe", 578, RY, 482, RH, S.cache, "#fffdf8", "#e2e8f0");
  F.text(600, RY + 38, "(e)  Deployment loop", { cls: "h2", step: S.cache, id: "e-t" });
  const LY = RY + 78, LW = 124, LH = 68, LX = [600, 758, 916], LM = LY + LH / 2;
  [["Denoise", "1–4 steps", "data"], ["Write", "1 pass", "mem"], ["KV cache", "2 chunks", "mem"]].forEach(([t, sub, kind], i) => F.node(`e-n${i}`, { x: LX[i], y: LY, w: LW, h: LH, kind, title: t, sub, scls: "xs", step: S.cache }));
  F.edge("e-0", [[LX[0] + LW + 2, LM], [LX[1] - 2, LM]], { kind: "data", step: S.cache, from: "e-n0", to: "e-n1", draw: [0, 0.15] });
  F.edge("e-1", [[LX[1] + LW + 2, LM], [LX[2] - 2, LM]], { kind: "mem", step: S.cache, from: "e-n1", to: "e-n2", draw: [0.15, 0.3] });
  F.edge("e-2", [[LX[2] + LW / 2, LY + LH + 2], [LX[2] + LW / 2, LY + LH + 44], [LX[0] + LW / 2, LY + LH + 44], [LX[0] + LW / 2, LY + LH + 2]],
    { kind: "mem", step: S.cache, from: "e-n2", to: "e-n0", draw: [0.3, 0.55], r: 14, label: "next chunk", labelAt: [(LX[0] + LX[2] + LW) / 2, LY + LH + 34] });

  panel("pf", 1078, RY, 494, RH, S.cost, "#fff", "#e2e8f0");
  F.text(1100, RY + 38, "(f)  Network passes per chunk", { cls: "h2", step: S.cost, id: "f-t" });
  const BX0 = 1292, BWL = 150;
  const bars = [["guided student", "35 steps × 2", 70, "#cbd5e1", "#475569"], ["ours", "steps + 1 write", 5, "#0f172a", "#0f172a"]].map(([n, sub, k, col, tc], i) => {
    const y = RY + 70 + i * 62, g = F.el("g", {}, F.layer);
    F.reg(g, { id: `f-bar${i}`, step: S.cost });
    F.text(1100, y + 14, n, { cls: "b", parent: g });
    F.text(1100, y + 36, sub, { cls: "xs", parent: g });
    const r = F.el("rect", { x: BX0, y: y + 4, width: 0, height: 30, rx: 6, fill: col }, g);
    const t = F.el("text", { y: y + 27, class: "h2", fill: tc }, g); t.textContent = i ? "≤ 5" : "70";
    return { r, t, w: (k / 70) * BWL, y };
  });
  const brk = F.group({ id: "f-brk", step: S.cost });
  F.el("path", { d: `M${BX0 + BWL + 42},${RY + 74} H${BX0 + BWL + 54} V${RY + 140} H${BX0 + BWL + 42}`, fill: "none", stroke: "#0f172a", "stroke-width": 2 }, brk);
  F.text(BX0 + BWL + 64, RY + 118, "14×", { cls: "h", parent: brk });
  F.text(1100, RY + 218, "guidance is distilled into the weights", { cls: "xs", step: S.cost, id: "f-n" });

  // ═══ (g) seven cameras ═══════════════════════════════════════════════════════════════
  panel("pg", 28, 836, 1544, 207, S.wall, "#fff", "#e2e8f0");
  F.text(50, 872, "(g)  Seven cameras, one scene", { cls: "h2", step: S.wall, id: "g-t" });
  const TY = 892, K = 206 / 640, BUS = [[0, 490, 0, 640, 282], [1, 66, 0, 640, 322], [2, 0, 0, 526, 300]];
  CAM.abbr.forEach((_, v) => {
    const id = `cam${v}`, x = 49 + v * 216;
    F.img(`assets/clip/gen_v${v}_f092_m.jpg`, x, TY, 206, 113, { id, step: S.wall, rx: 8 });
  });
  const busG = F.group({ id: "bus", step: S.wall }), centres = [];
  BUS.forEach(([v, x0, y0, x1, y1]) => {
    const x = 49 + v * 216;
    centres.push([x + (x0 + x1) / 2 * K, TY + (y0 + y1) / 2 * K]);
    F.el("rect", { x: x + x0 * K + 2, y: TY + y0 * K + 2, width: (x1 - x0) * K - 4, height: (y1 - y0) * K - 4, rx: 6, fill: "none", stroke: C.xview, "stroke-width": 3 }, busG);
  });
  const thread = centres.map((c, i) => `${i ? "L" : "M"}${c[0].toFixed(1)},${c[1].toFixed(1)}`).join(" "), threadLen = centres.slice(1).reduce((a, c, i) => a + Math.hypot(c[0] - centres[i][0], c[1] - centres[i][1]), 0);
  const threads = [["#fff", 8], [C.xview, 3.4]].map(([stroke, w]) => F.el("path", { d: thread, fill: "none", stroke, "stroke-width": w, "stroke-linecap": "round", "stroke-linejoin": "round" }, busG));
  centres.forEach(([cx, cy]) => F.el("circle", { cx, cy, r: 6, fill: C.xview, stroke: "#fff", "stroke-width": 2 }, busG));

  const pills = F.group({ id: "cam-pills", step: S.wall });
  CAM.abbr.forEach((_, v) => F.pill(v, 55 + v * 216, TY + 79, { parent: pills }));

  F.pulse("d-kv", S.write, { t0: 0.2, t1: 0.6, kind: "mem", to: "kvm" });
  F.pulse("e-0", S.cache, { t0: 0.2, t1: 0.35, to: "e-n1" });
  F.pulse("e-1", S.cache, { t0: 0.4, t1: 0.55, kind: "mem", to: "e-n2" });
  F.pulse("e-2", S.cache, { t0: 0.6, t1: 0.9, kind: "mem", to: "e-n0" });

  // ═══ mechanics ═══════════════════════════════════════════════════════════════════════
  F.hook(({ s, p, isStatic, t }) => {
    const stack = isStatic || s !== S.inp ? 1 : ease(clamp01(p));
    inMaps[0].setAttribute("transform", `translate(${(14 * stack).toFixed(2)} ${(-9 * stack).toFixed(2)})`);
    const z = isStatic || s !== S.few ? 1 : ease(clamp01(p / 0.5));
    zoom.forEach(({ x, src, link }) => {
      const by = src.y + src.height, y = lerp(by, RZ, z);
      link.setAttribute("d", `M${src.x},${by} L${lerp(src.x, x, z)},${y} L${lerp(src.x + src.width, x + CW, z)},${y} L${src.x + src.width},${by} Z`);
    });
    const q = isStatic ? 1 : s === S.wall ? ease(clamp01((p - 0.15) / 0.6)) : 1;
    threads.forEach((t) => { t.setAttribute("stroke-dasharray", `${threadLen.toFixed(1)} ${threadLen.toFixed(1)}`); t.setAttribute("stroke-dashoffset", ((1 - q) * threadLen).toFixed(1)); });
    passG.forEach((g, j) => g.setAttribute("opacity", (isStatic || s > S.pass ? 1 : s === S.pass ? clamp01((p - 0.2 * j - 0.02) / 0.12) : 0).toFixed(2)));
    // a dot hops along the chords (large first steps, small last step): the sampling path of the shifted flow
    const showHop = !isStatic && s === S.flow;
    hop.setAttribute("opacity", showHop ? 1 : 0);
    if (showHop) {
      const w = (t * 0.5) % 3, j = Math.min(2, Math.floor(w)), f = ease(w - j);
      hop.setAttribute("cx", lerp(P[j][0], P[j + 1][0], f)); hop.setAttribute("cy", lerp(P[j][1], P[j + 1][1], f));
    }
    chords.forEach((c, j) => c.setAttribute("opacity", isStatic || s > S.flow ? 1 : s === S.flow ? clamp01((p - 0.2 - 0.2 * j) / 0.2) : 0));
    const e = isStatic || s > S.cost ? 1 : s === S.cost ? ease(clamp01(p / 0.6)) : 0;
    bars.forEach((b) => { b.r.setAttribute("width", Math.max(0.01, b.w * e)); b.t.setAttribute("x", BX0 + b.w * e + 10); });
  });

  const steps = [
    { short: "Inputs", dur: 5, focus: ["pa", "a-t", "in-map0", "in-map1", "in-l1", "in-l2", "in-m1", "in-m2", "in-l3", "in-l4", "in-win", "in-cap", "in-eps"], title: "A chunk starts from noise and three conditions",
      text: "For every new chunk the seven cameras start from Gaussian noise. They are conditioned on the layout map of that chunk, the memory of the two chunks before it, and the caption." },
    { short: "Flow", dur: 8, focus: ["pb", "b-t", "chart"], title: "The training flow, with shifted steps",
      text: "Sampling uses the training equations: <i>x</i><sub>σ</sub> = (1−σ)<i>x</i><sub>0</sub> + σε, target velocity ε − <i>x</i><sub>0</sub>. The steps are uniform in u and warped by σ′ = sσ / (1 + (s−1)σ), s = 5. The warp makes the early steps large and the last step small." },
    { short: "Passes", dur: 8, focus: ["pb", "b-t", "chart", "pass0", "pass1", "pass2", "pass3", "m-pass-l", "m-pass", "m-ren-l", "m-ren"], title: "Predict, re-noise, predict again",
      text: "Each pass returns a full estimate of the clean chunk. It is re-noised to the next, lower σ and refined. These are real predictions of the network, in order." },
    { short: "Write", dur: 6, focus: ["pd", "d-t", "d-img", "d-sig", "kvm", "d-kv", "m-ctx", "m-cw"], title: "One more pass writes the chunk into memory",
      text: "The final estimate is lightly re-noised and run through the network once more. That pass stores the chunk's keys and values for later chunks. Writing slightly noisy memory matches the noise level the model denoised under, so small errors do not compound." },
    { short: "Steps", dur: 8, focus: ["pc", "c-t", "few0", "few1", "few2"], title: "One model, any number of steps",
      text: "The same weights run with one, two or four steps by truncating the step list. The amber box on each frame is the region enlarged below it." },
    { short: "Caches", dur: 6, focus: ["pe", "e-t", "e-n0", "e-n1", "e-n2", "e-0", "e-1", "e-2"], title: "The deployment loop",
      text: "Per chunk: a few denoising steps, one write into the KV cache, then the next chunk. Guidance is already in the weights, so there is no second branch." },
    { short: "Cost", dur: 6, focus: ["pf", "f-t", "f-bar0", "f-bar1", "f-brk", "f-n"], title: "Far fewer network passes per chunk",
      text: "A guided student needs 35 steps with a second guidance pass each. The distilled generator needs a few steps plus the memory write, with guidance already in its weights: 14 times fewer passes at four steps." },
    { short: "Cameras", dur: 6, focus: ["pg", "g-t", "bus", "cam-pills", "cam0", "cam1", "cam2", "cam3", "cam4", "cam5", "cam6"], title: "The result: seven cameras, one scene",
      text: "The seven decoded views of one chunk. The outlined bus is the same vehicle in the front wide, cross-right and rear-right cameras." },
  ];
  return { title: "One chunk", steps, caption: "<b>Figure 4 · One chunk.</b> (a) A seven-view chunk starts from noise, conditioned on its layout frames, the memory of the two chunks before it and a caption. (b) The sampling path follows the training flow with shifted steps; each pass predicts a clean estimate that is re-noised to the next level. (c) One checkpoint runs with one, two or four steps (same clip, frame and seed); the amber box marks the region enlarged below it. (d) A final write pass commits the chunk to memory at light noise. (e) The per-chunk loop: denoise, write once, keep a two-chunk KV cache; guidance is distilled into the weights. (f) Network passes per chunk against a guided student. (g) The decoded cameras of one chunk; the outlined bus is the same vehicle in FW, CR and RR." };
});
