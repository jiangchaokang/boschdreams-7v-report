// A small glass car that drives to the cursor: it turns before it accelerates, slows to turn, and parks on arrival.
export function setupCar(hero) {
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  const car = document.createElement("div");
  car.className = "glasscar";
  car.setAttribute("aria-hidden", "true");
  document.body.append(car);
  const s = { x: innerWidth / 2, y: innerHeight * 0.86, h: -Math.PI / 2, v: 0 }, target = { x: s.x, y: s.y };
  let on = false, last = performance.now(), raf = 0;
  const show = (v) => { if (v !== on) { on = v; car.classList.toggle("on", v); if (v && !raf) { last = performance.now(); raf = requestAnimationFrame(step); } } };

  function step(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const dx = target.x - s.x, dy = target.y - s.y, dist = Math.hypot(dx, dy);
    const turn = Math.atan2(Math.sin(Math.atan2(dy, dx) - s.h), Math.cos(Math.atan2(dy, dx) - s.h));
    const vt = dist < 6 ? 0 : Math.min(900, dist * 2.4) * Math.max(0.12, Math.cos(turn));
    s.v += Math.max(-1800 * dt, Math.min(1100 * dt, vt - s.v));
    if (dist > 6) s.h += Math.max(-1, Math.min(1, turn * 4)) * (1.6 + s.v / 60) * dt;
    s.x += Math.cos(s.h) * s.v * dt;
    s.y += Math.sin(s.h) * s.v * dt;
    car.style.transform = `translate(${s.x}px, ${s.y}px) rotate(${s.h}rad)`;
    raf = on || s.v > 1 ? requestAnimationFrame(step) : 0;
  }
  addEventListener("pointermove", (e) => { target.x = e.clientX; target.y = e.clientY; show(scrollY < innerHeight * 0.2); }, { passive: true });
  addEventListener("scroll", () => show(on && scrollY < innerHeight * 0.2), { passive: true });
  document.documentElement.addEventListener("pointerleave", () => show(false));
  new IntersectionObserver(([e]) => { if (!e.isIntersecting) show(false); }).observe(hero);
}
