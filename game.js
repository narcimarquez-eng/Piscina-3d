// Piscina Mazagón 3D — Robot solar vs ponis
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------
const CFG = {
  worldHalf: 32,          // el robot se mueve dentro de ±worldHalf (m)
  spawnRadius: 46,        // los ponis aparecen en este radio
  exitRadius: 52,         // al galopar más allá de este radio desaparecen
  robotSpeed: 5.5,        // m/s
  robotReverse: 3,        // m/s
  robotTurn: 1.7,         // rad/s
  robotRadius: 1.1,
  ponyWalk: 1.6,          // m/s (aumenta con el tiempo)
  ponyGallop: 10,         // m/s
  scareDist: 3,           // m
  laserCooldown: 5,       // s
  laserRange: 30,         // m
  laserHitRadius: 0.9,    // m
  maxInPool: 5,
  ptsLaser: 2000,
  ptsScare: 500,
  sunnyMin: 4, sunnyMax: 11,
  cloudyMin: 2.5, cloudyMax: 7,
};

const POOL = { w: 14, d: 7 };
const DECK = { w: 22, d: 15 };
const DECK_H = 0.12;
const WATER_Y = -0.25;
const POOL_DEPTH = 1.9;

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
const $ = (id) => document.getElementById(id);
const inRect = (x, z, hw, hd) => Math.abs(x) < hw && Math.abs(z) < hd;
const angleLerp = (a, b, t) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * t;
};

// ---------------------------------------------------------------------------
// Render básico
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
$('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const SKY_SUNNY = new THREE.Color(0x8fd3ff);
const SKY_CLOUDY = new THREE.Color(0x9eabb8);
scene.background = SKY_SUNNY.clone();
scene.fog = new THREE.Fog(SKY_SUNNY.clone(), 70, 170);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 700);

const hemi = new THREE.HemisphereLight(0xd8f0ff, 0x5b7a3a, 0.75);
scene.add(hemi);

const SUN_DIR = new THREE.Vector3(-0.55, 0.62, -0.55).normalize();
const sunLight = new THREE.DirectionalLight(0xfff0d0, 2.6);
sunLight.position.copy(SUN_DIR).multiplyScalar(70);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
Object.assign(sunLight.shadow.camera, { left: -50, right: 50, top: 50, bottom: -50, near: 1, far: 180 });
sunLight.shadow.bias = -0.0006;
sunLight.shadow.normalBias = 0.02;
scene.add(sunLight, sunLight.target);

// ---------------------------------------------------------------------------
// Texturas procedurales
// ---------------------------------------------------------------------------
function canvasTex(size, draw, repeat = null) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
  }
  return t;
}

const grassTex = canvasTex(256, (g, s) => {
  g.fillStyle = '#6caa4a'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 2600; i++) {
    const l = 30 + Math.random() * 25;
    g.fillStyle = `hsl(${90 + Math.random() * 25}, 45%, ${l}%)`;
    g.fillRect(Math.random() * s, Math.random() * s, 2, 3 + Math.random() * 3);
  }
}, 1 / 8);

const deckTex = canvasTex(256, (g, s) => {
  g.fillStyle = '#e9dcc0'; g.fillRect(0, 0, s, s);
  const n = 4, step = s / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    g.fillStyle = `hsl(38, ${30 + Math.random() * 10}%, ${80 + Math.random() * 7}%)`;
    g.fillRect(x * step + 2, y * step + 2, step - 4, step - 4);
  }
}, 1 / 4);

const tileTex = canvasTex(128, (g, s) => {
  g.fillStyle = '#2fa4d6'; g.fillRect(0, 0, s, s);
  g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2;
  for (let i = 0; i <= 8; i++) {
    g.beginPath(); g.moveTo(i * s / 8, 0); g.lineTo(i * s / 8, s); g.stroke();
    g.beginPath(); g.moveTo(0, i * s / 8); g.lineTo(s, i * s / 8); g.stroke();
  }
});
tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping;

const waterTex = canvasTex(256, (g, s) => {
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, s, s);
  g.strokeStyle = 'rgba(120,200,235,.55)'; g.lineWidth = 3;
  for (let i = 0; i < 40; i++) {
    g.beginPath();
    const x = Math.random() * s, y = Math.random() * s, r = 10 + Math.random() * 30;
    g.ellipse(x, y, r, r * 0.6, Math.random() * Math.PI, 0, Math.PI * 2);
    g.stroke();
  }
}, 1);
waterTex.repeat.set(3, 1.5);

const panelTex = canvasTex(256, (g, s) => {
  g.fillStyle = '#c9d3dd'; g.fillRect(0, 0, s, s);
  const cols = 6, rows = 8, pad = 4;
  const cw = (s - pad) / cols, ch = (s - pad) / rows;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const grd = g.createLinearGradient(0, y * ch, 0, (y + 1) * ch);
    grd.addColorStop(0, '#1f4fa8'); grd.addColorStop(1, '#0d2a66');
    g.fillStyle = grd;
    g.fillRect(pad + x * cw, pad + y * ch, cw - pad, ch - pad);
    g.strokeStyle = 'rgba(160,200,255,.35)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(pad + x * cw + (cw - pad) / 2, pad + y * ch); g.lineTo(pad + x * cw + (cw - pad) / 2, (y + 1) * ch); g.stroke();
  }
});

// ---------------------------------------------------------------------------
// Utilidades de mallas
// ---------------------------------------------------------------------------
const matCache = new Map();
function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!opts.unique && matCache.has(key)) return matCache.get(key);
  const { unique, ...rest } = opts;
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.0, ...rest });
  if (!unique) matCache.set(key, m);
  return m;
}
function mesh(geo, material, shadow = true) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}
function rectShape(w, d) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, -d / 2); s.lineTo(w / 2, -d / 2); s.lineTo(w / 2, d / 2); s.lineTo(-w / 2, d / 2); s.closePath();
  return s;
}
function rectHole(w, d) {
  const p = new THREE.Path();
  p.moveTo(-w / 2, -d / 2); p.lineTo(-w / 2, d / 2); p.lineTo(w / 2, d / 2); p.lineTo(w / 2, -d / 2); p.closePath();
  return p;
}

// ---------------------------------------------------------------------------
// Escenario: césped, terraza, piscina, pinos, tumbonas...
// ---------------------------------------------------------------------------
const colliders = []; // {x, z, r} obstáculos circulares para el robot

