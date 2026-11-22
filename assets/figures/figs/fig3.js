/* Figure 3 · Training, Stage IV: Antiphon Forcing */
BD.figure("fig3", (F, BD) => {
  const { C, pad3, lerp, ease, clamp01 } = BD;
  const D = window.HIW_DATA;
  const S = { call: 0, answer: 1, why: 2, dist: 3, hor: 4, path: 5 };

  // ═══ A · the call and the response ════════════════════════════════════════════════════
  const A = { x: 28, y: 24, w: 1544, h: 420 };
  F.node("pa", { x: A.x, y: A.y, w: A.w, h: A.h, kind: "mem", fill: "#fcfbff", stroke: "#ddd6fe", rx: 22, step: 0, always: true });
  F.text(50, 64, "Stage IV · Antiphon Forcing", { cls: "h" });
  F.text(50, 92, "the writer calls, the denoiser answers — each memory write is trained by its answer", { cls: "s" });
  const cA = 170, cB = 420, cC = 690, FR = [76, 84, 92];
  [cA, cB, cC].forEach((c, i) => {
    F.img(`assets/clip/gen_v0_f${pad3(FR[i])}_s.jpg`, c - 75, 118, 150, 83, { id: `im${i}`, step: S.call, rx: 6, stroke: i === 2 ? C.data : C.mem, sw: 2 });
    F.text(c, 222, ["chunk k − 2", "chunk k − 1", "chunk k"][i], { cls: "xs", anchor: "middle", step: S.call, id: `imt${i}` });
  });
  F.node("wA", { x: cA - 70, y: 240, w: 140, h: 40, kind: "mem", title: "writer", tcls: "b", ty: 266, step: S.call });
  F.node("wB", { x: cB - 70, y: 240, w: 140, h: 40, kind: "mem", title: "writer", tcls: "b", ty: 266, step: S.call });
  F.node("dC", { x: cC - 70, y: 240, w: 140, h: 40, kind: "data", title: "denoiser", tcls: "b", ty: 266, step: S.call });
  F.node("sC", { x: cC + 140, y: 240, w: 130, h: 40, kind: "grad", title: "score S", tcls: "b", ty: 266, step: S.call });
  F.node("mA", { x: cA - 70, y: 314, w: 140, h: 36, kind: "mem", title: "memory K, V", tcls: "xs", ty: 337, step: S.call, fill: "#ede9fe" });
  F.node("mB", { x: cB - 70, y: 314, w: 140, h: 36, kind: "mem", title: "memory K, V", tcls: "xs", ty: 337, step: S.call, fill: "#ede9fe" });
  F.edge("w-mA", [[cA - 30, 282], [cA - 30, 312]], { kind: "mem", step: S.call, from: "wA", to: "mA", draw: [0, 0.2] });
  F.edge("w-mB", [[cB - 30, 282], [cB - 30, 312]], { kind: "mem", step: S.call, from: "wB", to: "mB", draw: [0, 0.2] });
  F.edge("m-d", [[cA - 30, 352], [cA - 30, 376], [cC - 30, 376], [cC - 30, 282]], { kind: "mem", step: S.call, from: "mA", to: "dC", draw: [0.2, 0.55], r: 8 });
  F.edge("mb-d", [[cB - 30, 352], [cB - 30, 376]], { kind: "mem", step: S.call, from: "mB", to: "dC", draw: [0.3, 0.45], head: false });
  F.edge("d-s", [[cC + 72, 278], [cC + 138, 278]], { kind: "data", step: S.call, from: "dC", to: "sC", draw: [0.55, 0.7] });
  F.edge("s-d", [[cC + 138, 254], [cC + 72, 254]], { kind: "grad", step: S.answer, from: "sC", to: "dC", draw: [0, 0.15] });
  F.edge("d-bus", [[cC + 30, 282], [cC + 30, 402], [cA + 30, 402], [cA + 30, 352]], { kind: "grad", step: S.answer, from: "dC", to: "mA", draw: [0.1, 0.55], r: 8 });
  F.edge("bus-b", [[cB + 30, 402], [cB + 30, 352]], { kind: "grad", step: S.answer, from: "dC", to: "mB", draw: [0.5, 0.6] });
  F.edge("mA-w", [[cA + 30, 312], [cA + 30, 282]], { kind: "grad", step: S.answer, from: "mA", to: "wA", draw: [0.6, 0.75] });
  F.edge("mB-w", [[cB + 30, 312], [cB + 30, 282]], { kind: "grad", step: S.answer, from: "mB", to: "wB", draw: [0.6, 0.75] });
  F.text(50, 428, "gradients of K and V flow back into the writer passes, one chunk at a time", { cls: "xs", step: S.answer, id: "a-note", fill: C.grad });
  F.math("inject", 905, 340, { step: S.answer, id: "m-inj", anchor: "middle" });
  F.text(905, 378, "surrogate that carries the K, V gradient", { cls: "xs", step: S.answer, id: "m-inj-l", anchor: "middle" });

  // right: one frozen model, two roles, and the evidence that they disagree
  F.el("line", { x1: 1058, x2: 1058, y1: 52, y2: 428, stroke: "#ddd6fe" }, F.layer);
  const RX = 1082;
  F.text(RX, 64, "One frozen model, two adapters", { cls: "b", step: S.answer, id: "r-t" });
  F.node("base", { x: RX, y: 82, w: 172, h: 66, kind: "frozen", title: "base model", sub: "frozen", icon: "lock", step: S.answer });
  F.node("rW", { x: RX + 180, y: 82, w: 170, h: 30, kind: "mem", title: "writer adapter", tcls: "xs", ty: 103, step: S.answer, rx: 10 });
  F.node("rD", { x: RX + 180, y: 118, w: 184, h: 30, kind: "data", title: "denoiser adapter", tcls: "xs", ty: 139, step: S.answer, rx: 10 });
  F.math("roles", RX + 230, 182, { step: S.answer, id: "m-roles", anchor: "middle" });
  {
    const PL = { x: RX + 34, y: 232, w: 330, h: 118 };
    const pg = F.group({ id: "plot", step: S.why });
    const cosv = D.sgf_log.roles_cosine, n = cosv.length, lo = -0.32, hi = 0.06;
    const X = (i) => PL.x + (i / (n - 1)) * PL.w, Y = (v) => PL.y + ((hi - v) / (hi - lo)) * PL.h;
    F.text(RX, 218, "do the two roles want the same update?", { cls: "xs", parent: pg });
    F.el("rect", { x: PL.x, y: PL.y, width: PL.w, height: PL.h, fill: "#fff", stroke: "#e2e8f0" }, pg);
    F.el("rect", { x: PL.x, y: Y(0), width: PL.w, height: PL.y + PL.h - Y(0), fill: C.grad, "fill-opacity": 0.06 }, pg);   // every update lands in here
    F.el("line", { x1: PL.x, x2: PL.x + PL.w, y1: Y(0), y2: Y(0), stroke: "#0f172a", "stroke-dasharray": "4 3" }, pg);
    for (const v of [0, -0.3]) F.el("text", { x: PL.x - 6, y: Y(v) + 5, "text-anchor": "end", class: "xs" }, pg).textContent = v.toFixed(1);
    cosv.forEach((v, i) => F.el("circle", { cx: X(i), cy: Y(v), r: 1.6, fill: "#94a3b8" }, pg));
    const half = 7, ma = cosv.map((_, i) => { const a = Math.max(0, i - half), b = Math.min(n, i + half + 1); let s = 0; for (let j = a; j < b; j++) s += cosv[j]; return s / (b - a); });
    F.el("path", { d: ma.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" "), fill: "none", stroke: C.grad, "stroke-width": 2.8 }, pg);
    F.text(PL.x + PL.w / 2, PL.y + PL.h + 22, "training update →", { cls: "xs", parent: pg, anchor: "middle" });
    F.math("cosine", RX + 230, 408, { parent: pg, anchor: "middle", s: 0.95 });
  }

  // ═══ B · two balanced columns ═════════════════════════════════════════════════════════
  const BY = 466, BH = 380;
  const panel = (id, x, w, n, a, b, step) => {
    F.node(id, { x, y: BY, w, h: BH, kind: "ink", fill: "#fff", stroke: "#e2e8f0", rx: 22, step, always: true });
    const g = F.group({ id: id + "-h", step });
    F.el("circle", { cx: x + 38, cy: BY + 40, r: 16, fill: C.grad }, g);
    F.el("text", { x: x + 38, y: BY + 46, "text-anchor": "middle", "font-size": 21, "font-weight": 800, fill: "#fff" }, g).textContent = n;
    F.text(x + 66, BY + 36, a, { cls: "b", parent: g });
    F.text(x + 66, BY + 60, b, { cls: "b", parent: g, fill: C.mem });
  };
  // column 2: distribution-level objective
  const X2 = 28;
  panel("pb2", X2, 760, "2", "Per-sample regression blurs", "→ match distributions with a kernel score", S.dist);
  F.node("dino", { x: X2 + 22, y: BY + 92, w: 200, h: 66, kind: "frozen", title: "DINO", sub: "16×30 patches × 4", icon: "lock", step: S.dist, scls: "xs" });
  F.node("jepa", { x: X2 + 238, y: BY + 92, w: 214, h: 66, kind: "frozen", title: "V-JEPA", sub: "8×8×16 video tokens", icon: "lock", step: S.dist, scls: "xs" });
  F.node("lay", { x: X2 + 454, y: BY + 92, w: 300, h: 66, kind: "cond", step: S.dist });
  {
    const g = F.byId.lay.g;
    F.img("assets/clip/hdmap_v0_f092_s.jpg", X2 + 464, BY + 102, 92, 51, { parent: g, rx: 4 });
    F.text(X2 + 570, BY + 124, "layout branch", { cls: "b", parent: g });
    F.text(X2 + 570, BY + 146, "HDMap support", { cls: "xs", parent: g });
  }
  {
    const g = F.group({ id: "wchips", step: S.dist });
    F.text(X2 + 22, BY + 190, "branch weights", { cls: "xs", parent: g });
    let x = X2 + 210;
    [["dino 4", "#dbeafe", "#1e40af"], ["layout 3", "#fef3c7", "#92400e"], ["jepa 1", "#e2e8f0", "#334155"], ["color 0.1", "#f1f5f9", "#334155"]].forEach(([t, bg, fg]) => { const c = F.chip(x, BY + 172, t, { parent: g, fill: bg, color: fg, size: 19.5, mono: true }); x += c.chipW + 8; });
  }
  const fsG = F.group({ id: "fspace", step: S.dist });
  const FS = { x: X2 + 22, y: BY + 212, w: 330, h: 140 };
  F.el("rect", { x: FS.x, y: FS.y, width: FS.w, height: FS.h, rx: 14, fill: "#f8fafc", stroke: "#e2e8f0" }, fsG);
  const star = [FS.x + 230, FS.y + 58];
  const starPath = (cx, cy, R, r) => { let d = ""; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R; d += `${i ? "L" : "M"}${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`; } return d + "Z"; };
  F.el("path", { d: starPath(star[0], star[1], 12, 5.4), fill: "#f59e0b", stroke: "#b45309" }, fsG);
  F.el("text", { x: star[0] - 6, y: star[1] + 34, class: "xs" }, fsG).textContent = "real clip";
  const dots = Array.from({ length: 4 }, (_, i) => ({ a: (i / 4) * 6.28 + 0.5, e: F.el("circle", { r: 7, fill: C.data, stroke: "#fff", "stroke-width": 1.5 }, fsG) }));
  const pulls = dots.map(() => F.el("line", { stroke: "#b45309", "stroke-width": 1.2, "stroke-dasharray": "3 3" }, fsG));
  F.el("text", { x: FS.x + 12, y: FS.y + FS.h - 12, class: "xs" }, fsG).textContent = "seeds: pulled in, pushed apart";
  F.math("kern", X2 + 560, BY + 246, { step: S.dist, id: "m-kern", anchor: "middle" });
  F.math("score", X2 + 560, BY + 320, { step: S.dist, id: "m-score", anchor: "middle" });
  // column 3: replay pool, exact rebase, aligned control
  const X3 = 812;
  panel("pb3", X3, 760, "3", "Train horizon ≪ inference horizon", "→ replay pool and an exact rebase of positions", S.hor);
  const TX = X3 + 50, TS = 5.9, fx = (f) => TX + f * TS;
  const tl = F.group({ id: "tline", step: S.hor });
  F.text(TX, BY + 100, "training rollout: 48 latent frames", { cls: "xs", parent: tl });
  const bar1 = F.el("rect", { x: TX, y: BY + 108, width: 48 * TS, height: 24, rx: 6, fill: C.data }, tl);
  F.text(TX, BY + 164, "replay: continue from a stored state at p", { cls: "xs", parent: tl, fill: C.mem });
  F.el("rect", { x: fx(30), y: BY + 172, width: 6 * TS, height: 24, rx: 6, fill: "#c4b5fd" }, tl);
  const bar2 = F.el("rect", { x: fx(36), y: BY + 172, height: 24, rx: 6, fill: C.cond }, tl);
  F.text(fx(30) - 4, BY + 214, "memory rebuilt", { cls: "xs", parent: tl, fill: C.mem });
  F.text(TX, BY + 252, "after the exact rebase: positions restart", { cls: "xs", parent: tl });
  const bar3 = F.el("rect", { x: TX, y: BY + 260, height: 24, rx: 6, fill: C.cond }, tl);
  [0, 24, 48].forEach((f) => { F.el("line", { x1: fx(f), x2: fx(f), y1: BY + 288, y2: BY + 296, stroke: "#475569", "stroke-width": 1.6 }, tl); F.el("text", { x: fx(f), y: BY + 314, "text-anchor": "middle", class: "xs" }, tl).textContent = String(f); });
  // the train horizon, carried down the three bars: the replay bar is the only one that passes it
  F.el("line", { x1: fx(48), x2: fx(48), y1: BY + 132, y2: BY + 288, stroke: C.grad, "stroke-width": 1.4, "stroke-dasharray": "5 4" }, tl);
  F.text(fx(48) + 8, BY + 126, "train horizon", { cls: "xs", parent: tl, fill: C.grad });
  [0, 1, 2, 3, 4, 5].forEach((i) => F.img(`assets/clip/hdmap_v0_f${["000", "092", "188", "380", "092", "188"][i]}_s.jpg`, fx(0) + i * 8 * TS, BY + 322, 8 * TS - 3, 22, { parent: tl, rx: 2 }));
  F.text(fx(48) + 14, BY + 340, "layout stays aligned", { cls: "xs", parent: tl, fill: C.cond });
  F.math("rebase", X3 + 200, BY + 360, { step: S.hor, id: "m-rb", anchor: "middle", s: 0.8 });
  F.math("kcache", X3 + 440, BY + 360, { step: S.hor, id: "m-kc", anchor: "middle", s: 0.8 });
  const phG = F.group({ id: "phasor", step: S.hor });
  const PO = [X3 + 668, BY + 226], PR = 52;
  F.el("circle", { cx: PO[0], cy: PO[1], r: PR, fill: "#f5f3ff", stroke: "#ddd6fe", "stroke-width": 1.5 }, phG);
  const qL = F.el("line", { x1: PO[0], y1: PO[1], stroke: C.data, "stroke-width": 3.4, "stroke-linecap": "round", "marker-end": "url(#a-data)" }, phG);
  const kL = F.el("line", { x1: PO[0], y1: PO[1], stroke: C.mem, "stroke-width": 3.4, "stroke-linecap": "round", "marker-end": "url(#a-mem)" }, phG);
  F.text(PO[0] - 56, BY + 306, "query", { cls: "xs", parent: phG, fill: C.data });
  F.text(PO[0] + 14, BY + 306, "key", { cls: "xs", parent: phG, fill: C.mem });
  F.text(PO[0], BY + 100, ["angle between", "q and k unchanged"], { cls: "xs", parent: phG, anchor: "middle", lh: 18 });

  // ═══ C · gradient path ═════════════════════════════════════════════════════════════════
  // Two lanes, never crossing: the forward chain runs above the boxes, the gradient returns below them.
  // The one thing to see is that the red lane does not stop at the denoiser — it reaches the writer.
  const CY = 866, CH = 177;
  F.node("pc", { x: 28, y: CY, w: 1544, h: CH, kind: "ink", fill: "#fffafa", stroke: "#fecaca", rx: 22, step: S.path, always: true });
  F.text(50, CY + 36, "Gradient path of one update", { cls: "h2", step: S.path, id: "pc-t" });
  F.text(1550, CY + 36, "the gradient reaches the writer", { cls: "s", anchor: "end", step: S.path, id: "pc-new", fill: C.grad });
  const NW = 170, GAP = 50, NX0 = 55, NY = CY + 62, NH = 48, FY = NY - 12, GY2 = NY + NH + 12;
  { // two domains behind the chain; the decoder is the only crossing
    const g = F.group({ id: "pc-domains", step: S.path }), xb = NX0 + 4 * (NW + GAP) - GAP / 2, y0 = CY + 44, h = CH - 52;
    F.el("rect", { x: 40, y: y0, width: xb - 44, height: h, rx: 14, fill: "#eff6ff" }, g);
    F.el("rect", { x: xb + 4, y: y0, width: 1560 - xb - 4, height: h, rx: 14, fill: "#f1f5f9" }, g);
    F.text(540, CY + 36, "LATENT SPACE", { cls: "tag", parent: g, fill: C.data });
    F.text(xb + 20, CY + 36, "DECODED PIXELS", { cls: "tag", parent: g, fill: C.frozen });
  }
  const CH_ = [["Writer", "mem", "commits memory"], ["Memory", "mem", "keys and values"], ["Denoiser", "data", "denoising passes"],
               ["Latents", "ink", "generated video"], ["Decoder", "frozen", ""], ["Encoders", "frozen", "DINO, V-JEPA"], ["Score S", "grad", "kernel score"]];
  CH_.forEach(([t, kind, sub], i) => {
    const x = NX0 + i * (NW + GAP), id = `c${i}`;
    F.node(id, { x, y: NY, w: NW, h: NH, kind, title: t, tcls: "b", ty: NY + 31, step: S.path, stroke: i === 4 ? C.grad : undefined, icon: i === 5 ? "lock" : undefined });
    if (sub) F.text(x + NW / 2, NY + NH + 54, sub, { cls: "xs", anchor: "middle", step: S.path, id: `c${i}t` });
    if (i < 6) {
      F.edge(`cf${i}`, [[x + NW + 2, FY], [x + NW + GAP - 2, FY]], { kind: i === 0 ? "mem" : "data", step: S.path, from: id, to: `c${i + 1}`, draw: [i * 0.07, i * 0.07 + 0.1] });
      F.edge(`cg${i}`, [[x + NW + GAP - 2, GY2], [x + NW + 2, GY2]], { kind: "grad", step: S.path, from: `c${i + 1}`, to: id, sw: i < 2 ? 3.4 : undefined, draw: [0.45 + (5 - i) * 0.08, 0.55 + (5 - i) * 0.08] });
    }
  });
  F.math("vjp", NX0 + 4 * (NW + GAP) + NW / 2, NY + NH + 46, { step: S.path, id: "m-vjp", anchor: "middle", s: 0.9 });

  // pulses
  F.pulse("w-mA", S.call, { t0: 0, t1: 0.2, kind: "mem" }); F.pulse("w-mB", S.call, { t0: 0, t1: 0.2, kind: "mem" });
  F.pulse("m-d", S.call, { t0: 0.2, t1: 0.55, kind: "mem", to: "dC" });
  F.pulse("d-s", S.call, { t0: 0.55, t1: 0.7, to: "sC" });
  F.pulse("s-d", S.answer, { t0: 0, t1: 0.15, to: "dC" });
  F.pulse("d-bus", S.answer, { t0: 0.1, t1: 0.55, to: "mA" });
  F.pulse("mA-w", S.answer, { t0: 0.6, t1: 0.75, to: "wA" }); F.pulse("mB-w", S.answer, { t0: 0.6, t1: 0.75, to: "wB" });
  for (let i = 0; i < 6; i++) F.pulse(`cg${i}`, S.path, { t0: 0.45 + (5 - i) * 0.08, t1: 0.55 + (5 - i) * 0.08, kind: "grad", to: `c${i}` });

  // ═══ mechanics ══════════════════════════════════════════════════════════════════════════
  F.hook(({ s, p, isStatic, t }) => {
    const fp = isStatic ? 1 : s === S.dist ? ease(p) : s > S.dist ? 1 : 0;
    dots.forEach((d, i) => {
      const rad = lerp(44, 28, fp), ang = d.a + (isStatic ? 0 : t * 0.35);
      const x = lerp(star[0] - 130, star[0] - 30, fp) + rad * Math.cos(ang) * 0.9, y = star[1] + 0.62 * rad * Math.sin(ang);
      d.e.setAttribute("cx", x); d.e.setAttribute("cy", y);
      pulls[i].setAttribute("x1", x); pulls[i].setAttribute("y1", y); pulls[i].setAttribute("x2", star[0]); pulls[i].setAttribute("y2", star[1]);
    });
    const q = isStatic ? 1 : s === S.hor ? ease(clamp01(p / 0.7)) : s > S.hor ? 1 : 0;
    bar1.setAttribute("opacity", 1);
    bar2.setAttribute("width", (fx(84) - fx(36)) * q);
    bar3.setAttribute("width", 48 * TS * q);
    const back = isStatic ? 1 : s === S.hor ? ease(clamp01((p - 0.5) / 0.4)) : s > S.hor ? 1 : 0;
    const base = -2.2 + 1.9 * back, d = 0.9, R = PR - 8;
    qL.setAttribute("x2", PO[0] + R * Math.cos(base)); qL.setAttribute("y2", PO[1] + R * Math.sin(base));
    kL.setAttribute("x2", PO[0] + R * Math.cos(base - d)); kL.setAttribute("y2", PO[1] + R * Math.sin(base - d));
  });

  const steps = [
    { short: "Call", dur: 7, focus: ["pa", "im0", "im1", "im2", "imt0", "imt1", "imt2", "wA", "wB", "dC", "sC", "mA", "mB", "w-mA", "w-mB", "m-d", "mb-d", "d-s"], title: "The writer calls: every chunk is written into memory",
      text: "To generate chunk k the denoiser reads the memory that the writer passes of the chunks before it have written. The score S judges the result. Until now only the denoiser's output was supervised: how memory was written received no gradient at all." },
    { short: "Answer", dur: 8, focus: ["pa", "dC", "sC", "mA", "mB", "wA", "wB", "s-d", "d-bus", "bus-b", "mA-w", "mB-w", "a-note", "m-inj", "m-inj-l", "r-t", "base", "rW", "rD", "m-roles"], title: "The denoiser answers: its gradient trains the writer",
      text: "Two low-rank adapters on one frozen model: a <b>writer</b> for memory commits and a <b>denoiser</b> for denoising steps. The score is back-propagated through the denoiser first. The gradient on the earlier keys and values is then injected into the writer passes, replayed chunk by chunk, so the model learns what to remember." },
    { short: "Evidence", dur: 6, focus: ["plot", "r-t", "base", "rW", "rD", "m-roles"], title: "Evidence: the two roles want different updates",
      text: "In the real training run the gradients of the writer and the denoiser pointed in opposite directions at every update. One shared adapter would be pulled two ways at once; two adapters let each role learn its own job." },
    { short: "Distribution", dur: 7, focus: ["pb2", "pb2-h", "dino", "jepa", "lay", "wchips", "fspace", "m-kern", "m-score"], title: "Match distributions, not single samples",
      text: "Several independent seeds are generated under the same condition. A multi-scale kernel score attracts them to the paired real clip and repels them from each other, on frozen DINO and V-JEPA features and on the HDMap support. No paired future is needed, and appearance, motion and layout are constrained together." },
    { short: "Horizon", dur: 8, focus: ["pb3", "pb3-h", "tline", "m-rb", "m-kc", "phasor"], title: "Train beyond the training horizon",
      text: "A normal rollout stores the context of the chunks before position p, anywhere in the second half of the window. Later updates continue from that state for 48 more frames, rebuilding the KV with writer passes only. Positions are rebased exactly: cached keys are rotated by −Δ, so attention scores are unchanged in exact arithmetic, and the layout latents are sliced from one encoding of the whole HDMap, so control stays aligned." },
    { short: "Path", dur: 7, focus: ["pc", "pc-t", "pc-domains", "pc-new", "c0", "c1", "c2", "c3", "c4", "c5", "c6", "c0t", "c1t", "c2t", "c3t", "c5t", "c6t", "m-vjp", "cf0", "cf1", "cf2", "cf3", "cf4", "cf5", "cg0", "cg1", "cg2", "cg3", "cg4", "cg5"], title: "One gradient path, from the score to the writer",
      text: "The score lives on decoded pixels, but the denoiser produces latents. The gradient therefore has to cross the causal video decoder, whose state is recurrent: it is differentiated exactly (vector-Jacobian product, state saved on the CPU every few frames), then continues through the denoiser, the memory and the writer." },
  ];
  return { title: "Training IV", steps, caption: "<b>Figure 3 · Antiphon Forcing (Stage IV).</b> The writer commits each chunk to the KV memory; the denoiser answers by reading it. (1) The score gradient flows back through the denoiser into the writer passes, one chunk at a time; two adapters are used because the roles' gradients disagree at every update. (2) A kernel score matches whole distributions on frozen encoders and the HDMap support. (3) A replay pool and an exact rebase of positions train beyond the training horizon with the layout kept aligned. The bottom strip shows the full gradient path, including the exact vector-Jacobian product of the causal decoder." };
});
