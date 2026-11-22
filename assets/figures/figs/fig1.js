/* Figure 1 · Network */
BD.figure("fig1", (F, BD) => {
  const { C, CAM, pad3, lerp, ease, clamp01, mix } = BD;
  const D = window.HIW_DATA;
  const S = { rig: 0, tok: 1, sa: 2, xv: 3, tx: 4, ada: 5, out: 6, key: 7 };
  const cams = D.rig.cameras, yaw = D.rig.yaw_deg, fov = D.rig.fov_nominal_deg, NB = D.rig.neighbors;
  const ABBR = CAM.abbr, vcol = CAM.col;

  // ═══ A · rig graph ═════════════════════════════════════════════════════════════════
  F.text(28, 44, "Seven cameras, one rig", { cls: "h2" });
  // Coverage as the angles the rig data records: every cone radiates from one centre, so the angular overlap of two neighbours is exact.
  // Radius is schematic but monotonic in field of view: a wider lens spreads the same sensor over more angle and reaches less far.
  // Green marks where neighbouring views overlap (FW/FT 30, FW/CL and FW/CR 70, CL/RL and CR/RR 15 degrees). RR/RT and RT/RL only abut.
  const O = [214, 298], REACH = { 120: 128, 70: 158, 30: 200 }, BADGE = 0.8;
  const CAR = { x: O[0] - 22, y: O[1] - 46, w: 44, h: 92 };
  const rad = (v) => REACH[fov[cams[v]]];
  const ang = (v) => yaw[cams[v]] * Math.PI / 180, hlf = (v) => fov[cams[v]] / 2 * Math.PI / 180;
  const pt = (g, r) => [O[0] - Math.sin(g) * r, O[1] - Math.cos(g) * r];
  const wedge = (g0, g1, r) => { const [x0, y0] = pt(g0, r), [x1, y1] = pt(g1, r); return `M${O[0]},${O[1]} L${x0.toFixed(1)},${y0.toFixed(1)} A${r},${r} 0 0 1 ${x1.toFixed(1)},${y1.toFixed(1)} Z`; };
  const node = {};
  cams.forEach((c, v) => { node[v] = pt(ang(v), rad(v) * BADGE); });
  const rig = F.group({ id: "rig", step: S.rig });
  cams.forEach((c, v) => F.el("path", { d: wedge(ang(v) + hlf(v), ang(v) - hlf(v), rad(v)), fill: vcol[v], "fill-opacity": 0.1, stroke: vcol[v], "stroke-opacity": 0.7, "stroke-width": 1.4 }, rig));
  const wrapA = (d) => Math.atan2(Math.sin(d), Math.cos(d)), ovEl = {}, OVER = {};
  D.rig.undirected_edges.forEach(([a, b]) => {
    const d = wrapA(ang(b) - ang(a)), lo = Math.max(-hlf(a), d - hlf(b)), hi = Math.min(hlf(a), d + hlf(b));
    OVER[`${a}-${b}`] = Math.max(0, hi - lo) * 180 / Math.PI;
    if (hi - lo > 0.01) ovEl[`${a}-${b}`] = F.el("path", { d: wedge(ang(a) + hi, ang(a) + lo, Math.min(rad(a), rad(b))), fill: C.xview, "fill-opacity": 0.42, stroke: C.xview, "stroke-width": 1.6 }, rig);
  });
  const edgeEl = {};
  D.rig.undirected_edges.forEach(([a, b]) => { edgeEl[`${a}-${b}`] = F.el("line", { x1: node[a][0], y1: node[a][1], x2: node[b][0], y2: node[b][1], stroke: C.xview, "stroke-width": 3, "stroke-linecap": "round" }, rig); });
  {  // the vehicle: wheels, body, roof, glass, lamps, heading chevron
    const { x, y, w, h } = CAR, CX = O[0];
    for (const [wx, wy] of [[x - 3, y + 12], [x + w - 2, y + 12], [x - 3, y + h - 28], [x + w - 2, y + h - 28]]) F.el("rect", { x: wx, y: wy, width: 5, height: 16, rx: 2, fill: "#0f172a" }, rig);
    F.el("rect", { x, y, width: w, height: h, rx: 15, fill: "#334155" }, rig);
    F.el("path", { d: `M${x + 6},${y + 24} Q${CX},${y + 17} ${x + w - 6},${y + 24} L${x + w - 8},${y + 40} L${x + 8},${y + 40} Z`, fill: "#93c5fd", "fill-opacity": 0.85 }, rig);
    F.el("rect", { x: x + 8, y: y + 40, width: w - 16, height: 28, rx: 3, fill: "#475569" }, rig);
    F.el("path", { d: `M${x + 8},${y + 68} L${x + w - 8},${y + 68} L${x + w - 6},${y + h - 12} Q${CX},${y + h - 8} ${x + 6},${y + h - 12} Z`, fill: "#93c5fd", "fill-opacity": 0.6 }, rig);
    F.el("rect", { x: x + 4, y: y + 2, width: 9, height: 4, rx: 2, fill: "#fde68a" }, rig);
    F.el("rect", { x: x + w - 13, y: y + 2, width: 9, height: 4, rx: 2, fill: "#fde68a" }, rig);
    F.el("rect", { x: x + 4, y: y + h - 6, width: 9, height: 4, rx: 2, fill: "#ef4444" }, rig);
    F.el("rect", { x: x + w - 13, y: y + h - 6, width: 9, height: 4, rx: 2, fill: "#ef4444" }, rig);
    F.el("path", { d: `M${CX - 6},${y + 56} L${CX},${y + 48} L${CX + 6},${y + 56}`, fill: "none", stroke: "#fff", "stroke-width": 2 }, rig);
  }
  // Each camera's real frame stands where its badge was, with its two previous frames stacked behind it (time).
  const tileRect = {}, CARD = { w: 66, h: 37 }, ghosts = [];
  cams.forEach((c, v) => {
    const x = node[v][0] - CARD.w / 2, y = node[v][1] - CARD.h / 2, back = [2, 1].map((k) => {
      const g = F.img(`assets/clip/real_v${v}_f092_s.jpg`, x, y, CARD.w, CARD.h, { parent: rig, rx: 5 });
      g.setAttribute("opacity", 0.55 - 0.2 * k);
      return g;
    });
    ghosts.push(back);
    F.img(`assets/clip/real_v${v}_f092_s.jpg`, x, y, CARD.w, CARD.h, { parent: rig, rx: 5 }).setAttribute("opacity", 0.88);
    tileRect[v] = F.el("rect", { x, y, width: CARD.w, height: CARD.h, rx: 5, fill: "none", stroke: "#fff", "stroke-width": 2 }, rig);
  });
  cams.forEach((c, v) => F.pill(v, node[v][0] - CARD.w / 2 - 8, node[v][1] - CARD.h / 2 - 13, { parent: rig }));

  // ═══ B · tokens ═════════════════════════════════════════════════════════════════════════
  F.text(28, 584, "Tokens = video + layout", { cls: "h2" });

  const IV = { x: 28, y: 606, w: 150, h: 83 }, IM = { x: 202, y: 606, w: 150, h: 83 };
  F.img("assets/clip/real_v0_f000_s.jpg", IV.x, IV.y, IV.w, IV.h, { id: "vimg", step: S.tok, rx: 6, stroke: C.data });
  F.img("assets/clip/hdmap_v0_f000_s.jpg", IM.x, IM.y, IM.w, IM.h, { id: "mimg", step: S.tok, rx: 6, stroke: C.cond });
  F.text(IV.x + IV.w / 2, 714, "video", { cls: "b", anchor: "middle", fill: C.data, step: S.tok, id: "vlab" });
  F.text(IM.x + IM.w / 2, 714, "layout map", { cls: "b", anchor: "middle", fill: C.cond, step: S.tok, id: "mlab" });
  const GR = 4, GC = 6, PATCH = [];
  const patchLayer = F.group({ id: "patches", step: S.tok });
  for (const [src, box, kind] of [["real", IV, "data"], ["hdmap", IM, "cond"]]) {
    for (let r = 0; r < GR; r++) for (let c = 0; c < GC; c++) {
      const sv = F.el("svg", { viewBox: `${c * 320 / GC} ${r * 176 / GR} ${320 / GC} ${176 / GR}`, preserveAspectRatio: "none" }, patchLayer);
      F.el("image", { href: `assets/clip/${src}_v0_f000_s.jpg`, width: 320, height: 176, preserveAspectRatio: "none" }, sv);
      const fr = F.el("rect", { fill: "none", stroke: C[kind], "stroke-width": 1.2 }, patchLayer);
      PATCH.push({ sv, fr, kind, r, c, x0: box.x + c * box.w / GC, y0: box.y + r * box.h / GR, w0: box.w / GC, h0: box.h / GR, i: r * GC + c });
    }
  }
  const STRIP = { x: 28, y: 750, s: 12, pitch: 14.5 };
  F.text(28, 738, "patchify  →  one token per patch", { cls: "xs", step: S.tok, id: "ptxt" });
  F.math("addmap", 202, 810, { step: S.tok, id: "addmap", anchor: "middle" });
  const BAR = { x: 28, y: 846, w: 348, h: 36 };
  const bar = F.group({ id: "bar", step: S.tok });
  const segW = BAR.w / 7, seg = [];
  for (let v = 0; v < 7; v++) {
    seg.push(F.el("rect", { x: BAR.x + v * segW, y: BAR.y, width: segW - 2, height: BAR.h, rx: 5, fill: vcol[v] }, bar));
    F.el("text", { x: BAR.x + v * segW + segW / 2 - 1, y: BAR.y + 25, "text-anchor": "middle", "font-size": 19.5, "font-weight": 700, fill: "#fff" }, bar).textContent = ABBR[v];
  }
  F.el("path", { d: `M${STRIP.x},${STRIP.y + 12} L${BAR.x},${BAR.y} M${STRIP.x + 24 * STRIP.pitch - 2.5},${STRIP.y + 12} L${BAR.x + segW - 2},${BAR.y}`, stroke: "#94a3b8", "stroke-dasharray": "3 3", fill: "none" }, bar);
  const frameHi = F.el("rect", { x: BAR.x, y: BAR.y - 4, width: 4, height: BAR.h + 8, rx: 2, fill: C.xview, opacity: 0 }, bar);
  F.text(28, 910, "camera after camera, frame after frame", { cls: "xs", parent: bar });
  F.math("tokens", 202, 950, { step: S.tok, id: "tokmath", anchor: "middle" });
  F.text(28, 1000, ["V = 7 cameras, T = 24 frames", "S = 3,520 tokens, D = 2048"], { cls: "xs", step: S.tok, id: "tokinfo", lh: 19 });

  // ═══ C · the cross-view DiT block ═════════════════════════════════════════════════
  const CB = { x: 440, y: 24, w: 760, h: 998 };
  F.node("block", { x: CB.x, y: CB.y, w: CB.w, h: CB.h, kind: "ink", fill: "#fbfdff", stroke: "#c7d2fe", rx: 22, step: S.sa, always: true });
  F.text(CB.x + 24, 66, "Cross-view DiT block", { cls: "h" });
  F.el("rect", { x: CB.x + 640, y: 42, width: 64, height: 32, rx: 16, fill: "#0f172a" }, F.layer);
  F.el("text", { x: CB.x + 672, y: 65, "text-anchor": "middle", "font-size": 20, "font-weight": 800, fill: "#fff" }, F.layer).textContent = "×28";
  const XS = CB.x + 34, RX = CB.x + 80, RW = 630, BUS = CB.x + 736;
  const Y1 = 92, H1 = 316, Y2 = 436, H2 = 318, Y3 = 782, H3 = 40, Y4 = 850, H4 = 40, YA = 926, HA = 46, YE = 922;
  F.edge("e-in", [[BAR.x + BAR.w + 2, BAR.y + 17], [CB.x - 20, BAR.y + 17], [CB.x - 20, 82], [XS, 82], [XS, 96]], { step: S.sa, from: "bar", to: "sa", kind: "data", draw: [0, 0.25], r: 10 });
  F.edge("e-stream", [[XS, 96], [XS, YE]], { step: S.sa, kind: "data", head: false, draw: [0.05, 0.5] });
  const ROWS = [
    { id: "sa", y: Y1, h: H1, kind: "data", s: S.sa }, { id: "xv", y: Y2, h: H2, kind: "xview", s: S.xv },
    { id: "tx", y: Y3, h: H3, kind: "ink", s: S.tx }, { id: "mlp", y: Y4, h: H4, kind: "ink", s: S.tx },
  ];
  const G = {};
  ROWS.forEach((r) => {
    F.node(r.id, { x: RX, y: r.y, w: RW, h: r.h, kind: r.kind, step: r.s, rx: 14 });
    G[r.id] = F.byId[r.id].g;
    const yi = r.y + 26, yo = r.y + r.h + 18;
    F.edge(`${r.id}-in`, [[XS, yi], [RX, yi]], { step: r.s, from: r.id, kind: "data", draw: [0.05, 0.25] });
    F.edge(`${r.id}-out`, [[RX + 40, r.y + r.h], [RX + 40, yo], [XS + 12, yo]], { step: r.s, from: r.id, kind: r.kind === "xview" ? "xview" : "data", draw: [0.6, 0.85] });
    const pg = F.group({ step: r.s, id: `${r.id}-sum` });
    F.el("circle", { cx: XS, cy: yo, r: 11, fill: "#fff", stroke: "#0f172a", "stroke-width": 1.6 }, pg);
    F.el("path", { d: `M${XS - 6.5},${yo} H${XS + 6.5} M${XS},${yo - 6.5} V${yo + 6.5}`, stroke: "#0f172a", "stroke-width": 1.8 }, pg);
  });
  F.edge("e-loop", [[XS, YE], [XS - 22, YE], [XS - 22, 82], [XS - 2, 82]], { step: S.out, kind: "ink", head: false, draw: [0, 0.3], r: 10 });
  const X0 = RX + 22;

  // ── ① self-attention: time is causal; camera v and space S are not mixed ─────────────
  F.text(X0, Y1 + 34, "Self-attention", { cls: "h2", parent: G.sa });
  F.text(X0, Y1 + 58, "causal over T · fixed v, S", { cls: "s", parent: G.sa });
  F.math("selfattn", RX + RW - 20, Y1 + 34, { parent: G.sa, anchor: "end" });
  F.math("foldv", RX + RW - 20, Y1 + 76, { parent: G.sa, anchor: "end", s: 0.8 });
  const FR = [92, 100, 108, 116, 124, 132, 140, 148], TILE = { w: 58, h: 32, pitch: 70, y: Y1 + 104 };
  const tiles = FR.map((f, i) => {
    const x = X0 + i * TILE.pitch;
    F.img(`assets/clip/gen_v0_f${pad3(f)}_s.jpg`, x, TILE.y, TILE.w, TILE.h, { parent: G.sa, rx: 4 });
    const o = F.el("rect", { x, y: TILE.y, width: TILE.w, height: TILE.h, rx: 4, fill: "none", stroke: "#fff", "stroke-width": 2 }, G.sa);
    return { x, o };
  });
  const arcs = [0, 1].map(() => F.el("path", { fill: "none", "stroke-width": 2.4, stroke: C.mem, "marker-end": "url(#a-mem)" }, G.sa));
  {
    const ly = Y1 + 160; let lx = X0;
    [[C.data, "query chunk"], [C.mem, "KV memory"], ["#cbd5e1", "older, evicted"]].forEach(([c, t]) => { F.el("rect", { x: lx, y: ly - 13, width: 16, height: 16, rx: 3, fill: "none", stroke: c, "stroke-width": 3 }, G.sa); F.text(lx + 24, ly + 1, t, { cls: "xs", parent: G.sa }); lx += 50 + t.length * 10.6; });
  }
  const MS = 12, MX = X0, MY = Y1 + 184, mcells = [];
  const offCol = (d) => mix("#1d4ed8", "#dbeafe", d / 7);
  for (let q = 0; q < 8; q++) for (let k = 0; k < 8; k++) {
    const d = q - k;
    mcells.push({ q, k, d, r: F.el("rect", { x: MX + k * MS, y: MY + q * MS, width: MS - 1, height: MS - 1, rx: 1.5, fill: d < 0 ? "#eef2f7" : offCol(d), opacity: d < 0 ? 1 : d <= 2 ? 1 : 0.5 }, G.sa) });
  }
  F.text(MX, MY + 8 * MS + 18, "q ↓ rows · k → columns", { cls: "xs", parent: G.sa });
  const DO = [700, MY + 46], DR = 36;
  F.el("circle", { cx: DO[0], cy: DO[1], r: DR, fill: "#eff6ff", stroke: "#bfdbfe", "stroke-width": 1.5 }, G.sa);
  const vec = (col, mk, w, o) => F.el("line", { x1: DO[0], y1: DO[1], stroke: col, "stroke-width": w, "stroke-linecap": "round", "marker-end": `url(#a-${mk})`, opacity: o }, G.sa);
  const gq = vec(C.data, "data", 2.4, 0.35), gk = vec(C.mem, "mem", 2.4, 0.35), qv = vec(C.data, "data", 3.4, 1), kv = vec(C.mem, "mem", 3.4, 1);
  F.text(DO[0] - 26, MY + 92, "q", { cls: "b", parent: G.sa, fill: C.data });
  F.text(DO[0] + 10, MY + 92, "k", { cls: "b", parent: G.sa, fill: C.mem });
  F.math("rope", 742, MY + 10, { parent: G.sa, anchor: "start", s: 0.85 });
  F.text(742, MY + 52, "same Δ ⇒ same score", { cls: "s", parent: G.sa });
  F.text(742, MY + 80, "bright: streaming · pale: teacher", { cls: "xs", parent: G.sa });

  // ── ② cross-view attention: spatial mixing, never temporal ───────────────────────────
  F.text(X0, Y2 + 34, "Cross-view attention", { cls: "h2", parent: G.xv });
  F.text(X0, Y2 + 58, "spatial over v, S · fixed t", { cls: "s", parent: G.xv });
  F.math("xview", RX + RW - 20, Y2 + 34, { parent: G.xv, anchor: "end" });
  F.math("foldt", RX + RW - 20, Y2 + 76, { parent: G.xv, anchor: "end", s: 0.8 });
  const RV = [650, Y2 + 166], ringPos = {}, ringNode = {}, ringEdge = {};
  const RR2 = { 0: 40, 6: 80, 1: 64, 5: 64, 2: 64, 4: 64, 3: 52 };
  cams.forEach((c, v) => { const a = yaw[c] * Math.PI / 180; ringPos[v] = [RV[0] - Math.sin(a) * RR2[v], RV[1] - Math.cos(a) * RR2[v]]; });
  D.rig.undirected_edges.forEach(([a, b]) => { ringEdge[`${a}-${b}`] = F.el("line", { x1: ringPos[a][0], y1: ringPos[a][1], x2: ringPos[b][0], y2: ringPos[b][1], stroke: C.xview, "stroke-width": 3, "stroke-linecap": "round" }, G.xv); });
  cams.forEach((c, v) => {
    const g = F.el("g", {}, G.xv);
    F.el("circle", { cx: ringPos[v][0], cy: ringPos[v][1], r: 15, fill: vcol[v], stroke: "#fff", "stroke-width": 2 }, g);
    F.el("text", { x: ringPos[v][0], y: ringPos[v][1] + 5, "text-anchor": "middle", "font-size": 18, "font-weight": 700, fill: "#fff" }, g).textContent = ABBR[v];
    ringNode[v] = g;
  });
  const BM = { x: 800, y: Y2 + 112, c: 19 }, bmCells = [];
  for (let q = 0; q < 7; q++) {
    F.el("circle", { cx: BM.x - 12, cy: BM.y + q * BM.c + 8.5, r: 5, fill: vcol[q] }, G.xv);
    F.el("circle", { cx: BM.x + q * BM.c + 8.5, cy: BM.y - 12, r: 5, fill: vcol[q] }, G.xv);
    for (let k = 0; k < 7; k++) {
      const ok = (NB[q] || []).includes(k), cg = F.el("g", {}, G.xv);
      F.el("rect", { x: BM.x + k * BM.c, y: BM.y + q * BM.c, width: BM.c - 2, height: BM.c - 2, rx: 2, fill: ok ? C.xview : "#eef2f7" }, cg);
      bmCells.push({ q, k, g: cg });
    }
  }
  F.math("ratio", 1038, Y2 + 132, { parent: G.xv, anchor: "middle", s: 1.5 });
  F.text(1038, Y2 + 178, ["directed pairs", "attended"], { cls: "xs", parent: G.xv, anchor: "middle", lh: 18 });
  F.text(944, Y2 + 222, ["rows: query camera", "columns: key camera"], { cls: "xs", parent: G.xv, lh: 18 });
  {
    let cx = X0; const cy = Y2 + 252;
    for (const t of ["same frame only", "stateless: no KV cache"]) { const ch = F.chip(cx, cy, t, { parent: G.xv, fill: "#d1fae5", color: "#065f46", size: 19.5 }); cx += ch.chipW + 12; }
    F.math("gate0", X0, Y2 + 298, { parent: G.xv, anchor: "start", s: 0.95 });
  }

  // ── text attention + MLP: deliberately small ─────────────────────────────────────────
  F.text(X0, Y3 + 29, "Text cross-attention", { cls: "b", parent: G.tx });
  F.text(RX + RW - 20, Y3 + 29, "caption → K, V · front only", { cls: "xs", parent: G.tx, anchor: "end", fill: C.cond });
  F.text(X0, Y4 + 29, "MLP", { cls: "b", parent: G.mlp });
  F.text(RX + RW - 20, Y4 + 29, "per token", { cls: "xs", parent: G.mlp, anchor: "end" });

  // ── adaLN ─────────────────────────────────────────────────────────────────────────────
  F.node("ada", { x: RX, y: YA, w: BUS - RX + 14, h: HA, kind: "cond", step: S.ada, rx: 14 });
  const adaG = F.byId.ada.g;
  F.text(X0, YA + 29, "adaLN", { cls: "b", parent: adaG });
  F.math("ada", RX + 270, YA + 23, { parent: adaG, anchor: "middle" });
  F.math("resid", RX + 520, YA + 23, { parent: adaG, anchor: "middle", s: 0.95 });
  F.text(RX, YA + HA + 28, "camera id enters only here, RoPE is untouched", { cls: "xs", step: S.ada, id: "adanote", fill: C.cond });
  F.edge("ada-bus", [[BUS, YA], [BUS, Y1 + 34]], { step: S.ada, from: "ada", kind: "cond", head: false, draw: [0, 0.4] });
  F.edge("ada-sa", [[BUS, Y1 + 34], [RX + RW + 2, Y1 + 34]], { step: S.ada, from: "ada", to: "sa", kind: "cond", draw: [0.4, 0.6] });
  F.edge("ada-tx", [[BUS, Y3 + 21], [RX + RW + 2, Y3 + 21]], { step: S.ada, from: "ada", to: "tx", kind: "cond", draw: [0.4, 0.6] });
  F.edge("ada-mlp", [[BUS, Y4 + 21], [RX + RW + 2, Y4 + 21]], { step: S.ada, from: "ada", to: "mlp", kind: "cond", draw: [0.4, 0.6] });

  // ═══ D · right column ═════════════════════════════════════════════════════════════════
  const RXC = 1216, RWC = 356, RIN = RXC + 20, RMAX = RXC + RWC - 20;
  F.node("keycard", { x: RXC, y: 24, w: RWC, h: 404, kind: "ink", fill: "#fbfdff", stroke: "#c7d2fe", rx: 20, step: S.key });
  {
    // Each design choice is a small diagram plus one number; words are limited to what a diagram cannot say.
    const g = F.byId.keycard.g, R0 = (i) => 92 + i * 108;
    F.text(RIN, 66, "What to remember", { cls: "h2", parent: g });
    const bar = (i, col) => F.el("rect", { x: RXC, y: R0(i) - 4, width: 5, height: 88, rx: 2.5, fill: col }, g);
    const rule = (i) => F.el("line", { x1: RIN, x2: RMAX, y1: R0(i) + 94, y2: R0(i) + 94, stroke: "#e2e8f0" }, g);
    // 1 · which pairs attend: the real 7x7 mask, 14 of the 42 off-diagonal cells lit
    bar(0, C.xview);
    for (let q = 0; q < 7; q++) for (let k = 0; k < 7; k++) {
      const on = (NB[q] || []).includes(k);
      F.el("rect", { x: RIN + k * 15, y: R0(0) + q * 12, width: 13, height: 10, rx: 2, fill: q === k ? "#e2e8f0" : on ? C.xview : "#f1f5f9" }, g);
    }
    F.text(RMAX, R0(0) + 44, "1/3", { cls: "h", parent: g, anchor: "end", fill: C.xview });
    F.text(RMAX, R0(0) + 76, "of dense cost", { cls: "xs", parent: g, anchor: "end" });
    rule(0);
    // 2 · where camera identity goes: into adaLN, never into the rotary code, which keeps its q-k angle
    bar(1, C.cond);
    const dc = [RIN + 34, R0(1) + 34];
    F.el("circle", { cx: dc[0], cy: dc[1], r: 32, fill: "#eff6ff", stroke: "#bfdbfe", "stroke-width": 1.5 }, g);
    F.el("line", { x1: dc[0], y1: dc[1], x2: dc[0] + 20, y2: dc[1] - 20, stroke: C.data, "stroke-width": 3, "stroke-linecap": "round", "marker-end": "url(#a-data)" }, g);
    F.el("line", { x1: dc[0], y1: dc[1], x2: dc[0] + 2, y2: dc[1] - 27, stroke: C.mem, "stroke-width": 3, "stroke-linecap": "round", "marker-end": "url(#a-mem)" }, g);
    F.el("circle", { cx: dc[0] + 26, cy: dc[1] + 26, r: 11, fill: C.xview }, g);
    F.el("path", { d: `M${dc[0] + 21},${dc[1] + 26} l4,4 l7,-8`, fill: "none", stroke: "#fff", "stroke-width": 2.4, "stroke-linecap": "round", "stroke-linejoin": "round" }, g);
    F.text(dc[0], R0(1) + 84, "RoPE", { cls: "xs", parent: g, anchor: "middle" });
    for (let v = 0; v < 7; v++) F.el("circle", { cx: RIN + 88 + v * 15, cy: R0(1) + 14, r: 6.5, fill: vcol[v] }, g);
    F.el("path", { d: `M${RIN + 88 + 45},${R0(1) + 24} V${R0(1) + 40}`, fill: "none", stroke: C.cond, "stroke-width": 2.4, "marker-end": "url(#a-cond)" }, g);
    F.el("rect", { x: RIN + 88, y: R0(1) + 44, width: 92, height: 34, rx: 10, fill: "#fff7ed", stroke: C.cond, "stroke-width": 1.8 }, g);
    F.el("text", { x: RIN + 134, y: R0(1) + 68, "text-anchor": "middle", class: "b", fill: C.cond }, g).textContent = "adaLN";
    F.text(RMAX, R0(1) + 44, "0", { cls: "h", parent: g, anchor: "end", fill: C.cond });
    F.text(RMAX, R0(1) + 76, "no new pos.", { cls: "xs", parent: g, anchor: "end" });
    rule(1);
    // 3 · how it starts: the cross-view branch is multiplied by a zero-initialised gate, so the block begins as an identity
    bar(2, C.data);
    const ym = R0(2) + 56, yb = R0(2) + 18;
    F.el("path", { d: `M${RIN},${ym} H${RIN + 134}`, fill: "none", stroke: C.data, "stroke-width": 3 }, g);
    F.el("path", { d: `M${RIN + 156},${ym} H${RIN + 214}`, fill: "none", stroke: C.data, "stroke-width": 3, "marker-end": "url(#a-data)" }, g);
    F.el("path", { d: `M${RIN + 14},${ym} V${yb} H${RIN + 30}`, fill: "none", stroke: C.xview, "stroke-width": 2.6 }, g);
    F.el("rect", { x: RIN + 30, y: yb - 15, width: 72, height: 30, rx: 8, fill: "#ecfdf5", stroke: C.xview, "stroke-width": 1.8 }, g);
    F.el("text", { x: RIN + 66, y: yb + 7, "text-anchor": "middle", class: "xs", fill: "#065f46" }, g).textContent = "x-view";
    F.el("path", { d: `M${RIN + 102},${yb} H${RIN + 116}`, fill: "none", stroke: C.xview, "stroke-width": 2.6 }, g);
    F.el("circle", { cx: RIN + 130, cy: yb, r: 14, fill: "#fff", stroke: "#0f172a", "stroke-width": 2 }, g);
    F.el("text", { x: RIN + 130, y: yb + 7, "text-anchor": "middle", "font-size": 20, "font-weight": 800, fill: "#0f172a" }, g).textContent = "0";
    F.el("path", { d: `M${RIN + 144},${yb} H${RIN + 145} Q${RIN + 145},${yb} ${RIN + 145},${yb} V${ym - 12}`, fill: "none", stroke: C.xview, "stroke-width": 2.6, "marker-end": "url(#a-xview)" }, g);
    F.el("circle", { cx: RIN + 145, cy: ym, r: 12, fill: "#fff", stroke: "#0f172a", "stroke-width": 1.8 }, g);
    F.el("path", { d: `M${RIN + 139},${ym} h12 M${RIN + 145},${ym - 6} v12`, stroke: "#0f172a", "stroke-width": 2 }, g);
    F.text(RMAX, R0(2) + 44, "≈0", { cls: "h", parent: g, anchor: "end", fill: C.data });
    F.text(RMAX, R0(2) + 76, "at start", { cls: "xs", parent: g, anchor: "end" });
  }
  // the three panels are one real network call: noisy input, the velocity the network returns, the frame one step away
  const PC = { x: RXC, y: 444, w: RWC, h: 412 };
  F.node("predcard", { x: PC.x, y: PC.y, w: PC.w, h: PC.h, kind: "ink", fill: "#fbfdff", stroke: "#bfdbfe", rx: 20, step: S.out });
  const PW = 130, PH = Math.round(PW * 480 / 832), BW = RMAX - RIN, BH = Math.round(BW * 480 / 832);
  const IY = PC.y + 80, CY0 = PC.y + 182;
  F.text(RIN, PC.y + 42, "What it predicts", { cls: "h2", step: S.out, id: "predtitle" });
  F.text(RIN, PC.y + 70, "input · σ = 0.94", { cls: "xs", step: S.out, id: "pl1" });
  F.text(RMAX - PW, PC.y + 70, "velocity v̂", { cls: "xs", step: S.out, id: "pl2" });
  F.img("assets/denoise/k1_v0_s1_xt.jpg", RIN, IY, PW, PH, { id: "pxt", step: S.out, rx: 6 });
  F.img("assets/denoise/k1_v0_s1_vel.png", RMAX - PW, IY, PW, PH, { id: "pvel", step: S.out, rx: 6, pixelated: true });
  F.img("assets/denoise/k1_v0_s1_x0.jpg", RIN, CY0, BW, BH, { id: "px0", step: S.out, rx: 8, stroke: C.data, sw: 2 });
  F.chip(RIN + 10, CY0 + 10, "clean frame", { step: S.out, id: "pl3", fill: "#fff", color: C.data, stroke: C.data });
  F.math("x0", RXC + RWC / 2, CY0 + BH + 30, { step: S.out, id: "x0math", anchor: "middle", s: 1.05 });
  F.edge("e-out", [[XS, YE], [XS, 1044], [1203, 1044], [1203, IY + PH / 2], [RIN - 4, IY + PH / 2]], { step: S.out, to: "pxt", kind: "data", draw: [0.1, 0.55], r: 12 });
  F.edge("e-v", [[RIN + PW + 3, IY + PH / 2], [RMAX - PW - 4, IY + PH / 2]], { step: S.out, from: "pxt", to: "pvel", kind: "data", draw: [0.55, 0.7] });
  F.edge("e-x0", [[RMAX - PW / 2, IY + PH + 4], [RMAX - PW / 2, CY0 - 3]], { step: S.out, from: "pvel", to: "px0", kind: "data", draw: [0.7, 0.85] });
  const key = F.el("g", {}, F.layer);
  F.el("rect", { x: RXC, y: 870, width: RWC, height: 182, rx: 20, fill: "#f8fafc", stroke: "#e2e8f0" }, key);
  F.el("text", { x: RIN, y: 906, class: "h2" }, key).textContent = "Reading the figure";
  F.legend(RIN, 936, [["data", "tokens"], ["xview", "cross-view"]]);
  F.legend(RIN, 966, [["cond", "control"], ["mem", "memory"]]);
  const sym = (x, y, s, t) => F.text(x, y, `<tspan font-family='Times New Roman' font-style='italic' font-size='24'>${s}</tspan>  ${t}`, { cls: "xs", parent: key });
  sym(RIN, 1008, "σ", "noise level"); sym(RIN, 1038, "N(v)", "rig neighbours of v");

  // pulses
  F.pulse("e-in", S.sa, { t0: 0, t1: 0.2 });
  for (const r of ROWS) { F.pulse(`${r.id}-in`, r.s, { t0: 0.2, t1: 0.35, to: r.id }); F.pulse(`${r.id}-out`, r.s, { t0: 0.8, t1: 0.97, kind: r.kind === "xview" ? "xview" : "data", to: `${r.id}-sum` }); }
  F.pulse("ada-bus", S.ada, { t0: 0.1, t1: 0.45 });
  for (const k of ["sa", "tx", "mlp"]) F.pulse(`ada-${k}`, S.ada, { t0: 0.5, t1: 0.65, to: k, seg: 14 });
  F.pulse("e-out", S.out, { t0: 0.1, t1: 0.5, to: "pxt" });
  F.pulse("e-v", S.out, { t0: 0.55, t1: 0.68, to: "pvel" });
  F.pulse("e-x0", S.out, { t0: 0.7, t1: 0.83, to: "px0" });

  // ═══ mechanics ═════════════════════════════════════════════════════════════════════════
  const OM = 0.5;  // rotary angle per chunk (radians): illustration of the relative-phase law, not a trained value
  F.hook(({ s, p, isStatic }) => {
    const stack = isStatic || s > S.rig ? 1 : s === S.rig ? ease(clamp01((p - 0.2) / 0.6)) : 0;
    ghosts.forEach((back) => back.forEach((g, i) => g.setAttribute("transform", `translate(${(5 * (2 - i) * stack).toFixed(2)} ${(-5 * (2 - i) * stack).toFixed(2)})`)));
    const active = s === S.tok && !isStatic, done = isStatic || s > S.tok;
    const split = done ? 1 : active ? clamp01(p / 0.25) : 0;
    const fly = done ? 1 : active ? ease(clamp01((p - 0.3) / 0.45)) : 0;
    const fuse = done ? 1 : active ? ease(clamp01((p - 0.8) / 0.2)) : 0;
    for (const P of PATCH) {
      const gap = 3 * split * (1 - fly);
      const sx = P.x0 + (P.c - (GC - 1) / 2) * gap, sy = P.y0 + (P.r - (GR - 1) / 2) * gap;
      const tx = STRIP.x + P.i * STRIP.pitch, ty = STRIP.y + (P.kind === "cond" ? 24 * (1 - fuse) : 0);
      const x = lerp(sx, tx, fly), y = lerp(sy, ty, fly), w = lerp(P.w0, STRIP.s, fly), h = lerp(P.h0, STRIP.s + 2, fly);
      for (const e of [P.sv, P.fr]) { e.setAttribute("x", x); e.setAttribute("y", y); e.setAttribute("width", w); e.setAttribute("height", h); }
      const o = split <= 0 ? 0 : P.kind === "cond" ? 1 - 0.6 * fuse : 1;
      P.sv.style.opacity = o; P.fr.style.opacity = o;
    }
    // self-attention: ONE clock. The query chunk q walks along the timeline; its key is q-2. The mask cell (q, q-2),
    // the tile pair and the dial are the same event; every cell with offset 2 shares the dial's relative angle.
    const cur = isStatic || s !== S.sa ? 7 : 2 + Math.min(5, Math.floor(p * 6));
    tiles.forEach((tl, i) => { const isQ = i === cur, isM = i === cur - 1 || i === cur - 2; tl.o.setAttribute("stroke", isQ ? C.data : isM ? C.mem : "#fff"); tl.o.setAttribute("stroke-width", isQ || isM ? 3.4 : 2); tl.o.setAttribute("opacity", i > cur ? 0.35 : i < cur - 2 ? 0.6 : 1); });
    arcs.forEach((a, j) => {
      const to = cur - 1 - j, x1 = tiles[cur].x + TILE.w / 2 - 6 + j * 12, x2 = tiles[Math.max(0, to)].x + TILE.w / 2, y0 = TILE.y - 4, hh = 22 + 16 * j;
      a.setAttribute("d", `M${x1},${y0} C${x1},${y0 - hh} ${x2},${y0 - hh} ${x2},${y0}`); a.setAttribute("opacity", to >= 0 ? 1 : 0);
    });
    for (const c of mcells) {
      const act = c.q === cur && c.k === cur - 2, same = c.d === 2;
      c.r.setAttribute("stroke", act ? "#0f172a" : same ? "#0f172a" : "none"); c.r.setAttribute("stroke-width", act ? 2.6 : 1);
      c.r.setAttribute("stroke-opacity", act ? 1 : same ? 0.45 : 0);
    }
    const ang = (i) => 0.5 - OM * i, R = DR - 5;
    const put = (l, a) => { l.setAttribute("x2", DO[0] + R * Math.cos(a)); l.setAttribute("y2", DO[1] + R * Math.sin(a)); };
    put(qv, ang(cur)); put(kv, ang(cur - 2)); put(gq, ang(cur - 2)); put(gk, ang(cur - 4));
    // cross-view: cycle the query camera; neighbours light up in the ring, the mask and the rig
    const q7 = s === S.xv && !isStatic ? Math.min(6, Math.floor(p * 7)) : -1;
    bmCells.forEach((c) => c.g.setAttribute("opacity", q7 < 0 || c.q === q7 ? 1 : 0.22));
    for (const [k, e] of Object.entries(edgeEl)) {
      const [a, b] = k.split("-").map(Number);
      const hit = q7 >= 0 && ((a === q7 && NB[q7].includes(b)) || (b === q7 && NB[q7].includes(a)));
      for (const el of [e, ringEdge[k]]) { el.setAttribute("stroke-width", hit ? 6 : 3); el.setAttribute("stroke-opacity", q7 < 0 || hit ? 1 : 0.2); }
    }
    for (const [v, g] of Object.entries(ringNode)) {
      const isQ = +v === q7, isN = q7 >= 0 && NB[q7].includes(+v);
      g.setAttribute("opacity", q7 < 0 || isQ || isN ? 1 : 0.3);
      g.firstChild.setAttribute("stroke", isQ ? "#0f172a" : isN ? C.xview : "#fff"); g.firstChild.setAttribute("stroke-width", isQ || isN ? 4 : 2);
    }
    for (const [v, r] of Object.entries(tileRect)) {
      const isQ = +v === q7, isN = q7 >= 0 && NB[q7].includes(+v);
      r.setAttribute("stroke", isQ ? C.data : isN ? C.xview : "#fff"); r.setAttribute("stroke-width", isQ || isN ? 4 : 2);
    }
    frameHi.setAttribute("opacity", q7 >= 0 ? 1 : 0);
    if (q7 >= 0) frameHi.setAttribute("x", BAR.x + ((p * 7) % 1) * (segW - 6));
    seg.forEach((r, v) => r.setAttribute("opacity", s === S.sa && !isStatic ? (v === 0 ? 1 : 0.3) : 1));
  });

  const steps = [
    { short: "Rig", dur: 4.5, focus: ["rig"], title: "Seven cameras, one rig graph",
      text: "The seven views sit at their real headings and fields of view. Green marks where neighbours overlap: the three front views share a wide band, and each front-side camera overlaps its rear-side neighbour. A wider lens reaches less far, so the 30° tele cones are the longest. This graph, not all 42 pairs, decides who talks to whom." },
    { short: "Tokens", dur: 7, focus: ["vimg", "mimg", "vlab", "mlab", "patches", "ptxt", "addmap", "bar", "tokmath", "tokinfo", "e-in"], title: "Video and layout become one token sequence",
      text: "Each camera's latent video is cut into patches, one token per patch. The layout map has its <b>own</b> patch embedding and is <b>added</b> to the video tokens, so it steers every token without lengthening the sequence." },
    { short: "Time", dur: 8, focus: ["sa", "sa-in", "sa-out", "sa-sum", "e-in", "e-stream", "bar"], title: "Self-attention: time, inside one camera",
      text: "Cameras are folded into the batch, so every camera attends only to its own past. Rotary positions make the score depend on the <b>offset</b> Δ = q − k only: every pair at the same offset (outlined) has the same relative phase on the dial, whatever the absolute time. That is why one set of weights runs under the full, the causal and the sliding-window mask." },
    { short: "Cross-view", dur: 8, focus: ["xv", "xv-in", "xv-out", "xv-sum", "rig", "bar"], title: "Cross-view attention: space, inside one frame",
      text: "Time is folded into the batch instead. In each frame a camera attends to its rig neighbours only: 14 of 42 directed pairs, one third of dense cost, and no cross-view KV cache because it never looks at another time. The branch has no adaLN gate and a near-zero output projection, so it starts as an identity." },
    { short: "Text, MLP", dur: 4, focus: ["tx", "mlp", "tx-in", "tx-out", "tx-sum", "mlp-in", "mlp-out", "mlp-sum"], title: "Text attention and MLP",
      text: "Standard parts, kept small. The single caption is written into the front camera's slot; the other cameras receive the empty prompt." },
    { short: "adaLN", dur: 5, focus: ["ada", "adanote", "ada-bus", "ada-sa", "ada-tx", "ada-mlp", "sa", "tx", "mlp"], title: "adaLN carries noise level and camera identity",
      text: "The noise level and a learned camera embedding produce scale γ, shift β and gate α. Camera identity enters only here, never through positions, so every camera shares one timeline and the pretrained positional code is untouched." },
    { short: "Predict", dur: 6, focus: ["predcard", "predtitle", "pxt", "pvel", "px0", "pl1", "pl2", "pl3", "x0math", "e-out", "e-v", "e-x0", "e-loop"], title: "28 blocks, then velocity, then a clean frame",
      text: "After 28 blocks the network predicts a velocity <i>v̂</i> for every latent; the noise-free frame is one step away. The three panels are one real network call." },
    { short: "Summary", dur: 5, focus: ["keycard"], title: "Three design choices",
      text: "One third of the dense cross-view cost, an architecture that starts as the single-view model it was initialised from, and no change to positional encoding." },
  ];
  return { title: "Network", steps, caption: "<b>Figure 1 · Network.</b> Each camera's latent video is patchified; the HDMap layout is added through its own patch embedding. Every one of 28 DiT blocks alternates temporal self-attention inside a camera, whose score depends only on the offset Δ = q − k, with sparse cross-view attention inside a frame over the 14-edge rig graph. Camera identity enters only through adaLN. Frames are real; the right column is one real network call." };
});
