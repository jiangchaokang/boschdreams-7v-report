import { Rig, SEVEN, CAM, blit, fit, reduced } from "./rig.js";
import { drawMap, fanAt, zoomable } from "./bev.js";
import { World, loadWorld, steer } from "./world.js";

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function radios(group, onSelect) {
  const items = $$("[role=radio]", group);
  const select = (item, focus) => {
    items.forEach((i) => { i.setAttribute("aria-checked", String(i === item)); i.tabIndex = i === item ? 0 : -1; });
    if (focus) item.focus();
    onSelect(item);
  };
  items.forEach((item, i) => {
    item.tabIndex = item.getAttribute("aria-checked") === "true" ? 0 : -1;
    item.addEventListener("click", () => select(item));
    item.addEventListener("keydown", (e) => {
      const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!d) return;
      e.preventDefault();
      select(items[(i + d + items.length) % items.length], true);
    });
  });
}

// The pointer drags a wipe across a rig; when nobody steers, it sweeps on its own so the comparison is never hidden.
// The sweep runs at 30 Hz and only while the rig is on screen: seven full-tile redraws per step are the costliest paint.
export function follow(rig, place, active = () => true) {
  let user = 0, running = false, last = 0, seen = false;
  const move = (e) => {
    if (!active() || e.target.closest(".core")) return;
    user = performance.now();
    place(Math.max(0, Math.min(rig.el.clientWidth, e.clientX - rig.el.getBoundingClientRect().left)));
  };
  rig.el.addEventListener("pointermove", move);
  rig.el.addEventListener("pointerdown", move);
  const tick = (now) => {
    if (!seen) { running = false; return; }
    if (active() && now - user > 2400 && now - last > 32 && !reduced) { last = now; place(Math.round(rig.el.clientWidth * (0.5 + 0.34 * Math.sin(now / 2200)))); }
    requestAnimationFrame(tick);
  };
  new IntersectionObserver(([e]) => { seen = e.isIntersecting; if (seen && !running) { running = true; requestAnimationFrame(tick); } }, { threshold: 0.02 }).observe(rig.el);
}

const clock = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

