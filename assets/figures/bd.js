/* bd.js — figure engine of the BoschDreams "How it works" page.
 *
 * One page, six figures (BD.figure registrations), every figure on the same 1600 x 1067 (3:2) canvas.
 * A figure is a timeline of steps. Elements appear at their step, edges draw on, forward pulses travel along
 * data edges, the focus of a step stays lit (everything else drops to 25 %), finished nodes flash once.
 * Paper mode (BD.setPaper / #paper / print) renders every figure in its static state: all elements visible, all lit.
 * The animation and the static figure are the same function of state: a hook must give identical output for
 * isStatic and for the end of its own step.
 */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  // Semantic palette: the SAME meaning on every figure. Precision (figure 6) never uses these hues: it is a neutral bit-meter.
  const C = { data: "#2563eb", cond: "#d97706", mem: "#7c3aed", xview: "#059669", grad: "#dc2626", ink: "#0f172a",
    frozen: "#64748b", copy: "#475569", muted: "#94a3b8" };
  const TINT = { data: "#eff6ff", cond: "#fff7ed", mem: "#f5f3ff", xview: "#ecfdf5", grad: "#fef2f2", ink: "#ffffff",
    frozen: "#f1f5f9", copy: "#f8fafc", plain: "#ffffff" };
  // Sizes are figure units. A figure is placed at \linewidth = 483.7 pt in a 10 pt document, so 1 unit = 0.302 pt:
  // xs reads at 5.9 pt, b at 7.0 pt, h2 at 8.5 pt, h at 10.0 pt — the smallest annotation stays above the 5.5 pt floor.
  const FONT = { h: 33, h2: 28, b: 23, s: 21, xs: 19.5, tag: 18, mono: 19, big: 44 };
  const LH = 24;   // default line height of a multi-line text block
  const CSS = `
  text{font-family:Inter,"SF Pro Display",-apple-system,"Helvetica Neue",Helvetica,Arial,sans-serif;fill:#0f172a}
  .h{font-size:${FONT.h}px;font-weight:700;letter-spacing:-.3px}
  .h2{font-size:${FONT.h2}px;font-weight:700;letter-spacing:-.2px}
  .b{font-size:${FONT.b}px;font-weight:600}
  .s{font-size:${FONT.s}px;fill:#334155}
  .xs{font-size:${FONT.xs}px;fill:#475569}
  .tag{font-size:${FONT.tag}px;font-weight:700;letter-spacing:.6px}
  .mono{font-family:"SF Mono","JetBrains Mono",Menlo,Consolas,monospace;font-size:${FONT.mono}px;font-weight:600;fill:#334155}
  .big{font-size:${FONT.big}px;font-weight:800;letter-spacing:-.8px}
  .halo{paint-order:stroke;stroke:#fff;stroke-width:5px;stroke-linejoin:round}
  .edge{fill:none;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
  .e-grad{stroke-dasharray:7 5}
  .e-copy{stroke-dasharray:10 4 2 4}
  .node>rect.bx{stroke-width:1.6}
  .pulse{fill:none;stroke-width:5.5;stroke-linecap:round}
  .pop{transform-box:fill-box;transform-origin:center}`;
  const W = 1600, H = 1067;
  /* Dark theme: neutrals and pale tints invert their lightness, saturated (semantic) hues keep hue and get lifted for
   * contrast on the dark ground. Applied after every render, so colours a hook writes are remapped too; images untouched. */
  const hsl = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (!d) return [0, 0, l]; const s = d / (1 - Math.abs(2 * l - 1)); const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [(h * 60 + 360) % 360, s, l]; };
  const rgbHex = (h, s, l) => { const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return "#" + [r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0")).join(""); };
  const canon = (v) => { const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(v); if (m) return "#" + m.slice(1, 4).map((x) => (+x).toString(16).padStart(2, "0")).join("");
    const h = /^#([0-9a-fA-F]{3})$/.exec(v); return (h ? "#" + [...h[1]].map((c) => c + c).join("") : v).toLowerCase(); };
  /* role: "ink" (strokes, CSS, markers) | "text" (text fill) | "fill" (shape fill). White text only exists on coloured chips,
   * so it stays white; saturated shape fills stay mid-dark so white text on them keeps >= 4.5:1 contrast. */
  function darkColor(v, role = "ink") {
    return String(v).replace(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/g, (m, hx) => {
      if (hx.length === 3) hx = [...hx].map((c) => c + c).join("");
      const [h, s, l] = hsl(...[0, 2, 4].map((i) => parseInt(hx.slice(i, i + 2), 16) / 255));
      if (role === "text" && l > 0.97) return "#ffffff";
      if (role === "fill" && l <= 0.85 && s >= 0.3) return rgbHex(h, Math.min(1, s * 1.05), Math.min(0.5, Math.max(0.38, l)));
      if (role === "fill" && l < 0.5) return rgbHex(0, 0, 0.14 + l * 0.4);        // dark badges stay dark, lifted off black
      if (l > 0.97) return "#000000";                                              // paper -> pure black ground
      if (l > 0.85) return rgbHex(h, s * 0.35, 0.055 + (1 - l) * 0.35);           // pale tints -> near-black, a trace of hue
      if (s < 0.3 || l < 0.25) { const L = 1 - l; return rgbHex(0, 0, L < 0.3 ? 0.2 + L * 0.5 : Math.max(0.62, Math.min(0.95, L))); }   // neutrals -> pure greys
      return rgbHex(h, Math.min(1, s * 1.08), Math.min(0.72, Math.max(0.6, l + 0.12)));  // semantic hues, lifted for contrast on black
    });
  }
  // dark mode thickens connectors and pulses: 2.2-unit hairlines lose contrast after scaling and video encoding
  const DARK_CSS = (css) => darkColor(css) + ".edge{stroke-width:3.2}.pulse{stroke-width:7.5}.node>rect.bx{stroke-width:2.2}";
  // Rig order and labels of the report: front wide, cross right, rear right, rear tele, rear left, cross left, front tele.
  const CAM = { abbr: ["FW", "CR", "RR", "RT", "RL", "CL", "FT"],
    col: ["#1d4ed8", "#2563eb", "#3b82f6", "#60a5fa", "#7c3aed", "#8b5cf6", "#a78bfa"] };

  function rounded(pts, r = 12) {
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
      const l1 = Math.hypot(x1 - x0, y1 - y0), l2 = Math.hypot(x2 - x1, y2 - y1), rr = Math.min(r, l1 / 2, l2 / 2);
      d += ` L${x1 - (x1 - x0) / l1 * rr},${y1 - (y1 - y0) / l1 * rr} Q${x1},${y1} ${x1 + (x2 - x1) / l2 * rr},${y1 + (y2 - y1) / l2 * rr}`;
    }
    return d + ` L${pts[pts.length - 1][0]},${pts[pts.length - 1][1]}`;
  }
  const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const lerp = (a, b, q) => a + (b - a) * q;
  /* deterministic hash noise in [0, 1): the same (a, b) always gives the same value, animation and static alike */
  const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const mix = (a, b, t) => { const p = (h, i) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16); return "#" + [0, 1, 2].map((i) => Math.round(p(a, i) * (1 - t) + p(b, i) * t).toString(16).padStart(2, "0")).join(""); };

  class Fig {
    constructor(svg, { w, h }) {
      Object.assign(this, { svg, w, h, items: [], byId: {}, pulses: [], hooks: [] });
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      svg.setAttribute("xmlns", NS);
      this.el("style", {}, svg).textContent = CSS;
      this.defs = this.el("defs", {}, svg);
      for (const [k, c] of Object.entries(C)) {
        const m = this.el("marker", { id: `a-${k}`, viewBox: "0 0 12 12", refX: 10, refY: 6, markerWidth: 11, markerHeight: 11,
          markerUnits: "userSpaceOnUse", orient: "auto-start-reverse" }, this.defs);
        this.el("path", { d: "M1,1.5 L11,6 L1,10.5 L3.5,6 Z", fill: c }, m);
      }
      this.el("rect", { width: w, height: h, fill: "#fff" }, svg);
      this.layer = this.el("g", {}, svg);
      this.top = this.el("g", {}, svg);
      this.pulseLayer = this.el("g", {}, svg);
    }
    el(tag, a = {}, parent = null) {
      const e = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(a)) if (v !== undefined && v !== null) e.setAttribute(k, v);
      if ((tag === "text" || tag === "tspan") && a.fill) e.style.fill = a.fill;
      if (parent) parent.appendChild(e);
      return e;
    }
    reg(g, o = {}) {
      const it = { g, id: o.id, step: o.step ?? 0, cur: 1, from: o.from, to: o.to, edge: o.edge, draw: o.draw, len: 0, always: o.always, op: -1, vis: "", flash: 0 };
      this.items.push(it);
      if (o.id) this.byId[o.id] = it;
      return it;
    }
    group(o = {}, parent) { const g = this.el("g", { class: o.cls }, parent || this.layer); this.reg(g, o); return g; }
    text(x, y, t, o = {}) {
      const lines = Array.isArray(t) ? t : [t], lh = o.lh ? o.lh * 1.26 : LH;
      const e = this.el("text", { x, y, class: o.cls || "s", "text-anchor": o.anchor || "start", fill: o.fill,
        transform: o.rotate ? `rotate(${o.rotate} ${x} ${y})` : undefined }, o.parent || this.layer);
      lines.forEach((ln, i) => { this.el("tspan", { x, dy: i ? lh : 0 }, e).innerHTML = ln; });
      if (!o.parent && (o.step !== undefined || o.id)) this.reg(e, o);
      return e;
    }
    node(id, o) {
      const g = this.el("g", { class: "node pop" }, this.layer);
      const kind = o.kind || "ink";
      g.dataset.kind = kind;
      const rect = this.el("rect", { class: "bx", x: o.x, y: o.y, width: o.w, height: o.h, rx: o.rx ?? 12,
        fill: o.fill || TINT[kind], stroke: o.stroke || (kind === "ink" ? "#334155" : C[kind]), "stroke-dasharray": o.dash }, g);
      const cx = o.x + o.w / 2;
      const nT = o.title ? 1 : 0, nS = o.sub ? (Array.isArray(o.sub) ? o.sub.length : 1) : 0;
      let y = o.ty ?? o.y + o.h / 2 - (nT * 27 + nS * 24) / 2 + 20;
      if (o.title) { this.text(o.tx ?? cx, y, o.title, { parent: g, cls: o.tcls || "b", anchor: o.anchor || "middle" }); y += 28; }
      if (o.sub) this.text(o.tx ?? cx, y, o.sub, { parent: g, cls: o.scls || "s", anchor: o.anchor || "middle", lh: 19 });
      if (o.icon === "lock") this.lock(o.x + o.w - 20, o.y + 8, g);
      if (o.icon === "train") this.flame(o.x + o.w - 20, o.y + 8, g);
      const it = this.reg(g, { ...o, id });
      it.rect = rect; it.box = o;
      return g;
    }
    lock(x, y, g) {
      const s = this.el("g", { transform: `translate(${x},${y})` }, g);
      this.el("rect", { x: 0, y: 5, width: 11, height: 8.5, rx: 1.6, fill: C.frozen }, s);
      this.el("path", { d: "M2.4,5.5 V3.4 a3.1,3.1 0 0 1 6.2,0 V5.5", fill: "none", stroke: C.frozen, "stroke-width": 1.6 }, s);
    }
    flame(x, y, g) {
      const s = this.el("g", { transform: `translate(${x},${y})` }, g);
      this.el("path", { d: "M6,0 C9,4 12,6 11,10 C10,13.5 2,13.5 1,10 C0.3,7.5 2.5,6 3,4 C4,6 5,6 6,0 Z", fill: "#f97316" }, s);
    }
    edge(id, pts, o = {}) {
      const kind = o.kind || "data";
      const g = this.el("g", {}, o.over ? this.top : this.layer);
      const d = typeof pts === "string" ? pts : rounded(pts, o.r ?? 12);
      const mid = `m-${id}`;
      const mask = this.el("mask", { id: mid, maskUnits: "userSpaceOnUse", x: 0, y: 0, width: this.w, height: this.h }, this.defs);
      const mp = this.el("path", { d, fill: "none", stroke: "#fff", "stroke-width": 26, "stroke-linecap": "round" }, mask);
      const p = this.el("path", { d, class: `edge e-${kind}`, stroke: C[kind], mask: `url(#${mid})`,
        "marker-end": o.head === false ? undefined : `url(#a-${kind})`, "stroke-width": o.sw }, g);
      if (o.label) this.text(o.labelAt[0], o.labelAt[1], o.label, { parent: g, cls: `${o.lcls || "xs"} halo`, anchor: o.lanchor || "middle", fill: o.lfill || C[kind] });
      const it = this.reg(g, { id, step: o.step, from: o.from, to: o.to, edge: true, draw: o.draw || [0, 0.45] });
      it.path = p; it.mp = mp; it.kind = kind; it.d = d;
      return it;
    }
    math(key, x, y, o = {}) {
      const [w, h] = (window.HIW_MATH || {})[key] || [100, 20];
      const s = o.s || 1, ww = w * s, hh = h * s;
      const ax = o.anchor === "middle" ? x - ww / 2 : o.anchor === "end" ? x - ww : x;
      const img = this.el("image", { href: `assets/math/${key}.svg`, x: ax, y: y - hh / 2, width: ww, height: hh }, o.parent || this.layer);
      if (!o.parent) this.reg(img, o);
      img.mathBox = { x: ax, y: y - hh / 2, w: ww, h: hh };
      return img;
    }
    img(href, x, y, w, h, o = {}) {
      const outer = this.el("g", {}, o.parent || this.layer);
      const g = this.el("g", {}, outer);
      if (o.rx) {
        const cid = `c${Math.random().toString(36).slice(2, 9)}`;
        const cp = this.el("clipPath", { id: cid }, this.defs);
        this.el("rect", { x, y, width: w, height: h, rx: o.rx }, cp);
        g.setAttribute("clip-path", `url(#${cid})`);
      }
      const im = this.el("image", { href, x, y, width: w, height: h, preserveAspectRatio: "none" }, g);
      if (o.pixelated) im.setAttribute("style", "image-rendering:pixelated");
      if (o.stroke) this.el("rect", { x, y, width: w, height: h, rx: o.rx || 0, fill: "none", stroke: o.stroke, "stroke-width": o.sw || 1.2 }, outer);
      if (!o.parent) this.reg(outer, o);
      outer._img = im;
      return outer;
    }
    /* A declared box of a source image: crop = [x, y, w, h] in source pixels, src = [width, height]. Pure crop, one scale. */
    imgCrop(href, x, y, w, h, src, crop, o = {}) {
      const outer = this.el("g", {}, o.parent || this.layer);
      const g = this.el("g", {}, outer);
      if (o.rx) {
        const cid = `c${Math.random().toString(36).slice(2, 9)}`;
        const cp = this.el("clipPath", { id: cid }, this.defs);
        this.el("rect", { x, y, width: w, height: h, rx: o.rx }, cp);
        g.setAttribute("clip-path", `url(#${cid})`);
      }
      const sv = this.el("svg", { x, y, width: w, height: h, viewBox: crop.join(" "), preserveAspectRatio: "none" }, g);
      this.el("image", { href, width: src[0], height: src[1], preserveAspectRatio: "none" }, sv);
      if (o.stroke) this.el("rect", { x, y, width: w, height: h, rx: o.rx || 0, fill: "none", stroke: o.stroke, "stroke-width": o.sw || 1.4 }, outer);
      if (!o.parent) this.reg(outer, o);
      return outer;
    }
    chip(x, y, label, o = {}) {
      const size = o.size || FONT.xs, w = o.w || Math.ceil(label.replace(/<[^>]+>/g, "").length * size * 0.6 + 26), h = o.h || size + 14;
      const g = this.el("g", {}, o.parent || this.layer);
      this.el("rect", { x, y, width: w, height: h, rx: h / 2, fill: o.fill || "#f1f5f9", stroke: o.stroke || "none", "stroke-width": 1.4 }, g);
      const t = this.el("text", { x: x + w / 2, y: y + h / 2 + size * 0.36, "text-anchor": "middle", class: o.mono ? "mono" : "b", "font-size": size, fill: o.color || "#0f172a" }, g);
      t.innerHTML = label;
      if (!o.parent && (o.step !== undefined || o.id)) this.reg(g, o);
      g.chipW = w; g.chipH = h;
      return g;
    }
    /* The camera's coloured label, anchored at its top-left corner (x, y). */
    pill(v, x, y, o = {}) {
      const s = o.size || 18, w = CAM.abbr[v].length * s * 0.62 + 16, g = this.el("g", {}, o.parent || this.layer);
      this.el("rect", { x, y, width: w, height: s + 8, rx: (s + 8) / 2, fill: CAM.col[v], stroke: "#fff", "stroke-width": 1.5 }, g);
      this.el("text", { x: x + w / 2, y: y + s * 0.95 + 1, "text-anchor": "middle", "font-size": s, "font-weight": 700, fill: "#fff" }, g).textContent = CAM.abbr[v];
      return g;
    }
    /* Diagonal hatching inside a rectangle (explicit line segments, so it survives every renderer). */
    hatch(x, y, w, h, o = {}) {
      const gap = o.gap || 8; let d = "";
      for (let k = -h; k < w; k += gap) {
        const sx = x + Math.max(k, 0), sy = y + h + Math.min(k, 0);
        const ex = Math.min(x + k + h, x + w), ey = y + h - (ex - (x + k));
        d += `M${sx},${sy} L${ex},${ey} `;
      }
      return this.el("path", { d, stroke: o.stroke || "#cbd5e1", "stroke-width": o.sw || 1.2, fill: "none" }, o.parent || this.layer);
    }
    /* Marks a drawing as schematic (not measured data). */
    tag(x, y, label, o = {}) {
      const w = Math.ceil(label.length * 10 + 20), g = this.el("g", {}, o.parent || this.layer);
      this.el("rect", { x, y, width: w, height: 26, rx: 13, fill: "#fff", stroke: "#94a3b8", "stroke-dasharray": "3 3" }, g);
      this.el("text", { x: x + w / 2, y: y + 19, "text-anchor": "middle", class: "xs", "font-size": FONT.tag }, g).textContent = label;
      g.chipW = w;
      if (!o.parent && (o.step !== undefined || o.id)) this.reg(g, o);
      return g;
    }
    pulse(edgeId, step, o = {}) {
      const e = this.byId[edgeId];
      const kind = o.kind || (e.kind === "grad" ? "grad" : e.kind);
      const p = this.el("path", { d: e.d, class: "pulse", stroke: C[kind], opacity: 0.95 }, this.pulseLayer);
      this.pulses.push({ p, e, step, t0: o.t0 ?? 0.45, t1: o.t1 ?? 0.95, back: !!o.back, to: o.to, seg: o.seg || 34 });
    }
    hook(fn) { this.hooks.push(fn); }
    legend(x, y, entries) {
      const g = this.el("g", {}, this.layer);
      let cx = x;
      for (const [kind, label, style] of entries) {
        if (style === "box") this.el("rect", { x: cx, y: y - 9, width: 26, height: 16, rx: 4, fill: TINT[kind], stroke: C[kind], "stroke-width": 1.4 }, g);
        else if (style === "lock") { this.el("rect", { x: cx, y: y - 9, width: 26, height: 16, rx: 4, fill: TINT.frozen, stroke: C.frozen, "stroke-width": 1.4 }, g); this.lock(cx + 7.5, y - 8, g); }
        else if (style === "flame") this.flame(cx + 7, y - 9, g);
        else this.el("path", { d: `M${cx},${y} H${cx + 30}`, class: `edge e-${kind}`, stroke: C[kind], "marker-end": `url(#a-${kind})` }, g);
        this.text(cx + 38, y + 6, label, { parent: g, cls: "xs" });
        cx += 54 + label.length * 10.6;
      }
      return g;
    }
    /* Elements of the steps that just finished flash once (200 ms outline), so the narrative has a rhythm. */
    flash(ids) { for (const id of ids || []) { const it = this.byId[id]; if (it && it.rect) it.flash = 1; } }

    render(st, dt) {
      const { s, p, isStatic, focus, dur } = st;
      const lit = (it) => {
        if (isStatic || !focus) return true;
        if (it.id && focus.includes(it.id)) return true;
        if (it.edge && (focus.includes(it.from) || focus.includes(it.to))) return true;
        return false;
      };
      const arrivals = {};
      for (const pu of this.pulses) {
        const local = (p - pu.t0) / (pu.t1 - pu.t0);
        const show = !isStatic && s === pu.step && local >= 0 && local <= 1;
        const disp = show ? "" : "none";
        if (pu.disp !== disp) { pu.p.style.display = disp; pu.disp = disp; }
        if (pu.to && s === pu.step && !isStatic) {
          const since = (p - pu.t1) * dur;
          if (since >= 0 && since < 0.5) arrivals[pu.to] = Math.max(arrivals[pu.to] || 0, Math.sin(Math.PI * since / 0.5));
        }
        if (!show) continue;
        const L = pu.e.len || (pu.e.len = pu.e.path.getTotalLength());
        const q = ease(local), at = pu.back ? (1 - q) * L : q * L;
        pu.p.setAttribute("stroke-dasharray", `${pu.seg} ${L + pu.seg}`);
        pu.p.setAttribute("stroke-dashoffset", pu.back ? `${-at}` : `${pu.seg - at}`);
      }
      for (const it of this.items) {
        const vis = isStatic || s >= it.step || it.always;
        let a = vis ? (isStatic || s > it.step || it.always ? 1 : Math.min(1, (p * dur) / 0.4)) : 0;
        if (it.edge) {
          if (!it.len) it.len = it.path.getTotalLength();
          let q = 1;
          if (!isStatic && s === it.step) q = clamp01((p - it.draw[0]) / (it.draw[1] - it.draw[0]));
          if (!vis) q = 0;
          const off = ((1 - ease(q)) * (it.len + 30)).toFixed(1);
          if (it.off !== off) { it.mp.setAttribute("stroke-dasharray", `${it.len + 30} ${it.len + 30}`); it.mp.setAttribute("stroke-dashoffset", off); it.off = off; }
          a = vis ? 1 : 0;
        }
        const target = lit(it) ? 1 : BD.state.dark ? 0.42 : 0.25;   // equal perceived dimming on black needs more alpha
        it.cur = isStatic || !dt ? target : it.cur + (target - it.cur) * Math.min(1, dt * 6);
        const op = (a * it.cur).toFixed(2), v = a * it.cur < 0.003 ? "hidden" : "visible";
        if (it.op !== op) { it.g.style.opacity = op; it.op = op; }   // write only on change: no needless style recalculation
        if (it.vis !== v) { it.g.style.visibility = v; it.vis = v; }
        if (it.rect) {
          if (it.flash > 0) it.flash = isStatic ? 0 : Math.max(0, it.flash - (dt || 0.016) * 5);
          const r = Math.max(arrivals[it.id] || 0, it.flash);
          const key = r.toFixed(2);
          if (it.rk !== key) {
            it.g.style.transform = r ? `scale(${1 + 0.03 * r})` : "";
            it.rect.setAttribute("stroke-width", (1.6 + 1.8 * r).toFixed(2));
            it.rk = key;
          }
        }
      }
      for (const fn of this.hooks) fn(st);
      if (BD.state.dark || this._wasDark) this.theme(BD.state.dark);
    }
    /* Remap (or restore) every colour of the figure. A colour changed by a hook since the last pass is treated as new. */
    theme(dark) {
      this._wasDark = dark;
      const css = [...this.svg.children].find((c) => c.tagName === "style" || c.tag === "style");
      if (css) { css._light ??= css.textContent; css.textContent = dark ? DARK_CSS(css._light) : css._light; }
      const walk = (e, inMarker) => {
        const tag = e.tagName || e.tag;
        if (tag === "mask") return;   // mask paths are white by definition: recolouring them hides the edges
        if (e.getAttribute) {
          const isText = tag === "text" || tag === "tspan", fillRole = isText ? "text" : inMarker ? "ink" : "fill";
          // Compare canonical values only: the browser reads inline style colours back as rgb(), so a raw compare took the
          // themed colour for a new light one and inverted it again on every pass (label flicker at fps/2).
          const remap = (store, key, v, set, role) => {
            v = canon(v); const r = store[key];
            if (r && v === (dark ? r[1] : r[0])) return;
            const light = r && v === r[1] ? r[0] : v;
            store[key] = [light, canon(darkColor(light, role))];
            set(dark ? store[key][1] : light);
          };
          for (const a of ["fill", "stroke", "stop-color"]) {
            const v = e.getAttribute(a); if (v == null) continue;
            remap(e._dk ||= {}, a, v, (c) => e.setAttribute(a, c), a === "stroke" ? "ink" : fillRole);
          }
          for (const k of ["fill", "stroke"]) {
            const v = e.style && e.style[k]; if (!v) continue;
            remap(e._dks ||= {}, k, v, (c) => { e.style[k] = c; }, k === "stroke" ? "ink" : fillRole);
          }
          if (tag === "image" && /assets\/math\//.test(e.getAttribute("href") || "")) e.style.filter = dark ? "invert(1) hue-rotate(180deg)" : "";
        }
        for (const c of e.children || []) walk(c, inMarker || tag === "marker");
      };
      walk(this.svg);
    }
  }

  // ───────────────────────────────────────────── player ─────────────────────────────────────────────
  class Player {
    constructor(root, fig, steps, opts = {}) {
      Object.assign(this, { root, fig, steps, t: 0, playing: true, isStatic: false, forceStatic: false, speed: 1, dirty: true, visible: false, ratio: 0, figcap: opts.caption || "", id: opts.id, _s: -1 });
      this.starts = []; let acc = 0;
      for (const st of steps) { this.starts.push(acc); acc += st.dur || 4; }
      this.total = acc;
      this.ui();
    }
    stepAt(t) { let s = 0; while (s + 1 < this.starts.length && t >= this.starts[s + 1]) s++; return s; }
    state() {
      const s = this.stepAt(this.t), dur = this.steps[s].dur || 4;
      return { t: this.t, s, p: clamp01((this.t - this.starts[s]) / dur), dur, isStatic: this.isStatic, focus: this.steps[s].focus || null };
    }
    tick(dt) {
      if (BD.state.paper || this.forceStatic) { if (!this.isStatic || this.dirty) { this.isStatic = true; this.draw(0); this.dirty = false; } return; }
      if (this.isStatic) { this.isStatic = false; this.dirty = true; this._s = -1; }
      if (!this.visible && !this.dirty) return;
      if (this.playing && this.visible) { this.t += dt * this.speed; if (this.t >= this.total) this.t = 0; }
      this.draw(dt); this.dirty = false;
    }
    draw(dt) {
      const st = this.state();
      if (!this.isStatic && st.s !== this._s) {
        if (this._s >= 0) this.fig.flash(this.steps[this._s].focus);
        this._s = st.s; this.caption(st.s);
      }
      this.fig.render(st, dt);
      this.u.range.value = String((this.t / this.total) * 1000);
      this.u.play.textContent = this.playing ? "❚❚" : "▶";
    }
    setSpeed(v) { this.speed = v; if (this.u) this.u.speeds.forEach(([b, x]) => b.classList.toggle("on", x === v)); }
    setStatic(v) {
      this.forceStatic = !!v; this.dirty = true; this._s = -1;
      this.root.classList.toggle("static", !!v);
      if (this.u) this.u.stat.classList.toggle("on", !!v);
    }
    seek(i) { i = Math.max(0, Math.min(this.steps.length - 1, i)); this.t = this.starts[i] + 0.001; this.dirty = true; }
    caption(s) {
      const st = this.steps[s];
      this.u.ct.innerHTML = st.title; this.u.cp.innerHTML = st.text;
      this.u.pills.forEach((b, i) => { b.classList.toggle("on", i === s); b.classList.toggle("done", i < s); });
    }
    ui() {
      const bar = document.createElement("div"); bar.className = "controls";
      const mk = (l, title, fn, cls) => { const b = document.createElement("button"); b.textContent = l; b.title = title; b.onclick = fn; if (cls) b.className = cls; bar.appendChild(b); return b; };
      mk("◀", "previous step (←)", () => this.seek(this.stepAt(this.t) - 1));
      const play = mk("❚❚", "play / pause (space)", () => { this.playing = !this.playing; this.dirty = true; }, "play");
      mk("▶", "next step (→)", () => this.seek(this.stepAt(this.t) + 1));
      const pills = document.createElement("div"); pills.className = "pills";
      const pl = this.steps.map((st, i) => { const b = document.createElement("button"); b.textContent = st.short; b.onclick = () => this.seek(i); pills.appendChild(b); return b; });
      bar.appendChild(pills);
      const range = document.createElement("input"); range.type = "range"; range.min = 0; range.max = 1000;
      range.oninput = () => { this.t = (+range.value / 1000) * this.total; this.dirty = true; };
      bar.appendChild(range);
      const sep = document.createElement("div"); sep.className = "speedsel";
      const speeds = [0.5, 1, 2, 4].map((x) => { const b = document.createElement("button"); b.textContent = x === 0.5 ? "½×" : `${x}×`; b.title = `animation speed ${x}×`; b.onclick = () => this.setSpeed(x); sep.appendChild(b); return [b, x]; });
      bar.appendChild(sep);
      const stat = mk("Static", "show the high-definition static figure instead of the animation (end state of the animation)", () => this.setStatic(!this.forceStatic), "stat");
      mk("JPG", "download the static figure as a 3× JPG", () => exportFig(this, "jpg"), "exp");
      mk("PDF", "download the static figure as a single-page PDF (3× image); Paper mode + print gives vector output", () => exportFig(this, "pdf"), "exp");
      mk("⤢", "full screen", () => { const r = this.root; if (document.fullscreenElement) document.exitFullscreen(); else if (r.requestFullscreen) r.requestFullscreen(); }, "exp");
      for (const el of bar.children) if (!/stat|exp|speedsel/.test(el.className)) el.classList.add("hs");
      this.root.appendChild(bar);
      const cap = document.createElement("div"); cap.className = "cap";
      cap.innerHTML = "<h3></h3><p></p>"; this.root.appendChild(cap);
      if (this.figcap) { const fc = document.createElement("div"); fc.className = "figcap"; fc.innerHTML = this.figcap; this.root.appendChild(fc); }
      this.u = { play, range, pills: pl, speeds, stat, ct: cap.querySelector("h3"), cp: cap.querySelector("p") };
      this.setSpeed(BD.state.speed);
    }
  }

  /** A one-page PDF around one JPEG (no dependencies). jpeg: Uint8Array; page size in PDF points. */
  function pdfBytes(jpeg, pxw, pxh, ptw, pth) {
    const enc = (t) => new TextEncoder().encode(t), parts = [], off = []; let len = 0;
    const push = (b) => { parts.push(b); len += b.length; };
    const obj = (n, head, stream) => { off[n] = len; push(enc(`${n} 0 obj\n${head}\n`)); if (stream) { push(enc("stream\n")); push(stream); push(enc("\nendstream\n")); } push(enc("endobj\n")); };
    push(enc("%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n"));
    obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
    obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
    obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ptw} ${pth}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
    obj(4, `<< /Type /XObject /Subtype /Image /Width ${pxw} /Height ${pxh} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`, jpeg);
    const cs = enc(`q ${ptw} 0 0 ${pth} 0 0 cm /Im0 Do Q`);
    obj(5, `<< /Length ${cs.length} >>`, cs);
    const xr = len;
    push(enc(`xref\n0 6\n0000000000 65535 f \n${[1, 2, 3, 4, 5].map((n) => `${String(off[n]).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xr}\n%%EOF\n`));
    const out = new Uint8Array(len); let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }

  /** Both exports use the static state (the end state of the animation), at 3×, on white. */
  async function exportFig(player, fmt) {
    const fig = player.fig, K = 3;
    fig.render({ t: 0, s: 0, p: 1, isStatic: true, dur: 4, focus: null }, 0);
    const clone = fig.svg.cloneNode(true);
    player.dirty = true;
    clone.querySelectorAll(".pulse").forEach((n) => n.remove());
    const toData = async (u) => { const b = await (await fetch(u)).blob(); return await new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); }); };
    for (const im of clone.querySelectorAll("image")) { const h = im.getAttribute("href"); if (h && !h.startsWith("data:")) im.setAttribute("href", await toData(h)); }
    clone.setAttribute("width", fig.w); clone.setAttribute("height", fig.h);
    const xml = new XMLSerializer().serializeToString(clone), name = player.id || "figure";
    const save = (blob, n) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = n; a.click(); };
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas"); c.width = fig.w * K; c.height = fig.h * K;
      const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.scale(K, K); x.drawImage(img, 0, 0);
      c.toBlob(async (jpg) => {
        if (fmt === "jpg") return save(jpg, `${name}.jpg`);
        const bytes = new Uint8Array(await jpg.arrayBuffer());
        save(new Blob([pdfBytes(bytes, c.width, c.height, fig.w * 0.75, fig.h * 0.75)], { type: "application/pdf" }), `${name}.pdf`);
      }, "image/jpeg", 0.95);
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
  }

  // ───────────────────────────────────────────── registry ─────────────────────────────────────────────
  const BD = {
    C, TINT, FONT, CAM, W, H, ease, clamp01, lerp, hash, mix, rounded,
    pad3: (n) => String(n).padStart(3, "0"),
    state: { speed: 1, paper: false, dark: false }, figures: {}, order: [], players: [], speedListeners: [], darkColor,
    /** BD.figure(id, build) — build(F, BD) draws the figure and returns { steps, caption, title }. */
    figure(id, build) { this.figures[id] = build; this.order.push(id); },
    mount(id, root) {
      const stage = document.createElement("div"); stage.className = "stage";
      const svg = document.createElementNS(NS, "svg"); stage.appendChild(svg); root.appendChild(stage);
      const F = new Fig(svg, { w: W, h: H });
      const out = this.figures[id](F, this);
      const player = new Player(root, F, out.steps, { caption: out.caption, id });
      player.title = out.title;
      this.players.push(player);
      return player;
    },
    setPaper(v) {
      this.state.paper = !!v;
      if (typeof document !== "undefined") document.body.classList.toggle("paper", !!v);
      for (const p of this.players) p.dirty = true;
      (this.paperListeners || []).forEach((f) => f(!!v));
    },
    setSpeed(v) { this.state.speed = v; this.players.forEach((p) => p.setSpeed(v)); this.speedListeners.forEach((f) => f(v)); },
    setDark(v) {
      this.state.dark = !!v;
      if (typeof document !== "undefined" && document.body) document.body.classList.toggle("dark", !!v);
      for (const p of this.players) { p.fig.theme(!!v); p.dirty = true; }
    },
    pdfBytes,
    active() { return this.players.reduce((a, p) => (p.ratio > (a ? a.ratio : 0) ? p : a), null); },
    start() {
      let last = null;
      const loop = (ts) => {
        const dt = last == null ? 0 : Math.min(0.1, (ts - last) / 1000); last = ts;
        for (const p of this.players) p.tick(dt);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    },
  };
  window.BD = BD;
})();
