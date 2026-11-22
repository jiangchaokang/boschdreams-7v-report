export const CAM = { FW: "Front", CR: "Right", RR: "Rear right", RT: "Rear", RL: "Rear left", CL: "Left", FT: "Tele" };
export const SEVEN = ["CL", "FW", "FT", "CR", "RL", "RT", "RR"];
export const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches || location.search.includes("still");
export const dpr = () => Math.min(devicePixelRatio || 1, 2);

// Cover-fit atlas rect r = [x, y, w, h] into a cw x ch canvas (tiles share the source aspect, so nothing is cut).
export function blit(ctx, img, r, cw, ch) {
  const s = Math.max(cw / r[2], ch / r[3]);
  ctx.drawImage(img, r[0] + (r[2] - cw / s) / 2, r[1] + (r[3] - ch / s) / 2, cw / s, ch / s, 0, 0, cw, ch);
}
// Size a canvas to its box at device resolution; true when it changed.
export function fit(cv) {
  const w = Math.round(cv.clientWidth * dpr()), h = Math.round(cv.clientHeight * dpr());
  if (cv.width === w && cv.height === h) return false;
  Object.assign(cv, { width: w, height: h });
  return true;
}

/* Seven canvases fed by one atlas video: every view, and every layer of it, stays frame-locked.
   Layers: a base (`layer`), an overlay blended at `mix` (`over`) and a `wipeLayer` left of the `wipe` x. */