// The film in chapters: one file per chapter so any chapter starts at once; the bar and the clock read the whole film.
export async function setupFilm() {
  const root = $("#film"), box = $(".player", root), screen = $(".screen", box), v = $("video", box), list = $(".chapters", root);
  const seek = $(".p-seek", box), tip = $(".p-tip", box), level = $(".p-level", box), rate = $(".p-rate", box), track = $(".p-track", box);
  const ch = await fetch("assets/media/film/chapters.json").then((r) => r.json()), total = ch.at(-1).start + ch.at(-1).seconds;
  let i = 0;
  seek.max = total;
  $(".segs", box).innerHTML = ch.map((c) => `<i style="flex:${c.seconds}"><b></b></i>`).join("");
  list.innerHTML = ch.map((c, k) => `<li><button type="button"><img src="${c.src.replace(".mp4", ".webp")}" alt="" width="320" height="180" loading="lazy"><span><small>${String(k + 1).padStart(2, "0")} · ${clock(c.seconds)}</small><b>${c.title}</b><em>${c.line}</em></span><i></i></button></li>`).join("");
  const fills = $$(".segs b", box), items = $$("button", list);
  const at = (g) => Math.max(0, ch.findLastIndex((c) => g >= c.start));
  const now = () => ch[i].start + (v.currentTime || 0);
  const paint = () => {
    const g = now();
    fills.forEach((f, j) => f.style.transform = `scaleX(${j < i ? 1 : j > i ? 0 : Math.min(1, v.currentTime / ch[i].seconds)})`);
    items.forEach((b, j) => b.style.setProperty("--p", j < i ? 1 : j > i ? 0 : v.currentTime / ch[i].seconds));
    seek.value = g;
    $(".p-time", box).textContent = `${clock(g)} / ${clock(total)}`;
  };
  const load = (k, t = 0, go = !v.paused) => {
    i = Math.max(0, Math.min(ch.length - 1, k));
    v.poster = ch[i].src.replace(".mp4", ".webp");
    v.src = ch[i].src;
    v.currentTime = t;
    v.defaultPlaybackRate = v.playbackRate = +rate.value;
    items.forEach((b, j) => b.toggleAttribute("aria-current", j === i));
    $(".now", box).textContent = ch[i].title;
    if (go) v.play().catch(() => {});
    paint();
  };
  const jump = (g) => { g = Math.max(0, Math.min(total - 0.1, g)); const k = at(g); k === i ? (v.currentTime = g - ch[k].start) : load(k, g - ch[k].start); };
  const toggle = () => (v.paused ? v.play().catch(() => {}) : v.pause());
  const volume = (x) => { v.volume = level.value = Math.max(0, Math.min(1, x)); v.muted = v.volume === 0; };
  const full = () => (document.fullscreenElement ? document.exitFullscreen() : (screen.requestFullscreen?.() ?? v.webkitEnterFullscreen?.()));
  items.forEach((b, k) => b.addEventListener("click", () => { load(k, 0, true); screen.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" }); }));
  for (const [sel, fn] of [[".big-play", toggle], [".p-play", toggle], [".p-full", full], [".p-next", () => load(i + 1)], [".p-prev", () => (v.currentTime > 3 ? (v.currentTime = 0) : load(i - 1))]]) $(sel, box).addEventListener("click", fn);
  $(".p-mute", box).addEventListener("click", () => { v.muted = !v.muted; if (!v.muted && !v.volume) volume(0.6); });
  v.addEventListener("click", toggle);
  v.addEventListener("dblclick", full);
  v.addEventListener("timeupdate", paint);
  v.addEventListener("ended", () => (i < ch.length - 1 ? load(i + 1, 0, true) : paint()));
  v.addEventListener("volumechange", () => box.classList.toggle("muted", v.muted || !v.volume));
  for (const t of ["play", "pause"]) v.addEventListener(t, () => {
    screen.classList.toggle("playing", !v.paused);
    $("use", $(".p-play", box)).setAttribute("href", v.paused ? "#i-play" : "#i-pause");
    $(".p-play", box).setAttribute("aria-label", v.paused ? "Play" : "Pause");
  });
  seek.addEventListener("input", () => jump(+seek.value));
  level.addEventListener("input", () => volume(+level.value));
  rate.addEventListener("change", () => { v.defaultPlaybackRate = v.playbackRate = +rate.value; });
  track.addEventListener("pointermove", (e) => {
    const r = track.getBoundingClientRect(), u = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), g = u * total;
    tip.textContent = `${ch[at(g)].title} · ${clock(g)}`;
    tip.style.left = `${u * 100}%`;
  });
  box.addEventListener("keydown", (e) => {
    if (e.target.matches("input, select") && e.key.startsWith("Arrow")) return;
    const key = { " ": toggle, k: toggle, ArrowLeft: () => jump(now() - 5), ArrowRight: () => jump(now() + 5), ArrowUp: () => volume(v.volume + 0.1),
      ArrowDown: () => volume(v.volume - 0.1), m: () => { v.muted = !v.muted; }, f: full }[e.key];
    if (!key || e.target.closest(".chapters") && e.key === " ") return;
    e.preventDefault();
    key();
  });
  let idle;
  screen.addEventListener("pointermove", () => { screen.classList.add("awake"); clearTimeout(idle); idle = setTimeout(() => screen.classList.remove("awake"), 2500); });
  new IntersectionObserver(([e]) => { if (!e.isIntersecting) v.pause(); }, { threshold: 0.2 }).observe(screen);
  volume(+level.value);
  load(0, 0, false);
}

// Generated scenes: layout and generated views on one clock, and the top-down scene they both come from.
export function setupScenes(manifest) {
  const root = $("#data"), el = $("#scene-rig"), rig = new Rig(el, manifest, { swap: true, watch: el }), cv = $(".bev", el);
  const toggle = $(".layout-toggle", root), bevs = {}, zoom = { span: 72, px: 0, py: 0 };
  let compare = true, bev = null, hot = null, origin = null, down = null, lastF = -1;
  const big = () => rig.tiles.find((t) => t.dataset.slot === "FW").dataset.cam;
  const paint = (force = false) => {
    if (!bev) return;
    const f = Math.min(bev.n - 1, Math.floor(rig.time * 10));
    if (!force && f === lastF) return;
    lastF = f;
    origin = drawMap(cv, bev, {}, f, { fans: true, hot: hot || big(), zoom, y: 0.6 });
  };
  const hasLayout = () => !!manifest[rig.cur?.name]?.layout;
  const apply = () => {
    const on = compare && hasLayout();
    toggle.disabled = !hasLayout();
    toggle.setAttribute("aria-pressed", String(on));
    el.dataset.view = on ? "split" : "dream";
    rig.wipe = on ? (rig.wipe ?? el.clientWidth * 0.5) : null;
    rig.draw();
  };
  radios($(".scene-pick", root), async (b) => {
    rig.setClip(b.dataset.clip);
    $(".note", root).textContent = b.dataset.note;
    lastF = -1;
    apply();
    Object.assign(zoom, { px: 0, py: 0 });
    bev = bevs[b.dataset.clip] ||= await fetch(`assets/bev/${b.dataset.clip}.json`).then((r) => r.json());
    paint(true);
  });
  toggle.addEventListener("click", () => { compare = !compare; apply(); });
  rig.onframe = () => paint(false);
  el.addEventListener("focus-cam", () => paint(true));
  for (const t of rig.tiles) {
    t.addEventListener("pointerenter", () => { hot = t.dataset.cam; paint(true); });
    t.addEventListener("pointerleave", () => { hot = null; paint(true); });
  }
  zoomable(cv, zoom, () => paint(true), cv.parentElement);
  const fan = (e) => origin && fanAt(origin, e.offsetX, e.offsetY);
  cv.addEventListener("pointerdown", (e) => { down = [e.clientX, e.clientY]; });
  cv.addEventListener("pointermove", (e) => { if (e.buttons) return; const c = fan(e); if (c !== hot) { hot = c; paint(true); } });
  cv.addEventListener("pointerleave", () => { hot = null; paint(true); });
  cv.addEventListener("click", (e) => { const c = fan(e); if (c && down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 4) rig.focus(c); });
  follow(rig, (x) => { rig.wipe = x; rig.draw(); }, () => compare && hasLayout());
  $(".scene-pick [aria-checked=true]", root).click();
  return rig;
}

// Paired static-map edits from pure noise: Upper (Before · original) vs. Lower (After · edited) across 4 front views
// in one horizontal row, with high-contrast translucent colored overlays, interactive progress scrubber, and guided motion.
const ROADS = [
  ["hwy1", "Highway · diverge gore"],
  ["hwy2", "Highway · work-zone drop"],
  ["urb1", "Urban · mid-block crosswalk"],
  ["urb2", "Urban · protected left-turn bay"],
  ["corner1", "Corner · contraflow S-shift"],
];
const FRONT4 = ["CL", "FW", "FT", "CR"];

export function setupStatic(manifest) {
  const root = $("#static"), pick = $(".static-pick", root), toggle = $(".static-toggle", root);
  const cvBev = $(".st-bev", root), bandEdit = $(".st-band-edit", root);
  const rows = { base: $('.st-row4[data-side="base"]', root), edit: $('.st-row4[data-side="edit"]', root) };
  const btnPlay = $(".st-play", root), btnReplay = $(".st-replay", root), scrub = $(".st-scrub", root), timeEl = $(".st-time", root);
  const steps = $$(".st-step", root), cueText = $(".st-cue-text", root), explainEl = $(".st-explain", root);
  const activeRoads = ROADS.filter(([k]) => manifest[`static-${k}`]);
  if (!root || !activeRoads.length) return null;

  pick.innerHTML = activeRoads.map(([k, label], i) => `<button type="button" role="radio" aria-checked="${!i}" data-road="${k}">${label}</button>`).join("");
  const cells = { base: {}, edit: {} };
  for (const side of ["base", "edit"]) {
    rows[side].innerHTML = FRONT4.map((c) => `<div class="st-cell" data-cam="${c}"><canvas aria-hidden="true"></canvas><span>${c} · ${CAM[c]}</span></div>`).join("");
    for (const cell of $$(".st-cell", rows[side])) {
      const cv = $("canvas", cell), cam = cell.dataset.cam;
      cells[side][cam] = { el: cell, cv, ctx: cv.getContext("2d", { alpha: false }) };
      cell.addEventListener("pointerenter", () => { cells.base[cam].el.classList.add("hl"); cells.edit[cam].el.classList.add("hl"); });
      cell.addEventListener("pointerleave", () => { cells.base[cam].el.classList.remove("hl"); cells.edit[cam].el.classList.remove("hl"); });
    }
  }
  const bevs = {}, zoom = { span: 110, px: 0, py: 0 };
  let curKey = null, showOvl = true, visible = false, userPaused = false, scrubbing = false, bev = null, lastF = -1, lastPhase = -1;
  let vid = null, clip = null, buf = null, bctx = null, raf = 0, switchAt = 0;

  const setPlayIcon = (playing) => {
    btnPlay.setAttribute("aria-label", playing ? "Pause" : "Play");
    $("use", btnPlay).setAttribute("href", playing ? "#i-pause" : "#i-play");
  };

  const updateGuide = (t) => {
    const ph = t < 2.0 ? 0 : t < 6.8 ? 1 : 2;
    if (ph === lastPhase) return;
    lastPhase = ph;
    steps.forEach((s, i) => { s.classList.toggle("on", i === ph); s.classList.toggle("done", i < ph); });
    bandEdit.classList.toggle("pulse", ph === 1 && !reduced);
    cueText.textContent = ph === 0
      ? "Shared initial road — watch the edited static markings appear in the lower row"
      : ph === 1
        ? "Static geometry rewritten — compare ego & traffic trajectories vertically (upper vs. lower)"
        : "Zero barrier clipping — scrub the progress bar to inspect any frame";
  };

  const paintBev = (force = false) => {
    if (!bev || !vid) return;
    const f = Math.min(bev.n - 1, Math.floor((vid.currentTime || 0) * 10));
    const grow = reduced ? 1 : Math.min(1, (performance.now() - switchAt) / 650);
    if (!force && f === lastF && grow >= 1) return;
    lastF = f;
    const ed = bev.edit, bs = bev.base, [x, y, h] = ed.ego[f], ahead = 0.24 * zoom.span;
    const m = { n: bev.n, ego: ed.ego, map: ed.map, tracks: ed.tracks };
    const clipPts = (p) => { const closed = p.length === 4 ? [...p, p[0]] : p; return closed.slice(0, Math.max(2, Math.ceil(closed.length * grow))); };
    drawMap(cvBev, m, {}, f, {
      zoom, view: [x + ahead * Math.cos(h), y + ahead * Math.sin(h), h + Math.PI / 2], y: 0.5,
      paths: [
        ...(bs?.ego ? [{ p: bs.ego.map((q) => [q[0], q[1]]), color: "rgba(210,218,230,.45)", width: 1.4, dash: [4, 4] }] : []),
        { p: ed.ego.map((q) => [q[0], q[1]]), color: "rgba(255,255,255,.85)", width: 1.8 },
        ...ed.old.map((p) => ({ p, color: "rgba(255,68,132,.48)", width: 1.3, dash: [5, 4] })),
        ...ed.new.map((p) => ({ p: clipPts(p), color: "#00e0ff", width: 2.4 })),
      ],
    });
  };

  const drawFrame = () => {
    if (!buf || !clip) return;
    const lb = showOvl ? clip.base : clip.base_clean, le = showOvl ? clip.edit : clip.edit_clean;
    for (const c of FRONT4) {
      for (const [side, layer] of [["base", lb], ["edit", le]]) {
        const cell = cells[side][c];
        fit(cell.cv);
        if (cell.cv.width && layer?.[c]) blit(cell.ctx, buf, layer[c], cell.cv.width, cell.cv.height);
      }
    }
    if (vid) {
      const t = vid.currentTime || 0, dur = clip.seconds || vid.duration || 9.3;
      if (!scrubbing) scrub.value = String(Math.min(92, Math.round(t * 10)));
      timeEl.textContent = `${t.toFixed(1)} / ${dur.toFixed(1)} s`;
      updateGuide(t);
    }
    paintBev(false);
  };

  const grab = (img) => {
    const w = img.videoWidth || img.naturalWidth, h = img.videoHeight || img.naturalHeight;
    if (!w) return;
    if (!buf) { buf = document.createElement("canvas"); bctx = buf.getContext("2d", { alpha: false }); }
    if (buf.width !== w || buf.height !== h) { buf.width = w; buf.height = h; }
    bctx.drawImage(img, 0, 0);
    drawFrame();
  };

  const sync = () => {
    if (!vid) return;
    const shouldPlay = visible && !reduced && !document.hidden && !userPaused && !scrubbing;
    if (shouldPlay) {
      if (vid.paused) vid.play().catch(() => {});
      setPlayIcon(true);
      if (!raf) raf = requestAnimationFrame(pump);
    } else {
      if (!vid.paused) vid.pause();
      setPlayIcon(false);
    }
  };
  let lastT = -1;
  const pump = () => {
    raf = 0;
    if (!vid || !visible || document.hidden) return;
    const growing = !reduced && performance.now() - switchAt < 700;
    if (!vid.paused && vid.readyState >= 2 && vid.currentTime !== lastT) { lastT = vid.currentTime; grab(vid); }
    else if (growing) paintBev(true);
    if (!vid.paused || growing) raf = requestAnimationFrame(pump);
  };

  const loadRoad = async (key) => {
    if (curKey === key) return;
    curKey = key;
    switchAt = performance.now();
    lastPhase = -1;
    const name = `static-${key}`;
    clip = manifest[name];
    const old = vid;
    const v = Object.assign(document.createElement("video"), { muted: true, loop: true, playsInline: true, preload: "auto", className: "vsrc" });
    v.setAttribute("aria-hidden", "true");
    v.src = `assets/media/${name}.mp4`;
    const poster = Object.assign(new Image(), { src: `assets/media/${name}.webp` });
    vid = v; lastT = -1; lastF = -1;
    root.append(v);
    v.addEventListener("loadeddata", () => { if (old) { old.pause(); old.remove(); } if (vid === v) { grab(v); sync(); } }, { once: true });
    v.addEventListener("seeked", () => { if (vid === v) grab(v); });
    poster.onload = () => { if (vid === v && v.readyState < 2) grab(poster); };
    sync();
    bev = bevs[key] ||= await fetch(`assets/bev/static-${key}.json`).then((r) => r.json());
    if (curKey !== key) return;
    $(".st-kind", root).textContent = `${bev.kind} · pure-noise generation`;
    $(".st-title", root).textContent = bev.title;
    $(".st-change", root).textContent = bev.change;
    $(".st-why", root).textContent = bev.why;
    if (!reduced) gsap.fromTo(explainEl, { y: 8, autoAlpha: 0.35 }, { y: 0, autoAlpha: 1, duration: 0.32, ease: "power2.out", overwrite: "auto" });
    Object.assign(zoom, { span: bev.cat === "urban" ? 72 : 112, px: 0, py: 0 });
    paintBev(true);
    if (!raf) raf = requestAnimationFrame(pump);
  };

  radios(pick, (b) => loadRoad(b.dataset.road));
  toggle.addEventListener("click", () => { showOvl = !showOvl; toggle.setAttribute("aria-pressed", String(showOvl)); drawFrame(); });
  btnPlay.addEventListener("click", () => { userPaused = !userPaused; sync(); });
  btnReplay.addEventListener("click", () => { if (!vid) return; userPaused = false; vid.currentTime = 0; sync(); grab(vid); });
  scrub.addEventListener("pointerdown", () => { scrubbing = true; sync(); });
  scrub.addEventListener("input", () => { if (!vid) return; vid.currentTime = Number(scrub.value) / 10; });
  const endScrub = () => { if (!scrubbing) return; scrubbing = false; sync(); };
  scrub.addEventListener("pointerup", endScrub);
  scrub.addEventListener("change", endScrub);
  zoomable(cvBev, zoom, () => paintBev(true), cvBev.parentElement);
  new ResizeObserver(drawFrame).observe(root);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }, { threshold: 0.05 }).observe(root);
  document.addEventListener("visibilitychange", sync);
  $("[aria-checked=true]", pick).click();
  return { root };
}