{
  // Césped con un hueco para la terraza
  const s = rectShape(400, 400);
  s.holes.push(rectHole(DECK.w, DECK.d));
  const geo = new THREE.ShapeGeometry(s);
  geo.rotateX(-Math.PI / 2);
  const ground = mesh(geo, new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }), false);
  scene.add(ground);

  // Terraza (extruida) con hueco de la piscina
  const ds = rectShape(DECK.w, DECK.d);
  ds.holes.push(rectHole(POOL.w, POOL.d));
  const dgeo = new THREE.ExtrudeGeometry(ds, { depth: DECK_H, bevelEnabled: false });
  dgeo.rotateX(-Math.PI / 2);
  const deck = mesh(dgeo, new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.9 }), false);
  scene.add(deck);

  // Vaso de la piscina (caja vista por dentro)
  const bt = tileTex.clone(); bt.needsUpdate = true; bt.repeat.set(POOL.w / 2, POOL.d / 2);
  const basin = mesh(new THREE.BoxGeometry(POOL.w, POOL_DEPTH, POOL.d),
    new THREE.MeshStandardMaterial({ map: bt, side: THREE.BackSide, roughness: 0.4 }), false);
  basin.position.y = DECK_H - POOL_DEPTH / 2 + 0.001;
  scene.add(basin);
  // Calles de natación
  for (let i = -1; i <= 1; i++) {
    const lane = mesh(new THREE.PlaneGeometry(POOL.w - 1.5, 0.22), mat(0x0d4f8a), false);
    lane.rotation.x = -Math.PI / 2;
    lane.position.set(0, DECK_H - POOL_DEPTH + 0.01, i * POOL.d / 4);
    scene.add(lane);
  }

  // Bordillo blanco
  const cop = mat(0xf7f5ef, { roughness: 0.6 });
  const cw = 0.4, ch = 0.07;
  for (const sz of [-1, 1]) {
    const b = mesh(new THREE.BoxGeometry(POOL.w + cw * 2, ch, cw), cop);
    b.position.set(0, DECK_H + ch / 2, sz * (POOL.d / 2 + cw / 2));
    scene.add(b);
  }
  for (const sx of [-1, 1]) {
    const b = mesh(new THREE.BoxGeometry(cw, ch, POOL.d), cop);
    b.position.set(sx * (POOL.w / 2 + cw / 2), DECK_H + ch / 2, 0);
    scene.add(b);
  }

  // Escalerilla
  const steel = mat(0xd9dde3, { metalness: 0.9, roughness: 0.25 });
  for (const dx of [-0.35, 0.35]) {
    const rail = mesh(new THREE.TorusGeometry(0.45, 0.04, 8, 16, Math.PI), steel);
    rail.position.set(POOL.w / 2 - 1.6 + dx, DECK_H + 0.05, POOL.d / 2 - 0.05);
    rail.rotation.y = Math.PI / 2;
    scene.add(rail);
    const leg = mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.5), steel);
    leg.position.set(POOL.w / 2 - 1.6 + dx, DECK_H - 0.7, POOL.d / 2 - 0.5);
    scene.add(leg);
  }
}

// Agua
const waterMat = new THREE.MeshStandardMaterial({
  color: 0x3fc6ee, map: waterTex, transparent: true, opacity: 0.82, roughness: 0.08, metalness: 0.1,
});
const water = mesh(new THREE.PlaneGeometry(POOL.w, POOL.d), waterMat, false);
water.rotation.x = -Math.PI / 2;
water.position.y = WATER_Y;
scene.add(water);

// Pino piñonero (típico de Mazagón)
function addPine(x, z, s = 1) {
  const g = new THREE.Group();
  const trunkMat = mat(0x7a5236, { roughness: 1 });
  const lean = rand(-0.12, 0.12);
  const trunk = mesh(new THREE.CylinderGeometry(0.22 * s, 0.35 * s, 6 * s, 8), trunkMat);
  trunk.position.y = 3 * s; trunk.rotation.z = lean;
  g.add(trunk);
  // Material propio por árbol para poder hacerlo translúcido si tapa la cámara
  const leafMat = new THREE.MeshStandardMaterial({ color: pick([0x2f6b2f, 0x3a7d34, 0x285c2a]), roughness: 1, transparent: true, opacity: 1 });
  const leafMats = [leafMat];
  const top = new THREE.Vector3(-Math.sin(lean) * 6 * s, 6 * s, 0);
  for (let i = 0; i < 6; i++) {
    const c = mesh(new THREE.SphereGeometry(rand(1.4, 2.0) * s, 10, 8), pick(leafMats));
    c.scale.y = 0.45;
    const a = (i / 6) * Math.PI * 2;
    c.position.set(top.x + Math.cos(a) * 1.5 * s, top.y + rand(-0.2, 0.4), top.z + Math.sin(a) * 1.5 * s);
    g.add(c);
  }
  const mid = mesh(new THREE.SphereGeometry(2.0 * s, 12, 8), leafMat);
  mid.scale.y = 0.5; mid.position.copy(top).add(new THREE.Vector3(0, 0.5, 0));
  g.add(mid);
  g.position.set(x, 0, z);
  g.rotation.y = rand(0, Math.PI * 2);
  scene.add(g);
  colliders.push({ x, z, r: 0.5 * s });
  pines.push({ x, z, leafMat });
}
const pines = [];

// Copas que se interponen entre la cámara y el robot se vuelven translúcidas
function updateOccluders(dt) {
  const cx = camera.position.x, cz = camera.position.z;
  const ex = R.x - cx, ez = R.z - cz;
  const len2 = ex * ex + ez * ez || 1;
  for (const p of pines) {
    const t = clamp(((p.x - cx) * ex + (p.z - cz) * ez) / len2, -0.15, 1);
    const d = Math.hypot(cx + ex * t - p.x, cz + ez * t - p.z);
    const target = d < 4 ? 0.2 : 1;
    p.leafMat.opacity = damp(p.leafMat.opacity, target, 8, dt);
    p.leafMat.depthWrite = p.leafMat.opacity > 0.95;
  }
}

{
  const placed = [];
  let tries = 0;
  while (placed.length < 30 && tries++ < 600) {
    const a = rand(0, Math.PI * 2), r = rand(17, 60);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (inRect(x, z, DECK.w / 2 + 4, DECK.d / 2 + 4)) continue;
    if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < 7)) continue;
    placed.push({ x, z });
    addPine(x, z, rand(0.85, 1.2));
  }
  // Arbustos
  const bushMat = [mat(0x4c8f3a, { roughness: 1 }), mat(0x5aa043, { roughness: 1 })];
  for (let i = 0; i < 28; i++) {
    const a = rand(0, Math.PI * 2), r = rand(14, 45);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (inRect(x, z, DECK.w / 2 + 2, DECK.d / 2 + 2)) continue;
    const b = mesh(new THREE.SphereGeometry(rand(0.5, 0.9), 10, 8), pick(bushMat));
    b.scale.y = 0.7; b.position.set(x, 0.3, z);
    scene.add(b);
  }
}

