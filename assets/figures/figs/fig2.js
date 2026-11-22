/* Figure 2 · Training, Stages I – III */
BD.figure("fig2", (F, BD) => {
  const { C, CAM, pad3, lerp, ease, clamp01, hash } = BD;
  const S = { rail: 0, s1: 1, s2: 2, roll: 3, dmd: 4 };
  const camC = CAM.col;

  // ═══ stage rail ══════════════════════════════════════════════════════════════════════
  const ST = [
    { id: "s1", x: 28, tag: "STAGE I", t: "Surround Teacher", add: "adds 7-camera geometry", col: C.xview },
    { id: "s2", x: 424, tag: "STAGE II", t: "Causal Student", add: "adds causality", col: C.data },
    { id: "s3", x: 820, tag: "STAGE III", t: "Self-Forcing", add: "adds few-step generation", col: C.grad },
    { id: "s4", x: 1216, tag: "STAGE IV", t: "Antiphon Forcing", add: "adds long-horizon memory", col: C.mem, next: true },
  ];
  ST.forEach((s, i) => {
    F.node(s.id, { x: s.x, y: 24, w: 356, h: 140, kind: "ink", fill: "#fff", stroke: s.col, step: S.rail, rx: 20, dash: s.next ? "7 5" : undefined });
    const g = F.byId[s.id].g, tw = s.tag.length * 11 + 22;
    F.el("rect", { x: s.x + 18, y: 36, width: tw, height: 28, rx: 14, fill: s.col }, g);
    F.el("text", { x: s.x + 29, y: 56, class: "tag", fill: "#fff" }, g).textContent = s.tag;
    F.el("text", { x: s.x + 18, y: 92, class: "b" }, g).textContent = s.t;
    F.chip(s.x + 18, 106, s.add, { parent: g, fill: s.col + "1a", color: s.col, size: 19.5 });
    const gx = s.x + 266, gy = 58;
    if (i === 0) for (let q = 0; q < 5; q++) for (let k = 0; k < 5; k++) F.el("rect", { x: gx + k * 12, y: gy + q * 12, width: 10, height: 10, rx: 1.5, fill: s.col }, g);
    if (i === 1) for (let q = 0; q < 6; q++) for (let k = 0; k < 6; k++) F.el("rect", { x: gx + k * 10, y: gy + q * 10, width: 8.5, height: 8.5, rx: 1.5, fill: (k >> 1) <= (q >> 1) ? s.col : "#e2e8f0" }, g);
    if (i === 2) {
      for (let j = 0; j < 4; j++) F.el("circle", { cx: gx + 8 + j * 17, cy: gy + 12, r: 7, fill: s.col, "fill-opacity": 0.25 + 0.25 * j }, g);
      F.el("path", { d: `M${gx + 59},${gy + 24} C${gx + 59},${gy + 56} ${gx + 8},${gy + 56} ${gx + 8},${gy + 26}`, fill: "none", stroke: s.col, "stroke-width": 2, "marker-end": "url(#a-grad)" }, g);
    }
    if (i === 3) {
      F.el("rect", { x: gx, y: gy, width: 32, height: 22, rx: 6, fill: C.mem }, g); F.el("text", { x: gx + 16, y: gy + 17, "text-anchor": "middle", "font-size": 18, "font-weight": 700, fill: "#fff" }, g).textContent = "W";
      F.el("rect", { x: gx + 40, y: gy, width: 32, height: 22, rx: 6, fill: C.data }, g); F.el("text", { x: gx + 56, y: gy + 17, "text-anchor": "middle", "font-size": 18, "font-weight": 700, fill: "#fff" }, g).textContent = "D";
      F.el("path", { d: `M${gx + 56},${gy + 44} C${gx + 56},${gy + 60} ${gx + 16},${gy + 60} ${gx + 16},${gy + 46}`, fill: "none", stroke: C.grad, "stroke-width": 2, "stroke-dasharray": "5 3", "marker-end": "url(#a-grad)" }, g);
    }
  });
  F.edge("i12", [[386, 94], [422, 94]], { kind: "copy", step: S.rail, from: "s1", to: "s2", draw: [0.2, 0.4] });
  F.edge("i23", [[782, 94], [818, 94]], { kind: "copy", step: S.rail, from: "s2", to: "s3", draw: [0.4, 0.6] });
  F.edge("i34", [[1178, 94], [1214, 94]], { kind: "copy", step: S.rail, from: "s3", to: "s4", draw: [0.6, 0.8] });
  F.edge("i13", [[206, 164], [206, 198], [998, 198], [998, 166]], { kind: "copy", step: S.rail, from: "s1", to: "s3", draw: [0.5, 0.8], label: "the frozen Stage I teacher is the real-score critic", labelAt: [602, 188], r: 8 });

  // ═══ (a) Stages I + II ════════════════════════════════════════════════════════════════
  const ax = 28, ay = 212, A = { w: 560, h: 822 };
  F.node("pa", { x: ax, y: ay, w: A.w, h: A.h, kind: "ink", fill: "#fbfefc", stroke: "#bbf7d0", rx: 22, step: 0, always: true });
  F.text(ax + 22, ay + 38, "(a)  Geometry first, then causality", { cls: "h2" });
  F.img("assets/clip/real_v0_f000_s.jpg", ax + 22, ay + 70, 150, 83, { id: "a-real", step: S.s1, rx: 6, stroke: C.data });
  F.img("assets/clip/hdmap_v0_f000_s.jpg", ax + 190, ay + 70, 150, 83, { id: "a-map", step: S.s1, rx: 6, stroke: C.cond });
  F.text(ax + 97, ay + 178, "real video", { cls: "b", anchor: "middle", fill: C.data, step: S.s1, id: "a-l1" });
  F.text(ax + 265, ay + 178, "layout map", { cls: "b", anchor: "middle", fill: C.cond, step: S.s1, id: "a-l2" });
  F.math("xt", ax + 450, ay + 104, { step: S.s1, id: "m-xt", anchor: "middle" });
  F.math("rf", ax + 286, ay + 196, { step: S.s1, id: "m-rf", anchor: "middle" });
  F.text(ax + 22, ay + 236, "noise level σ per 2-frame chunk", { cls: "b", step: S.s1, id: "a-sgt" });
  const sigAt = (c, k) => 0.12 + 0.85 * hash(c + 1, k);        // one draw per chunk, the same for every camera
  const sigPer = (v, c, k) => 0.12 + 0.85 * hash(c * 7 + v + 13, k);  // the rejected alternative: one draw per camera
  const sg = F.group({ id: "sgrid", step: S.s1 });
  // Ours on the left, the alternative that leaks on the right. The eye compares columns: uniform versus speckled.
  const CW = 22, CPX = 24, CPY = 15, GX = ax + 64, GX2 = ax + 322, GY = ay + 306, BASE = GY - 16, BARH = 26;
  const gridCells = [], leakCells = [], bars = [];
  F.text(ax + 36, BASE - 2, "σ", { cls: "b", anchor: "end", parent: sg, fill: "#0f172a" });
  F.el("line", { x1: GX - 5, x2: GX + 8 * CPX, y1: BASE, y2: BASE, stroke: "#cbd5e1", "stroke-width": 1.2 }, sg);
  for (let c = 0; c < 8; c++) bars.push(F.el("rect", { x: GX + c * CPX, width: CW, rx: 2, fill: "#0f172a", "fill-opacity": 0.75 }, sg));
  for (let v = 0; v < 7; v++) {
    F.el("circle", { cx: GX - 14, cy: GY + v * CPY + 7, r: 5.5, fill: camC[v] }, sg);
    F.el("circle", { cx: GX2 - 14, cy: GY + v * CPY + 7, r: 5.5, fill: camC[v] }, sg);
    for (let c = 0; c < 8; c++) {
      gridCells.push({ v, c, r: F.el("rect", { x: GX + c * CPX, y: GY + v * CPY, width: CW, height: CPY - 2, rx: 2, fill: "#0f172a", "fill-opacity": (sigAt(c, 0) * 0.85).toFixed(3) }, sg) });
      leakCells.push({ v, c, r: F.el("rect", { x: GX2 + c * CPX, y: GY + v * CPY, width: CW, height: CPY - 2, rx: 2, fill: "#0f172a", "fill-opacity": (sigPer(v, c, 0) * 0.85).toFixed(3) }, sg) });
    }
  }
  F.el("rect", { x: GX - 5, y: GY - 5, width: 8 * CPX + 8, height: 7 * CPY + 8, rx: 6, fill: "none", stroke: C.xview, "stroke-width": 2 }, sg);
  F.el("rect", { x: GX2 - 5, y: GY - 5, width: 8 * CPX + 8, height: 7 * CPY + 8, rx: 6, fill: "none", stroke: C.grad, "stroke-width": 2, "stroke-dasharray": "5 4" }, sg);
  F.text(GX, GY - 44, "ours: one draw per chunk", { cls: "xs", parent: sg, fill: C.xview });
  F.text(GX2, GY - 44, "✗ one draw per camera", { cls: "xs", parent: sg, fill: C.grad });
  F.text(GX, GY + 7 * CPY + 26, ["every column one shade:", "all 7 cameras share σ"], { cls: "xs", parent: sg, lh: 17 });
  F.text(GX2, GY + 7 * CPY + 26, ["columns disagree:", "a camera reads a", "cleaner neighbour"], { cls: "xs", parent: sg, lh: 17 });
  F.text(GX + 8 * CPX + 6, BASE, "chunks →", { cls: "xs", parent: sg, id: "a-sgc" });
  F.math("sig_shared", ax + 280, ay + 504, { step: S.s1, id: "m-sig", anchor: "middle" });
  F.el("line", { x1: ax + 22, x2: ax + A.w - 22, y1: ay + 524, y2: ay + 524, stroke: "#d1fae5" }, F.layer);
  const mk = F.group({ id: "morph", step: S.s2 });
  const MC = 14, MX = ax + 26, MY = ay + 562, mcells = [];
  for (let q = 0; q < 8; q++) for (let k = 0; k < 8; k++) mcells.push({ q, k, r: F.el("rect", { x: MX + k * MC, y: MY + q * MC, width: MC - 1.5, height: MC - 1.5, rx: 2, fill: C.data }, mk) });
  const mlab = F.el("text", { x: ax + 168, y: ay + 590, class: "b" }, mk);
  F.text(ax + 168, ay + 620, ["same weights, same loss,", "only the mask changes"], { cls: "xs", parent: mk, lh: 19 });
  F.chip(ax + 168, ay + 656, "all weights inherited", { parent: mk, fill: "#dbeafe", color: "#1e40af", size: 19.5 });
  F.node("tip-a", { x: ax + 22, y: ay + 724, w: A.w - 44, h: 70, kind: "xview", title: "Why two stages?", sub: "learning both at once did not converge", step: S.s2, tcls: "b" });

  // ═══ (b) Stage III ════════════════════════════════════════════════════════════════════
  const bx = 616, by = 212, B = { w: 956, h: 822 };
  F.node("pb", { x: bx, y: by, w: B.w, h: B.h, kind: "ink", fill: "#fffbfb", stroke: "#fecaca", rx: 22, step: 0, always: true });
  F.text(bx + 22, by + 38, "(b)  Stage III · train on your own rollout", { cls: "h2" });
  const rollG = F.group({ id: "roll", step: S.roll });
  const CX0 = bx + 172, PITCH = 128, EXIT = [1, 3, 2, 3, 1, 2], FRM = [4, 12, 20, 28, 36, 44], chunkG = [];
  F.text(bx + 22, by + 220, "passes", { cls: "b", parent: rollG });
  F.text(bx + 22, by + 266, "KV write", { cls: "b", parent: rollG, fill: C.mem });
  const dotAt = (g, cx, cy, j, mode) => {
    if (mode === "skip") { F.el("circle", { cx, cy, r: 11, fill: "#fff", stroke: "#cbd5e1", "stroke-width": 1.8 }, g); F.el("path", { d: `M${cx - 5},${cy} H${cx + 5}`, stroke: "#94a3b8", "stroke-width": 2.4, "stroke-linecap": "round" }, g); return; }
    F.el("circle", { cx, cy, r: 11, fill: mode === "exit" ? C.grad : "#cbd5e1" }, g);
    F.el("text", { x: cx, y: cy + 5, "text-anchor": "middle", "font-size": 18, "font-weight": 800, fill: mode === "exit" ? "#fff" : "#334155" }, g).textContent = String(j + 1);
  };
  for (let i = 0; i < 6; i++) {
    const x = CX0 + i * PITCH, g = F.el("g", {}, rollG);
    chunkG.push(g);
    F.img(`assets/clip/gen_v0_f${pad3(FRM[i])}_s.jpg`, x, by + 98, 108, 60, { parent: g, rx: 6 });
    F.el("text", { x: x + 54, y: by + 182, "text-anchor": "middle", class: "xs" }, g).textContent = `chunk ${i + 1}`;
    for (let j = 0; j < 4; j++) dotAt(g, x + 54 + (j - 1.5) * 28, by + 216, j, j < EXIT[i] ? "run" : j === EXIT[i] ? "exit" : "skip");
    F.el("rect", { x: x + 13, y: by + 250, width: 82, height: 26, rx: 7, fill: C.mem }, g);
    F.el("text", { x: x + 54, y: by + 269, "text-anchor": "middle", "font-size": 19, "font-weight": 700, fill: "#fff" }, g).textContent = "KV write";
    if (i < 5) F.el("path", { d: `M${x + 97},${by + 263} H${x + PITCH + 11}`, stroke: C.mem, "stroke-width": 2.4, "marker-end": "url(#a-mem)" }, g);
  }
  {
    const brk = (a, b, col, label) => {
      F.el("path", { d: `M${a},${by + 92} V${by + 85} H${b} V${by + 92}`, fill: "none", stroke: col, "stroke-width": 2 }, rollG);
      F.el("text", { x: (a + b) / 2, y: by + 72, "text-anchor": "middle", class: "xs", fill: col }, rollG).textContent = label;
    };
    brk(CX0, CX0 + 2 * PITCH + 108, "#64748b", "history: no gradient");
    brk(CX0 + 3 * PITCH, CX0 + 5 * PITCH + 108, C.grad, "last chunks keep gradient");
    const ly = by + 318; let lx = CX0;
    [["run", "pass, no gradient", 0], ["exit", "exit pass: carries gradient", 1], ["skip", "not run", 2]].forEach(([m, t]) => {
      dotAt(rollG, lx + 11, ly - 6, m === "skip" ? 0 : m === "exit" ? 1 : 0, m);
      F.text(lx + 32, ly, t, { cls: "xs", parent: rollG }); lx += 58 + t.length * 10.6;
    });
  }
  const mCtx = F.group({ id: "rollmath", step: S.roll });
  F.math("ctxnoise", CX0 + 190, by + 372, { parent: mCtx, anchor: "middle" });
  F.math("ctxwrite", CX0 + 540, by + 372, { parent: mCtx, anchor: "middle" });
  F.el("line", { x1: bx + 22, x2: bx + B.w - 22, y1: by + 420, y2: by + 420, stroke: "#fecaca" }, F.layer);
  // critics and distribution matching
  const y0 = by + 450;
  F.node("gen", { x: bx + 22, y: y0, w: 176, h: 60, kind: "data", title: "generator G", sub: "1 – 4 steps", icon: "train", step: S.dmd });
  F.node("noise", { x: bx + 214, y: y0, w: 190, h: 60, kind: "ink", title: "re-noise", sub: "random level σ", step: S.dmd });
  F.node("real", { x: bx + 450, y: y0 - 14, w: 238, h: 60, kind: "frozen", title: "real score", sub: "frozen teacher + CFG", icon: "lock", step: S.dmd });
  F.node("fake", { x: bx + 450, y: y0 + 66, w: 238, h: 60, kind: "data", title: "fake score", sub: "tracks G", icon: "train", step: S.dmd });
  F.edge("g-n", [[bx + 182, y0 + 30], [bx + 212, y0 + 30]], { kind: "data", step: S.dmd, from: "gen", to: "noise", draw: [0, 0.2] });
  F.edge("n-r", [[bx + 406, y0 + 30], [bx + 428, y0 + 30], [bx + 428, y0 + 16], [bx + 448, y0 + 16]], { kind: "data", step: S.dmd, from: "noise", to: "real", draw: [0.2, 0.4], r: 6 });
  F.edge("n-f", [[bx + 428, y0 + 30], [bx + 428, y0 + 96], [bx + 448, y0 + 96]], { kind: "data", step: S.dmd, from: "noise", to: "fake", draw: [0.2, 0.4], r: 6 });
  F.math("dmdg", bx + 826, y0 + 36, { step: S.dmd, id: "m-g", anchor: "middle" });
  F.math("dmdl", bx + 820, y0 + 116, { step: S.dmd, id: "m-lg", anchor: "middle" });
  F.edge("r-g", [[bx + 690, y0 + 16], [bx + 700, y0 + 16], [bx + 692, y0 + 26], [bx + 726, y0 + 26]], { kind: "data", step: S.dmd, from: "real", to: "m-g", draw: [0.4, 0.55], r: 4 });
  F.edge("f-g", [[bx + 690, y0 + 96], [bx + 700, y0 + 96], [bx + 692, y0 + 46], [bx + 726, y0 + 46]], { kind: "data", step: S.dmd, from: "fake", to: "m-g", draw: [0.4, 0.55], r: 6 });
  F.edge("g-back", [[bx + 820, y0 + 140], [bx + 820, y0 + 172], [bx + 97, y0 + 172], [bx + 97, y0 + 64]], { kind: "grad", step: S.dmd, from: "m-lg", to: "gen", draw: [0.55, 0.95], r: 10, label: "gradient updates G", labelAt: [bx + 440, y0 + 166] });
  const den = F.group({ id: "dens", step: S.dmd });
  const DX0 = bx + 330, DY0 = by + 716, DWd = 300, DH = 44;
  F.el("line", { x1: DX0, y1: DY0, x2: DX0 + DWd, y2: DY0, stroke: "#94a3b8" }, den);
  const gauss = (mu, s) => Array.from({ length: 91 }, (_, i) => { const x = i / 90; return [DX0 + x * DWd, DY0 - DH * Math.exp(-((x - mu) ** 2) / (2 * s * s))]; });
  const pth = (pts) => "M" + pts.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" L");
  F.el("path", { d: pth(gauss(0.7, 0.09)), fill: "none", stroke: "#475569", "stroke-width": 2.6 }, den);
  F.el("path", { d: pth(gauss(0.28, 0.07)), fill: "none", stroke: C.data, "stroke-width": 1.6, "stroke-dasharray": "4 4", "stroke-opacity": 0.45 }, den);   // where the generator started
  const fakeCurve = F.el("path", { fill: "none", stroke: C.data, "stroke-width": 2.6 }, den);
  const fakeLab = F.el("text", { y: DY0 - DH - 10, "text-anchor": "end", class: "xs", fill: C.data }, den); fakeLab.textContent = "generated";
  F.el("text", { x: DX0 + DWd * 0.7 + 6, y: DY0 - DH - 10, class: "xs", fill: "#475569" }, den).textContent = "real";
  F.text(bx + 22, DY0 - 14, ["the generated distribution", "moves onto the real one"], { cls: "xs", parent: den, lh: 19 });
  F.node("tip-b", { x: bx + 22, y: by + 740, w: B.w - 44, h: 68, kind: "grad", title: "Why on its own rollouts?", sub: "training sees the same imperfect history as inference", step: S.dmd, tcls: "b" });

  F.legend(28, 1052, [["data", "forward"], ["grad", "gradient"], ["mem", "memory (KV)"], ["copy", "weights inherited"], ["frozen", "frozen", "lock"], ["frozen", "trained", "flame"]]);
  F.pulse("g-n", S.dmd, { t0: 0, t1: 0.2, to: "noise" });
  F.pulse("n-r", S.dmd, { t0: 0.2, t1: 0.4, to: "real" }); F.pulse("n-f", S.dmd, { t0: 0.2, t1: 0.4, to: "fake" });
  F.pulse("r-g", S.dmd, { t0: 0.4, t1: 0.55 }); F.pulse("f-g", S.dmd, { t0: 0.4, t1: 0.55 });
  F.pulse("g-back", S.dmd, { t0: 0.55, t1: 0.95, to: "gen" });

  // ═══ mechanics: animation and paper figure share the same end state ══════════════════
  F.hook(({ s, p, isStatic, t }) => {
    const k = s === S.s1 && !isStatic && p < 0.85 ? Math.floor(t * 1.4) + 1 : 0;   // resample while playing, settle on the paper field
    gridCells.forEach((c) => c.r.setAttribute("fill-opacity", (sigAt(c.c, k) * 0.85).toFixed(3)));
    leakCells.forEach((c) => c.r.setAttribute("fill-opacity", (sigPer(c.v, c.c, k) * 0.85).toFixed(3)));
    bars.forEach((b, c) => { const h = BARH * sigAt(c, k); b.setAttribute("y", (BASE - h).toFixed(1)); b.setAttribute("height", h.toFixed(1)); });
    const m = isStatic ? 1 : s === S.s2 ? ease(clamp01((p - 0.25) / 0.45)) : s > S.s2 ? 1 : 0;
    mcells.forEach((c) => { const future = (c.k >> 1) > (c.q >> 1); c.r.setAttribute("fill", future && m > 0.5 ? "#e2e8f0" : C.data); c.r.setAttribute("opacity", future ? (1 - m * 0.6).toFixed(2) : 1); });
    mlab.textContent = m > 0.5 ? "Stage II: block-causal attention" : "Stage I: full attention";
    const nChunks = isStatic ? 6 : s === S.roll ? Math.min(6, Math.ceil(clamp01(p / 0.9) * 6)) : s > S.roll ? 6 : 0;
    chunkG.forEach((g, i) => g.setAttribute("opacity", i < nChunks ? 1 : 0.12));
    const prog = isStatic ? 0.95 : s === S.dmd ? ease(p) * 0.95 : s > S.dmd ? 0.95 : 0;
    const mu = 0.28 + 0.42 * prog, sd = 0.07 + 0.02 * prog;
    fakeCurve.setAttribute("d", pth(gauss(mu, sd)));
    fakeLab.setAttribute("x", DX0 + DWd * mu - 8);
  });

  const steps = [
    { short: "Overview", dur: 5, focus: ["s1", "s2", "s3", "s4", "i12", "i23", "i34", "i13"], title: "Four stages, weights flow forward",
      text: "Every stage starts from the previous one and adds one capability. The Stage I teacher is reused twice: as the initial weights of the causal student, and as the frozen critic that judges the few-step generator." },
    { short: "Stage I", dur: 6.5, focus: ["s1", "pa", "a-real", "a-map", "a-l1", "a-l2", "m-xt", "a-sgt", "sgrid", "m-sig", "m-rf"], title: "Stage I: one noise level per chunk, shared by all cameras",
      text: "Real video and its layout map are mixed with noise and the network regresses the velocity ε − <i>x</i><sub>0</sub>. Each two-frame chunk gets its own σ, but every camera shares it. Draw σ per camera instead (right) and the columns disagree: a camera can read a cleaner neighbour through cross-view attention and never learn the geometry." },
    { short: "Stage II", dur: 5.5, focus: ["s2", "pa", "morph", "tip-a", "i12"], title: "Stage II: the same model learns to stop looking ahead",
      text: "Stage II loads all weights of the trained teacher and only changes the attention mask from full to block-causal. Starting from a single-camera model had to learn geometry and causality at once, and did not converge." },
    { short: "Rollout", dur: 8, focus: ["s3", "pb", "roll", "rollmath"], title: "Stage III: generate the way it will be used",
      text: "The generator denoises one chunk at a time. A random pass is the exit step: only it carries gradient, and only the last chunks keep autograd. Each finished chunk is re-noised, run once more and written to the KV memory, so later chunks see exactly the history noise they saw while denoising." },
    { short: "Distil", dur: 7, focus: ["pb", "gen", "noise", "real", "fake", "g-n", "n-r", "n-f", "r-g", "f-g", "m-g", "m-lg", "g-back", "dens", "tip-b"], title: "Distribution matching moves the generator onto the data",
      text: "The rollout is re-noised and judged by two copies of the Stage I teacher. Their difference is a direction that moves generated samples toward real ones; a stop-gradient loss turns it into an update of G. Guidance is baked into G, so inference needs one pass per step." },
  ];
  return { title: "Training I–III", steps, caption: "<b>Figure 2 · Training, Stages I – III.</b> Each stage adds one capability: (I) 7-camera geometry and layout control with full attention and one noise level per chunk shared by all cameras, (II) causality from the same weights, (III) few-step generation distilled on the model's own chunk-wise rollouts, where a random exit pass carries gradient and every finished chunk is re-noised and written to the KV memory. Stage IV continues in Figure 3." };
});