// Recorded drives, longest-tailed condition last: each plays once, then hands over. A chip's fill is its share of the drives.
export async function setupReel() {
  const box = $(".reel"), v = $("video", box), bar = $(".reel-chips", box);
  const items = await fetch("assets/media/data/strip.json").then((r) => r.json()), top = items[0].drives;
  let i = 0, visible = false;
  bar.innerHTML = items.map((d) => `<button type="button" aria-pressed="false" style="--s:${(d.drives / top).toFixed(3)}"><b>${d.label}</b><span>${d.drives.toLocaleString("en")}</span><i></i></button>`).join("");
  const chips = $$("button", bar);
  const show = (k) => {
    i = k;
    chips.forEach((c, n) => { c.setAttribute("aria-pressed", String(n === k)); c.style.setProperty("--p", 0); });
    v.src = items[k].src;
    if (visible) v.play().catch(() => {});
  };
  chips.forEach((c, k) => c.addEventListener("click", () => show(k)));
  v.addEventListener("ended", () => show((i + 1) % items.length));
  v.addEventListener("timeupdate", () => chips[i].style.setProperty("--p", v.currentTime / (v.duration || 3)));
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible && !reduced ? v.play().catch(() => {}) : v.pause(); }, { threshold: 0.2 }).observe(box);
  show(0);
}