// Tumbonas y sombrillas
{
  const frame = mat(0xffffff, { roughness: 0.5 });
  const cushions = [0xff7f50, 0x3bb3c3, 0xffd166];
  const umbrellaCols = [0xff5c5c, 0x2ec4b6, 0xffbf3f];
  for (const side of [-1, 1]) {
    for (let i = -1; i <= 1; i++) {
      const x = i * 5.5, z = side * (POOL.d / 2 + 2.6);
      const g = new THREE.Group();
      const base = mesh(new THREE.BoxGeometry(0.75, 0.12, 1.9), frame); base.position.y = 0.32; g.add(base);
      const cush = mesh(new THREE.BoxGeometry(0.7, 0.08, 1.3), mat(cushions[(i + 1) % 3])); cush.position.set(0, 0.42, -0.25); g.add(cush);
      const back = mesh(new THREE.BoxGeometry(0.7, 0.08, 0.7), mat(cushions[(i + 1) % 3])); back.position.set(0, 0.6, 0.65); back.rotation.x = -0.9; g.add(back);
      for (const lx of [-0.3, 0.3]) for (const lz of [-0.8, 0.8]) {
        const l = mesh(new THREE.BoxGeometry(0.05, 0.3, 0.05), frame); l.position.set(lx, 0.15, lz); g.add(l);
      }
      g.position.set(x, DECK_H, z);
      g.rotation.y = side > 0 ? 0 : Math.PI;
      scene.add(g);
      colliders.push({ x, z, r: 0.9 });

      if (i !== 0) {
        const ux = x + 1.6, uz = z;
        const pole = mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4), frame);
        pole.position.set(ux, DECK_H + 1.2, uz); scene.add(pole);
        const top = mesh(new THREE.ConeGeometry(1.4, 0.55, 10, 1, true), mat(umbrellaCols[(i + 2) % 3], { side: THREE.DoubleSide }));
        top.position.set(ux, DECK_H + 2.45, uz); scene.add(top);
        colliders.push({ x: ux, z: uz, r: 0.3 });
      }
    }
  }
}

// Cartel "Piscina Mazagón"
{
  const t = canvasTex(512, (g, s) => {
    g.fillStyle = '#0e5aa7'; g.fillRect(0, 0, s, s / 2);
    g.strokeStyle = '#fff'; g.lineWidth = 10; g.strokeRect(10, 10, s - 20, s / 2 - 20);
    g.fillStyle = '#fff'; g.textAlign = 'center';
    g.font = 'bold 64px system-ui, sans-serif'; g.fillText('PISCINA', s / 2, 110);
    g.font = 'bold 72px system-ui, sans-serif'; g.fillText('MAZAGÓN', s / 2, 200);
  });
  t.repeat.set(1, 0.5); t.offset.set(0, 0.5);
  const g = new THREE.Group();
  const board = mesh(new THREE.BoxGeometry(3.2, 1.6, 0.1), [mat(0x0e5aa7), mat(0x0e5aa7), mat(0x0e5aa7), mat(0x0e5aa7),
    new THREE.MeshStandardMaterial({ map: t }), mat(0x0e5aa7)]);
  board.position.y = 2.4; g.add(board);
  for (const px of [-1.3, 1.3]) {
    const p = mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.4), mat(0x8a8f96)); p.position.set(px, 1.2, -0.08); g.add(p);
  }
  g.position.set(-DECK.w / 2 - 2.2, 0, DECK.d / 2 + 2.2);
  g.rotation.y = Math.PI / 4;
  scene.add(g);
  colliders.push({ x: g.position.x - 0.9, z: g.position.z + 0.9, r: 0.3 }, { x: g.position.x + 0.9, z: g.position.z - 0.9, r: 0.3 });
}

// Cielo: nubes de fondo que siguen a la cámara
const skyGroup = new THREE.Group();
scene.add(skyGroup);
const skyCloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, transparent: true, opacity: 0.95 });
for (let i = 0; i < 16; i++) {
  const c = new THREE.Group();
  const n = 4 + Math.floor(Math.random() * 4);
  for (let j = 0; j < n; j++) {
    const sp = new THREE.Mesh(new THREE.SphereGeometry(rand(10, 20), 10, 8), skyCloudMat);
    sp.position.set(j * 14 - n * 7, rand(-3, 5), rand(-6, 6));
    sp.scale.y = 0.55;
    c.add(sp);
  }
  const a = (i / 16) * Math.PI * 2 + rand(-0.15, 0.15);
  const r = 420;
  c.position.set(Math.cos(a) * r, rand(40, 110), Math.sin(a) * r);
  c.lookAt(0, c.position.y, 0);
  skyGroup.add(c);
}

// ---------------------------------------------------------------------------
// Robot / carrito solar
// ---------------------------------------------------------------------------
function buildRobot() {
  const g = new THREE.Group();
  const white = mat(0xf3f4f6, { roughness: 0.45 });
  const dark = mat(0x2b2f36, { roughness: 0.7 });
  const yellow = mat(0xffc400, { roughness: 0.5 });

  const body = mesh(new THREE.BoxGeometry(1.5, 0.55, 2.1), white); body.position.y = 0.68; g.add(body);
  const stripe = mesh(new THREE.BoxGeometry(1.52, 0.12, 2.12), yellow); stripe.position.y = 0.55; g.add(stripe);
  const bumper = mesh(new THREE.BoxGeometry(1.4, 0.2, 0.15), dark); bumper.position.set(0, 0.5, 1.1); g.add(bumper);

  const wheels = [];
  const tire = mat(0x1d1f22, { roughness: 0.9 });
  const hub = mat(0xb8bec7, { metalness: 0.6, roughness: 0.3 });
  for (const x of [-0.82, 0.82]) for (const z of [-0.68, 0.68]) {
    const w = new THREE.Group();
    const t = mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 20), tire); t.rotation.z = Math.PI / 2; w.add(t);
    const h = mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.32, 12), hub); h.rotation.z = Math.PI / 2; w.add(h);
    const spoke = mesh(new THREE.BoxGeometry(0.33, 0.06, 0.5), hub); w.add(spoke);
    w.position.set(x, 0.38, z);
    g.add(w); wheels.push(w);
  }

  // Panel solar inclinado
  const panelMat = new THREE.MeshStandardMaterial({ map: panelTex, roughness: 0.25, metalness: 0.4, emissive: 0x1a4fff, emissiveIntensity: 0.0 });
  const panel = new THREE.Group();
  const p = mesh(new THREE.BoxGeometry(1.9, 0.05, 1.8), [mat(0xaab2bd), mat(0xaab2bd), panelMat, mat(0xaab2bd), mat(0xaab2bd), mat(0xaab2bd)]);
  panel.add(p);
  panel.position.set(0, 1.35, -0.3);
  panel.rotation.x = -0.18;
  g.add(panel);
  for (const x of [-0.7, 0.7]) for (const z of [-0.95, 0.35]) {
    const post = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.45), dark);
    post.position.set(x, 1.1 + (z < 0 ? -0.12 : 0.12), z);
    g.add(post);
  }

  // Mástil y torreta láser
  const mast = mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.8), dark); mast.position.set(0, 1.35, 0.8); g.add(mast);
  const turret = mesh(new THREE.BoxGeometry(0.45, 0.32, 0.5), white); turret.position.set(0, 1.85, 0.8); g.add(turret);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x35d6ff, emissiveIntensity: 1.2 });
  for (const x of [-0.12, 0.12]) {
    const e = mesh(new THREE.SphereGeometry(0.06, 10, 8), eyeMat); e.position.set(x, 1.9, 1.05); g.add(e);
  }
  const barrel = mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.55, 12), dark);
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 1.72, 1.25); g.add(barrel);
  const tipMat = new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 2 });
  const tip = mesh(new THREE.SphereGeometry(0.08, 12, 8), tipMat); tip.position.set(0, 1.72, 1.55); g.add(tip);
  const antenna = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6), dark); antenna.position.set(0.18, 2.25, 0.65); g.add(antenna);
  const ball = mesh(new THREE.SphereGeometry(0.05, 8, 6), yellow); ball.position.set(0.18, 2.56, 0.65); g.add(ball);

  // Faros
  for (const x of [-0.5, 0.5]) {
    const l = mesh(new THREE.CircleGeometry(0.1, 12), new THREE.MeshStandardMaterial({ color: 0xfffbe6, emissive: 0xfff2b0, emissiveIntensity: 0.6 }));
    l.position.set(x, 0.75, 1.051); g.add(l);
  }

  return { group: g, wheels, tip, tipMat, panelMat };
}

