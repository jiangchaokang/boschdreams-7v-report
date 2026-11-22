/* Figure 5 · Closed-loop, unbounded simulation */
BD.figure("fig5", (F, BD) => {
  const { C, CAM, pad3, lerp, ease, clamp01 } = BD;
  const S = { loop: 0, feed: 1, mem: 2, roll: 3, rebase: 4 };

  // ═══ (a) the closed loop ═════════════════════════════════════════════════════════════════
  // Ego keys, traffic, map and HDMap renders are the recorded scene of the BoschDreams simulator (tools/make_scene.py);
  // the bird's-eye view follows the cockpit's own drawing: ego-up, camera cones, goals, light palette.
  const SC = window.HIW_SCENE, NF = SC.frames.length, DT = SC.stride / SC.fps;
  const A = { x: 28, y: 24, w: 1544, h: 420 };
  F.node("pa", { x: A.x, y: A.y, w: A.w, h: A.h, kind: "ink", fill: "#fbfdff", stroke: "#bfdbfe", rx: 22, step: 0, always: true });
  F.text(50, 62, "(a)  A reactive, long-horizon, closed-loop simulation", { cls: "h2" });
  const NY = 84, NH = 250, GAP = 18, NWS = [196, 340, 212, 210, 240, 200];
  const nodeX = (i) => 52 + NWS.slice(0, i).reduce((s, w) => s + w, 0) + GAP * i;
  const N = [
    { t: "Ego control", s: ["recorded input", "pose every tick"], kind: "cond" },
    { t: "Traffic agents", kind: "cond" },
    { t: "HDMap render", s: ["layout for all 7", "cameras"], kind: "cond" },
    { t: "Conditioning", s: ["layout + memory", "+ caption"], kind: "mem" },
    { t: "7V generation", s: ["a few steps, then", "one memory write"], kind: "data" },
    { t: "Streaming", s: ["decode, then push", "to the viewer"], kind: "ink" },
  ];
  const E = {};
  N.forEach((n, i) => {
    const x = nodeX(i), id = `n${i}`;
    F.node(id, { x, y: NY, w: NWS[i], h: NH, kind: n.kind, step: S.loop, rx: 18 });
    const g = F.byId[id].g;
    F.el("circle", { cx: x + 20, cy: NY + 26, r: 12, fill: "#0f172a" }, g);
    F.el("text", { x: x + 20, y: NY + 31, "text-anchor": "middle", "font-size": 18, "font-weight": 800, fill: "#fff" }, g).textContent = String(i + 1);
    F.text(x + 38, NY + 32, n.t, { cls: "b", parent: g });
    if (n.s) F.text(x + 14, NY + NH - 34, n.s, { cls: "xs", parent: g, lh: 19 });
    E[i] = { g, x, w: NWS[i] };
  });

  // 1 · ego control: a steering wheel and pedals driven by the recorded driver state
  {
    const { g, x } = E[0], cx = x + 76, cy = NY + 101, R = 47;
    const wheel = F.el("g", {}, g);
    F.el("circle", { cx, cy, r: R, fill: "#f8fafc", stroke: "#334155", "stroke-width": 8 }, wheel);
    F.el("circle", { cx, cy, r: R - 8, fill: "none", stroke: "#94a3b8", "stroke-width": 1.3 }, wheel);
    for (const a of [-Math.PI / 2, Math.PI / 6, 5 * Math.PI / 6]) {
      const dx = Math.cos(a), dy = Math.sin(a);
      F.el("path", { d: `M${cx + dx * 13},${cy + dy * 13} L${cx + dx * 38},${cy + dy * 38}`, stroke: "#475569", "stroke-width": 9, "stroke-linecap": "round" }, wheel);
    }
    F.el("circle", { cx, cy, r: 15, fill: "#334155", stroke: "#0f172a", "stroke-width": 1.5 }, wheel);
    F.el("path", { d: `M${cx - 5},${cy + 4} L${cx},${cy - 5} L${cx + 5},${cy + 4} Z`, fill: "#fff" }, wheel);
    F.el("circle", { cx, cy: cy - R, r: 4, fill: C.cond, stroke: "#fff", "stroke-width": 1.5 }, wheel);
    E.wheel = wheel;
    E.pedals = [["s", 0, 24], ["w", 34, 15]].map(([k, dx, w]) => {
      const px = x + 136 + dx, py = NY + 70;
      F.el("rect", { x: px - 4, y: py - 4, width: w + 8, height: 74, rx: 7, fill: "#e2e8f0" }, g);
      return { k, py, r: F.el("rect", { x: px, y: py, width: w, height: 58, rx: 4 }, g) };
    });
    E.spd = F.el("text", { x: cx, y: NY + 178, "text-anchor": "middle", class: "b" }, g);
  }

  // 2 · traffic agents: bird's-eye view of the recorded scene, 5 px per metre, ego-up
  const VX = nodeX(1) + 10, VY = NY + 44, VW = NWS[1] - 20, VH = NH - 44 - 58, K = 5, OX = VX + VW / 2, OY = VY + VH * 0.74;
  const PAL = { bg: "#f0f4fa", road_edge: "#e11d48", crosswalks: "#141e32", wait_lines: "#d97706", lane_center_line: "#2563eb", white: "#1e293b", yellow: "#b45309",
    car: "#1d4ed8", truck: "#b45309", pedestrian: "#dc2626", cyclist: "#15803d", ego: "#0088cc" };
  // style: [colour key, px width, dash (m), opacity]
  const MAPSTYLE = { road_edge: ["road_edge", 2.4], crosswalks: ["crosswalks", 2.0, "1 1", 0.75], wait_lines: ["wait_lines", 2.0], lane_center_line: ["lane_center_line", 1.0, "2 2", 0.4],
    white: ["white", 1.6, null, 0.85], white_dash: ["white", 1.6, "2.5 1.8", 0.85], yellow: ["yellow", 1.6], yellow_dash: ["yellow", 1.6, "2.5 1.8"] };
  const CONES = [[0, 120, 35], [0, 30, 60], [Math.PI / 3, 120, 25], [-Math.PI / 3, 120, 25], [2 * Math.PI / 3, 70, 25], [-2 * Math.PI / 3, 70, 25], [Math.PI, 30, 40]];  // the cockpit's camera cones
  const catKey = (c) => (c === "bus" ? "truck" : c === "motorcycle" ? "cyclist" : ["truck", "pedestrian", "cyclist"].includes(c) ? c : "car");
  const HIDE = "-9999,-9999 -9999,-9999 -9999,-9999";
  const ptsStr = (poly) => (poly.length ? poly.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(" ") : HIDE);
  const clipPoly = (poly, R) => {
    const X = (a, b, x) => [x, a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1])], Y = (a, b, y) => [a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]), y];
    const edges = [[(q) => q[0] >= R.x0, (a, b) => X(a, b, R.x0)], [(q) => q[0] <= R.x1, (a, b) => X(a, b, R.x1)], [(q) => q[1] >= R.y0, (a, b) => Y(a, b, R.y0)], [(q) => q[1] <= R.y1, (a, b) => Y(a, b, R.y1)]];
    let out = poly;
    for (const [inside, hit] of edges) {
      const inp = out; out = [];
      for (let i = 0; i < inp.length; i++) {
        const a = inp[i], b = inp[(i + 1) % inp.length], ia = inside(a), ib = inside(b);
        if (ia) { out.push(a); if (!ib) out.push(hit(a, b)); } else if (ib) out.push(hit(a, b));
      }
      if (!out.length) break;
    }
    return out;
  };
  const clipSeg = (a, b, R) => {   // Liang-Barsky: the part of segment ab inside R, or null
    let t0 = 0, t1 = 1; const dx = b[0] - a[0], dy = b[1] - a[1];
    for (const [pp, qq] of [[-dx, a[0] - R.x0], [dx, R.x1 - a[0]], [-dy, a[1] - R.y0], [dy, R.y1 - a[1]]]) {
      if (pp === 0) { if (qq < 0) return null; } else { const r = qq / pp; if (pp < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; } }
    }
    return [t0 === 0 ? a : [a[0] + t0 * dx, a[1] + t0 * dy], t1 === 1 ? b : [a[0] + t1 * dx, a[1] + t1 * dy]];
  };
  const pathD = (pts, R) => {      // a polyline as a path, broken where it leaves the rectangle
    let d = "", last = null;
    for (let i = 1; i < pts.length; i++) {
      const sg = clipSeg(pts[i - 1], pts[i], R);
      if (!sg) { last = null; continue; }
      d += last && last[0] === sg[0][0] && last[1] === sg[0][1] ? `L${sg[1][0].toFixed(1)},${sg[1][1].toFixed(1)}` : `M${sg[0][0].toFixed(1)},${sg[0][1].toFixed(1)}L${sg[1][0].toFixed(1)},${sg[1][1].toFixed(1)}`;
      last = sg[1];
    }
    return d;
  };

  {
    const { g, x } = E[1];
    F.text(x + NWS[1] - 12, NY + 32, "ego-up", { cls: "xs", parent: g, anchor: "end" });
    // Every shape is clipped to the viewport rectangle in code (Sutherland-Hodgman / Liang-Barsky), so the picture is exact in any renderer.
    const R = { x0: VX, y0: VY, x1: VX + VW, y1: VY + VH };
    E.R = R;
    const bev = F.el("g", {}, g);
    F.el("rect", { x: VX, y: VY, width: VW, height: VH, rx: 8, fill: PAL.bg }, bev);
    for (const [ang, fov, dist] of CONES) {
      const h = (fov / 2) * Math.PI / 180, r = dist * K, poly = [[OX, OY]];
      for (let k = 0; k <= 24; k++) { const a2 = ang - h + (2 * h * k) / 24; poly.push([OX - r * Math.sin(a2), OY - r * Math.cos(a2)]); }
      F.el("polygon", { points: ptsStr(clipPoly(poly, R)), fill: PAL.ego, "fill-opacity": 0.07, stroke: PAL.ego, "stroke-opacity": 0.3, "stroke-width": 0.8 }, bev);
    }
    E.map = Object.entries(MAPSTYLE).filter(([name]) => SC.map[name]).map(([name, [col, w, dash, op]]) =>
      ({ name, el: F.el("path", { fill: "none", stroke: PAL[col], "stroke-width": w, "stroke-dasharray": dash ? dash.split(" ").map((v) => v * K).join(" ") : undefined, "stroke-opacity": op || 1, "stroke-linejoin": "round" }, bev) }));
    E.trail = F.el("path", { fill: "none", stroke: PAL.ego, "stroke-width": 3, "stroke-opacity": 0.8 }, bev);
    E.ahead = F.el("path", { fill: "none", stroke: PAL.ego, "stroke-width": 2, "stroke-dasharray": "4 4", "stroke-opacity": 0.8 }, bev);
    E.goals = Array.from({ length: 60 }, () => ({ l: F.el("path", { fill: "none", "stroke-width": 1.2, "stroke-opacity": 0.55, "stroke-dasharray": "3 2.5" }, bev), c: F.el("circle", { r: 4, fill: "none", "stroke-width": 1.2, "stroke-opacity": 0.7, cx: -9999, cy: -9999 }, bev) }));
    E.actors = Array.from({ length: 140 }, () => ({ r: F.el("polygon", { points: HIDE, fill: "#ffffff", "fill-opacity": 0.85, "stroke-width": 1.8 }, bev), t: F.el("polygon", { points: HIDE }, bev) }));
    // the ego body of the cockpit: 4.9 x 2.0 m, glass, head and tail lights, heading pointer
    const e = F.el("g", { transform: `translate(${OX} ${OY})` }, bev), L = 4.9 * K, Wd = 2 * K;
    F.el("rect", { x: -Wd / 2, y: -L / 2, width: Wd, height: L, rx: 2.5, fill: PAL.ego }, e);
    F.el("rect", { x: -Wd / 2 + 1.2, y: -L / 4, width: Wd - 2.4, height: L / 2, rx: 1.5, fill: "#ffffff", "fill-opacity": 0.7 }, e);
    for (const sx of [-1, 1]) {
      F.el("rect", { x: sx * (Wd / 2 - 2.6) - 0.8, y: -L / 2 + 1, width: 1.6, height: 2, fill: "#ffffff" }, e);
      F.el("rect", { x: sx * (Wd / 2 - 2.6) - 0.8, y: L / 2 - 3, width: 1.6, height: 2, fill: "#ff0033" }, e);
    }
    F.el("line", { x1: 0, y1: -L / 2, x2: 0, y2: -L / 2 - 2.5 * K, stroke: PAL.ego, "stroke-width": 2 }, e);
    E.time = F.el("text", { x: VX + 8, y: VY + 18, class: "xs" }, bev);
    let lx = VX + 2;
    [["car", PAL.car], ["truck", PAL.truck]].forEach(([t, c]) => {
      F.el("rect", { x: lx, y: NY + NH - 46, width: 13, height: 13, rx: 3, fill: "#fff", stroke: c, "stroke-width": 2 }, g);
      F.text(lx + 19, NY + NH - 35, t, { cls: "xs", parent: g }); lx += 19 + t.length * 11 + 22;
    });
    F.el("path", { d: `M${lx},${NY + NH - 40} h14`, stroke: "#64748b", "stroke-width": 1.6, "stroke-dasharray": "3 2" }, g);
    F.text(lx + 20, NY + NH - 35, "3.5 s goal", { cls: "xs", parent: g });
    lx = VX + 2;
    [["pedestrian", PAL.pedestrian], ["cyclist", PAL.cyclist]].forEach(([t, c]) => {
      F.el("rect", { x: lx, y: NY + NH - 23, width: 13, height: 13, rx: 3, fill: "#fff", stroke: c, "stroke-width": 2 }, g);
      F.text(lx + 19, NY + NH - 12, t, { cls: "xs", parent: g }); lx += 19 + t.length * 11 + 22;
    });
  }

  // 3 · HDMap render: the real layout render of the same frame
  {
    const { g, x } = E[2];
    E.vec = F.img(`assets/vec/f${SC.ids[NF - 1]}.jpg`, x + 10, NY + 48, 170, 96, { parent: g, rx: 6, stroke: C.cond, sw: 2 })._img;
    E.vecT = F.text(x + 10, NY + 170, "", { cls: "xs", parent: g });
  }
  // 4 · conditioning
  {
    const { g, x } = E[3];
    [["layout", C.cond], ["memory", C.mem], ["caption", "#9a3412"]].forEach(([t, c], k) => {
      F.el("rect", { x: x + 14, y: NY + 54 + k * 34, width: 152, height: 26, rx: 13, fill: c, "fill-opacity": 0.16, stroke: c }, g);
      F.el("text", { x: x + 90, y: NY + 73 + k * 34, "text-anchor": "middle", "font-size": 19, "font-weight": 700, fill: c }, g).textContent = t;
    });
  }
  // 5 · 7V generation and 6 · streaming: real rollout frames (an example rollout of another clip)
  {
    const { g, x } = E[4];
    E.gen = F.img("assets/clip/gen_v0_f092_s.jpg", x + 10, NY + 48, 180, 99, { parent: g, rx: 6, stroke: C.data, sw: 2 })._img;
    E.genT = F.text(x + 10, NY + 170, "", { cls: "xs", parent: g });
    const o = E[5];
    E.out = F.img("assets/clip/gen_v0_f092_s.jpg", o.x + 10, NY + 48, 160, 88, { parent: o.g, rx: 6 })._img;
    F.el("rect", { x: o.x + 16, y: NY + 106, width: 34, height: 24, rx: 6, fill: "#0f172a", "fill-opacity": 0.78 }, o.g);
    F.el("path", { d: `M${o.x + 28},${NY + 112} L${o.x + 40},${NY + 118} L${o.x + 28},${NY + 124} Z`, fill: "#fff" }, o.g);
    E.outT = F.text(o.x + 10, NY + 170, "", { cls: "xs", parent: o.g });
  }
  E.rings = N.map((_, i) => F.el("rect", { x: nodeX(i) - 3, y: NY - 3, width: NWS[i] + 6, height: NH + 6, rx: 21, fill: "none", stroke: "#0f172a", "stroke-width": 3.2, opacity: 0 }, F.layer));

  const edgeKind = ["cond", "cond", "cond", "mem", "data"];
  for (let i = 0; i < 5; i++) {
    const x1 = nodeX(i) + NWS[i], x2 = nodeX(i + 1);
    F.edge(`lf${i}`, [[x1 + 2, NY + NH / 2], [x2 - 2, NY + NH / 2]], { kind: edgeKind[i], step: S.loop, from: `n${i}`, to: `n${i + 1}`, draw: [i * 0.12, i * 0.12 + 0.14] });
  }
  F.edge("lback", [[nodeX(5) + NWS[5] / 2, NY + NH + 2], [nodeX(5) + NWS[5] / 2, NY + NH + 38], [nodeX(0) + NWS[0] / 2, NY + NH + 38], [nodeX(0) + NWS[0] / 2, NY + NH + 2]],
    { kind: "ink", step: S.feed, from: "n5", to: "n0", draw: [0, 0.8], r: 14, label: "next tick: the new pose and the new scene state close the loop", labelAt: [(nodeX(0) + nodeX(5) + NWS[5]) / 2, NY + NH + 30], lcls: "s" });
  {
    let cx = 50;
    [["agents react to the ego vehicle", "#fff7ed", "#9a3412"], ["layout is rendered live", "#fff7ed", "#9a3412"], ["any length: memory stays constant", "#f5f3ff", "#5b21b6"], ["seven views share one layout", "#ecfdf5", "#065f46"]].forEach(([t, bg, fg], i) => {
      const c = F.chip(cx, NY + NH + 56, t, { fill: bg, color: fg, size: 19.5, step: S.feed, id: `chip${i + 1}` }); cx += c.chipW + 14;
    });
  }

  // the recorded scene at a fractional frame: ego and actors interpolated between the two kept frames
  const byId = SC.frames.map((fr) => new Map(fr.map((a) => [a[0], a])));
  const wrap = (d) => Math.atan2(Math.sin(d), Math.cos(d));
  // A tracker's heading is noise for a near-stationary agent (a parked cyclist flips 4.7 rad in 0.4 s), which draws as a spinning box.
  // Below SLOW the last trustworthy heading is held; above it, a heading contradicting the direction of travel by > 90 degrees is replaced by it.
  const SLOW = 0.5, yawFix = SC.frames.map(() => new Map()), lastGood = new Map();
  SC.frames.forEach((fr, i) => fr.forEach((a) => {
    const prev = i ? byId[i - 1].get(a[0]) : null;
    let yaw = a[4];
    if (prev) {
      const dx = a[2] - prev[2], dy = a[3] - prev[3], sp = Math.hypot(dx, dy) / DT;
      if (sp >= SLOW) { const dir = Math.atan2(dy, dx); if (Math.abs(wrap(yaw - dir)) > Math.PI / 2) yaw = dir; lastGood.set(a[0], yaw); }
      else if (lastGood.has(a[0])) yaw = lastGood.get(a[0]);
      else lastGood.set(a[0], yaw);
    } else lastGood.set(a[0], yaw);
    yawFix[i].set(a[0], yaw);
  }));
  const sceneAt = (u) => {
    const f = clamp01(u) * (NF - 1), i = Math.min(NF - 2, Math.floor(f)), a = f - i;
    const e0 = SC.ego[i], e1 = SC.ego[i + 1];
    const base = a < 0.5 ? i : i + 1, other = base === i ? i + 1 : i, t = base === i ? a : 1 - a;
    const actors = SC.frames[base].map((q) => {
      const o = byId[other].get(q[0]), y0 = yawFix[base].get(q[0]);
      if (!o) return { q, x: q[2], y: q[3], yaw: y0, goal: q[7], fade: 1 };
      // a goal that merely moves glides; one that is replaced or dropped (waypoint reached) fades out, and the next fades in, instead of popping
      const g0 = q[7], g1 = o[7], same = g0 && g1 && Math.hypot(g0[0] - g1[0], g0[1] - g1[1]) < 3;
      return { q, x: lerp(q[2], o[2], t), y: lerp(q[3], o[3], t), yaw: y0 + wrap(yawFix[other].get(q[0]) - y0) * t,
        goal: same ? [lerp(g0[0], g1[0], t), lerp(g0[1], g1[1], t)] : g0, fade: g0 && !same ? clamp01(1 - 2 * t) : 1 };
    });
    return { f, i, ego: { x: lerp(e0[0], e1[0], a), y: lerp(e0[1], e1[1], a), yaw: e0[2] + wrap(e1[2] - e0[2]) * a }, v: Math.hypot(e1[0] - e0[0], e1[1] - e0[1]) / DT, actors };
  };
  const pts = (arr) => arr.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");

  const controlAt = (u) => {
    const f = clamp01(u) * (NF - 1), a = Math.floor(f), b = Math.min(NF - 1, a + 1), q = ease(f - a);
    const ka = SC.keys[Math.min(NF - 1, a)], kb = SC.keys[b];
    const dir = (k) => (k.includes("a") ? -38 : k.includes("d") ? 38 : 0);
    return { angle: lerp(dir(ka), dir(kb), q), throttle: ka.includes("w") || kb.includes("w"), brake: ka.includes("s") || kb.includes("s") };
  };
  const updateLoop = (u, stage) => {
    const sc = sceneAt(u), ego = sc.ego, cs = Math.cos(ego.yaw), sn = Math.sin(ego.yaw), fr = Math.round(sc.f);
    const R = E.R, P = (x, y) => { const dx = x - ego.x, dy = y - ego.y; return [OX - K * (-sn * dx + cs * dy), OY - K * (cs * dx + sn * dy)]; };
    E.map.forEach(({ name, el }) => el.setAttribute("d", SC.map[name].map((l) => pathD(l.map((q) => P(q[0], q[1])), R)).join("")));
    E.trail.setAttribute("d", pathD(SC.ego.slice(Math.max(0, sc.i - 10), sc.i + 1).concat([[ego.x, ego.y]]).map((q) => P(q[0], q[1])), R));
    E.ahead.setAttribute("d", pathD([[ego.x, ego.y]].concat(SC.ego.slice(sc.i + 1, sc.i + 11)).map((q) => P(q[0], q[1])), R));
    let gi = 0;
    E.actors.forEach((slot, k) => {
      const m = sc.actors[k];
      const c0 = m && P(m.x, m.y);
      if (!m || c0[0] < R.x0 - 40 || c0[0] > R.x1 + 40 || c0[1] < R.y0 - 40 || c0[1] > R.y1 + 40) { slot.r.setAttribute("points", HIDE); slot.t.setAttribute("points", HIDE); return; }
      const [, cat, , , , L, W] = m.q, goal = m.goal, col = PAL[catKey(cat)], tri = Math.min(1.2, L * 0.35), c = Math.cos(m.yaw), n = Math.sin(m.yaw);
      const at = (lx, ly) => P(m.x + lx * c - ly * n, m.y + lx * n + ly * c);
      slot.r.setAttribute("points", ptsStr(clipPoly([at(L / 2, W / 2), at(L / 2, -W / 2), at(-L / 2, -W / 2), at(-L / 2, W / 2)], R))); slot.r.setAttribute("stroke", col);
      slot.t.setAttribute("points", ptsStr(clipPoly([at(L / 2, 0), at(L / 2 - tri, -W / 2), at(L / 2 - tri, W / 2)], R))); slot.t.setAttribute("fill", col);
      if (goal && gi < E.goals.length) {
        const gl = E.goals[gi++], gp = P(goal[0], goal[1]), inside = gp[0] > R.x0 + 5 && gp[0] < R.x1 - 5 && gp[1] > R.y0 + 5 && gp[1] < R.y1 - 5;
        gl.l.setAttribute("d", pathD([c0, gp], R)); gl.l.setAttribute("stroke", col); gl.l.setAttribute("stroke-opacity", (0.55 * m.fade).toFixed(3));
        gl.c.setAttribute("cx", inside ? gp[0] : -9999); gl.c.setAttribute("cy", gp[1]); gl.c.setAttribute("stroke", col); gl.c.setAttribute("stroke-opacity", (0.7 * m.fade).toFixed(3));
      }
    });
    for (; gi < E.goals.length; gi++) { E.goals[gi].l.setAttribute("d", ""); E.goals[gi].c.setAttribute("cx", -9999); }
    const ctl = controlAt(u), angle = ctl.angle;
    const wx = nodeX(0) + 76, wy = NY + 101;
    E.wheel.setAttribute("transform", `rotate(${angle.toFixed(2)} ${wx} ${wy})`);
    E.pedals.forEach(({ k, r, py }) => {
      const on = k === "w" ? ctl.throttle : ctl.brake;
      r.setAttribute("y", py + (on ? 9 : 0)); r.setAttribute("height", on ? 49 : 58);
      r.setAttribute("fill", on ? C.cond : "#94a3b8");
    });
    E.spd.textContent = `${sc.v.toFixed(1)} m/s`;
    E.time.textContent = `t = ${(fr * DT).toFixed(1)} s`;
    E.vec.setAttribute("href", `assets/vec/f${SC.ids[fr]}.jpg`);
    E.vecT.firstChild.textContent = `sim frame ${SC.ids[fr]}`;
    const chunk = 10 + Math.floor(sc.f / 4);
    E.gen.setAttribute("href", `assets/clip/gen_v0_f${pad3(8 * chunk + 4)}_s.jpg`);
    E.genT.firstChild.textContent = `chunk ${chunk}, other clip`;
    E.out.setAttribute("href", `assets/clip/gen_v0_f${pad3(8 * (chunk - 1) + 4)}_s.jpg`);
    E.outT.firstChild.textContent = `chunk ${chunk - 1} decoded`;
    E.rings.forEach((r, i) => r.setAttribute("opacity", i === stage ? 1 : 0));
  };

  // ═══ (b) memory + real rollout strip ═════════════════════════════════════════════════
  const BY = 468, BH = 575;
  F.node("pb", { x: 28, y: BY, w: 760, h: BH, kind: "mem", fill: "#fcfbff", stroke: "#ddd6fe", rx: 22, step: S.mem, always: true });
  F.text(50, BY + 40, "(b)  Memory: two chunks, window: three", { cls: "h2" });
  const memG = F.group({ id: "memg", step: S.mem });
  const MT = Array.from({ length: 6 }, (_, i) => {
    const x = 52 + i * 118;
    const im = F.img("assets/clip/gen_v0_f092_s.jpg", x, BY + 130, 104, 57, { parent: memG, rx: 5 });
    const o = F.el("rect", { x, y: BY + 130, width: 104, height: 57, rx: 5, fill: "none", stroke: "#fff", "stroke-width": 2 }, memG);
    return { x, im, o };
  });
  const memArcs = [4, 3].map(() => F.el("path", { fill: "none", stroke: C.mem, "stroke-width": 2.6, "marker-end": "url(#a-mem)" }, memG));
  F.el("path", { d: `M52,${BY + 206} V${BY + 214} H${52 + 2 * 118 + 104} V${BY + 206}`, fill: "none", stroke: "#cbd5e1", "stroke-width": 2.4 }, memG);
  F.el("path", { d: `M${52 + 3 * 118},${BY + 206} V${BY + 214} H${52 + 4 * 118 + 104} V${BY + 206}`, fill: "none", stroke: C.mem, "stroke-width": 2.4 }, memG);
  F.el("path", { d: `M${52 + 3 * 118},${BY + 244} V${BY + 252} H${52 + 5 * 118 + 104} V${BY + 244}`, fill: "none", stroke: "#94a3b8", "stroke-width": 1.6 }, memG);
  F.text(52, BY + 240, "evicted", { cls: "xs", parent: memG, fill: "#94a3b8" });
  F.text(52 + 3 * 118, BY + 240, "memory Mₖ: two chunks", { cls: "xs", parent: memG, fill: C.mem });
  F.text(52 + 5 * 118, BY + 240, "query", { cls: "xs", parent: memG, fill: C.data });
  F.text(52 + 3 * 118, BY + 278, "attention window: three chunks", { cls: "xs", parent: memG });
  F.math("window", 170, BY + 308, { step: S.mem, id: "m-win", anchor: "middle" });
  F.text(300, BY + 314, "fixed size: only temporal attention keeps K and V", { cls: "xs", step: S.mem, id: "memtxt" });
  F.el("line", { x1: 50, x2: 766, y1: BY + 336, y2: BY + 336, stroke: "#ddd6fe" }, F.layer);
  F.text(50, BY + 368, "A real rollout: 48 chunks, 38 s, every frame generated", { cls: "b", step: S.roll, id: "roll-t" });
  const SAMP = [0, 5, 10, 15, 20, 25, 30, 35, 40, 47];
  const stripG = F.group({ id: "strip", step: S.roll });
  const stile = SAMP.map((c, i) => {
    const x = 50 + (i % 5) * 144, y = BY + 384 + Math.floor(i / 5) * 84;
    F.img(`assets/clip/gen_v0_f${pad3(8 * c + 4)}_s.jpg`, x, y, 132, 52, { parent: stripG, rx: 5 });
    const o = F.el("rect", { x, y, width: 132, height: 52, rx: 5, fill: "none", stroke: "#fff", "stroke-width": 2 }, stripG);
    F.el("text", { x: x + 66, y: y + 72, "text-anchor": "middle", class: "xs" }, stripG).textContent = `chunk ${c}`;
    return { x, y, o };
  });
  const cnt = F.el("text", { x: 50, y: BY + 562, class: "xs", fill: C.mem }, stripG);

  // ═══ (c) exact rebase ═════════════════════════════════════════════════════════════════
  const Cp = { x: 812, y: BY, w: 760, h: BH };
  F.node("pc", { x: Cp.x, y: Cp.y, w: Cp.w, h: Cp.h, kind: "ink", fill: "#fbfdff", stroke: "#e2e8f0", rx: 22, step: S.rebase, always: true });
  F.text(Cp.x + 22, Cp.y + 40, "(c)  Past the position table, exactly", { cls: "h2" });
  const rg = F.group({ id: "rgraph", step: S.rebase });
  // Two stacked axes: the window runs off the end of the table, then every cached key is rotated back and it restarts.
  const AX = { x: Cp.x + 40, y: Cp.y + 150, w: 680 }, AX2Y = Cp.y + 250;
  [[AX.y, "before: the window reaches the end", "start"], [AX2Y, "after the rebase: positions restart", "end"]].forEach(([y, lab, anc]) => {
    F.el("line", { x1: AX.x, x2: AX.x + AX.w, y1: y, y2: y, stroke: "#475569", "stroke-width": 2 }, rg);
    F.el("text", { x: anc === "end" ? AX.x + AX.w : AX.x, y: y - 28, "text-anchor": anc, class: "xs" }, rg).textContent = lab;
  });
  F.el("rect", { x: AX.x + AX.w * 0.78, y: AX.y - 8, width: AX.w * 0.22, height: 16, fill: "#fee2e2" }, rg);
  F.el("text", { x: AX.x + AX.w, y: AX.y - 28, "text-anchor": "end", class: "xs", fill: C.grad }, rg).textContent = "end of position table";
  const winR = F.el("rect", { y: AX.y - 18, height: 36, width: AX.w * 0.16, rx: 9, fill: "#c4b5fd", stroke: C.mem, "stroke-width": 2 }, rg);
  const winT = F.el("text", { y: AX.y + 6, "text-anchor": "middle", "font-size": 19, "font-weight": 700, fill: "#fff" }, rg); winT.textContent = "window";
  const win2 = F.el("rect", { x: AX.x + AX.w * 0.02, y: AX2Y - 18, height: 36, width: AX.w * 0.16, rx: 9, fill: "#c4b5fd", stroke: C.mem, "stroke-width": 2 }, rg);
  const shiftA = F.el("path", { fill: "none", stroke: C.mem, "stroke-width": 2.6, "stroke-dasharray": "6 4", "marker-end": "url(#a-mem)" }, rg);
  F.math("kcache", AX.x + AX.w * 0.78, Cp.y + 318, { step: S.rebase, id: "m-kc", anchor: "middle" });
  const PO = [Cp.x + 170, Cp.y + 400], PR = 74;
  F.el("circle", { cx: PO[0], cy: PO[1], r: PR, fill: "#f5f3ff", stroke: "#ddd6fe", "stroke-width": 1.5 }, rg);
  const qL = F.el("line", { x1: PO[0], y1: PO[1], stroke: C.data, "stroke-width": 3.6, "stroke-linecap": "round", "marker-end": "url(#a-data)" }, rg);
  const kL = F.el("line", { x1: PO[0], y1: PO[1], stroke: C.mem, "stroke-width": 3.6, "stroke-linecap": "round", "marker-end": "url(#a-mem)" }, rg);
  const dArc = F.el("path", { fill: "none", stroke: "#0f172a", "stroke-width": 1.6, "stroke-dasharray": "3 3" }, rg);
  F.el("text", { x: PO[0] - PR, y: PO[1] + PR + 28, class: "b", fill: C.data }, rg).textContent = "query";
  F.el("text", { x: PO[0] + 8, y: PO[1] + PR + 28, class: "b", fill: C.mem }, rg).textContent = "cached key";
  F.text(Cp.x + 300, Cp.y + 366, ["the angle between query", "and cached key is unchanged:", "same attention scores,", "no table limit"], { cls: "s", step: S.rebase, id: "rbtxt", lh: 23 });
  F.math("rebase", Cp.x + 440, Cp.y + 524, { step: S.rebase, id: "m-rb", anchor: "middle" });
  F.text(Cp.x + 300, Cp.y + 480, "no sink, no absolute position", { cls: "xs", step: S.rebase, id: "rbtxt2", fill: C.mem });

  for (let i = 0; i < 5; i++) F.pulse(`lf${i}`, S.loop, { t0: i * 0.12 + 0.14, t1: i * 0.12 + 0.28, kind: edgeKind[i], to: `n${i + 1}` });
  F.pulse("lback", S.feed, { t0: 0.05, t1: 0.8, kind: "ink", to: "n0" });

  F.hook(({ s, p, isStatic }) => {
    const u = isStatic || s > S.loop ? 1 : s === S.loop ? clamp01(p) : 0;
    updateLoop(u, !isStatic && s === S.loop ? Math.floor(((u * 4) % 1) * 6) : -1);
    const cur = isStatic || s !== S.mem ? 11 : 5 + Math.floor(clamp01(p) * 42);
    MT.forEach((m, i) => {
      const c = Math.max(0, cur - 5 + i);
      m.im._img.setAttribute("href", `assets/clip/gen_v0_f${pad3(8 * Math.min(47, c) + 4)}_s.jpg`);
      const isQ = i === 5, isM = i === 3 || i === 4;
      m.o.setAttribute("stroke", isQ ? C.data : isM ? C.mem : "#fff"); m.o.setAttribute("stroke-width", isQ || isM ? 3.6 : 2);
      m.o.setAttribute("opacity", i < 3 ? 0.6 : 1); m.im.setAttribute("opacity", i < 3 ? 0.55 : 1);
    });
    memArcs.forEach((a, j) => {
      const x1 = MT[5].x + 52 - 8 + j * 16, x2 = MT[4 - j].x + 52, y0 = BY + 126, hh = 30 + 18 * j;
      a.setAttribute("d", `M${x1},${y0} C${x1},${y0 - hh} ${x2},${y0 - hh} ${x2},${y0}`);
    });
    const si = isStatic || s !== S.roll ? 9 : Math.min(9, Math.floor(clamp01(p / 0.9) * 10));
    stile.forEach((tl, i) => { tl.o.setAttribute("stroke", i === si ? C.mem : "#fff"); tl.o.setAttribute("stroke-width", i === si ? 4 : 2); tl.o.setAttribute("opacity", i > si ? 0.35 : 1); });
    cnt.textContent = `frame ${8 * SAMP[si] + 4} · chunk ${SAMP[si]} · memory: 2 chunks`;
    const q = isStatic ? 1 : s === S.rebase ? p : s > S.rebase ? 1 : 0;
    const slide = clamp01(q / 0.55), back = ease(clamp01((q - 0.6) / 0.3));
    const wx = AX.x + AX.w * (0.05 + 0.75 * slide);
    winR.setAttribute("x", wx); winT.setAttribute("x", wx + AX.w * 0.08);
    win2.style.opacity = back.toFixed(2);
    shiftA.setAttribute("d", `M${AX.x + AX.w * 0.86},${AX.y + 24} C${AX.x + AX.w * 0.7},${AX2Y - 34} ${AX.x + AX.w * 0.3},${AX2Y - 34} ${AX.x + AX.w * 0.1},${AX2Y - 24}`);
    shiftA.style.opacity = q > 0.58 || isStatic ? 1 : 0;
    const base = -0.3 - 1.4 * slide + 1.4 * back * 0.9, d = 0.9, R = PR - 10, qa = base, ka = base - d, ar = 38;
    qL.setAttribute("x2", PO[0] + R * Math.cos(qa)); qL.setAttribute("y2", PO[1] + R * Math.sin(qa));
    kL.setAttribute("x2", PO[0] + R * Math.cos(ka)); kL.setAttribute("y2", PO[1] + R * Math.sin(ka));
    dArc.setAttribute("d", `M${PO[0] + ar * Math.cos(ka)},${PO[1] + ar * Math.sin(ka)} A${ar},${ar} 0 0 1 ${PO[0] + ar * Math.cos(qa)},${PO[1] + ar * Math.sin(qa)}`);
  });

  const steps = [
    { short: "Loop", dur: 9, focus: ["pa", "n0", "n1", "n2", "n3", "n4", "n5", "lf0", "lf1", "lf2", "lf3", "lf4"], title: "From a trajectory to seven cameras, tick by tick",
      text: "Recorded driver inputs move the ego vehicle. The wheel visualizes the recorded left/right commands as an illustrative angle; the pedals follow throttle and brake. The bird's-eye view shows the simulator's own tracks: every car, cyclist and pedestrian around it, each with the point it will reach in 3.5 s. The scene is rendered as an HDMap layout for all seven cameras; that layout, the memory and the caption condition the next chunk, which is decoded and streamed while the new pose feeds the next tick." },
    { short: "Closed", dur: 6, focus: ["pa", "n0", "n5", "lback", "chip1", "chip2", "chip3", "chip4"], title: "The loop closes: the world reacts to what you do",
      text: "Because the layout is rendered from a live scene instead of being read from a recording, the agents respond to the ego vehicle and the simulation stays steerable for as long as it runs." },
    { short: "Memory", dur: 9, focus: ["pb", "memg", "m-win", "memtxt"], title: "A three-chunk memory: constant size, any length",
      text: "Attention sees the current chunk plus the two before it. As the drive goes on, the oldest chunk leaves the window. Cross-view attention happens inside one chunk and needs no cache, so only temporal attention keeps K and V." },
    { short: "Rollout", dur: 8, focus: ["pb", "roll-t", "strip"], title: "A real rollout, all generated",
      text: "A 38-second, 48-chunk rollout of one camera, from the HDMap and the first frame alone. The memory window is three chunks at every point." },
    { short: "Rebase", dur: 8, focus: ["pc", "rgraph", "rbtxt", "rbtxt2", "m-rb", "m-kc"], title: "Past the position table",
      text: "Rotary positions encode only offsets and the memory has no fixed sink. When the window reaches the end of the position table, every cached key is rotated back by Δ and positions restart from the origin. The angle between query and key, and therefore attention, is unchanged." },
  ];
  return { title: "Closed loop", steps, caption: "<b>Figure 5 · Closed-loop, unbounded simulation.</b> (a) Recorded driver inputs move the ego vehicle; the steering wheel and pedals visualize those commands (wheel angle is illustrative). The bird's-eye view (the simulator's ego-up view with its camera cones) shows the tracked agents with their 3.5 s goals; the scene is rendered as HDMap layouts for seven cameras, which condition each generated chunk that is decoded and streamed while the new pose closes the loop. Driver inputs, tracks, map and HDMap frames are from the recorded scene; the generated frames are an example rollout of another clip. (b) A fixed three-chunk memory, shown on a real 48-chunk rollout. (c) When the window reaches the end of the position table, cached keys are rotated by −Δ and positions restart; attention is unchanged." };
});
