// Top-down vector views, chase-cam: the car heads up the canvas. Shared by the scene viewer, the agent and the futures.
import { dpr, reduced } from "./rig.js";

export const EGO = "__ego__";
// Camera rig (yaw left-positive, horizontal FOV, drawn range in m), as in the cockpit.
export const FANS = [["FW", -0.3, 120, 30], ["FT", 0.1, 30, 46], ["CL", 49.9, 120, 20], ["CR", -49.8, 120, 20], ["RL", 129.9, 70, 20], ["RR", -129.5, 70, 20], ["RT", 180, 30, 30]];
export const COL = { ego: "#2ee6ff", edit: "#ff3347", vru: "#ffd24d", car: "rgba(214,222,236,.5)", ok: "#36e27f" };
const MAP = [["rgba(255,255,255,.16)", 1], ["rgba(255,255,255,.5)", 1.6], ["rgba(255,255,255,.26)", 4, [2, 3]], ["rgba(255,255,255,.5)", 1.6], ["rgba(255,255,255,.4)", 1.2]];

// Pose [x, y, yaw] of track `id` at frame f: the edit if there is one, else the recording.
export function poseAt(m, ed, id, f) {
  const e = ed[id];
  if (e) return f >= e.f && f - e.f < e.p.length ? e.p[f - e.f] : null;
  if (id === EGO) return m.ego[Math.max(0, Math.min(f, m.ego.length - 1))];
  const t = m.tracks[id];
  if (!t) return null;
  if (t.n) { const f0 = +Object.keys(t.p)[0]; return f >= f0 && f < f0 + t.n ? t.p[f0] : null; }
  return t.p[f] || null;
}
export const vru = (t) => t.c === "pedestrian" || t.c === "cyclist";

/* m: {ego, map, tracks}; ed: edited tracks by id; f: frame. Options:
   span (m across), y (ego height 0..1), zoom {span, px, py} (user view), view [x, y, yaw] (centre instead of the ego),
   paths [{p, color, width, dash}], trails (edited paths, default when no paths), grow {id: 0..1} (draw an edited trail in part),
   fans, hot, hi (Set: emphasised ids), dim (alpha of the rest), skip (Set: ids not drawn), ego (pose override or false),
   rec (pose of the recorded ego, drawn as an outline), marks [{p, r, color, text}], measure {a, b, text}, spot {p, r}. */
