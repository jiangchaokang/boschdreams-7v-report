import { World, FANS, loadWorld } from "./world.js";
import { CAM, reduced } from "./rig.js";

const MODES = ["world", "layout", "dream", "seven"];
const SAT = ["FT", "CL", "CR", "RL", "RR", "RT"];
const YAW = Object.fromEntries(FANS.map(([c, yaw]) => [c, yaw]));
const SEVEN = 0.8; // the lens shrinks in Seven so the six other cameras can be read
const CAPTION = {
  world: "The vector world: HD map, traffic and the fields of view of the car's seven cameras. Drag to orbit.",
  layout: "What the front camera sees of that world. This layout is the model's input.",
  dream: "What BoschDreams-7V generates from it.",
  seven: "All seven cameras, generated together on one clock.",
  montage: "Sixteen more drives, each generated the same way.",
};

// A square crop of a fisheye view: centred a little above the middle, where the road and horizon are.
function square(ctx, img, r, S, side = 0.9) {
  const s = r[3] * side;
  ctx.drawImage(img, r[0] + r[2] / 2 - s / 2, Math.max(r[1], r[1] + r[3] * 0.44 - s / 2), s, s, 0, 0, S, S);
}

// Copy each decoded frame once; every crop drawn from it this frame then shows the same instant.
function buffer(v, posterSrc) {
  const b = { c: document.createElement("canvas"), ok: false, ctx: null };
  const draw = (src, w, h) => {
    if (!w) return;
    if (b.c.width !== w || b.c.height !== h) { Object.assign(b.c, { width: w, height: h }); b.ctx = b.c.getContext("2d", { alpha: false }); }
    b.ctx.drawImage(src, 0, 0);
    b.ok = true;
  };
  const copy = () => { if (v.readyState >= 2) draw(v, v.videoWidth, v.videoHeight); };
  if (posterSrc) { const im = new Image(); im.onload = () => { if (!b.ok) draw(im, im.naturalWidth, im.naturalHeight); }; im.src = posterSrc; }
  const loop = () => { copy(); if ("requestVideoFrameCallback" in v) v.requestVideoFrameCallback(loop); };
  if ("requestVideoFrameCallback" in v) v.requestVideoFrameCallback(loop);
  v.addEventListener("loadeddata", copy);
  v.addEventListener("seeked", copy);
  v.addEventListener("timeupdate", copy);
  return b;
}

// The opening's first frame, set before anything loads: only the name, in the middle of a dark page.
export function primeHero() {
  if (reduced) return null;
  gsap.set(".hero .lens", { scale: 0.04, filter: "blur(16px)" });
  gsap.set([".hero-copy", ".hero-foot"], { autoAlpha: 0, y: 12 });
  gsap.set([".hero-bg", ".bar .brand"], { opacity: 0 });
  return gsap.timeline({ defaults: { ease: "expo.out", duration: 1.2 } })
    .fromTo(".hero-title .b", { opacity: 0, x: -40, filter: "blur(12px)" }, { opacity: 1, x: 0, filter: "blur(0px)" }, 0.1)
    .fromTo(".hero-title .d", { opacity: 0, x: 40, filter: "blur(12px)" }, { opacity: 1, x: 0, filter: "blur(0px)" }, 0.3)
    .fromTo(".hero-title sup", { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.8 }, 0.9);
}