// Repair: all seven views of one damaged render. Left of the divider the 3DGS render, right of it the repair (or the recording).
export async function setupRepair(manifest) {
  const root = $("#repair"), chips = $$(".fix-pick [role=radio]", root), stats = $(".fx-stats", root);
  const rig = new Rig($("#fix-rig"), manifest, { order: SEVEN, layer: "restored", wipeLayer: "degraded", loop: false, watch: root });
  const F = (await fetch("assets/data/results.json").then((r) => r.json())).fixer;
  let pinned = false, cur = chips[0];
  rig.wipe = rig.el.clientWidth / 2;
  const show = (b) => {
    cur = b;
    chips.forEach((c) => c.style.setProperty("--p", 0));
    rig.setClip(`fix-${b.dataset.clip}`);
    const f = F[b.dataset.fam], pc = (a, z) => `<b>${a} → ${z}</b><span>${z < a ? "−" : "+"}${Math.abs((100 * (z - a)) / a).toFixed(0)}%</span>`;
    stats.innerHTML = f ? `<div><dt>PSNR</dt><dd><b>${f.psnr[0]} → ${f.psnr[1]} dB</b><span>+${(f.psnr[1] - f.psnr[0]).toFixed(2)}</span></dd></div><div><dt>LPIPS</dt><dd>${pc(...f.lpips)}</dd></div><div><dt>FVD</dt><dd>${pc(...f.fvd)}</dd></div><div><dt>BEV feature distance</dt><dd>${pc(...f.fbd)}</dd></div>` : "";
  };
  rig.onframe = (v) => cur.style.setProperty("--p", v.currentTime / (v.duration || 8.7));
  rig.el.addEventListener("ended", () => { if (pinned) { rig.time = 0; rig.sync(); } else chips[(chips.indexOf(cur) + 1) % chips.length].click(); });
  radios($(".fix-pick", root), show);
  chips.forEach((c) => c.addEventListener("pointerdown", () => { pinned = true; }));
  radios($(".fix-mode", root), (b) => { rig.layer = b.dataset.row; $(".fix-right", root).textContent = `${b.textContent} →`; rig.draw(); });
  follow(rig, (x) => { rig.wipe = x; rig.draw(); });
  show(chips[0]);
}