const robot = buildRobot();
scene.add(robot.group);
const R = {
  x: 0, z: 14, heading: Math.PI, vel: 0, turnVel: 0, wheelSpin: 0,
};

// Anillo de 3 m y línea de puntería
const scareRing = new THREE.Mesh(
  new THREE.RingGeometry(CFG.scareDist - 0.08, CFG.scareDist, 64),
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }),
);
scareRing.rotation.x = -Math.PI / 2;
scene.add(scareRing);

const aimMat = new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.25, depthWrite: false });
const aimGeo = new THREE.PlaneGeometry(0.12, CFG.laserRange);
aimGeo.rotateX(-Math.PI / 2);
aimGeo.translate(0, 0, CFG.laserRange / 2);
const aimLine = new THREE.Mesh(aimGeo, aimMat);
scene.add(aimLine);

// ---------------------------------------------------------------------------
// Ponis
// ---------------------------------------------------------------------------
const COATS = [
  { body: 0x8b5a2b, mane: 0x2a1a0e }, // castaño
  { body: 0xf3efe6, mane: 0xd9cbb0 }, // blanco
  { body: 0x2a2523, mane: 0x111111 }, // negro
  { body: 0xc8893f, mane: 0xf5e6c4 }, // palomino
  { body: 0x9aa0a6, mane: 0x4a4d52 }, // tordo
  { body: 0xa0522d, mane: 0xf0e0c0 }, // alazán crin rubia
  { body: 0xe8b4c8, mane: 0x9b5de5 }, // poni de fantasía
];

function buildPony() {
  const coat = pick(COATS);
  const g = new THREE.Group();
  const m = mat(coat.body, { unique: true, roughness: 0.85 });
  const mm = mat(coat.mane, { unique: true, roughness: 0.95 });
  const hoofM = mat(0x2a2220);

  const body = mesh(new THREE.CapsuleGeometry(0.32, 0.75, 6, 12), m);
  body.rotation.x = Math.PI / 2; body.position.set(0, 0.85, 0);
  g.add(body);

  const legs = [];
  for (const [x, z] of [[0.17, 0.38], [-0.17, 0.38], [0.17, -0.38], [-0.17, -0.38]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.78, z);
    const leg = mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.7, 8), m); leg.position.y = -0.35; pivot.add(leg);
    const hoof = mesh(new THREE.CylinderGeometry(0.07, 0.085, 0.1, 8), hoofM); hoof.position.y = -0.72; pivot.add(hoof);
    g.add(pivot); legs.push(pivot);
  }

  const neck = new THREE.Group();
  neck.position.set(0, 1.0, 0.45);
  const nk = mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.62, 10), m);
  nk.rotation.x = 0.55; nk.position.set(0, 0.26, 0.16);
  neck.add(nk);
  const head = mesh(new THREE.BoxGeometry(0.24, 0.26, 0.52), m);
  head.rotation.x = 0.55; head.position.set(0, 0.52, 0.48);
  neck.add(head);
  const muzzle = mesh(new THREE.BoxGeometry(0.22, 0.2, 0.16), mat(0x3b2f2a));
  muzzle.rotation.x = 0.55; muzzle.position.set(0, 0.38, 0.72);
  neck.add(muzzle);
  for (const x of [-0.13, 0.13]) {
    const eye = mesh(new THREE.SphereGeometry(0.035, 8, 6), mat(0x111111)); eye.position.set(x, 0.6, 0.48); neck.add(eye);
    const ear = mesh(new THREE.ConeGeometry(0.05, 0.16, 6), m); ear.position.set(x * 0.6, 0.76, 0.3); ear.rotation.x = -0.2; neck.add(ear);
  }
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    const tuft = mesh(new THREE.BoxGeometry(0.07, 0.18, 0.16), mm);
    tuft.position.set(0, 0.12 + t * 0.55, -0.08 + t * 0.28); tuft.rotation.x = 0.55;
    neck.add(tuft);
  }
  const forelock = mesh(new THREE.BoxGeometry(0.12, 0.08, 0.14), mm); forelock.position.set(0, 0.7, 0.4); neck.add(forelock);
  g.add(neck);

  const tail = new THREE.Group();
  tail.position.set(0, 0.98, -0.62);
  const tl = mesh(new THREE.CylinderGeometry(0.06, 0.13, 0.65, 8), mm); tl.position.y = -0.3; tail.add(tl);
  tail.rotation.x = 0.5;
  g.add(tail);

  const scale = rand(0.9, 1.12);
  g.scale.setScalar(scale);
  return { group: g, legs, neck, tail, mats: [m], scale };
}

const ponies = [];
let poolCount = 0;

