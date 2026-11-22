// The serve cockpit's 3D vector world (web7v_bev3d.js) for exported scenes: HD map ribbons, GLB actors, ego, camera fans.
// World (x, y, CCW yaw) maps to three (x, 0, -y) with +Y up, so rotation.y == world yaw for models whose nose is +X.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { FANS as rigFans } from "./bev.js";

const COLOR = {
  bg: 0x000000, ground: 0x000000, grid: 0x15181d,
  car: 0x3d7eff, truck: 0xff9900, pedestrian: 0xffd36b, cyclist: 0xffd36b, ego: 0x00f0ff, edited: 0xff2a3a,
  wheel: 0x14181e, cyclistWheel: 0xffd027, skin: 0xe6e9ee,
  laneWhite: 0xf2f5f8, laneYellow: 0xffd000, laneFaint: 0x5a6878, edge: 0xff2d92, marker: 0xd9e0e8, area: 0x4a5664,
};
const DEFAULT_SIZE = { car: [4.6, 1.9, 1.55], truck: [8, 2.5, 3.1], pedestrian: [0.6, 0.6, 1.72], cyclist: [1.8, 0.7, 1.65] };
const EGO_SIZE = [4.9, 1.95, 1.5];
const MAX_INST = 320;
const EDITED = new THREE.Color(COLOR.edited);
const SOLID = new Set(["c", "f", "g", "h"]), DASHED = new Set(["d", "e"]), DUAL = new Set(["cc", "dd", "cd", "dc"]);
// The rig: yaw (left positive), FOV and schematic range from the cockpit's cones; hues match the page's camera colours.
const fanColors = [0x5b8cff, 0xa58bff, 0x8f7bff, 0x6aa0ff, 0xb07cff, 0x7ab8ff, 0x86c8ff];
const fanRanges = [35, 60, 25, 25, 25, 25, 40];
export const FANS = rigFans.map(([key, yaw, fov], index) => [key, yaw, fov, fanRanges[index], fanColors[index]]);
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const lerp = (a, b, t) => a + (b - a) * t;
const laneCol = (c) => (c === "c" ? COLOR.laneWhite : c === "d" ? COLOR.laneYellow : COLOR.laneFaint);
const pairs = (p) => Array.from({ length: p.length / 2 }, (_, i) => [p[2 * i], p[2 * i + 1]]);