// The single take's beats, in the order the agent scripted them; the times come from the design (world data).
// Each beat also cues the 3D camera: a real move to where the action is, then a hold.
const BEATS = {
  start: ["Recorded start", "Into the roundabout", "Until the first edit the car follows its recorded route. Everything after is generated from one first frame.", { pitch: 0.55, dist: 30, yaw: 0 }],
  cyclist: ["Slow", "A cyclist cuts across", "The agent sends a cyclist over the roundabout exit just as the car arrives. The car yields, then drives on.", { pitch: 0.32, dist: 19, yaw: -0.55 }],
  lead_brakes: ["Fast", "The car ahead brakes hard", "The lead car stops at 6 m/s². The car follows it down at 7 m/s² and stops behind it.", { pitch: 0.28, dist: 17, yaw: 0.35 }],
  u_turn: ["Off the map", "U-turn through the median", "The edited route turns across the median fence. No road leads here; the vector world and all seven cameras follow.", { pitch: 1.2, dist: 52, yaw: 0 }],
  wreck: ["Through", "Through a broken-down car", "A stopped car waits in the oncoming lane. The route drives straight through it.", { pitch: 0.38, dist: 21, yaw: 1.1 }],
  median: ["Through", "Back across the median", "A diagonal over the fence and its planters into the lanes the car came from.", { pitch: 0.8, dist: 34, yaw: -0.7 }],
  trees: ["Off the road", "Into the trees", "Over the kerb into the roadside trees. The picture still holds.", { pitch: 0.24, dist: 20, yaw: 0.55 }],
};