function spawnPony() {
  const pony = buildPony();
  const a = rand(0, Math.PI * 2);
  const x = Math.cos(a) * CFG.spawnRadius, z = Math.sin(a) * CFG.spawnRadius;
  const target = { x: rand(-POOL.w / 2 + 1.5, POOL.w / 2 - 1.5), z: rand(-POOL.d / 2 + 1, POOL.d / 2 - 1) };
  const p = {
    ...pony, x, z, y: 0, heading: Math.atan2(target.x - x, target.z - z),
    state: 'walk', speed: CFG.ponyWalk + Math.min(1.0, elapsed * 0.006) + rand(-0.15, 0.25),
    target, phase: rand(0, 10), flash: 0, t: 0,
  };
  p.group.position.set(x, 0, z);
  p.group.rotation.y = p.heading;
  scene.add(p.group);
  ponies.push(p);
}

function makeFlee(p) {
  p.state = 'flee';
  let ox = p.x, oz = p.z;
  const ol = Math.hypot(ox, oz) || 1; ox /= ol; oz /= ol;
  let ax = p.x - R.x, az = p.z - R.z;
  const al = Math.hypot(ax, az) || 1; ax /= al; az /= al;
  const dx = ox + ax * 0.6, dz = oz + az * 0.6;
  p.fleeHeading = Math.atan2(dx, dz);
  p.speed = 2;
}

function scarePony(p) {
  makeFlee(p);
  stats.scares++;
  addScore(CFG.ptsScare, p, '#e07b00');
  sfx.neigh();
}

function zapPony(p) {
  makeFlee(p);
  p.flash = 0.6;
  stats.lasers++;
  addScore(CFG.ptsLaser, p, '#e01e1e');
  burst(p.x, 1.0, p.z, 0xff4040, 18, 4);
  sfx.neigh();
}

function startJump(p) {
  p.state = 'jump';
  p.t = 0;
  p.j0 = { x: p.x, z: p.z, y: p.y };
  const hx = Math.sin(p.heading), hz = Math.cos(p.heading);
  p.j1 = {
    x: clamp(p.x + hx * 2, -POOL.w / 2 + 1, POOL.w / 2 - 1),
    z: clamp(p.z + hz * 2, -POOL.d / 2 + 0.8, POOL.d / 2 - 0.8),
  };
}

function updatePony(p, dt) {
  let moving = 0;
  switch (p.state) {
    case 'walk': {
      const dx = p.target.x - p.x, dz = p.target.z - p.z;
      p.heading = angleLerp(p.heading, Math.atan2(dx, dz), 1 - Math.exp(-3 * dt));
      p.x += Math.sin(p.heading) * p.speed * dt;
      p.z += Math.cos(p.heading) * p.speed * dt;
      moving = p.speed;
      if (Math.hypot(p.x - R.x, p.z - R.z) <= CFG.scareDist) { scarePony(p); break; }
      if (inRect(p.x, p.z, POOL.w / 2 + 0.3, POOL.d / 2 + 0.3)) startJump(p);
      break;
    }
    case 'flee': {
      p.speed = Math.min(CFG.ponyGallop, p.speed + 14 * dt);
      p.heading = angleLerp(p.heading, p.fleeHeading, 1 - Math.exp(-6 * dt));
      let nx = p.x + Math.sin(p.heading) * p.speed * dt;
      let nz = p.z + Math.cos(p.heading) * p.speed * dt;
      // no atravesar la piscina al huir
      if (inRect(nx, nz, POOL.w / 2 + 0.4, POOL.d / 2 + 0.4)) { nx = p.x; nz = p.z; p.fleeHeading += 0.15; }
      p.x = nx; p.z = nz;
      moving = p.speed;
      if (Math.hypot(p.x, p.z) > CFG.exitRadius) p.remove = true;
      break;
    }
    case 'jump': {
      p.t = Math.min(1, p.t + dt / 0.75);
      const t = p.t;
      p.x = p.j0.x + (p.j1.x - p.j0.x) * t;
      p.z = p.j0.z + (p.j1.z - p.j0.z) * t;
      const swimY = WATER_Y - 0.85 * p.scale;
      p.y = p.j0.y + (swimY - p.j0.y) * t + Math.sin(t * Math.PI) * 1.2;
      p.group.rotation.x = Math.sin(t * Math.PI) * -0.4;
      moving = 6;
      if (t >= 1) {
        p.state = 'swim';
        p.group.rotation.x = 0;
        p.target = randomPoolPoint();
        burst(p.x, WATER_Y, p.z, 0xbfefff, 30, 5);
        sfx.splash();
        poolCount++;
        updatePoolHud();
        if (poolCount >= CFG.maxInPool) gameOver();
      }
      break;
    }
    case 'swim': {
      const dx = p.target.x - p.x, dz = p.target.z - p.z;
      if (Math.hypot(dx, dz) < 0.4) p.target = randomPoolPoint();
      p.heading = angleLerp(p.heading, Math.atan2(dx, dz), 1 - Math.exp(-1.5 * dt));
      p.x += Math.sin(p.heading) * 0.55 * dt;
      p.z += Math.cos(p.heading) * 0.55 * dt;
      p.y = WATER_Y - 0.85 * p.scale + Math.sin(performance.now() / 400 + p.phase) * 0.05;
      moving = 1.2;
      break;
    }
  }

  if (p.state === 'walk' || p.state === 'flee') {
    p.y = inRect(p.x, p.z, DECK.w / 2, DECK.d / 2) ? DECK_H : 0;
  }

  // Animación
  const gallop = p.state === 'flee' || p.state === 'jump';
  p.phase += dt * (gallop ? 11 : 1.6 + moving * 2.2);
  const amp = gallop ? 0.85 : p.state === 'swim' ? 0.6 : 0.42;
  const offs = gallop ? [0, 0.5, Math.PI, Math.PI + 0.5] : [0, Math.PI, Math.PI, 0];
  p.legs.forEach((l, i) => { l.rotation.x = Math.sin(p.phase + offs[i]) * amp; });
  p.neck.rotation.x = gallop ? Math.sin(p.phase) * 0.12 - 0.15 : Math.sin(p.phase * 2) * 0.05;
  p.tail.rotation.x = 0.5 + (gallop ? 0.6 : 0) + Math.sin(p.phase * 1.3) * 0.1;
  const bounce = gallop && p.state !== 'jump' ? Math.abs(Math.sin(p.phase)) * 0.18 : 0;

  if (p.flash > 0) {
    p.flash -= dt;
    const on = Math.floor(p.flash * 20) % 2 === 0 && p.flash > 0;
    p.mats.forEach((m) => { m.emissive.setHex(on ? 0xff2020 : 0x000000); m.emissiveIntensity = on ? 1.2 : 0; });
  }

  p.group.position.set(p.x, p.y + bounce, p.z);
  p.group.rotation.y = p.heading;
}

function randomPoolPoint() {
  return { x: rand(-POOL.w / 2 + 1.2, POOL.w / 2 - 1.2), z: rand(-POOL.d / 2 + 0.9, POOL.d / 2 - 0.9) };
}