function offsetLine(P, d) {
  return P.map((p, i) => {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    return [p[0] - (dy / L) * d, p[1] + (dx / L) * d];
  });
}
function ribbon(pos, pts, w, y, dash) {
  const h = w / 2, [on, off] = dash || [Infinity, 0], period = on + off;
  let ph = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 1e-3) continue;
    const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L, nx = -uy * h, ny = ux * h;
    for (let t = 0; t < L - 1e-6;) {
      const step = Math.max(1e-4, Math.min((ph < on ? on : period) - ph, L - t));
      if (ph < on) {
        const x0 = a[0] + ux * t, y0 = a[1] + uy * t, x1 = a[0] + ux * (t + step), y1 = a[1] + uy * (t + step);
        pos.push(x0 + nx, y, -(y0 + ny), x1 - nx, y, -(y1 - ny), x1 + nx, y, -(y1 + ny),
                 x0 + nx, y, -(y0 + ny), x0 - nx, y, -(y0 - ny), x1 - nx, y, -(y1 - ny));
      }
      t += step;
      ph = (ph + step) % period;
    }
  }
}
function curb(pos, pts) {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    pos.push(a[0], 0, -a[1], b[0], 0, -b[1], b[0], 0.3, -b[1], a[0], 0, -a[1], b[0], 0.3, -b[1], a[0], 0.3, -a[1]);
  }
}
function buildMap(elements) {
  const buckets = new Map();
  const add = (color, fn) => { if (!buckets.has(color)) buckets.set(color, []); fn(buckets.get(color)); };
  for (const el of elements) {
    const pts = pairs(el.p);
    if (pts.length < 2) continue;
    const P = el.g ? pts.concat([pts[0]]) : pts, t = el.lt || "", c = el.lc || "";
    if (el.t === "lane_line") {
      if (DUAL.has(t)) [-0.11, 0.11].forEach((o, i) => add(laneCol(c[i] || c), (a) => ribbon(a, offsetLine(P, o), 0.12, 0.03, DASHED.has(t[i]) ? [3, 3] : null)));
      else if (SOLID.has(t) || DASHED.has(t)) add(laneCol(c), (a) => ribbon(a, P, t === "e" || t === "f" ? 0.22 : 0.15, 0.03, DASHED.has(t) ? [3, 3] : null));
      else add(laneCol(c), (a) => ribbon(a, P, 0.1, 0.028, [1.2, 1.8]));
    } else if (el.t === "road_edge") add(COLOR.edge, (a) => { curb(a, P); ribbon(a, P, 0.3, 0.3, null); });
    else if (el.t === "crosswalks") add(COLOR.marker, (a) => ribbon(a, P, 0.35, 0.032, null));
    else if (el.t === "wait_lines") add(COLOR.marker, (a) => ribbon(a, P, 0.45, 0.032, null));
    else if (el.t === "road_marker_arrow" || el.t === "road_marker_sign") add(COLOR.marker, (a) => ribbon(a, P, 0.12, 0.032, null));
    else if (el.t === "non_drivable_area") add(COLOR.area, (a) => ribbon(a, P, 0.1, 0.026, [1.5, 1.5]));
  }
  let n = 0;
  for (const arr of buckets.values()) n += arr.length;
  const pos = new Float32Array(n), col = new Float32Array(n), c = new THREE.Color();
  let o = 0;
  for (const [hex, arr] of buckets) {
    c.setHex(hex);
    pos.set(arr, o);
    for (let i = o; i < o + arr.length; i += 3) { col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b; }
    o += arr.length;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

// ---- GLB -> merged per-part templates (nose +X, origin at ground centre), loaded once for every world ----
const partOf = (name) => (/wheel|tyre|tire/i.test(name) ? "wheel" : /head/i.test(name) ? "skin" : "body");
function collect(root) {
  root.updateMatrixWorld(true);
  const groups = {};
  root.traverse((n) => { if (n.isMesh) (groups[partOf(n.name)] ||= []).push(n.geometry.clone().applyMatrix4(n.matrixWorld)); });
  return groups;
}
function strip(g) {
  for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal") g.deleteAttribute(k);
  return g;
}
function template(groups) {
  const parts = {}, box = new THREE.Box3();
  for (const [k, list] of Object.entries(groups)) {
    const g = mergeGeometries(list.map(strip));
    g.rotateY(Math.PI / 2); // Kenney assets face +Z
    g.computeBoundingBox();
    box.union(g.boundingBox);
    parts[k] = g;
  }
  const c = box.getCenter(new THREE.Vector3()), d = box.getSize(new THREE.Vector3());
  for (const g of Object.values(parts)) g.translate(-c.x, -box.min.y, -c.z);
  return { parts, dims: [d.x, d.z, d.y] };
}
function cyclistGroups(ped) {
  const box = new THREE.Box3();
  for (const g of Object.values(ped).flat()) { g.computeBoundingBox(); box.union(g.boundingBox); }
  const s = 1.25 / (box.max.y - box.min.y);
  const rider = (g) => g.clone().translate(0, -box.min.y, 0).scale(s, s, s).translate(0, 0.45, -0.12);
  const wheel = (z) => new THREE.TorusGeometry(0.33, 0.045, 8, 28).rotateY(Math.PI / 2).translate(0, 0.33, z);
  const bar = (w, h, d, y, z) => new THREE.BoxGeometry(w, h, d).translate(0, y, z);
  return {
    wheel: [wheel(0.5), wheel(-0.5)],
    body: [...(ped.body || []).map(rider), bar(0.05, 0.05, 1, 0.62, 0), bar(0.05, 0.36, 0.05, 0.8, 0.42), bar(0.52, 0.04, 0.04, 0.98, 0.42)],
    skin: (ped.skin || []).map(rider),
  };
}
let templates;
function loadTemplates() {
  return (templates ||= (async () => {
    const manager = new THREE.LoadingManager();
    manager.setURLModifier((u) => (/\.png$/i.test(u) ? "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=" : u));
    const loader = new GLTFLoader(manager);
    const [car, truck, ped] = await Promise.all(["sedanSports", "truck", "pedestrian_raw"].map((f) => loader.loadAsync(`assets/models/${f}.glb`)));
    const pedGroups = collect(ped.scene);
    return { car: template(collect(car.scene)), truck: template(collect(truck.scene)), cyclist: template(cyclistGroups(pedGroups)), pedestrian: template(pedGroups) };
  })());
}
function material(part, kind, ego = false) {
  if (part === "wheel") return new THREE.MeshStandardMaterial({ color: kind === "cyclist" ? COLOR.cyclistWheel : COLOR.wheel, roughness: 0.75, metalness: 0.2 });
  if (part === "skin") return new THREE.MeshStandardMaterial({ color: COLOR.skin, roughness: 0.6 });
  const vehicle = kind === "car" || kind === "truck";
  return new THREE.MeshPhysicalMaterial({
    color: ego ? COLOR.ego : 0xffffff, metalness: vehicle ? 0.45 : 0, roughness: vehicle ? 0.32 : 0.55,
    clearcoat: vehicle ? 1 : 0, clearcoatRoughness: 0.12, emissive: ego ? COLOR.ego : 0, emissiveIntensity: ego ? 0.22 : 0,
  });
}
function radialTexture(inner, outer) {
  const c = Object.assign(document.createElement("canvas"), { width: 128, height: 128 });
  const x = c.getContext("2d"), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner); g.addColorStop(1, outer);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function envTexture() {
  const c = Object.assign(document.createElement("canvas"), { width: 512, height: 256 });
  const x = c.getContext("2d"), g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "#9fb3c6"); g.addColorStop(0.45, "#34495b"); g.addColorStop(0.52, "#0e1822"); g.addColorStop(1, "#0a1017");
  x.fillStyle = g; x.fillRect(0, 0, 512, 256);
  x.fillStyle = "#fff"; x.fillRect(60, 24, 70, 40); x.fillRect(300, 30, 120, 18);
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function fanMesh(fov, range, hex) {
  const n = 28, a0 = (-fov / 2) * Math.PI / 180, da = (fov * Math.PI / 180) / n, c = new THREE.Color(hex);
  const pos = [0, 0, 0], col = [c.r, c.g, c.b, 0.42], idx = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + i * da;
    pos.push(Math.cos(a) * range, 0, -Math.sin(a) * range);
    col.push(c.r, c.g, c.b, 0.02);
    if (i) idx.push(0, i, i + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 4));
  g.setIndex(idx);
  const fill = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false }));
  const edge = new THREE.Line(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(pos.slice(3).concat(pos.slice(0, 3), pos.slice(3, 6)), 3)),
    new THREE.LineBasicMaterial({ color: hex, transparent: true, opacity: 0.55, toneMapped: false }));
  const g2 = new THREE.Group();
  g2.add(fill, edge);
  return g2;
}