export async function setupDrive(manifest) {
  const root = $("#drive"), rig = new Rig($("#drive-rig"), manifest, { order: SEVEN, watch: root }), data = await loadWorld("drive");
  const stage = $(".drive-world", root), world = new World(stage, data);
  world.view = { ...BEATS.start[3], fp: 0, fov: 42 };
  world.grow = world.grow.map(() => 1);
  const wheel = $(".wheel", root), arc = $(".speed-arc", root), kmh = $(".kmh", root), scrub = $(".drive-scrub", root), play = $(".drive-play", root), card = $(".beat-card", root);
  const beats = [[0, "start"], ...data.events].map(([t, k]) => ({ t, f: Math.round(t * 10), key: k, kick: BEATS[k][0], title: BEATS[k][1], text: BEATS[k][2], shot: BEATS[k][3] }));
  $(".marks", root).innerHTML = beats.slice(1).map((b) => `<i style="left:${(100 * b.f) / (world.n - 1)}%"></i>`).join("");
  $(".beats", root).innerHTML = beats.map((b) => `<li><button type="button"><time>${b.t.toFixed(1)} s</time><small>${b.kick}</small><b>${b.title}</b></button></li>`).join("");
  const items = $$(".beats button", root);
  let visible = false, last = performance.now(), cur = -1, touched = -1e9, lastKmh = -1, lastScrub = -1;
  // The director frames each beat unless the reader has just orbited or zoomed; then it waits, and eases back.
  const direct = (shot, d = 2.4) => { if (!reduced) gsap.to(world.view, { ...shot, duration: d, ease: "power2.inOut", overwrite: "auto" }); else Object.assign(world.view, shot); };
  const release = () => gsap.to([world.drag], { yaw: 0, pitch: 0, duration: 1.6, ease: "power2.inOut" });
  const beat = (f) => {
    const i = Math.max(0, beats.findLastIndex((b) => f >= b.f - 12));
    items[i].style.setProperty("--p", Math.min(1, Math.max(0, (f - beats[i].f + 12) / Math.max(1, (beats[i + 1]?.f ?? world.n) - beats[i].f))).toFixed(3));
    if (i === cur) return;
    cur = i;
    items.forEach((b, j) => { b.toggleAttribute("aria-current", j === i); b.classList.toggle("past", j < i); if (j !== i) b.style.setProperty("--p", j < i ? 1 : 0); });
    [$("small", card).textContent, $("b", card).textContent, $("span", card).textContent] = [beats[i].kick, beats[i].title, beats[i].text];
    if (!reduced) gsap.fromTo(card, { y: 10, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.7, ease: "expo.out" });
    if (performance.now() - touched > 6000) direct(beats[i].shot);
  };
  const dash = (f) => {
    const { v, yawRate } = world.motion(f);
    const steer = Math.atan((2.9 * yawRate) / Math.max(1.5, Math.abs(v))) * Math.sign(v || 1) * 15;
    wheel.style.transform = `rotate(${((-steer * 180) / Math.PI).toFixed(1)}deg)`;
    arc.style.strokeDashoffset = (100 - Math.min(100, (Math.abs(v) / 16) * 100)).toFixed(1);
    const k = Math.round(Math.abs(v) * 3.6), sc = Math.round(f);
    if (k !== lastKmh) { lastKmh = k; kmh.textContent = k; }
    if (sc !== lastScrub) { lastScrub = sc; scrub.value = sc; }
    beat(f);
  };
  const paint = (now) => {
    if (!visible) return;
    const dt = Math.min(0.1, (now - last) / 1000), f = rig.time * 10;
    last = now;
    if (now - touched > 6000 && (world.drag.yaw || world.drag.pitch || world.zoom !== 1) && !gsap.isTweening(world.drag) && !gsap.isTweening(world)) { release(); gsap.to(world, { zoom: 1, duration: 1.6, ease: "power2.inOut" }); direct(beats[Math.max(0, cur)].shot); }
    world.render(f, dt);
    dash(f);
    requestAnimationFrame(paint);
  };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) { last = performance.now(); requestAnimationFrame(paint); } }, { threshold: 0.05 }).observe(root);
  scrub.max = world.n - 1;
  const seek = (t) => { rig.time = t; dash(t * 10); };
  scrub.addEventListener("input", () => { rig.userPaused = true; rig.sync(); seek(scrub.value / 10); });
  items.forEach((b, i) => b.addEventListener("click", () => { touched = -1e9; seek(Math.max(0, beats[i].t - 1)); rig.userPaused = false; rig.sync(); }));
  play.addEventListener("click", () => rig.toggle());
  rig.el.addEventListener("playstate", () => {
    play.setAttribute("aria-label", rig.playing ? "Pause" : "Play");
    $("use", play).setAttribute("href", rig.playing ? "#i-pause" : "#i-play");
  });
  const zoomBy = steer(world, stage, () => { touched = performance.now(); });
  $$(".drive-stage .zoom [data-z]", root).forEach((b) => b.addEventListener("click", () => zoomBy(+b.dataset.z)));
  beat(0);
  return rig;
}