function removePony(p) {
  scene.remove(p.group);
  p.group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
  p.mats.forEach((m) => m.dispose());
}

// ---------------------------------------------------------------------------
// Láser y partículas
// ---------------------------------------------------------------------------
const beamCore = new THREE.Mesh(
  new THREE.CylinderGeometry(0.05, 0.05, 1, 8, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xffeeee, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
);
const beamGlow = new THREE.Mesh(
  new THREE.CylinderGeometry(0.2, 0.2, 1, 12, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }),
);
const beam = new THREE.Group();
beam.add(beamCore, beamGlow);
beam.visible = false;
scene.add(beam);
let beamLife = 0;

const particles = [];
const particleGeo = new THREE.SphereGeometry(0.09, 6, 4);
function burst(x, y, z, color, n, speed) {
  const m = new THREE.MeshBasicMaterial({ color, transparent: true });
  for (let i = 0; i < n; i++) {
    const s = new THREE.Mesh(particleGeo, m);
    s.position.set(x, y, z);
    s.userData.v = new THREE.Vector3(rand(-1, 1), rand(0.8, 2), rand(-1, 1)).multiplyScalar(speed * rand(0.4, 1));
    s.userData.life = rand(0.6, 1.1);
    scene.add(s);
    particles.push(s);
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const s = particles[i];
    s.userData.life -= dt;
    s.userData.v.y -= 12 * dt;
    s.position.addScaledVector(s.userData.v, dt);
    s.scale.setScalar(Math.max(0.01, s.userData.life));
    if (s.userData.life <= 0) { scene.remove(s); particles.splice(i, 1); }
  }
}

const _v = new THREE.Vector3();
function fireLaser() {
  if (state !== 'play') return;
  if (!weather.sunny) { hint('☁️ El láser necesita sol'); return; }
  if (laserCd > 0) { hint(`🔋 Láser recargando… ${laserCd.toFixed(1)} s`); return; }
  laserCd = CFG.laserCooldown;

  const origin = robot.tip.getWorldPosition(_v).clone();
  const dx = Math.sin(R.heading), dz = Math.cos(R.heading);
  let best = null, bestT = CFG.laserRange;
  for (const p of ponies) {
    if (p.state !== 'walk') continue;
    const rx = p.x - origin.x, rz = p.z - origin.z;
    const t = rx * dx + rz * dz;
    if (t < 0 || t > bestT) continue;
    const perp = Math.abs(rx * dz - rz * dx);
    if (perp < CFG.laserHitRadius * p.scale + 0.3) { best = p; bestT = t; }
  }
  const len = best ? bestT : CFG.laserRange;
  const end = new THREE.Vector3(origin.x + dx * len, best ? 0.95 * best.scale + best.y : origin.y - 0.3, origin.z + dz * len);
  const dir = end.clone().sub(origin);
  const L = dir.length();
  beam.position.copy(origin).addScaledVector(dir, 0.5);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  beam.scale.set(1, L, 1);
  beam.visible = true;
  beamLife = 0.35;
  sfx.laser();
  burst(origin.x, origin.y, origin.z, 0xff6060, 6, 2);
  if (best) zapPony(best);
}

// ---------------------------------------------------------------------------
// Tiempo: sol y nubes
// ---------------------------------------------------------------------------
const weather = { sunny: true, timer: rand(6, 10), f: 1 };

function updateWeather(dt) {
  weather.timer -= dt;
  if (weather.timer <= 0) {
    weather.sunny = !weather.sunny;
    weather.timer = weather.sunny ? rand(CFG.sunnyMin, CFG.sunnyMax) : rand(CFG.cloudyMin, CFG.cloudyMax);
    updateWeatherHud();
    if (!weather.sunny) sfx.cloud(); else sfx.sun();
  }
  weather.f = damp(weather.f, weather.sunny ? 1 : 0, 3, dt);
  const f = weather.f;
  sunLight.intensity = 0.35 + 2.25 * f;
  hemi.intensity = 0.55 + 0.25 * f;
  scene.background.copy(SKY_CLOUDY).lerp(SKY_SUNNY, f);
  scene.fog.color.copy(scene.background);
  robot.panelMat.emissiveIntensity = 0.35 * f;
  $('weatherWarn').textContent = weather.timer < 1.3 ? (weather.sunny ? '⚠ ¡Se acerca una nube!' : '⚠ ¡Va a salir el sol!') : '';
}

function updateWeatherHud() {
  $('weather').classList.toggle('cloudy', !weather.sunny);
  $('weatherTitle').textContent = weather.sunny ? '☀️ SOL' : '☁️ NUBES';
  $('weatherDesc').textContent = weather.sunny ? 'Avanza y dispara · no gira' : 'Puede girar · no avanza';
}

// ---------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------
const keys = { up: false, down: false, left: false, right: false };
const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
};
window.addEventListener('keydown', (e) => {
  if (KEYMAP[e.code]) { keys[KEYMAP[e.code]] = true; e.preventDefault(); }
  if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) fireLaser(); }
  if (e.code === 'KeyC') toggleCam();
  if (e.code === 'KeyP') togglePause();
  if (e.code === 'Enter' && state !== 'play' && state !== 'pause') startGame();
});
window.addEventListener('keyup', (e) => { if (KEYMAP[e.code]) keys[KEYMAP[e.code]] = false; });
window.addEventListener('blur', () => { Object.keys(keys).forEach((k) => (keys[k] = false)); });

if (window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) document.body.classList.add('touch');
document.querySelectorAll('#touch button').forEach((b) => {
  const k = b.dataset.key;
  const down = (e) => {
    e.preventDefault();
    b.classList.add('active');
    sfx.unlock();
    if (k === 'fire') fireLaser(); else keys[k] = true;
  };
  const up = (e) => { e.preventDefault(); b.classList.remove('active'); if (k !== 'fire') keys[k] = false; };
  b.addEventListener('pointerdown', down);
  b.addEventListener('pointerup', up);
  b.addEventListener('pointercancel', up);
  b.addEventListener('pointerleave', up);
});

let camMode = 'chase';
function toggleCam() { camMode = camMode === 'chase' ? 'aerial' : 'chase'; }
$('camBtn').addEventListener('click', (e) => { e.currentTarget.blur(); toggleCam(); });

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------
let score = 0;
const stats = { lasers: 0, scares: 0 };
let hintTimer = 0;
function hint(text) {
  $('hint').textContent = text;
  $('hint').classList.add('show');
  hintTimer = 1.4;
}
function updatePoolHud() {
  $('poolIcons').innerHTML = Array.from({ length: CFG.maxInPool }, (_, i) => `<span class="${i < poolCount ? 'on' : ''}">🐴</span>`).join('');
}