export class Rig {
  constructor(el, manifest, opts = {}) {
    Object.assign(this, { el, manifest, layer: "tiles", over: "layout", mix: 0, wipe: null, wipeLayer: "layout", visible: false, userPaused: reduced, loop: true, onframe: null }, opts);
    this.tiles = (opts.order || SEVEN).map((cam) => {
      const b = document.createElement(opts.swap ? "button" : "div");
      if (opts.swap) b.type = "button";
      b.className = "tile";
      b.dataset.cam = b.dataset.slot = cam;
      b.innerHTML = `<canvas aria-hidden="true"></canvas><span class="tag">${CAM[cam]}</span>`;
      b.canvas = b.firstChild;
      b.ctx = b.canvas.getContext("2d", { alpha: false });
      return b;
    });
    el.prepend(...this.tiles);
    if (opts.swap) for (const t of this.tiles) t.addEventListener("click", () => this.focus(t.dataset.cam));
    new ResizeObserver(() => this.resize()).observe(el);
    new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; this.sync(); }, { threshold: 0.02 }).observe(opts.watch || el);
    document.addEventListener("visibilitychange", () => this.sync());
    if (el.dataset.clip) this.setClip(el.dataset.clip);
  }

  // Any view can be the big one: a click swaps it with the main tile.
  focus(cam) {
    const main = this.tiles.find((x) => x.dataset.slot === "FW"), t = this.tiles.find((x) => x.dataset.cam === cam);
    if (!t || t === main) return;
    [t.dataset.cam, main.dataset.cam] = [main.dataset.cam, t.dataset.cam];
    for (const x of [t, main]) x.lastChild.textContent = CAM[x.dataset.cam];
    this.draw();
    this.el.dispatchEvent(new Event("focus-cam"));
  }

  setClip(name, at = 0) {
    if (this.cur?.name === name) {
      if (at && Math.abs(this.cur.v.currentTime - at) > 0.2) this.time = at;
      this.sync();
      return;
    }
    const v = Object.assign(document.createElement("video"), { muted: true, loop: this.loop, playsInline: true, preload: "auto", className: "vsrc" });
    v.setAttribute("aria-hidden", "true");
    v.src = `assets/media/${name}.mp4`;
    const poster = Object.assign(new Image(), { src: `assets/media/${name}.webp` });
    const old = this.cur;
    this.cur = { name, clip: this.manifest[name], v, poster, seek: at, lastT: -1 };
    this.el.append(v);
    const step = () => {
      if (this.cur?.v !== v) return;
      if (v.readyState >= 2) {
        this.cur.lastT = v.currentTime;
        this.grab(v);
        this.onframe?.(v);
      }
      if ("requestVideoFrameCallback" in v) v.requestVideoFrameCallback(step);
    };
    const pump = () => {
      if (this.cur?.v !== v) return;
      if (!v.paused && v.readyState >= 2 && v.currentTime !== this.cur.lastT) {
        this.cur.lastT = v.currentTime;
        this.grab(v);
        this.onframe?.(v);
      }
      if (this.visible && !document.hidden) requestAnimationFrame(pump);
    };
    this.cur.pump = pump;
    v.addEventListener("loadedmetadata", () => {
      if (this.cur?.v === v && this.cur.seek) { v.currentTime = this.cur.seek; this.cur.seek = 0; }
    }, { once: true });
    v.addEventListener("loadeddata", () => {
      if (old) { old.v.pause(); old.v.remove(); }
      if (this.cur?.v !== v) return;
      if (this.cur.seek) { v.currentTime = this.cur.seek; this.cur.seek = 0; }
      step();
      this.sync();
    }, { once: true });
    v.addEventListener("canplay", () => { if (this.cur?.v === v) this.sync(); });
    v.addEventListener("seeked", () => { if (this.cur?.v === v && v.readyState >= 2) { this.cur.lastT = v.currentTime; this.grab(v); this.onframe?.(v); } });
    for (const t of ["play", "pause", "ended"]) v.addEventListener(t, () => {
      if (t === "play" && this.cur?.v === v) requestAnimationFrame(pump);
      this.el.dispatchEvent(new Event(t === "ended" ? "ended" : "playstate"));
    });
    poster.onload = () => this.cur?.v === v && v.readyState < 2 && this.grab(poster);
    this.sync();
  }

  // One copy per decoded frame: every tile and overlay then reads identical pixels.
  grab(img) {
    const b = (this.buf ||= document.createElement("canvas")), w = img.videoWidth || img.naturalWidth, h = img.videoHeight || img.naturalHeight;
    if (!w) return;
    if (b.width !== w || b.height !== h) { Object.assign(b, { width: w, height: h }); this.bctx = b.getContext("2d", { alpha: false }); }
    (this.bctx || b.getContext("2d", { alpha: false })).drawImage(img, 0, 0);
    this.bufClip = this.cur.clip;
    this.draw();
  }

  get video() { return this.cur.v; }
  get playing() { return !!(this.cur?.v && !this.cur.v.paused); }
  get time() { return this.cur?.v?.currentTime || 0; }
  set time(t) {
    if (!this.cur?.v) return;
    if (this.cur.v.readyState >= 1) { this.cur.v.currentTime = t; this.cur.seek = 0; }
    else this.cur.seek = t;
  }
  toggle() { this.userPaused = this.playing; this.sync(); }
  sync() {
    const v = this.cur?.v;
    if (!v) return;
    if (this.visible && !this.userPaused && !document.hidden) {
      if (v.paused) v.play().catch(() => {});
      if (this.cur.pump) requestAnimationFrame(this.cur.pump);
    } else if (!v.paused) v.pause();
  }

  resize() {
    for (const t of this.tiles) fit(t.canvas);
    this.draw();
  }

  draw() {
    if (!this.cur || !this.buf || !this.bufClip) return;
    const clip = this.bufClip, img = this.buf;
    const k = dpr(), base = clip[this.layer] || clip.tiles || Object.values(clip).find((x) => x?.FW), over = this.mix > 0 && clip[this.over], wipe = this.wipe != null && clip[this.wipeLayer];
    for (const t of this.tiles) {
      const { ctx } = t, cw = t.canvas.width, ch = t.canvas.height, cam = t.dataset.cam;
      if (!cw || !base?.[cam]) continue;
      blit(ctx, img, base[cam], cw, ch);
      if (over) {
        ctx.globalAlpha = this.mix;
        blit(ctx, img, over[cam], cw, ch);
        ctx.globalAlpha = 1;
      }
      if (wipe) {
        const wx = Math.min(cw, (this.wipe - t.offsetLeft) * k);
        if (wx > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, wx, ch);
          ctx.clip();
          blit(ctx, img, wipe[cam], cw, ch);
          ctx.restore();
        }
        if (wx > 0 && wx < cw) { ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.fillRect(wx - k, 0, 2 * k, ch); }
      }
    }
  }
}