export function setupFigures() {
  const host = $(".fig"), tabs = $(".fig-tabs");
  let loading, player;
  const load = () => loading ||= ["data.js", "math.js", "scene.js", "bd.js", ...$$("[data-fig]", tabs).map((b) => `figs/${b.dataset.fig}.js`)]
    .reduce((chain, src) => chain.then(() => new Promise((ok, fail) => {
      document.head.append(Object.assign(document.createElement("script"), { src: `assets/figures/${src}`, onload: ok, onerror: fail }));
    })), Promise.resolve()).then(() => { BD.state.dark = true; BD.start(); });
  const show = (id) => load().then(() => {
    if (player) { player.visible = false; BD.players.splice(BD.players.indexOf(player), 1); }
    host.replaceChildren();
    player = BD.mount(id, host);
    player.fig.theme(true);
    if (reduced) player.setStatic(true);
    Object.assign(player, { visible: true, ratio: 1, dirty: true });
  });
  radios(tabs, (b) => show(b.dataset.fig));
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !player) show($("[aria-checked=true]", tabs).dataset.fig);
    if (player) player.visible = e.isIntersecting;
  }, { rootMargin: "50% 0px" }).observe(host);
}

export function setupCopy() {
  const btn = $(".copy");
  btn.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText($("#bibtex").textContent); btn.dataset.done = "Copied"; } catch { getSelection().selectAllChildren($("#bibtex")); btn.dataset.done = "Selected"; }
    setTimeout(() => delete btn.dataset.done, 1800);
  });
}

// One place for the report's arXiv URL: <meta name="arxiv">. Until it is set the links say so instead of pointing nowhere.
export function setupArxiv() {
  const url = $('meta[name="arxiv"]')?.content.trim();
  for (const a of $$(".arxiv")) {
    if (url) a.href = url;
    else { a.removeAttribute("href"); a.setAttribute("aria-disabled", "true"); a.title = "arXiv link coming soon"; }
  }
}