const popups = [];
function addScore(pts, p, color) {
  score += pts;
  $('scoreVal').textContent = score.toLocaleString('es-ES');
  sfx.points();
  const el = document.createElement('div');
  el.className = 'popup';
  el.style.color = color;
  el.textContent = `+${pts}`;
  document.body.appendChild(el);
  popups.push({ el, pos: new THREE.Vector3(p.x, 2.2, p.z), life: 1.3 });
}

function updatePopups(dt) {
  for (let i = popups.length - 1; i >= 0; i--) {
    const pp = popups[i];
    pp.life -= dt;
    pp.pos.y += dt * 1.5;
    const s = pp.pos.clone().project(camera);
    pp.el.style.left = `${(s.x * 0.5 + 0.5) * window.innerWidth}px`;
    pp.el.style.top = `${(-s.y * 0.5 + 0.5) * window.innerHeight}px`;
    pp.el.style.opacity = Math.min(1, pp.life * 2);
    pp.el.style.display = s.z > 1 ? 'none' : '';
    if (pp.life <= 0) { pp.el.remove(); popups.splice(i, 1); }
  }
}

// Flechas para ponis fuera de pantalla
const arrows = [];
function updateArrows() {
  let n = 0;
  const W = window.innerWidth, H = window.innerHeight, m = 26;
  for (const p of ponies) {
    if (p.state !== 'walk') continue;
    _v.set(p.x, 1, p.z).project(camera);
    let { x, y } = _v;
    const behind = _v.z > 1;
    if (!behind && Math.abs(x) < 0.98 && Math.abs(y) < 0.95) continue;
    if (behind) { x = -x; y = -y; }
    const k = Math.max(Math.abs(x), Math.abs(y)) || 1;
    x /= k; y /= k;
    if (!arrows[n]) { const a = document.createElement('div'); a.className = 'arrow'; document.body.appendChild(a); arrows[n] = a; }
    const a = arrows[n++];
    const sx = clamp((x * 0.5 + 0.5) * W, m, W - m);
    const sy = clamp((-y * 0.5 + 0.5) * H, m + 60, H - m - 40);
    a.style.display = 'block';
    a.style.left = `${sx - 9}px`;
    a.style.top = `${sy - 9}px`;
    a.style.transform = `rotate(${Math.atan2(x, y)}rad)`;
  }
  for (let i = n; i < arrows.length; i++) arrows[i].style.display = 'none';
}

// ---------------------------------------------------------------------------
// Sonido (WebAudio sintetizado)
// ---------------------------------------------------------------------------
const sfx = (() => {
  let ctx = null;
  const get = () => {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  const tone = (type, f0, f1, dur, vol = 0.15, delay = 0) => {
    const c = get(); if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + dur + 0.02);
  };
  const noise = (dur, vol, freq) => {
    const c = get(); if (!c) return;
    const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = c.createBufferSource(); s.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = c.createGain(); g.gain.value = vol;
    s.connect(f).connect(g).connect(c.destination);
    s.start();
  };
  return {
    unlock: () => get(),
    laser: () => { tone('sawtooth', 1600, 120, 0.3, 0.12); tone('square', 900, 80, 0.25, 0.05); },
    neigh: () => {
      const c = get(); if (!c) return;
      const t = c.currentTime;
      const o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(950, t); o.frequency.linearRampToValueAtTime(520, t + 0.6);
      lfo.frequency.value = 22; lg.gain.value = 70;
      lfo.connect(lg).connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.07, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
      o.connect(g).connect(c.destination);
      o.start(t); lfo.start(t); o.stop(t + 0.7); lfo.stop(t + 0.7);
    },
    splash: () => noise(0.7, 0.35, 1400),
    points: () => { tone('triangle', 880, 1320, 0.12, 0.08); tone('triangle', 1320, 1760, 0.12, 0.06, 0.08); },
    cloud: () => tone('sine', 300, 180, 0.4, 0.06),
    sun: () => tone('sine', 400, 800, 0.35, 0.06),
    over: () => { tone('square', 440, 220, 0.4, 0.08); tone('square', 330, 110, 0.6, 0.08, 0.35); },
  };
})();

// ---------------------------------------------------------------------------
// Robot: movimiento
// ---------------------------------------------------------------------------
function updateRobot(dt) {
  const wantMove = (keys.up ? 1 : 0) - (keys.down ? 1 : 0);
  const wantTurn = (keys.left ? 1 : 0) - (keys.right ? 1 : 0);

  let targetVel = 0;
  if (wantMove !== 0) {
    if (weather.sunny) targetVel = wantMove > 0 ? CFG.robotSpeed : -CFG.robotReverse;
    else hint('☁️ Sin sol no hay energía para avanzar');
  }
  let targetTurn = 0;
  if (wantTurn !== 0) {
    if (!weather.sunny) targetTurn = wantTurn * CFG.robotTurn;
    else hint('☀️ Con sol el robot avanza, pero no puede girar');
  }
  R.vel = damp(R.vel, targetVel, weather.sunny ? 4 : 8, dt);
  R.turnVel = damp(R.turnVel, targetTurn, 10, dt);
  R.heading += R.turnVel * dt;

  let nx = R.x + Math.sin(R.heading) * R.vel * dt;
  let nz = R.z + Math.cos(R.heading) * R.vel * dt;
  nx = clamp(nx, -CFG.worldHalf, CFG.worldHalf);
  nz = clamp(nz, -CFG.worldHalf, CFG.worldHalf);

  // Colisión con la piscina (rectángulo ampliado)
  const hw = POOL.w / 2 + CFG.robotRadius * 0.8, hd = POOL.d / 2 + CFG.robotRadius * 0.8;
  if (inRect(nx, nz, hw, hd)) {
    const px = hw - Math.abs(nx), pz = hd - Math.abs(nz);
    if (px < pz) nx = Math.sign(nx || 1) * hw; else nz = Math.sign(nz || 1) * hd;
  }
  // Colisiones circulares
  for (const c of colliders) {
    const dx = nx - c.x, dz = nz - c.z;
    const d = Math.hypot(dx, dz), min = c.r + CFG.robotRadius;
    if (d < min && d > 0.0001) { nx = c.x + (dx / d) * min; nz = c.z + (dz / d) * min; }
  }

  const moved = Math.hypot(nx - R.x, nz - R.z) * Math.sign(R.vel || 0);
  R.x = nx; R.z = nz;
  R.wheelSpin += moved / 0.38 + R.turnVel * dt * 0.8;
  robot.wheels.forEach((w) => { w.rotation.x = R.wheelSpin; });

  const ry = inRect(R.x, R.z, DECK.w / 2, DECK.d / 2) ? DECK_H : 0;
  robot.group.position.set(R.x, ry, R.z);
  robot.group.rotation.y = R.heading;

  // Anillo de 3 m y línea de puntería
  scareRing.position.set(R.x, ry + 0.03, R.z);
  aimLine.position.set(R.x + Math.sin(R.heading) * 1.5, ry + 0.04, R.z + Math.cos(R.heading) * 1.5);
  aimLine.rotation.y = R.heading;
  const ready = weather.sunny && laserCd <= 0;
  aimMat.opacity = ready ? 0.35 : 0.1;
  robot.tipMat.emissiveIntensity = ready ? 2.5 + Math.sin(performance.now() / 120) * 0.8 : 0.2;
}