export function drawMap(cv, m, ed, f, o = {}) {
  const ctx = cv.getContext("2d"), k = dpr(), W = (cv.width = Math.round(cv.clientWidth * k)), H = (cv.height = Math.round(cv.clientHeight * k));
  if (!W || !H || !m) return null;
  const egoPose = o.ego === undefined ? poseAt(m, ed, EGO, f) : o.ego;
  const [cx, cy, ch] = o.view || egoPose || m.ego[0];
  const span = o.zoom?.span || o.span || 64, s = W / span, px = (o.zoom?.px || 0) * k, py = (o.zoom?.py || 0) * k;
  const T = (p) => { const dx = p[0] - cx, dy = p[1] - cy, a = Math.PI / 2 - ch, c = Math.cos(a), n = Math.sin(a); return [(W / 2 + px + (dx * c - dy * n) * s) / k, (H * (o.y ?? 0.66) + py - (dx * n + dy * c) * s) / k]; };
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2 + px, H * (o.y ?? 0.66) + py);
  ctx.scale(s, -s);
  ctx.rotate(Math.PI / 2 - ch);
  ctx.translate(-cx, -cy);
  ctx.lineCap = ctx.lineJoin = "round";
  const line = (pts, color, width, dash = []) => {
    if (!pts || pts.length < 2) return;
    ctx.beginPath();
    pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
    ctx.setLineDash(dash.map((d) => (d * k) / s));
    ctx.strokeStyle = color;
    ctx.lineWidth = (width * k) / s;
    ctx.stroke();
  };
  for (const [kind, pts] of m.map) line(pts, ...MAP[kind]);
  if (o.fans && egoPose) for (const [cam, yaw, fov, r] of FANS) {
    const [ex, ey, eh] = egoPose, a = eh + (yaw * Math.PI) / 180, h = (fov * Math.PI) / 360, on = cam === o.hot;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.arc(ex, ey, r, a - h, a + h);
    ctx.closePath();
    ctx.setLineDash([]);
    ctx.fillStyle = on ? "rgba(122,162,255,.24)" : "rgba(255,255,255,.035)";
    ctx.fill();
    ctx.strokeStyle = on ? "rgba(150,185,255,.95)" : "rgba(255,255,255,.13)";
    ctx.lineWidth = ((on ? 1.6 : 1) * k) / s;
    ctx.stroke();
  }
  if (o.trails ?? !o.paths?.length) for (const id of Object.keys(ed)) {
    if (o.skip?.has(id)) continue;
    const rec = id === EGO ? m.ego : m.tracks[id] && !m.tracks[id].n && Object.values(m.tracks[id].p);
    if (rec?.length > 1) line(rec, "rgba(255,255,255,.42)", 1.3, [5, 5]);
    const g = o.grow?.[id] ?? 1, p = ed[id].p;
    if (p.length > 1 && g > 0) line(p.slice(0, Math.max(2, Math.ceil(p.length * g))), id === EGO ? COL.ego : COL.edit, 2.4);
  }
  for (const q of o.paths || []) { ctx.globalAlpha = q.alpha ?? 1; line(q.p, q.color, q.width || 2.4, q.dash || []); ctx.globalAlpha = 1; }
  const box = (p, L, Wd, fill, stroke) => {
    ctx.save();
    ctx.translate(p[0], p[1]);
    ctx.rotate(p[2]);
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.roundRect(-L / 2, -Wd / 2, L, Wd, Math.min(0.5, Wd / 3));
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = (1.6 * k) / s; ctx.stroke(); }
    ctx.restore();
  };
  for (const [id, t] of Object.entries(m.tracks)) {
    if (o.skip?.has(id)) continue;
    const p = poseAt(m, ed, id, f);
    if (!p) continue;
    const v = vru(t), edited = ed[id] && id !== EGO, hot = o.hi?.has(id);
    ctx.globalAlpha = o.hi && !hot ? o.dim ?? 0.35 : 1;
    box(p, Math.max(t.s[0], v ? 0.9 : 0), Math.max(t.s[1], v ? 0.9 : 0), edited ? COL.edit : v ? COL.vru : COL.car, hot ? "#fff" : null);
    ctx.globalAlpha = 1;
  }
  if (o.rec) box([o.rec[0] + 1.4 * Math.cos(o.rec[2]), o.rec[1] + 1.4 * Math.sin(o.rec[2]), o.rec[2]], 4.8, 1.9, null, "rgba(255,255,255,.9)");
  if (egoPose) {
    ctx.shadowColor = COL.ego;
    ctx.shadowBlur = 14 * k;
    box([egoPose[0] + 1.4 * Math.cos(egoPose[2]), egoPose[1] + 1.4 * Math.sin(egoPose[2]), egoPose[2]], 4.8, 1.9, COL.ego);
    ctx.shadowBlur = 0;
  }
  ctx.restore();
  // Screen-space annotations stay crisp at any zoom.
  ctx.save();
  ctx.scale(k, k);
  ctx.font = "500 12px 'BD Text', sans-serif";
  if (o.measure) {
    const [a, b] = [T(o.measure.a), T(o.measure.b)];
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.2; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke(); ctx.setLineDash([]);
    tag(ctx, o.measure.text, (a[0] + b[0]) / 2 + 10, (a[1] + b[1]) / 2, "#fff");
  }
  for (const mk of o.marks || []) {
    const [x, y] = T(mk.p);
    ctx.strokeStyle = mk.color || "#fff"; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(x, y, mk.r || 14, 0, Math.PI * 2); ctx.stroke();
    if (mk.cross) { ctx.beginPath(); ctx.moveTo(x - 6, y - 6); ctx.lineTo(x + 6, y + 6); ctx.moveTo(x + 6, y - 6); ctx.lineTo(x - 6, y + 6); ctx.stroke(); }
    if (mk.text) tag(ctx, mk.text, x + (mk.r || 14) + 8, y + (mk.dy || 0), mk.color || "#fff");
  }
  if (o.spot) {
    const [x, y] = T(o.spot.p), r = o.spot.r;
    ctx.fillStyle = `rgba(0,0,0,${o.spot.a ?? 0.6})`;
    ctx.beginPath(); ctx.rect(0, 0, W / k, H / k); ctx.arc(x, y, r, 0, Math.PI * 2, true); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
  return { x: (W / 2 + px) / k, y: (H * (o.y ?? 0.66) + py) / k, T };
}

function tag(ctx, text, x, y, color) {
  const w = ctx.measureText(text).width + 14;
  ctx.fillStyle = "rgba(0,0,0,.82)";
  ctx.beginPath(); ctx.roundRect(x, y - 11, w, 22, 11); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = color; ctx.fillText(text, x + 7, y + 4);
}

// The camera whose cone contains canvas point (x, y), narrowest first; o is drawMap's return value.
export function fanAt(o, x, y) {
  const deg = (Math.atan2(o.x - x, o.y - y) * 180) / Math.PI;
  const hit = FANS.filter(([, yaw, fov]) => Math.abs(((deg - yaw + 540) % 360) - 180) <= fov / 2);
  return hit.sort((a, b) => a[2] - b[2])[0]?.[0] || null;
}

// Wheel, pinch and drag on a map; buttons [data-z] in `box` step the zoom. z = {span, px, py}; paint redraws.
export function zoomable(cv, z, paint, box = cv.parentElement, [lo, hi] = [16, 260]) {
  const set = (span, ease = false) => {
    span = Math.max(lo, Math.min(hi, span));
    if (ease && !reduced) gsap.to(z, { span, duration: 0.5, ease: "power3.out", onUpdate: paint });
    else { z.span = span; paint(); }
  };
  cv.addEventListener("wheel", (e) => { e.preventDefault(); set(z.span * Math.exp(e.deltaY * 0.0012)); }, { passive: false });
  const pts = new Map();
  let pinch = 0;
  cv.addEventListener("pointerdown", (e) => { pts.set(e.pointerId, [e.clientX, e.clientY]); cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", (e) => {
    if (!pts.has(e.pointerId)) return;
    const prev = pts.get(e.pointerId);
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch) set(z.span * (pinch / d));
      pinch = d;
    } else { z.px += e.clientX - prev[0]; z.py += e.clientY - prev[1]; paint(); }
  });
  const up = (e) => { pts.delete(e.pointerId); pinch = 0; };
  cv.addEventListener("pointerup", up);
  cv.addEventListener("pointercancel", up);
  cv.addEventListener("dblclick", () => { z.px = z.py = 0; set(z.home, true); });
  for (const b of box.querySelectorAll("[data-z]")) b.addEventListener("click", () => set(z.span * +b.dataset.z, true));
  z.home ??= z.span;
}