export class World {
  constructor(container, data) {
    this.container = container;
    this.data = data;
    this.n = data.n;
    const gl = document.createElement("canvas").getContext("webgl2");
    const renderer = String(gl?.getParameter(gl.RENDERER) || "");
    this.software = /swiftshader|llvmpipe|software/i.test(renderer);
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: !this.software, alpha: false, powerPreference: "high-performance" }));
    r.setPixelRatio(Math.min(devicePixelRatio, this.software ? 1 : 1.5));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    container.append(r.domElement);
    this.canvas = r.domElement;

    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color(COLOR.bg);
    scene.fog = new THREE.Fog(COLOR.bg, 60, 320);
    scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x0b1016, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(-20, 40, 15);
    scene.add(sun);
    scene.environment = envTexture();
    scene.environmentIntensity = 0.9;
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.3, 900);

    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: COLOR.ground }));
    this.ground.position.y = -0.05;
    this.grid = new THREE.GridHelper(400, 40, COLOR.grid, COLOR.grid);
    this.grid.position.y = -0.03;
    const map = new THREE.Mesh(buildMap(data.map), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false }));
    map.frustumCulled = false;
    scene.add(this.ground, this.grid, map);

    const flat = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.shadows = this._instanced(flat, new THREE.MeshBasicMaterial({ map: radialTexture("rgba(0,0,0,0.7)", "rgba(0,0,0,0)"), transparent: true, depthWrite: false }));
    this.glow = new THREE.Mesh(flat, new THREE.MeshBasicMaterial({ map: radialTexture("rgba(0,240,255,0.55)", "rgba(0,240,255,0)"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    this.trail = this._ribbonMesh(COLOR.ego, 0.35);
    this.plan = this._ribbonMesh(COLOR.ego, 0.85);
    this._bakeTrail();
    scene.add(this.glow);
    if (data.recorded) {
      const pos = [];
      ribbon(pos, pairs(data.recorded), 0.4, 0.035, [2, 2.5]);
      const ghost = this._ribbonMesh(0xffffff, 0.22);
      ghost.geometry = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    }

    this.rig = new THREE.Group();
    this.fans = FANS.map(([, yaw, fov, range, hex]) => {
      const m = fanMesh(fov, range, hex);
      m.rotation.y = (yaw * Math.PI) / 180;
      m.position.y = 0.06;
      this.rig.add(m);
      return m;
    });
    scene.add(this.rig);
    this.grow = FANS.map(() => 1);

    this.view = { pitch: 0.32, dist: 22, yaw: 0, fp: 0, fov: 45 };
    this.drag = { yaw: 0, pitch: 0 };
    this.zoom = 1;
    this.frame = 0;
    this.camYaw = null;
    this.fleets = {};
    this.ego = null;
    this._d = new THREE.Object3D();
    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(container);
    this.resize();
    this.ready = this._load();
  }

  _ribbonMesh(hex, opacity) {
    const m = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    m.frustumCulled = false;
    this.scene.add(m);
    return m;
  }
  _instanced(geo, mat) {
    const m = new THREE.InstancedMesh(geo, mat, MAX_INST);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    m.count = m.n = 0;
    this.scene.add(m);
    return m;
  }
  async _load() {
    const tpl = await loadTemplates();
    for (const [kind, t] of Object.entries(tpl)) {
      const meshes = Object.entries(t.parts).map(([part, geo]) => {
        const m = this._instanced(geo, material(part, kind));
        if (part === "body") m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_INST * 3).fill(1), 3);
        return m;
      });
      this.fleets[kind] = { meshes, body: meshes.find((m) => m.instanceColor), color: new THREE.Color(COLOR[kind]), dims: t.dims, uniform: kind === "pedestrian", n: 0 };
    }
    this.ego = new THREE.Group();
    for (const [part, geo] of Object.entries(tpl.car.parts)) this.ego.add(new THREE.Mesh(geo, material(part, "car", true)));
    const [L, W, H] = tpl.car.dims;
    this.ego.scale.set(EGO_SIZE[0] / L, EGO_SIZE[2] / H, EGO_SIZE[1] / W);
    this.scene.add(this.ego);
    await this.renderer.compileAsync(this.scene, this.camera);
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  pose(f) {
    const e = this.data.ego, i = Math.max(0, Math.min(this.n - 1, Math.floor(f))), j = Math.min(this.n - 1, i + 1), u = Math.max(0, Math.min(1, f - i));
    return { x: lerp(e[3 * i], e[3 * j], u), y: lerp(e[3 * i + 1], e[3 * j + 1], u), yaw: e[3 * i + 2] + wrapPi(e[3 * j + 2] - e[3 * i + 2]) * u };
  }
  // Signed speed (m/s) and yaw rate (rad/s) at frame f, for the dashboard.
  motion(f) {
    const a = this.pose(f - 0.5), b = this.pose(f + 0.5), fps = this.data.fps;
    const v = this.data.speed[Math.max(0, Math.min(this.n - 1, Math.round(f)))];
    return { v, yawRate: wrapPi(b.yaw - a.yaw) * fps };
  }
  orbit(dx, dy) {
    this.drag.yaw -= dx * 0.006;
    this.drag.pitch = Math.max(-0.25, Math.min(1.1, this.drag.pitch + dy * 0.004));
  }
  _bakeTrail() {
    const e = this.data.ego, pos = [], verts = [0];
    for (let i = 1; i < this.n; i++) {
      ribbon(pos, [[e[3 * (i - 1)], e[3 * (i - 1) + 1]], [e[3 * i], e[3 * i + 1]]], 0.35, 0.045, null);
      verts.push(pos.length / 3);
    }
    this.trail.geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    this._trailVerts = verts;
    this._planBuf = new Float32Array(256 * 3);
    this.plan.geometry.setAttribute("position", new THREE.BufferAttribute(this._planBuf, 3).setUsage(THREE.DynamicDrawUsage));
  }
  _path(mesh, from, to, w, dash) {
    const a = Math.max(0, from), b = Math.min(this.n - 1, to), key = `${a}:${b}`;
    if (mesh.key === key) return;
    mesh.key = key;
    if (mesh === this.trail && this._trailVerts) {
      const start = this._trailVerts[a], end = this._trailVerts[b];
      mesh.geometry.setDrawRange(start, Math.max(0, end - start));
      return;
    }
    const e = this.data.ego, pts = [];
    for (let i = a; i <= b; i++) pts.push([e[3 * i], e[3 * i + 1]]);
    const pos = [];
    if (pts.length > 1) ribbon(pos, pts, w, 0.045, dash);
    if (pos.length > this._planBuf.length) {
      this._planBuf = new Float32Array(Math.max(pos.length, this._planBuf.length * 2));
      mesh.geometry.setAttribute("position", new THREE.BufferAttribute(this._planBuf, 3).setUsage(THREE.DynamicDrawUsage));
    }
    this._planBuf.set(pos);
    mesh.geometry.attributes.position.needsUpdate = true;
    mesh.geometry.setDrawRange(0, pos.length / 3);
  }
  _shadow(x, y, yaw, sx, sz) {
    const m = this.shadows, D = this._d;
    if (m.n >= MAX_INST) return;
    D.position.set(x, 0.02, -y); D.rotation.set(0, yaw, 0); D.scale.set(sx, 1, sz); D.updateMatrix();
    m.setMatrixAt(m.n++, D.matrix);
  }
  _actors(f, ego) {
    for (const fl of Object.values(this.fleets)) fl.n = 0;
    const D = this._d, i = Math.floor(f), u = f - i;
    for (const t of this.data.tracks) {
      const k = i - t.f, len = t.n || t.p.length / 3;
      if (k < 0 || k >= len) continue;
      const fl = this.fleets[t.c] || this.fleets.car;
      if (!fl || fl.n >= MAX_INST) continue;
      const p = t.p, a = t.n ? 0 : 3 * k, b = t.n ? 0 : 3 * Math.min(k + 1, len - 1);
      const x = lerp(p[a], p[b], u), y = lerp(p[a + 1], p[b + 1], u), yaw = p[a + 2] + wrapPi(p[b + 2] - p[a + 2]) * u;
      if ((x - ego.x) ** 2 + (y - ego.y) ** 2 > 120 * 120) continue;
      const [L, W, H] = t.s || DEFAULT_SIZE[t.c] || DEFAULT_SIZE.car, [dl, dw, dh] = fl.dims;
      D.position.set(x, 0, -y); D.rotation.set(0, yaw, 0);
      if (fl.uniform) D.scale.setScalar(H / dh); else D.scale.set(L / dl, H / dh, W / dw);
      D.updateMatrix();
      for (const m of fl.meshes) m.setMatrixAt(fl.n, D.matrix);
      fl.body?.setColorAt(fl.n, t.e ? EDITED : fl.color);
      fl.n++;
      this._shadow(x, y, yaw, Math.max(L, 0.8) * 1.3, Math.max(W, 0.8) * 1.6);
    }
    for (const fl of Object.values(this.fleets)) {
      for (const m of fl.meshes) { m.count = fl.n; m.instanceMatrix.needsUpdate = true; }
      if (fl.body) fl.body.instanceColor.needsUpdate = true;
    }
  }
  _camera(ego, dt) {
    const v = this.view;
    if (this.camYaw == null) this.camYaw = ego.yaw;
    this.camYaw += wrapPi(ego.yaw - this.camYaw) * (1 - Math.exp(-3 * dt));
    const pitch = Math.max(0.04, Math.min(1.5, v.pitch + this.drag.pitch)), yaw = this.camYaw + v.yaw + this.drag.yaw;
    const dist = v.dist * this.zoom, ahead = 6 * Math.cos(pitch), hz = dist * Math.cos(pitch);
    const fx = ego.x + Math.cos(this.camYaw) * ahead, fy = ego.y + Math.sin(this.camYaw) * ahead;
    const c = this.camera, cy = Math.cos(ego.yaw), sy = Math.sin(ego.yaw);
    // fp blends the orbit camera into the front-wide camera's own pose: mounted on the roof, looking down the road.
    const px = lerp(fx - Math.cos(yaw) * hz, ego.x + cy * 1.9, v.fp), py = lerp(dist * Math.sin(pitch), 1.55, v.fp), pz = lerp(-(fy - Math.sin(yaw) * hz), -(ego.y + sy * 1.9), v.fp);
    c.position.set(px, py, pz);
    c.lookAt(lerp(fx, ego.x + cy * 40, v.fp), lerp(0, 1.2, v.fp), lerp(-fy, -(ego.y + sy * 40), v.fp));
    if (c.fov !== v.fov) { c.fov = v.fov; c.updateProjectionMatrix(); }
    this.scene.fog.near = dist * 1.5 + 20;
    this.scene.fog.far = dist * 5 + 200;
    this.ground.position.set(ego.x, -0.05, -ego.y);
    this.grid.position.set(Math.round(ego.x / 10) * 10, -0.03, -Math.round(ego.y / 10) * 10);
  }

  dispose() {
    this._ro.disconnect();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }

  render(f, dt = 1 / 60) {
    this.frame = f;
    const ego = this.pose(f);
    this._camera(ego, dt);
    this.shadows.n = 0;
    if (this.ego) {
      this.ego.position.set(ego.x, 0, -ego.y);
      this.ego.rotation.y = ego.yaw;
      this.ego.visible = this.view.fp < 0.5;
    }
    this.glow.position.set(ego.x, 0.025, -ego.y);
    this.glow.rotation.y = ego.yaw;
    this.glow.scale.set(EGO_SIZE[0] * 1.9, 1, EGO_SIZE[1] * 2.6);
    this.rig.position.set(ego.x, 0, -ego.y);
    this.rig.rotation.y = ego.yaw;
    this.fans.forEach((m, i) => { const g = Math.max(0.001, this.grow[i]); m.scale.set(g, 1, g); m.visible = this.grow[i] > 0.002; });
    this._shadow(ego.x, ego.y, ego.yaw, EGO_SIZE[0] * 1.25, EGO_SIZE[1] * 1.5);
    const i = Math.floor(f);
    this._path(this.trail, i - (this.data.recorded ? this.n : 90), i, 0.35, null);
    this._path(this.plan, i, i + 8, 0.5, [1.2, 0.9]); // the chunk being generated: the next eight frames
    if (Object.keys(this.fleets).length) this._actors(f, ego);
    this.shadows.count = this.shadows.n;
    this.shadows.instanceMatrix.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
  }
}

export const loadWorld = (name) => fetch(`assets/world/${name}.json`).then((r) => r.json());

// Drag to orbit, wheel or pinch to zoom; onUser fires on every touch so an autopilot camera can step aside.
export function steer(world, el, onUser = () => {}) {
  const pts = new Map();
  let pinch = 0;
  const zoom = (k) => { world.zoom = Math.max(0.25, Math.min(4, world.zoom * k)); onUser(); };
  el.addEventListener("wheel", (e) => { e.preventDefault(); zoom(Math.exp(e.deltaY * 0.0012)); }, { passive: false });
  el.addEventListener("pointerdown", (e) => { pts.set(e.pointerId, [e.clientX, e.clientY]); el.setPointerCapture(e.pointerId); onUser(); });
  el.addEventListener("pointermove", (e) => {
    const prev = pts.get(e.pointerId);
    if (!prev) return;
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch) zoom(pinch / d);
      pinch = d;
    } else { world.orbit(e.clientX - prev[0], e.clientY - prev[1]); onUser(); }
  });
  const up = (e) => { pts.delete(e.pointerId); pinch = 0; };
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
  return zoom;
}