export async function setupHero(manifest, titleIn) {
  const root = document.querySelector(".hero"), lens = root.querySelector(".lens"), out = lens.querySelector(".lens-video");
  const bg = root.querySelector(".hero-bg"), bgx = bg.getContext("2d"), ctx = out.getContext("2d");
  const chips = [...root.querySelectorAll(".modes button")], sats = SAT.map((c) => root.querySelector(`.sat[data-cam="${c}"]`));
  const clip = manifest.hero, cuts = manifest.montage.cuts;
  const video = Object.assign(document.createElement("video"), { src: "assets/media/hero.mp4", muted: true, loop: true, playsInline: true, preload: "auto", className: "vsrc" });
  const montage = Object.assign(document.createElement("video"), { src: "assets/media/montage.mp4", muted: true, playsInline: true, preload: "auto", className: "vsrc" });
  root.append(video, montage);
  const hb = buffer(video, "assets/media/hero.webp"), mb = buffer(montage);
  const world = new World(lens.querySelector(".lens-world"), await loadWorld("crosswalk"));
  const st = { mode: "world", show: 0, ripple: 0, sat: 0, montage: 0, punch: 1 };
  world.grow = FANS.map(() => 0);
  let S = 0, last = performance.now(), visible = true, tl = null;

  const resize = () => {
    S = Math.round(lens.clientWidth * Math.min(devicePixelRatio, 2));
    out.width = out.height = S;
    for (const s of sats) s.width = s.height = Math.round(s.clientWidth * Math.min(devicePixelRatio, 2));
  };
  new ResizeObserver(resize).observe(lens);
  resize();

  const frameOf = () => clip.first + (video.readyState >= 2 ? video.currentTime : (performance.now() / 1000) % 30) * 10;
  const cap = root.querySelector(".modes-cap");
  const select = (m) => { chips.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === m))); cap.textContent = CAPTION[m]; };
  // During the opening each chip fills for as long as its mode is on screen: the sequence shows its own timing.
  const run = (m, d) => gsap.fromTo(chips.find((b) => b.dataset.mode === m), { "--p": 0 }, { "--p": 1, duration: d, ease: "none", onComplete() { gsap.set(this.targets()[0], { "--p": 0 }); } });

  function paint(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (st.show < 1 && st.montage < 1) world.render(frameOf(), dt);
    if (S && hb.ok && (st.show > 0 || st.montage > 0)) {
      const img = hb.c;
      ctx.clearRect(0, 0, S, S);
      square(ctx, img, clip.layout.FW, S);
      if (st.ripple > 0) {
        const r = st.ripple * S * 0.75, c = S / 2;
        ctx.save();
        ctx.beginPath();
        ctx.arc(c, c, r, 0, Math.PI * 2);
        ctx.clip();
        square(ctx, img, clip.tiles.FW, S);
        ctx.restore();
        if (st.ripple < 1) {  // the wavefront: a soft band of light, not a drawn line
          const g = ctx.createRadialGradient(c, c, r * 0.8, c, c, r * 1.06);
          g.addColorStop(0, "rgba(255,255,255,0)");
          g.addColorStop(0.75, `rgba(255,255,255,${0.32 * (1 - st.ripple)})`);
          g.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, S, S);
        }
      }
      if (st.montage > 0 && mb.ok) {
        ctx.globalAlpha = st.montage;
        square(ctx, mb.c, [0, 0, 1280, 704], S, 0.95);
        ctx.globalAlpha = 1;
      }
    }
    if (st.sat > 0 && hb.ok) sats.forEach((s, i) => {
      const r = clip.tiles[SAT[i]], x = s.getContext("2d"), w = s.width;
      x.drawImage(hb.c, r[0] + (r[2] - r[3]) / 2, r[1], r[3], r[3], 0, 0, w, w);
      x.font = `500 ${Math.round(w * 0.07)}px ${getComputedStyle(s).fontFamily}`;
      x.textAlign = "center";
      x.fillStyle = "rgba(255,255,255,.9)";
      x.shadowColor = "#000";
      x.shadowBlur = w * 0.03;
      x.fillText(CAM[SAT[i]], w / 2, w * 0.86);
      x.shadowBlur = 0;
    });
    const src = st.show > 0.5 || st.montage > 0 ? out : world.canvas;
    out.style.opacity = Math.max(st.show, st.montage);
    bgx.drawImage(src, 0, src.height * 0.15, src.width, src.height * 0.7, 0, 0, bg.width, bg.height);
    if (visible) requestAnimationFrame(paint);
  }

  const fanIn = () => world.grow.map((_, i) => gsap.to(world.grow, { [i]: 1, duration: 0.9, ease: "expo.out", delay: i * 0.12 }));
  const satPos = (k) => sats.forEach((s, i) => {
    const a = (YAW[SAT[i]] * Math.PI) / 180, R = (lens.clientWidth * SEVEN / 2 + s.clientWidth * 0.56 + (SAT[i] === "FT" ? 6 : 0)) * k;
    s.style.transform = `translate(${-Math.sin(a) * R}px, ${-Math.cos(a) * R}px) scale(${0.2 + 0.8 * k})`;
    s.style.opacity = k;
  });
  const sat = (to, d = 0.9) => gsap.to(st, { sat: to, duration: d, ease: to ? "expo.out" : "power2.in", onUpdate: () => satPos(st.sat) });
  const view = (to, d) => gsap.to(world.view, { ...to, duration: d, ease: "power2.inOut" });
  // A droplet takes a new view like water takes a touch: a squash, then a few settling oscillations.
  const wobble = (scale) => gsap.timeline()
    .to(lens, { scaleX: scale * 1.04, scaleY: scale * 0.96, duration: 0.25, ease: "power2.out" })
    .to(lens, { scaleX: scale, scaleY: scale, duration: 1.3, ease: "elastic.out(1, 0.32)" });

  // One transition per mode: each is a real change of what the lens shows, and each lands on a resting state.
  function go(mode) {
    tl?.kill();
    const fromWorld = st.show < 0.5;
    st.mode = mode;
    select(mode);
    lens.dataset.mode = mode;
    tl = gsap.timeline();
    tl.add(wobble(mode === "seven" ? SEVEN : 1), 0);
    tl.to(".hero-copy", { autoAlpha: mode === "seven" ? 0 : 1, duration: 0.6 }, 0);
    if (mode !== "seven" && st.sat) tl.add(sat(0, 0.4), 0);
    if (st.montage) tl.to(st, { montage: 0, duration: 0.5 }, 0);
    if (mode === "world") {
      tl.to(st, { show: 0, ripple: 0, duration: 0.6, ease: "power1.inOut" }, 0).add(view({ pitch: 0.32, dist: 22, fp: 0, fov: 45 }, 1.4), 0);
      if (world.grow.some((g) => g < 1)) tl.add(fanIn(), 0.3);
      return tl;
    }
    // Into the front camera: the layout is the vector world as that camera sees it; the dream grows out of it.
    let at = 0;
    if (fromWorld) {
      tl.add(view({ fp: 1, fov: 72, pitch: 0.2 }, 1.3), 0).to(st, { show: 1, duration: 0.6, ease: "power1.inOut" }, 1.05);
      at = 1.8;
    }
    tl.to(st, { ripple: mode === "layout" ? 0 : 1, duration: mode === "layout" ? 0.6 : 1.3, ease: "power2.inOut" }, at);
    if (mode === "seven") tl.add(sat(1), ">-0.2");
    return tl;
  }

  // The name opens the page in the middle, then flies into the header and becomes the brand; the lens grows under it.
  const title = root.querySelector(".hero-title"), brand = document.querySelector(".bar .brand");
  const land = () => { gsap.set(title, { opacity: 0 }); gsap.set(brand, { opacity: 1 }); };
  const fly = () => {
    const a = title.getBoundingClientRect(), b = brand.getBoundingClientRect();
    return gsap.to(title, { x: `+=${b.left + b.width / 2 - (a.left + a.width / 2)}`, y: `+=${b.top + b.height / 2 - (a.top + a.height / 2)}`, scale: b.width / a.width, duration: 1.1, ease: "expo.inOut", onComplete: land });
  };

  function intro() {
    world.view = { pitch: 1.45, dist: 110, yaw: 0.4, fp: 0, fov: 45 };
    select("world");
    const t = gsap.timeline({ defaults: { ease: "expo.out" } })
      .add(() => fly(), 0.5)
      .to(lens, { scale: 1, duration: 1.8 }, 0.6)
      .to(lens, { filter: "blur(0px)", duration: 1.4, ease: "power2.out" }, 0.8)
      .to(bg, { autoAlpha: 1, duration: 2, ease: "power1.out" }, 0.9)
      .add(view({ pitch: 0.32, dist: 22, yaw: 0 }, 3.2), 0.9)
      .add(fanIn(), 1.9)
      .to([".hero-copy", ".hero-foot"], { autoAlpha: 1, y: 0, duration: 1, stagger: 0.12 }, 1.9)
      .add(() => run("world", 2.6), 1.9)
      .add(() => { go("layout"); run("layout", 2.8); }, 4.5)
      .add(() => { go("dream"); run("dream", 2.2); }, 7.3)
      .add(() => { go("seven"); run("seven", 3.1); }, 9.5);
    // Acceleration: the lens runs through other worlds, each cut shorter than the last, and lands back on this one.
    t.add(() => {
      tl?.kill();
      cap.textContent = CAPTION.montage;
      chips.forEach((b) => b.setAttribute("aria-pressed", "false"));
      tl = gsap.timeline().add(sat(0, 0.5), 0).add(wobble(1), 0).add(() => { montage.currentTime = 0; montage.play().catch(() => {}); }, 0.3).to(st, { montage: 1, duration: 0.3 }, 0.3);
      let at = 0.3;
      for (const c of cuts) { tl.fromTo(lens, { scale: 1.035 }, { scale: 1, duration: Math.min(0.5, c), ease: "power3.out" }, at); at += c; }
      tl.to(st, { montage: 0, duration: 0.9, ease: "power2.inOut" }, at - 0.2).to(".hero-copy", { autoAlpha: 1, duration: 0.6 }, at - 0.2).add(() => { st.mode = "dream"; select("dream"); lens.dataset.mode = "dream"; }, at - 0.2);
    }, 12.6);
    return t;
  }

  // A choice ends the opening early: whatever was still opening finishes quickly, then the chosen mode runs.
  const settle = () => {
    if (!introTl) return;
    introTl.kill();
    introTl = null;
    montage.pause();
    gsap.killTweensOf(title);
    gsap.killTweensOf(chips);
    gsap.set(chips, { "--p": 0 });
    titleIn?.progress(1);
    land();
    gsap.to(lens, { scale: 1, filter: "blur(0px)", duration: 0.6, ease: "power2.out" });
    gsap.to([bg, ".hero-copy", ".hero-foot"], { autoAlpha: 1, y: 0, duration: 0.6 });
    world.view.yaw = 0;
  };
  chips.forEach((b) => b.addEventListener("click", () => { settle(); go(b.dataset.mode); }));
  let drag = null;
  lens.addEventListener("pointerdown", (e) => { if (st.show < 0.5) { drag = [e.clientX, e.clientY]; lens.setPointerCapture(e.pointerId); } });
  lens.addEventListener("pointermove", (e) => { if (drag) { world.orbit(e.clientX - drag[0], e.clientY - drag[1]); drag = [e.clientX, e.clientY]; } });
  lens.addEventListener("pointerup", () => { drag = null; });

  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) { last = performance.now(); requestAnimationFrame(paint); if (!reduced) video.play().catch(() => {}); } else video.pause();
  }).observe(root);
  await world.ready;

  let introTl = null;
  if (reduced) {
    Object.assign(st, { show: 1, ripple: 1, mode: "dream" });
    land();
    world.grow = FANS.map(() => 1);
    select("dream");
    video.play().catch(() => {}).finally(() => { video.pause(); video.currentTime = 4; });
  } else {
    await titleIn;
    introTl = intro();
    video.play().catch(() => {});
  }
  gsap.to(root.querySelector(".lens-stage"), { scale: 0.86, autoAlpha: 0.35, ease: "none", scrollTrigger: { trigger: root, start: "top top", end: "bottom top", scrub: true } });
}