// ---------------------------------------------------------------------------
// Cámara
// ---------------------------------------------------------------------------
const camPos = new THREE.Vector3(0, 20, 40);
const camLook = new THREE.Vector3();
function updateCamera(dt, snap = false) {
  const hx = Math.sin(R.heading), hz = Math.cos(R.heading);
  const wantPos = new THREE.Vector3(), wantLook = new THREE.Vector3();
  if (camMode === 'chase') {
    wantPos.set(R.x - hx * 11, 12.5, R.z - hz * 11);
    wantLook.set(R.x + hx * 7, 0, R.z + hz * 7);
  } else {
    wantPos.set(R.x * 0.35, 50, R.z * 0.35 + 30);
    wantLook.set(R.x * 0.35, 0, R.z * 0.35 + 2);
  }
  if (snap) { camPos.copy(wantPos); camLook.copy(wantLook); }
  camPos.lerp(wantPos, 1 - Math.exp(-4 * dt));
  camLook.lerp(wantLook, 1 - Math.exp(-6 * dt));
  camera.position.copy(camPos);
  camera.lookAt(camLook);
  skyGroup.position.set(camera.position.x, 0, camera.position.z);
}

// ---------------------------------------------------------------------------
// Bucle del juego
// ---------------------------------------------------------------------------
let state = 'menu'; // menu | play | pause | over
let elapsed = 0;
let spawnTimer = 2;
let laserCd = 0;

function startGame() {
  sfx.unlock();
  for (const p of ponies) removePony(p);
  ponies.length = 0;
  popups.forEach((pp) => pp.el.remove()); popups.length = 0;
  score = 0; poolCount = 0; elapsed = 0; spawnTimer = 1.5; laserCd = 0;
  stats.lasers = 0; stats.scares = 0;
  Object.assign(R, { x: 0, z: 14, heading: Math.PI, vel: 0, turnVel: 0 });
  Object.assign(weather, { sunny: true, timer: rand(6, 10), f: 1 });
  $('scoreVal').textContent = '0';
  updatePoolHud();
  updateWeatherHud();
  $('startScreen').classList.add('hidden');
  $('overScreen').classList.add('hidden');
  updateRobot(0);
  updateCamera(0, true);
  state = 'play';
}

function gameOver() {
  state = 'over';
  sfx.over();
  let best = 0;
  try {
    best = Math.max(score, Number(localStorage.getItem('piscinaMazagonBest')) || 0);
    localStorage.setItem('piscinaMazagonBest', String(best));
  } catch { best = score; }
  $('finalScore').textContent = `${score.toLocaleString('es-ES')} pts`;
  $('statLaser').textContent = stats.lasers;
  $('statScare').textContent = stats.scares;
  $('statTime').textContent = `${Math.floor(elapsed / 60)}:${String(Math.floor(elapsed % 60)).padStart(2, '0')}`;
  $('statBest').textContent = best.toLocaleString('es-ES');
  setTimeout(() => $('overScreen').classList.remove('hidden'), 900);
}

function togglePause() {
  if (state === 'play') { state = 'pause'; hint('⏸ Pausa (P para seguir)'); hintTimer = 1e9; }
  else if (state === 'pause') { state = 'play'; hintTimer = 0; }
}

$('startBtn').addEventListener('click', startGame);
$('againBtn').addEventListener('click', startGame);

function updateLaserHud() {
  const el = $('laser');
  const ready = laserCd <= 0;
  $('laserFill').style.width = `${(1 - laserCd / CFG.laserCooldown) * 100}%`;
  el.classList.toggle('nosun', !weather.sunny);
  el.classList.toggle('ready', ready && weather.sunny);
  $('laserLabel').textContent = !weather.sunny
    ? (ready ? '☁️ LÁSER SIN SOL' : `☁️ RECARGANDO ${laserCd.toFixed(1)} s`)
    : ready ? (document.body.classList.contains('touch') ? '🔴 LÁSER LISTO' : '🔴 LÁSER LISTO (Espacio)') : `RECARGANDO ${laserCd.toFixed(1)} s`;
}

const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = performance.now() / 1000;

  waterTex.offset.set(t * 0.03, Math.sin(t * 0.4) * 0.05);

  if (state === 'play') {
    elapsed += dt;
    updateWeather(dt);
    laserCd = Math.max(0, laserCd - dt);
    updateRobot(dt);

    spawnTimer -= dt;
    const walkers = ponies.filter((p) => p.state === 'walk').length;
    if (spawnTimer <= 0 && walkers < 12) {
      spawnPony();
      spawnTimer = Math.max(1.4, 4.4 - elapsed * 0.02) * rand(0.75, 1.25);
    }
  }

  if (state === 'play' || state === 'over') {
    for (const p of ponies) updatePony(p, dt);
    for (let i = ponies.length - 1; i >= 0; i--) if (ponies[i].remove) { removePony(ponies[i]); ponies.splice(i, 1); }
    updateParticles(dt);
  }

  if (beamLife > 0) {
    beamLife -= dt;
    const o = Math.max(0, beamLife / 0.35);
    beamCore.material.opacity = o;
    beamGlow.material.opacity = o * 0.6;
    if (beamLife <= 0) beam.visible = false;
  }

  if (state === 'menu') {
    // Cámara orbitando en el menú
    const a = t * 0.12;
    camera.position.set(Math.cos(a) * 34, 16, Math.sin(a) * 34);
    camera.lookAt(0, 0, 0);
    skyGroup.position.set(camera.position.x, 0, camera.position.z);
  } else if (state !== 'pause') {
    updateCamera(dt);
    updateOccluders(dt);
  }

  if (hintTimer > 0) { hintTimer -= dt; if (hintTimer <= 0) $('hint').classList.remove('show'); }
  updateLaserHud();
  updatePopups(dt);
  if (state === 'play') updateArrows(); else arrows.forEach((a) => (a.style.display = 'none'));

  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

updatePoolHud();
updateWeatherHud();
updateRobot(0);
frame();

// Exponer para pruebas
window.__game = { get state() { return state; }, get score() { return score; }, get poolCount() { return poolCount; }, ponies, R, weather, fireLaser, startGame, keys, spawnPony };
