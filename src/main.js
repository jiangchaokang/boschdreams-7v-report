import { setupHero, primeHero } from "./lens.js";
import { setupCar } from "./car.js";
import { setupCharts } from "./charts.js";
import { reduced } from "./rig.js";
import { $, $$, setupFilm, setupScenes, setupReel, setupStatic, setupRepair, setupDrive, setupFigures, setupCopy, setupArxiv } from "./sections.js";
import { setupAgent } from "./agent.js";
import { setupFutures } from "./futures.js";

gsap.registerPlugin(ScrollTrigger);
const titleIn = primeHero();
const manifest = await fetch("assets/media/manifest.json").then((r) => r.json());
await Promise.race([document.fonts.ready, new Promise((ok) => setTimeout(ok, 600))]);
setupArxiv();
setupCar($(".hero"));
setupCharts();
setupFigures();
setupCopy();
// Each section wakes up just before it is reached, so the opening keeps the network and the GPU to itself.
const pendingSections = new Map([
  [$("#film"), () => setupFilm()],
  [$("#data"), () => { setupScenes(manifest); return setupReel(); }],
  [$("#agent"), () => setupAgent(manifest)],
  [$("#futures"), () => setupFutures(manifest)],
  [$("#drive"), () => setupDrive(manifest)],
  [$("#static"), () => setupStatic(manifest)],
  [$("#repair"), () => setupRepair(manifest)],
]);
const nearby = new IntersectionObserver((entries) => {
  entries.filter((entry) => entry.isIntersecting).forEach(({ target }) => {
    nearby.unobserve(target);
    const setup = pendingSections.get(target);
    pendingSections.delete(target);
    Promise.resolve().then(setup).then(() => ScrollTrigger.refresh()).catch((err) => {
      console.error(err);
      const notice = document.createElement("p");
      notice.className = "hint";
      notice.setAttribute("role", "status");
      notice.textContent = "This preview could not load. The technical report has the full results.";
      target.append(notice);
    });
  });
}, { rootMargin: "400px 0px" });
pendingSections.forEach((_, section) => nearby.observe(section));

// Where am I: the header fills with reading progress, and the nav marks the section in view.
const bar = $(".bar"), links = $$(".nav a");
addEventListener("scroll", () => {
  bar.classList.toggle("scrolled", scrollY > innerHeight * 0.6);
  bar.style.setProperty("--read", (scrollY / (document.documentElement.scrollHeight - innerHeight)).toFixed(4));
}, { passive: true });
const spy = new IntersectionObserver((entries) => entries.forEach((e) => {
  if (e.isIntersecting) links.forEach((a) => a.toggleAttribute("aria-current", a.hash === `#${e.target.id}`));
}), { rootMargin: "-45% 0px -50% 0px" });
links.forEach((a) => spy.observe($(a.hash)));
// Each claim arrives as it is reached: the heading, then how to read it, then the evidence rises into place.
if (!reduced) {
  $$(".sec-head").forEach((h) => gsap.from(h.children, { y: 32, autoAlpha: 0, duration: 1.2, stagger: 0.14, ease: "expo.out", scrollTrigger: { trigger: h, start: "top 86%", once: true, onEnter: () => h.classList.add("in") } }));
  $$(".sec-head + *").forEach((el) => gsap.from(el, { y: 48, autoAlpha: 0, duration: 1.4, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 92%", once: true } }));
  const foot = $(".foot-hero");
  new IntersectionObserver(([e]) => foot.style.setProperty("--play", e.isIntersecting ? "running" : "paused")).observe(foot);
} else $$(".sec-head").forEach((h) => h.classList.add("in"));

await setupHero(manifest, titleIn);
ScrollTrigger.refresh();
