/* Figure 6 · Engineering: fused kernels, exact accelerations, overlapped execution */
BD.figure("fig6", (F, BD) => {
  const { C, CAM, pad3, lerp, ease, clamp01 } = BD;
  const vcol7 = CAM.col;
  const S = { blk: 0, fuse: 1, attn: 2, vae: 3, exact: 4, chain: 5, pipe: 6 };
  // Numerical precision is its own dimension: neutral graphite bit-meters (square = float, circle = integer), never the semantic hues.
  const GR = "#1f2937", GRL = "#9ca3af", PITCH = 5.6;
  const meter = (g, x, y, bits, shape, label) => {
    for (let i = 0; i < 16; i++) {
      const on = i < bits, a = { fill: on ? GR : "#fff", stroke: on ? GR : GRL, "stroke-width": 1.2 };
      if (shape === "sq") F.el("rect", { x: x + i * PITCH, y, width: 4.4, height: 12, rx: 1.2, ...a }, g);
      else F.el("circle", { cx: x + i * PITCH + 2.2, cy: y + 6, r: 2.4, ...a }, g);
    }
    if (label) F.text(x + 16 * PITCH + 8, y + 12, label, { cls: "mono", parent: g });
  };

  // ═══ (a) one DiT block, fused into kernels ════════════════════════════════════════════
  F.node("pa", { x: 28, y: 24, w: 1544, h: 460, kind: "ink", fill: "#fbfdff", stroke: "#e2e8f0", rx: 22, step: 0, always: true });
  F.text(50, 64, "(a)  One DiT block, compiled into fused kernels", { cls: "h2" });
  const OW = 180, OP = 196, OX = 60, OY = 84, OH = 70;
  const OPS = [["adaLN-LoRA", "γ, β, α", "cond"], ["Modulate", "one pass", "cond"], ["QKV + RoPE", "GEMM + rotary", "ink"],
               ["Attention", "time + views", "ink"], ["Projection", "gate, residual", "ink"], ["MLP", "feed-forward", "ink"]];
  OPS.forEach(([t, sub, kind], i) => {
    const x = OX + i * OP;
    F.node(`t${i + 1}`, { x, y: OY, w: OW, h: OH, kind, title: t, sub: [sub], scls: "xs", step: S.blk, rx: 14 });
    if (i < 5) F.edge(`ch${i + 1}`, [[x + OW + 2, OY + 35], [x + OP - 2, OY + 35]], { kind: "ink", step: S.blk, from: `t${i + 1}`, to: `t${i + 2}`, draw: [0.1 + 0.1 * i, 0.2 + 0.1 * i] });
  });
  // the fusion braces: which of the six operations each kernel swallows. Two ops into one kernel is the whole point.
  const brace = (x0, x1, step) => {
    const g = F.group({ id: `br${x0}`, step });
    const cx = (x0 + x1) / 2;
    F.el("path", { d: `M${x0},${OY + OH + 4} V${OY + OH + 14} H${x1} V${OY + OH + 4}`, fill: "none", stroke: "#94a3b8", "stroke-width": 1.6 }, g);
    F.el("path", { d: `M${cx},${OY + OH + 14} V${OY + OH + 28}`, fill: "none", stroke: "#94a3b8", "stroke-width": 1.6, "marker-end": "url(#a-copy)" }, g);
    return g;
  };
  brace(OX + 20, OX + OP + OW - 20, S.fuse);
  brace(OX + 2 * OP + 20, OX + 2 * OP + OW - 20, S.fuse);
  brace(OX + 4 * OP + 20, OX + 4 * OP + OW - 20, S.fuse);
  brace(OX + 5 * OP + 20, OX + 5 * OP + OW - 20, S.fuse);
  brace(OX + 3 * OP + 20, OX + 3 * OP + OW - 20, S.attn);
  const kc = (id, x, w, title, sub, rows, step) => {
    F.node(id, { x, y: 186, w, h: 128, kind: "ink", fill: "#fff", stroke: "#94a3b8", step, rx: 14 });
    const g = F.byId[id].g;
    F.text(x + 16, 216, title, { cls: "b", parent: g });
    F.text(x + 16, 242, sub, { cls: "xs", parent: g, lh: 17 });
    rows.forEach(([bits, shape, lab], i) => meter(g, x + 16, 272 + i * 22, bits, shape, lab));
  };
  kc("k1", OX, OP + OW, "Fused conditioning", ["adaLN-LoRA, modulation and", "layer norm in a single pass"], [[16, "sq", "bf16"]], S.fuse);
  kc("k2", OX + 2 * OP, OW, "QKV + RoPE", ["one kernel"], [[16, "sq", "bf16"], [8, "ci", "INT8"]], S.fuse);
  kc("k4", OX + 4 * OP, OW, "Projection", ["output GEMM"], [[16, "sq", "bf16"], [8, "ci", "INT8"]], S.fuse);
  kc("k5", OX + 5 * OP, OW, "MLP", ["feed-forward"], [[16, "sq", "bf16"], [8, "ci", "INT8"]], S.fuse);
  F.text(OX + 3 * OP + OW / 2, 250, ["one slot,", "four backends,", "one per run"], { cls: "xs", anchor: "middle", step: S.attn, id: "pick", lh: 17 });
  F.edge("sel", [[OX + 3 * OP + OW / 2, 290], [OX + 3 * OP + OW / 2, 322]], { kind: "ink", step: S.attn, head: false, draw: [0.2, 0.4] });
  { // one rail so the choice reads as "any one of these four", not "this one"
    const g = F.group({ id: "rail", step: S.attn });
    F.el("path", { d: `M60,322 H1216`, stroke: "#94a3b8", "stroke-width": 1.6 }, g);
    for (let i = 0; i < 4; i++) F.el("path", { d: `M${60 + i * 294 + 137},322 V330`, stroke: "#94a3b8", "stroke-width": 1.6, "marker-end": "url(#a-copy)" }, g);
  }
  const BK = [
    { id: "d1", t: "Dense · bf16", sub: ["fused FMHA,", "the default"], bits: 16, shape: "sq", pl: "bf16", glyph: "dense" },
    { id: "d2", t: "FP8 flash", sub: ["FP8 matrix", "products"], bits: 8, shape: "sq", pl: "FP8", glyph: "dense2" },
    { id: "d3", t: "FP4 / FP8", sub: ["block-quantised", "Q, K, V"], bits: 4, shape: "sq", pl: "FP4", glyph: "quant" },
    { id: "d4", t: "Block-sparse", sub: ["top 25 %", "of the tiles"], bits: 16, shape: "sq", pl: "sparse", glyph: "sparse" },
  ];
  const glyphCells = [];
  BK.forEach((b, i) => {
    const x = 60 + i * 294, y = 332;
    F.node(b.id, { x, y, w: 274, h: 140, kind: "ink", fill: "#fff", stroke: "#94a3b8", step: S.attn, rx: 14 });
    const g = F.byId[b.id].g;
    F.text(x + 16, y + 32, b.t, { cls: "b", parent: g });
    F.text(x + 16, y + 58, b.sub, { cls: "xs", parent: g, lh: 17 });
    meter(g, x + 16, y + 100, b.bits, b.shape, b.pl === "sparse" ? "" : b.pl);
    if (b.pl === "sparse") F.text(x + 16 + 16 * PITCH + 8, y + 112, "bf16", { cls: "mono", parent: g });
    const cells = [], gx = x + 186, gy = y + 46;
    if (b.glyph === "sparse") {
      // top-k 25 % of tiles: four of sixteen, drawn as tiles rather than cells so the ratio is literal
      for (let q = 0; q < 4; q++) for (let k = 0; k < 4; k++) cells.push({ q, k, r: F.el("rect", { x: gx + k * 20, y: gy + q * 20, width: 18, height: 18, rx: 2, fill: "#fff", stroke: "#cbd5e1", "stroke-width": 1 }, g) });
    } else {
      for (let q = 0; q < 8; q++) for (let k = 0; k < 8; k++) {
        let fill = GR;
        if (b.glyph === "dense2") fill = "#4b5563";
        if (b.glyph === "quant") fill = ((q >> 1) ^ (k >> 1)) & 1 ? "#4b5563" : "#9ca3af";
        cells.push({ q, k, r: F.el("rect", { x: gx + k * 10, y: gy + q * 10, width: 8.6, height: 8.6, rx: 1.2, fill }, g) });
      }
    }
    glyphCells.push({ kind: b.glyph, cells });
    F.tag(x + 186, y + 112, "schematic", { parent: g });
  });
  // LightVAE and the precision key
  F.node("vae", { x: 1244, y: 84, w: 312, h: 230, kind: "ink", fill: "#fff", stroke: "#94a3b8", step: S.vae, rx: 14 });
  {
    const g = F.byId.vae.g, x = 1244, y = 84;
    F.text(x + 16, y + 34, "LightVAE", { cls: "b", parent: g });
    meter(g, x + 150, y + 22, 8, "sq", "FP8");
    F.img("assets/clip/real_v0_f000_s.jpg", x + 16, y + 56, 76, 42, { parent: g, rx: 4 });
    F.img("assets/clip/gen_v0_f092_s.jpg", x + 220, y + 56, 76, 42, { parent: g, rx: 4 });
    F.el("path", { d: `M${x + 96},${y + 77} H${x + 128}`, stroke: "#475569", "stroke-width": 2.4, "marker-end": "url(#a-copy)" }, g);
    F.el("rect", { x: x + 134, y: y + 64, width: 44, height: 26, rx: 6, fill: "#fff", stroke: "#475569", "stroke-width": 1.8 }, g);
    F.el("text", { x: x + 156, y: y + 82, "text-anchor": "middle", "font-size": 18, fill: "#475569" }, g).textContent = "16 ch";
    F.el("path", { d: `M${x + 182},${y + 77} H${x + 214}`, stroke: "#475569", "stroke-width": 2.4, "marker-end": "url(#a-copy)" }, g);
    F.text(x + 16, y + 128, ["encode: the training VAE", "decode: LightTAE, or the", "standard decoder"], { cls: "xs", parent: g, lh: 17 });
    F.text(x + 16, y + 210, "streaming FP8 kernels", { cls: "xs", parent: g });
  }
  F.node("legend", { x: 1244, y: 332, w: 312, h: 140, kind: "ink", fill: "#f8fafc", stroke: "#e2e8f0", step: S.blk, rx: 14, always: true });
  {
    const g = F.byId.legend.g, x = 1244, y = 332;
    F.text(x + 16, y + 30, "Reading the figure", { cls: "b", parent: g });
    meter(g, x + 16, y + 48, 16, "sq", "float");
    meter(g, x + 16, y + 70, 8, "ci", "integer");
    F.text(x + 16, y + 106, "filled = bits used", { cls: "xs", parent: g });
    F.text(x + 16, y + 128, "colour = data flow", { cls: "xs", parent: g });
  }

  // ═══ (b) exact accelerations ═════════════════════════════════════════════════════════
  F.node("pb", { x: 28, y: 504, w: 1544, h: 112, kind: "ink", fill: "#f9fafb", stroke: "#e2e8f0", rx: 22, step: S.exact, always: true });
  {
    const g = F.group({ id: "exact", step: S.exact });
    F.text(50, 542, "(b)  Exact accelerations: never change the output", { cls: "h2", parent: g });
    const bd = F.chip(1056, 518, "measured max difference 0 on the real network", { parent: g, fill: "#0f172a", color: "#fff", size: 19.5 });
    const CW = 360, CH = 52, CY = 556, GAPC = 20, ink = "#334155";
    const glyphs = [
      (x, y) => {  // L = T·H·W rows collapse to T
        for (let i = 0; i < 6; i++) F.el("rect", { x: x + i * 6, y: y + 14, width: 4.4, height: 22, rx: 1.4, fill: "#cbd5e1" }, g);
        F.el("path", { d: `M${x + 40},${y + 25} H${x + 52}`, stroke: ink, "stroke-width": 2, "marker-end": "url(#a-copy)" }, g);
        F.el("rect", { x: x + 56, y: y + 14, width: 4.4, height: 22, rx: 1.4, fill: ink }, g);
      },
      (x, y) => {  // built once: a table with a tick
        for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) F.el("rect", { x: x + c * 11, y: y + 10 + r * 10, width: 9, height: 8, rx: 1.4, fill: r === 0 ? ink : "#cbd5e1" }, g);
        F.el("path", { d: `M${x + 50},${y + 30} l4,5 l8,-11`, fill: "none", stroke: ink, "stroke-width": 2.4, "stroke-linecap": "round", "stroke-linejoin": "round" }, g);
      },
      (x, y) => {  // host-side cursor: a ruler and one marker that lives on the host
        F.el("rect", { x, y: y + 24, width: 62, height: 6, rx: 3, fill: "#cbd5e1" }, g);
        F.el("path", { d: `M${x + 40},${y + 22} l-5,-11 h10 z`, fill: ink }, g);
        F.el("rect", { x: x + 36, y: y + 34, width: 8, height: 8, rx: 1.5, fill: "none", stroke: ink, "stroke-width": 1.6 }, g);
      },
      (x, y) => {  // one camera per rank: seven lanes, seven devices
        for (let i = 0; i < 7; i++) { F.el("rect", { x: x + i * 9, y: y + 10, width: 6.4, height: 14, rx: 1.6, fill: vcol7[i] }, g); F.el("rect", { x: x + i * 9, y: y + 28, width: 6.4, height: 12, rx: 1.6, fill: "none", stroke: ink, "stroke-width": 1.4 }, g); }
      },
    ];
    const CARDS = [["adaLN per frame", "T·H·W rows → T rows"], ["Tables built once", "positions, block masks"], ["Host-side cursors", "840 syncs per block → 0"], ["Camera per rank", "7 cameras on 7 ranks"]];
    CARDS.forEach(([t, sub], i) => {
      const x = 50 + i * (CW + GAPC);
      F.el("rect", { x, y: CY, width: CW, height: CH, rx: 12, fill: "#fff", stroke: "#cbd5e1", "stroke-width": 1.6 }, g);
      glyphs[i](x + 14, CY + 1);
      F.text(x + 92, CY + 24, t, { cls: "b", parent: g });
      F.text(x + 92, CY + 44, sub, { cls: "xs", parent: g });
    });
  }

  // ═══ (c) execution ════════════════════════════════════════════════════════════════════
  F.node("pc", { x: 28, y: 632, w: 1544, h: 411, kind: "ink", fill: "#fffdf7", stroke: "#fde68a", rx: 22, step: S.pipe, always: true });
  F.text(50, 670, "(c)  Overlapped execution: layout, denoise, write and decode", { cls: "h2" });
  {
    const y = 690, w = 330, gap = 46;
    const N3 = [["Host syncs", "no .item() inside a block"], ["Capturable", "cursors live on the host"], ["One CUDA graph", "replayed, not launched"]];
    N3.forEach(([t, sub], i) => {
      const x = 56 + i * (w + gap);
      F.node(`ck${i}`, { x, y, w, h: 66, kind: "ink", fill: "#fff", stroke: i === 2 ? "#0f172a" : "#94a3b8", title: t, sub: [sub], scls: "xs", ty: y + 23, step: S.chain, rx: 14 });
      if (i < 2) F.edge(`cke${i}`, [[x + w + 2, y + 28], [x + w + gap - 2, y + 28]], { kind: "ink", step: S.chain, from: `ck${i}`, to: `ck${i + 1}`, draw: [i * 0.3, i * 0.3 + 0.3] });
    });
    F.math("cursor", 1348, y + 28, { step: S.chain, id: "m-cursor", anchor: "middle" });
    F.text(1348, y + 62, "per block, before and after", { cls: "xs", step: S.chain, id: "m-cursor-l", anchor: "middle" });
  }
  const LX = 252, TU = 8, LY0 = 770, LH = 64;
  const U = (t) => LX + t * TU;
  const lanes = [["CPU", "layout, 7 cameras", C.cond], ["GPU", "denoise · write", C.data], ["GPU", "decode, side stream", C.mem]];
  const laneG = F.group({ id: "lanes", step: S.pipe });
  lanes.forEach(([a, b, c], i) => {
    const y = LY0 + i * LH;
    F.el("rect", { x: 44, y: y + 4, width: 1512, height: LH - 8, rx: 12, fill: i % 2 ? "#ffffff" : "#fbf7ec" }, laneG);
    F.el("text", { x: 62, y: y + 28, class: "b", fill: c }, laneG).textContent = a;
    F.el("text", { x: 62, y: y + 50, class: "xs" }, laneG).textContent = b;
  });
  const blocks = [];
  const blk = (id, lane, t0, t1, label, fill, stroke) => {
    const y = LY0 + lane * LH + 12, g = F.group({ id, step: S.pipe });
    const r = F.el("rect", { x: U(t0), y, width: 0, height: LH - 24, rx: 8, fill, stroke: stroke || "none", "stroke-width": 1.8 }, g);
    const tx = F.el("text", { x: U(t0) + 10, y: y + 25, class: "b", "font-size": 19.5 }, g); tx.textContent = label;
    blocks.push({ r, tx, t0, t1 });
  };
  blk("raster1", 0, 0, 26, "layout N+1", "#fde68a");
  blk("kv0", 1, 0, 10, "write", "#ddd6fe", C.mem);
  blk("dit1", 1, 27, 58, "denoise", "#bfdbfe");
  blk("kv1", 1, 59, 69, "write", "#ddd6fe", C.mem);
  blk("raster2", 0, 59, 85, "layout N+2", "#fde68a");
  blk("dit2", 1, 86, 117, "denoise", "#bfdbfe");
  blk("dec0", 2, 0, 17, "decode N", "#e9d5ff");
  blk("dec1", 2, 59, 80, "decode N+1", "#e9d5ff");
  F.edge("d-r-dit", [[U(26), LY0 + 29], [U(27) + 2, LY0 + 29], [U(27) + 2, LY0 + LH + 14]], { kind: "cond", step: S.pipe, from: "raster1", to: "dit1", draw: [0, 0.3], r: 4 });
  F.edge("d-dit-dec", [[U(58), LY0 + LH + 50], [U(59) + 3, LY0 + LH + 50], [U(59) + 3, LY0 + 2 * LH + 14]], { kind: "data", step: S.pipe, from: "dit1", to: "dec1", draw: [0.2, 0.5], r: 4 });
  const head = F.el("line", { y1: LY0, y2: LY0 + 3 * LH, stroke: "#0f172a", "stroke-width": 2 }, F.layer);
  F.text(U(121), LY0 + 36, "critical path: layout → denoise", { cls: "xs", step: S.pipe, id: "n1" });
  F.text(U(121), LY0 + LH + 38, "the write overlaps the next layout", { cls: "xs", step: S.pipe, id: "n2", fill: C.mem });
  F.text(U(121), LY0 + 2 * LH + 38, "decode never blocks the next chunk", { cls: "xs", step: S.pipe, id: "n3", fill: C.mem });
  const AXY = LY0 + 3 * LH + 22;
  {
    const g = F.group({ id: "period", step: S.pipe });
    F.el("path", { d: `M${U(27)},${AXY} V${AXY + 8} H${U(86)} V${AXY}`, fill: "none", stroke: "#0f172a", "stroke-width": 2 }, g);
    F.text((U(27) + U(86)) / 2, AXY + 30, "one chunk period", { cls: "b", parent: g, anchor: "middle" });
    F.text(1550, AXY + 30, "1-step compile + FP8: 8 frames per 737 ms · 10.85 FPS per camera · 7 cameras · 480p", { cls: "xs", parent: g, anchor: "end" });
    F.text(50, AXY + 30, "block lengths are schematic", { cls: "xs", parent: g, fill: "#94a3b8" });
  }
  F.pulse("d-r-dit", S.pipe, { t0: 0.1, t1: 0.3, kind: "cond", to: "dit1" });
  F.pulse("d-dit-dec", S.pipe, { t0: 0.5, t1: 0.7, to: "dec1" });
  F.pulse("cke0", S.chain, { t0: 0.1, t1: 0.4, kind: "ink", to: "ck1" });
  F.pulse("cke1", S.chain, { t0: 0.5, t1: 0.8, kind: "ink", to: "ck2" });

  // ═══ mechanics ═══════════════════════════════════════════════════════════════════════
  F.hook(({ s, p, isStatic, t }) => {
    const sweep = !isStatic && s === S.attn;
    const qi = sweep ? Math.min(7, Math.floor(p * 8)) : -1, seed = sweep ? Math.floor(t * 1.6) : 0;
    glyphCells.forEach((gc) => gc.cells.forEach((c) => {
      if (gc.kind === "sparse") {
        // exactly one tile per row stays: 4 of 16, the stated 25 %
        c.r.setAttribute("fill", c.k === (c.q * 2 + seed) % 4 ? GR : "#fff");
        c.r.setAttribute("opacity", qi < 0 || c.q === qi % 4 ? 1 : 0.4);
        return;
      }
      c.r.setAttribute("opacity", qi < 0 || c.q === qi ? 1 : 0.4);
    }));
    const live = !isStatic && s === S.pipe;
    const now = live ? 120 * ease(clamp01(p / 0.85)) : 120;
    for (const b of blocks) {
      const grown = !live ? 1 : clamp01((now - b.t0) / Math.max(1, b.t1 - b.t0));
      b.r.setAttribute("width", Math.max(0, (U(b.t1) - U(b.t0) - 3) * grown));
      b.tx.style.opacity = grown > 0.6 ? 1 : 0;
    }
    head.setAttribute("x1", U(now)); head.setAttribute("x2", U(now));
    head.style.opacity = live && p < 0.999 ? 1 : 0;
  });

  const steps = [
    { short: "Block", dur: 5.5, focus: ["pa", "t1", "t2", "t3", "t4", "t5", "t6", "ch1", "ch2", "ch3", "ch4", "ch5", "legend"], title: "A DiT block is six operations",
      text: "Each block conditions with adaLN, projects with GEMMs, applies attention and an MLP. The figure follows one block and shows which kernel executes each part." },
    { short: "Fuse", dur: 6.5, focus: ["pa", "t1", "t2", "t3", "t5", "t6", "k1", "k2", "k4", "k5", "legend"], title: "Fusion removes memory traffic",
      text: "Conditioning is one kernel: adaLN-LoRA, modulation and layer norm in a single pass. The QKV projection applies the rotate-half rotary embedding in the same kernel. Every GEMM can run in bf16 or, optionally, as a block-wise quantised INT8 product." },
    { short: "Attention", dur: 8, focus: ["pa", "t4", "sel", "rail", "pick", "d1", "d2", "d3", "d4", "legend"], title: "One attention slot, four backends",
      text: "Attention dominates the cost, so it is a selectable backend: dense fused attention in bf16 (default), FP8 flash attention, FP4 / FP8 quantised attention, or block-sparse attention that keeps the top 25 % of tiles. The tile drawings are schematic, not measured sparsity." },
    { short: "VAE", dur: 5, focus: ["pa", "vae", "legend"], title: "A lightweight decoder in FP8",
      text: "Encoding always uses the VAE of training. For display, decoding uses the lightweight decoder (LightTAE) or the standard decoder, with FP8 streaming kernels." },
    { short: "Exact", dur: 6, focus: ["pb", "exact"], title: "Every other speed-up is exact",
      text: "Four accelerations remove work without changing a bit: adaLN is computed once per frame (T rows) instead of once per token (T·H·W rows), position tables and block masks are built once, the KV window is rolled in place with host-side cursors, and one camera runs per rank. The maximum difference to the original computation is zero on the real seven-camera network." },
    { short: "Graph", dur: 6, focus: ["pc", "ck0", "ck1", "ck2", "cke0", "cke1", "m-cursor", "m-cursor-l"], title: "Why the denoise step can be a graph",
      text: "The original cache cursor was read back from the device about 840 times per block, each read a synchronisation. With host-side cursors there are none, so the CPU can launch ahead and the step can be captured once and replayed as a single CUDA graph." },
    { short: "Pipeline", dur: 9, focus: ["pc", "lanes", "raster1", "kv0", "dit1", "kv1", "raster2", "dit2", "dec0", "dec1", "d-r-dit", "d-dit-dec", "n1", "n2", "n3", "period"], title: "A chunk is a pipeline, not a sequence",
      text: "The CPU draws the layout of the next chunk while the GPU writes the previous chunk into memory. Decoding waits on a single event and runs on a side stream, so the next chunk never waits for pixels. The critical path is only layout and denoise." },
  ];
  return { title: "Engineering", steps, caption: "<b>Figure 6 · Engineering for streaming.</b> (a) A DiT block executes as fused kernels: conditioning in one pass, QKV with fused rotary embedding, optional INT8 GEMMs and one of four attention backends (dense, FP8, FP4 / FP8, block-sparse), with an FP8 lightweight decoder. Numerical precision is drawn as grey bit-meters, apart from the semantic colours. (b) The remaining accelerations are exact. (c) Removing host synchronisations makes the denoise step capturable as one CUDA graph; layout rendering, denoising, the memory write and decoding overlap, so layout and denoise form the critical path." };
});
