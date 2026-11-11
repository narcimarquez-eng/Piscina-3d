// Ponis en la Piscina — Carrito solar vs ponis
// El escenario (piscina de arena, jacuzzi, palmeras, plantas y fondo) es el de la
// Piscina Tropical, con las texturas sacadas de la foto real (ver tools/make_assets.py).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// ---------- Ajustes básicos ----------
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 400);
camera.position.set(0, 6, 22);

const loader = new THREE.TextureLoader();
function tex(url, repeat) {
  const t = loader.load(url);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping; t.repeat.set(repeat, repeat); }
  t.anisotropy = 8;
  return t;
}

// Panorama hecho con el jardín de la foto: fondo y reflejos
const pano = loader.load('assets/fondo.jpg', t => {
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  scene.background = t;
  scene.environment = t;
});
// El jardín de la foto envuelve la piscina como una pared cilíndrica cercana
const wallTex = loader.load('assets/fondo.jpg');
wallTex.colorSpace = THREE.SRGBColorSpace;
wallTex.repeat.set(1, 0.5); wallTex.offset.set(0.25, 0.5);
wallTex.wrapS = THREE.RepeatWrapping;
const wall = new THREE.Mesh(new THREE.CylinderGeometry(46, 46, 42, 96, 1, true),
  new THREE.MeshBasicMaterial({ map: wallTex, side: THREE.BackSide, fog: false }));
wall.position.y = 21 - 0.02;
scene.add(wall);

// ---------- Luces ----------
scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x5a6b33, 0.9));
const sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
sun.position.set(-18, 30, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 90 });
sun.shadow.bias = -0.0005;
scene.add(sun);

// ---------- Forma de la piscina (orgánica, con playa) ----------
// Radio del borde en función del ángulo, inspirado en la silueta de la foto
function rim(theta) {
  return 1 + 0.13 * Math.sin(2 * theta + 0.6) + 0.08 * Math.sin(3 * theta - 1.1) + 0.05 * Math.cos(5 * theta);
}
const RX = 13, RZ = 8.5;           // tamaño de la piscina
const DECK = 2.6;                  // ancho del borde de arena
const MAX_DEPTH = 1.7;
// devuelve t: <1 dentro de la piscina (0 = centro), >1 fuera
function poolT(x, z) {
  const th = Math.atan2(z / RZ, x / RX);
  const r = Math.hypot(x / RX, z / RZ);
  return r / rim(th);
}
function poolHeight(x, z) {
  const t = poolT(x, z);
  if (t >= 1) return 0.06;
  // playa: lado delantero (z>0) con pendiente muy suave, como en la foto
  const beach = THREE.MathUtils.smoothstep(z / RZ, -0.2, 0.9);
  const k = Math.pow(1 - t, 0.75 + beach * 0.9);
  const depth = MAX_DEPTH * (1 - beach * 0.55);
  return 0.06 - (depth + 0.06) * THREE.MathUtils.smoothstep(k, 0, 0.75);
}
function inWater(x, z) { return poolHeight(x, z) < -0.35; }
// Jacuzzi elevado junto a la piscina (como en las fotos): el terreno se hunde dentro de su vaso
const JAC = { x: -1.5, z: -11, rIn: 2.2, rOut: 3.0, top: 0.5, floor: -0.45 };
function groundHeight(x, z) {
  if (Math.hypot(x - JAC.x, z - JAC.z) < JAC.rIn + 0.05) return JAC.floor - 0.02;
  return poolHeight(x, z);
}

// Terreno: fondo de piscina + borde de arena + césped
const SIZE = 100, SEG = 280;
const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
geo.rotateX(-Math.PI / 2);
const pos = geo.attributes.position;
const colors = new Float32Array(pos.count * 3);
const wSand = new Float32Array(pos.count);
const cDeep = new THREE.Color(0x7fc9c0), cShallow = new THREE.Color(0xffffff);
for (let i = 0; i < pos.count; i++) {
  const x = pos.getX(i), z = pos.getZ(i);
  const h = groundHeight(x, z);
  pos.setY(i, h);
  const t = poolT(x, z);
  const distOut = (t - 1) * Math.min(RX, RZ) * rim(Math.atan2(z / RZ, x / RX));
  // 1 = arena, 0 = césped (borde ondulado)
  const edge = DECK + 0.6 * Math.sin(Math.atan2(z, x) * 7);
  wSand[i] = t < 1 ? 1 : 1 - THREE.MathUtils.smoothstep(distOut, edge - 0.4, edge + 0.4);
  const c = cShallow.clone().lerp(cDeep, THREE.MathUtils.clamp(-h / MAX_DEPTH, 0, 1));
  colors.set([c.r, c.g, c.b], i * 3);
}
geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
geo.setAttribute('sandW', new THREE.BufferAttribute(wSand, 1));
geo.computeVertexNormals();

const sandFloor = tex('assets/arena_fondo.jpg', 18);
const sandDeck = tex('assets/arena_borde.jpg', 18);
const grassTex = tex('assets/cesped_foto.jpg', 30);
const uTime = { value: 0 };

const groundMat = new THREE.MeshStandardMaterial({ map: sandFloor, vertexColors: true, roughness: 0.95, color: 0xf2e2c8 });
groundMat.onBeforeCompile = (sh) => {
  sh.uniforms.deckMap = { value: sandDeck };
  sh.uniforms.grassMap = { value: grassTex };
  sh.uniforms.uTime = uTime;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nattribute float sandW; varying float vSand; varying vec3 vWorld;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSand = sandW; vWorld = (modelMatrix * vec4(position,1.0)).xyz;');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>
      uniform sampler2D deckMap; uniform sampler2D grassMap; uniform float uTime;
      varying float vSand; varying vec3 vWorld;
      float caustic(vec2 p){
        // cáusticas tipo Voronoi animadas
        vec2 g = floor(p), f = fract(p);
        float d1 = 8.0, d2 = 8.0;
        for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){
          vec2 o = vec2(float(x), float(y));
          vec2 h = fract(sin(vec2(dot(g+o, vec2(127.1,311.7)), dot(g+o, vec2(269.5,183.3))))*43758.5453);
          h = 0.5 + 0.45*sin(uTime*0.9 + 6.2831*h);
          float d = length(o + h - f);
          if(d < d1){ d2 = d1; d1 = d; } else if(d < d2){ d2 = d; }
        }
        return pow(clamp(1.0 - (d2 - d1)*3.0, 0.0, 1.0), 4.0);
      }`)
    .replace('#include <map_fragment>', `
      vec4 floorC = texture2D(map, vMapUv);
      vec4 deckC = texture2D(deckMap, vMapUv);
      // césped de la foto a dos escalas para que no se note la repetición
      vec4 grassC = texture2D(grassMap, vMapUv * 1.6);
      float patchy = texture2D(grassMap, vMapUv * 0.21 + 0.37).g;
      grassC.rgb *= 0.78 + patchy * 0.45;
      float under = smoothstep(0.02, -0.15, vWorld.y);
      vec4 sandC = mix(deckC, floorC, under);
      diffuseColor *= mix(grassC, sandC, vSand);
      float ca = caustic(vWorld.xz * 0.7) * smoothstep(0.0, -0.4, vWorld.y);
      diffuseColor.rgb += ca * 0.28;
    `);
};
const ground = new THREE.Mesh(geo, groundMat);
ground.receiveShadow = true;
scene.add(ground);

// ---------- Agua ----------
function makeNormalTex() {
  const s = 256, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d'); const img = g.createImageData(s, s);
  // ruido suave y repetible (sin costuras) para las ondas
  const octs = [8, 16, 32].map(n => ({ n, g: Array.from({ length: n * n }, () => Math.random()) }));
  const sm = t => t * t * (3 - 2 * t);
  const noise = (o, x, y) => {
    const fx = x / s * o.n, fy = y / s * o.n, ix = Math.floor(fx), iy = Math.floor(fy), tx = sm(fx - ix), ty = sm(fy - iy);
    const v = (i, j) => o.g[((j % o.n + o.n) % o.n) * o.n + ((i % o.n + o.n) % o.n)];
    return (v(ix, iy) * (1 - tx) + v(ix + 1, iy) * tx) * (1 - ty) + (v(ix, iy + 1) * (1 - tx) + v(ix + 1, iy + 1) * tx) * ty;
  };
  const hgt = (x, y) => noise(octs[0], x, y) * 1.0 + noise(octs[1], x, y) * 0.5 + noise(octs[2], x, y) * 0.25;
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const dx = hgt(x + 1, y) - hgt(x - 1, y), dy = hgt(x, y + 1) - hgt(x, y - 1);
    const n = new THREE.Vector3(-dx * 40, -dy * 40, 1).normalize();
    const i = (y * s + x) * 4;
    img.data[i] = (n.x * 0.5 + 0.5) * 255; img.data[i + 1] = (n.y * 0.5 + 0.5) * 255; img.data[i + 2] = (n.z * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3);
  return t;
}
const waterNormal = makeNormalTex();
const waterNormal2 = waterNormal.clone(); waterNormal2.repeat.set(5, 5);
const waterMat = new THREE.MeshPhysicalMaterial({
  color: 0x5fd3c8, transparent: true, opacity: 0.5, roughness: 0.04, metalness: 0,
  normalMap: waterNormal, normalScale: new THREE.Vector2(0.09, 0.09), envMapIntensity: 0.9,
  clearcoat: 1, clearcoatRoughness: 0.05, clearcoatNormalMap: waterNormal2, clearcoatNormalScale: new THREE.Vector2(0.12, 0.12), depthWrite: false,
});
const water = new THREE.Mesh(new THREE.PlaneGeometry(RX * 2.8, RZ * 2.8, 1, 1), waterMat);
water.rotation.x = -Math.PI / 2;
water.position.y = 0;
water.renderOrder = 2;
scene.add(water);

// ---------- Jacuzzi: ladrillo, gresite y roca de las fotos del jacuzzi real ----------
const jacColors = { agua: [78, 159, 165], tapas: [195, 219, 228] };   // medidos en las fotos (assets/jac_colores.json)
function jacTex(url, rx, ry) {
  const t = tex(url);
  t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
  t.repeat.set(rx, ry);
  return t;
}
const jac = new THREE.Group();
const jacH = JAC.top;
// Muro exterior: ladrillos de pie
const wallMesh = new THREE.Mesh(new THREE.CylinderGeometry(JAC.rOut - 0.04, JAC.rOut + 0.02, jacH, 96, 1, true),
  new THREE.MeshStandardMaterial({ map: jacTex('assets/jac_muro.jpg', 14, 1), roughness: 0.95 }));
wallMesh.position.y = jacH / 2; wallMesh.castShadow = true; wallMesh.receiveShadow = true;
// Corona: ladrillos en abanico (UV polares: u = vuelta, v = radio)
const capGeo = new THREE.RingGeometry(JAC.rIn, JAC.rOut, 128, 1);
{
  const p = capGeo.attributes.position, uv = capGeo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    const a = Math.atan2(y, x) / (Math.PI * 2) + 0.5;
    uv.setXY(i, a * 10, (Math.hypot(x, y) - JAC.rIn) / (JAC.rOut - JAC.rIn));
  }
  capGeo.rotateX(-Math.PI / 2);
}
const capTex = tex('assets/jac_borde.jpg'); capTex.wrapS = THREE.MirroredRepeatWrapping;
const cap = new THREE.Mesh(capGeo, new THREE.MeshStandardMaterial({ map: capTex, color: 0xe2bfa2, roughness: 0.95 }));
cap.position.y = jacH + 0.001; cap.receiveShadow = true;
// Remate redondeado de gresite en el borde interior
const gresMat = new THREE.MeshStandardMaterial({ map: jacTex('assets/jac_gresite.jpg', 30, 1), roughness: 0.35 });
const lip = new THREE.Mesh(new THREE.TorusGeometry(JAC.rIn, 0.07, 8, 96), new THREE.MeshStandardMaterial({ color: 0xeee6d2, roughness: 0.35 }));
lip.rotation.x = Math.PI / 2; lip.position.y = jacH - 0.02;
// Pared interior y fondo de gresite crema
const innerH = jacH - JAC.floor;
const inner = new THREE.Mesh(new THREE.CylinderGeometry(JAC.rIn, JAC.rIn * 0.92, innerH, 96, 1, true), gresMat);
inner.material = gresMat.clone(); inner.material.side = THREE.BackSide;
inner.position.y = JAC.floor + innerH / 2; inner.receiveShadow = true;
const jFloor = new THREE.Mesh(new THREE.CircleGeometry(JAC.rIn * 0.92, 64), new THREE.MeshStandardMaterial({ map: jacTex('assets/jac_gresite.jpg', 6, 12), roughness: 0.4 }));
jFloor.rotation.x = -Math.PI / 2; jFloor.position.y = JAC.floor + 0.01; jFloor.receiveShadow = true;
// Agua turquesa (color medido en la foto, más luminoso por el gresite claro)
const jWaterColor = new THREE.Color().setRGB(...jacColors.agua.map(v => Math.min(1, v / 255 * 1.35)), THREE.SRGBColorSpace);
const jWater = new THREE.Mesh(new THREE.CircleGeometry(JAC.rIn, 64), new THREE.MeshPhysicalMaterial({
  color: jWaterColor, transparent: true, opacity: 0.55, roughness: 0.03, envMapIntensity: 1.1, depthWrite: false,
  normalMap: waterNormal, normalScale: new THREE.Vector2(0.25, 0.25), clearcoat: 1, clearcoatRoughness: 0.05 }));
jWater.rotation.x = -Math.PI / 2; jWater.position.y = jacH - 0.1; jWater.renderOrder = 2;
// Dos tapas de skimmer sobre la corona (del lado de la piscina)
const capsMat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(...jacColors.tapas.map(v => v / 255), THREE.SRGBColorSpace), roughness: 0.5 });
for (const a of [Math.PI / 2 - 0.22, Math.PI / 2 - 0.06]) {
  const c = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.14, 0.06, 24), capsMat);
  c.position.set(Math.cos(a) * (JAC.rIn + 0.22), jacH + 0.03, Math.sin(a) * (JAC.rIn + 0.22));
  c.castShadow = true; jac.add(c);
}
// Roca porosa apoyada en la corona
const rockGeo = new THREE.IcosahedronGeometry(0.38, 4);
{
  const p = rockGeo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = 1 + 0.18 * Math.sin(v.x * 7 + 1) * Math.cos(v.y * 6) + 0.1 * Math.sin(v.z * 13 + v.x * 5);
    v.multiplyScalar(n); v.y *= 0.75; p.setXYZ(i, v.x * 1.25, v.y, v.z);
  }
  rockGeo.computeVertexNormals();
}
const rock = new THREE.Mesh(rockGeo, new THREE.MeshStandardMaterial({ map: tex('assets/jac_roca.jpg'), color: new THREE.Color(1.6, 1.55, 1.45), roughness: 1 }));
const rockA = Math.PI / 2 + 0.75;
rock.position.set(Math.cos(rockA) * (JAC.rIn + 0.4), jacH + 0.22, Math.sin(rockA) * (JAC.rIn + 0.35));
rock.rotation.y = 0.6; rock.castShadow = true;
// Burbujas de los chorros
const bubbleGeo = new THREE.SphereGeometry(0.035, 6, 4);
const bubbleMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
const BUBBLES = 90;
const bubbles = new THREE.InstancedMesh(bubbleGeo, bubbleMat, BUBBLES);
const bubbleData = Array.from({ length: BUBBLES }, () => ({ a: Math.random() * Math.PI * 2, r: Math.random() * JAC.rIn * 0.9, t: Math.random() }));
const foam = [];
const foamTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();
for (let i = 0; i < 4; i++) {
  const f = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), new THREE.MeshBasicMaterial({ map: foamTex, transparent: true, opacity: 0.35, depthWrite: false }));
  const a = i / 4 * Math.PI * 2 + 0.4;
  f.rotation.x = -Math.PI / 2; f.position.set(Math.cos(a) * 1.55, jacH - 0.08, Math.sin(a) * 1.55);
  f.renderOrder = 3; foam.push(f); jac.add(f);
}
const bm = new THREE.Matrix4();
function updateJacuzzi(t, dt) {
  bubbleData.forEach((b, i) => {
    b.t += dt * (0.5 + (i % 5) * 0.12);
    if (b.t > 1) { b.t = 0; b.a = Math.random() * Math.PI * 2; b.r = Math.random() * JAC.rIn * 0.9; }
    const y = JAC.floor + 0.1 + b.t * (jacH - 0.1 - JAC.floor - 0.1);
    const s = 0.6 + b.t * 0.9;
    bm.makeScale(s, s, s).setPosition(Math.cos(b.a + b.t) * b.r, y, Math.sin(b.a + b.t) * b.r);
    bubbles.setMatrixAt(i, bm);
  });
  bubbles.instanceMatrix.needsUpdate = true;
  foam.forEach((f, i) => { const k = 1 + 0.25 * Math.sin(t * 6 + i * 2); f.scale.set(k, k, 1); f.material.opacity = 0.25 + 0.15 * Math.sin(t * 5 + i); });
}
jac.add(wallMesh, cap, lip, inner, jFloor, jWater, rock, bubbles);
jac.position.set(JAC.x, 0, JAC.z);
scene.add(jac);
// ---------- Palmeras con texturas recortadas de la foto ----------
function leafTex(url) {
  const t = loader.load(url);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
const trunkTex = tex('assets/palma_tronco.jpg');
trunkTex.wrapS = trunkTex.wrapT = THREE.MirroredRepeatWrapping;
const fanTex = leafTex('assets/palma_abanico.png');
const frondTex = leafTex('assets/palma_hoja.png');
const trunkMat = new THREE.MeshStandardMaterial({ map: trunkTex, roughness: 1 });
const leafProps = { alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.75 };
const frondMat = new THREE.MeshStandardMaterial({ map: frondTex, ...leafProps });
const fanMat = new THREE.MeshStandardMaterial({ map: fanTex, ...leafProps });
// sombras con la silueta real de las hojas
const depthMat = map => new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.5 });
const frondDepth = depthMat(frondTex), fanDepth = depthMat(fanTex);
const palmTops = [];
// Hoja de datilera: banda con la foto de la hoja, caída hacia abajo
function frondGeo(len) {
  const g = new THREE.PlaneGeometry(len, len / 3.2, 16, 1);
  g.translate(len / 2, 0, 0);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) / len;
    p.setY(i, u * len * 0.3 - u * u * len * 0.75 - Math.abs(p.getZ(i)) * 0.25);
  }
  g.computeVertexNormals();
  return g;
}
// Hoja de abanico: sector circular con la foto centrada en el peciolo
const fanGeo = new THREE.CircleGeometry(2.3, 28, -0.25, Math.PI + 0.5);
function palm(x, z, h, lean, fan) {
  const g = new THREE.Group();
  const pts = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector3(Math.sin(lean.a) * lean.d * t * t, h * t, Math.cos(lean.a) * lean.d * t * t)); }
  const curve = new THREE.CatmullRomCurve3(pts);
  const tg = new THREE.TubeGeometry(curve, 20, fan ? 0.24 : 0.32, 10);
  const uv = tg.attributes.uv;                        // repetir las escamas a lo largo del tronco
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * h * 1.4, uv.getY(i) * 2);
  const trunk = new THREE.Mesh(tg, trunkMat);
  trunk.castShadow = true; g.add(trunk);
  const top = pts[8];
  const n = fan ? 16 : 12;
  for (let i = 0; i < n; i++) {
    const pivot = new THREE.Group();
    pivot.position.copy(top);
    pivot.rotation.y = (i / n) * Math.PI * 2 + Math.random() * 0.3;
    let m;
    if (fan) {
      m = new THREE.Mesh(fanGeo, fanMat);
      m.customDepthMaterial = fanDepth;
      m.position.z = 0.3;
      m.rotation.x = 0.35 + Math.random() * 0.9;      // inclinación hacia fuera
      m.rotation.z = (Math.random() - 0.5) * 0.4;
    } else {
      m = new THREE.Mesh(frondGeo(4 + Math.random() * 1.5), frondMat);
      m.customDepthMaterial = frondDepth;
      m.rotation.order = 'YZX';
      m.rotation.y = -Math.PI / 2;                      // la hoja crece hacia fuera (+z del pivote)
      m.rotation.z = Math.random() * 0.35;
      m.rotation.x = (Math.random() - 0.5) * 0.5;       // giro sobre su eje
    }
    m.castShadow = true;
    pivot.add(m); g.add(pivot);
  }
  g.position.set(x, 0, z);
  scene.add(g);
  palmTops.push(new THREE.Vector3(x + top.x, top.y, z + top.z));
  return g;
}
const palmSpots = [
  [-16, -9, 6, { a: 0.6, d: 1.5 }, true], [-6, -14, 6.5, { a: 0.2, d: 1.2 }, true], [4, -13.5, 5.5, { a: -0.4, d: 1 }, true],
  [16, -6, 8, { a: -2.2, d: 4 }, false], [18, 4, 7.5, { a: -1.8, d: 3.5 }, false], [-18, 5, 5.5, { a: 1.4, d: 1.5 }, true],
  [10, -12.5, 8.5, { a: -2.6, d: 3 }, false], [-11, 13, 6.5, { a: 2.8, d: 2 }, false],
];
const palms = palmSpots.map(p => palm(...p));

// Plantas del jardín: matas frondosas con follaje recortado de la foto.
// Cada mata = núcleo abultado con la foto del follaje + ~8 hojas recortadas a distintos ángulos.
// Todas las matas de un mismo tipo se funden en una sola malla (pocas llamadas de dibujo en el móvil).
const plantTex = ['assets/planta_helecho.png', 'assets/planta_cica.png', 'assets/planta_arbusto.png'].map(url => {
  const t = loader.load(url); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
});
const plantMats = plantTex.map(map => new THREE.MeshStandardMaterial({ map, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9 }));
const coreMats = plantTex.map(map => new THREE.MeshStandardMaterial({ map, color: 0xb8c4a8, roughness: 1 }));
const plantDepth = plantTex.map(map => depthMat(map));
const cardGeo = new THREE.PlaneGeometry(1, 0.75, 2, 2); cardGeo.translate(0, 0.375, 0);
const coreGeo = (() => {
  const g = new THREE.IcosahedronGeometry(0.5, 2);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = 1 + 0.16 * Math.sin(v.x * 11 + 2) * Math.sin(v.z * 9) + 0.1 * Math.sin(v.y * 15 + v.x * 7);
    p.setXYZ(i, v.x * n, Math.max(-0.05, v.y * n * 0.75), v.z * n);
  }
  g.computeVertexNormals();
  return g;
})();
function mergeGeos(parts) {
  const out = { position: [], normal: [], uv: [] };
  for (const [geo, m] of parts) {
    let g = geo.clone().applyMatrix4(m);
    if (g.index) g = g.toNonIndexed();
    for (const k in out) out[k].push(g.attributes[k].array);
  }
  const merged = new THREE.BufferGeometry();
  for (const k in out) {
    const len = out[k].reduce((n, a) => n + a.length, 0), arr = new Float32Array(len);
    let o = 0; for (const a of out[k]) { arr.set(a, o); o += a.length; }
    merged.setAttribute(k, new THREE.BufferAttribute(arr, k === 'uv' ? 2 : 3));
  }
  return merged;
}
const plantParts = [[], [], []], coreParts = [[], [], []];
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
const plantSpots = [];   // posiciones de las matas (obstáculos en el juego)
function plant(x, z, size, kind) {
  plantSpots.push({ x, z, r: size * 0.3 });
  const base = Math.random() * Math.PI;
  // núcleo: rellena el centro para que no se vea vacío
  _e.set(0, base, 0); _q.setFromEuler(_e);
  _m.compose(_v.set(x, size * 0.12, z), _q, _s.set(size * 0.9, size * 0.7, size * 0.9));
  coreParts[kind].push([coreGeo, _m.clone()]);
  // hojas: anillo exterior inclinado hacia fuera + algunas centrales más altas
  const cards = 8;
  for (let i = 0; i < cards; i++) {
    const outer = i < 6;
    const ang = base + (i / cards) * Math.PI * 2 + Math.random() * 0.4;
    const off = outer ? size * (0.12 + Math.random() * 0.12) : size * 0.04;
    const sc = size * (outer ? 0.75 + Math.random() * 0.3 : 0.95 + Math.random() * 0.25);
    _e.set(outer ? -(0.25 + Math.random() * 0.35) : (Math.random() - 0.5) * 0.2, ang, (Math.random() - 0.5) * 0.25, 'YXZ');
    _q.setFromEuler(_e);
    // la hoja mira hacia fuera y se separa un poco del centro
    _m.compose(_v.set(x + Math.sin(ang) * off, -0.02, z + Math.cos(ang) * off), _q, _s.set(sc, sc * (0.85 + Math.random() * 0.3), sc));
    plantParts[kind].push([cardGeo, _m.clone()]);
  }
}
// fuera de la piscina y del borde de arena, sin pisar las palmeras ni el jacuzzi
for (let placed = 0, tries = 0; placed < 60 && tries < 3000; tries++) {
  const a = Math.random() * Math.PI * 2, r = 14 + Math.random() * 26;
  const x = Math.cos(a) * r * 1.15, z = Math.sin(a) * r * 0.95;
  if (Math.hypot(x, z) > 43 || poolT(x, z) < 1.45) continue;
  if (Math.hypot(x - JAC.x, z - JAC.z) < JAC.rOut + 1.5) continue;
  if (palmSpots.some(p => Math.hypot(x - p[0], z - p[1]) < 1.6)) continue;
  plant(x, z, 2.6 + Math.random() * 2.8, Math.floor(Math.random() * 3));
  placed++;
}
for (let k = 0; k < 3; k++) {
  if (!plantParts[k].length) continue;
  const cards = new THREE.Mesh(mergeGeos(plantParts[k]), plantMats[k]);
  cards.customDepthMaterial = plantDepth[k];
  cards.castShadow = cards.receiveShadow = true;
  const core = new THREE.Mesh(mergeGeos(coreParts[k]), coreMats[k]);
  core.castShadow = core.receiveShadow = true;
  scene.add(cards, core);
}

// Focos de la piscina (como en la foto)
const lampMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xbfefff, emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.2 });
for (const [x, z] of [[-9, 3], [-10.5, -1], [3, -6], [9, -4]]) {
  const l = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.05, 20), lampMat);
  l.position.set(x, groundHeight(x, z) + 0.03, z); scene.add(l);
}

// ---------- Palomas volando ----------
const doveMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.8, side: THREE.DoubleSide });
const doves = [];
for (let i = 0; i < 3; i++) {
  const d = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), doveMat); body.scale.set(1, 0.8, 2);
  const wg = new THREE.PlaneGeometry(0.9, 0.35); wg.translate(0.45, 0, 0);
  const wl = new THREE.Mesh(wg, doveMat), wr = new THREE.Mesh(wg, doveMat);
  wr.rotation.y = Math.PI;
  d.add(body, wl, wr); d.userData = { wl, wr, ph: Math.random() * 6, r: 10 + i * 4, h: 6 + i * 1.5, sp: 0.25 + i * 0.07 };
  scene.add(d); doves.push(d);
}

// ---------- Salpicaduras ----------
const splashes = [];
const dropMat = new THREE.MeshBasicMaterial({ color: 0xe6fbff, transparent: true });
const dropGeo = new THREE.SphereGeometry(0.07, 6, 4);
function splash(x, z, n = 18, color) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(dropGeo, color ? new THREE.MeshBasicMaterial({ color, transparent: true }) : dropMat.clone());
    m.position.set(x, 0.1, z);
    const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 2.5;
    m.userData.v = new THREE.Vector3(Math.cos(a) * s, 3 + Math.random() * 3, Math.sin(a) * s);
    m.userData.life = 1;
    scene.add(m); splashes.push(m);
  }
  const ripple = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false }));
  ripple.rotation.x = -Math.PI / 2; ripple.position.set(x, 0.03, z); ripple.userData.ripple = 1; ripple.userData.life = 1;
  scene.add(ripple); splashes.push(ripple);
}

// =====================================================================
// JUEGO: Carrito solar vs ponis
// (escenario de arriba = el mismo de la Piscina Tropical, sacado de la foto)
// =====================================================================
const CFG = {
  arena: 36,              // el carrito se mueve dentro de este radio (m)
  spawnRadius: 43,        // los ponis salen del jardín, junto al fondo
  exitRadius: 44.5,       // al galopar más allá desaparecen en el jardín
  robotSpeed: 5,          // m/s
  robotReverse: 2.5,
  robotTurn: 1.7,         // rad/s
  robotRadius: 1.0,
  robotScale: 1.4,        // el modelo mide ~1,1 m; lo agrandamos un poco
  ponyWalk: 1.3,          // m/s (sube con el tiempo)
  ponyGallop: 8.5,
  scareDist: 3,
  laserCooldown: 5,
  laserRange: 28,
  laserHitRadius: 0.8,
  maxInPool: 5,
  ptsLaser: 2000,
  ptsScare: 500,
  sunnyMin: 4, sunnyMax: 11,
  cloudyMin: 2.5, cloudyMax: 7,
};

const $ = (id) => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = THREE.MathUtils.clamp;
const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
const angleLerp = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
const tv = new THREE.Vector3();

// La sombra sigue al carrito para que se vea nítida en todo el jardín
scene.add(sun.target);
const SUN_OFFSET = sun.position.clone();
const sunBase = sun.intensity;
const hemiLight = scene.children.find((o) => o.isHemisphereLight);
const hemiBase = hemiLight.intensity;

// ---------- Obstáculos ----------
const colliders = palmSpots.map((p) => ({ x: p[0], z: p[1], r: 0.45 }));
colliders.push({ x: JAC.x, z: JAC.z, r: JAC.rOut + 0.1 });
colliders.push(...plantSpots);
function pushOut(o, extra) {
  for (const c of colliders) {
    const dx = o.x - c.x, dz = o.z - c.z, d = Math.hypot(dx, dz), min = c.r + extra;
    if (d < min && d > 1e-4) { o.x = c.x + (dx / d) * min; o.z = c.z + (dz / d) * min; }
  }
}
function randomWaterPoint() {
  for (let i = 0; i < 200; i++) {
    const x = (Math.random() * 2 - 1) * RX * 1.1, z = (Math.random() * 2 - 1) * RZ * 1.1;
    if (inWater(x, z) && poolT(x, z) < 0.8) return { x, z };
  }
  return { x: 0, z: 0 };
}

// ---------- Modelos 3D (carrito solar y poni animado) ----------
const gltf = new GLTFLoader();
const robot = new THREE.Group();
scene.add(robot);
const eyes = [new THREE.Object3D(), new THREE.Object3D()];   // origen de los rayos: los ojos del carrito
let eyeMat = null, panelMat = null;
let ponyTemplate = null, ponyClips = [];

Promise.all([gltf.loadAsync('assets/modelos/carrito_solar.glb'), gltf.loadAsync('assets/modelos/pony.glb')])
  .then(([cart, pony]) => {
    const c = cart.scene;
    c.scale.setScalar(CFG.robotScale);
    c.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = true;
      if (o.name.includes('Ojos')) { o.material = o.material.clone(); eyeMat = o.material; eyeMat.emissive = new THREE.Color(0xff2020); }
      if (o.name.includes('Panel')) { o.material = o.material.clone(); panelMat = o.material; panelMat.emissive = new THREE.Color(0x2a6cff); }
    });
    eyes[0].position.set(-0.13, 0.98, 0.72);
    eyes[1].position.set(0.13, 0.98, 0.72);
    c.add(...eyes);
    robot.add(c);

    ponyTemplate = pony.scene;
    ponyClips = pony.animations;
    ponyTemplate.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });

    $('startBtn').disabled = false;
    $('startBtn').textContent = '¡JUGAR!';
  })
  .catch((err) => {
    console.error(err);
    $('startBtn').textContent = 'No se pudieron cargar los modelos';
  });

// Anillo de 3 m y línea de puntería
const scareRing = new THREE.Mesh(new THREE.RingGeometry(CFG.scareDist - 0.08, CFG.scareDist, 64),
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }));
scareRing.rotation.x = -Math.PI / 2;
scareRing.renderOrder = 3;
scene.add(scareRing);
const aimMat = new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.25, depthWrite: false });
const aimGeo = new THREE.PlaneGeometry(0.12, CFG.laserRange);
aimGeo.rotateX(-Math.PI / 2); aimGeo.translate(0, 0, CFG.laserRange / 2);
const aimLine = new THREE.Mesh(aimGeo, aimMat);
aimLine.renderOrder = 3;
scene.add(aimLine);

const R = { x: 0, z: 16, heading: Math.PI, vel: 0, turnVel: 0 };
pushOut(R, CFG.robotRadius + 0.5);

// ---------- Ponis ----------
const COAT_TINTS = [0xffffff, 0xffffff, 0xffe0c0, 0xd8d0c8, 0xfff2dc, 0xc9b49a, 0xb0a8a0];
const ponies = [];
let poolCount = 0;

function spawnPony() {
  if (!ponyTemplate) return;
  const model = SkeletonUtils.clone(ponyTemplate);
  const mats = [];
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.material = o.material.clone();
    o.frustumCulled = false;
    mats.push(o.material);
    if (o.material.map) o.material.color.setHex(pick(COAT_TINTS));
  });
  const scale = rand(0.9, 1.1);
  model.scale.setScalar(scale);
  const group = new THREE.Group();
  group.add(model);
  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  for (const n of ['Walk', 'Run', 'Hit', 'Trot', 'Idle']) {
    const clip = ponyClips.find((c) => c.name === n);
    if (clip) actions[n] = mixer.clipAction(clip);
  }
  if (actions.Hit) { actions.Hit.setLoop(THREE.LoopOnce); actions.Hit.clampWhenFinished = true; }

  const a = rand(0, Math.PI * 2);
  const x = Math.cos(a) * CFG.spawnRadius, z = Math.sin(a) * CFG.spawnRadius;
  const target = randomWaterPoint();
  const p = {
    group, mixer, actions, mats, scale, x, z, y: 0.06, target,
    heading: Math.atan2(target.x - x, target.z - z),
    state: 'walk', speed: CFG.ponyWalk + Math.min(1.0, elapsed * 0.006) + rand(-0.15, 0.25),
    flash: 0, t: 0, cur: null, anim: '',
  };
  playAnim(p, 'Walk', 0);
  group.position.set(x, p.y, z);
  group.rotation.y = p.heading;
  scene.add(group);
  ponies.push(p);
}

function playAnim(p, name, fade = 0.25) {
  if (p.anim === name || !p.actions[name]) return;
  const next = p.actions[name];
  next.reset().setEffectiveWeight(1).fadeIn(fade).play();
  if (p.cur) p.cur.fadeOut(fade);
  p.cur = next; p.anim = name;
}

function makeFlee(p) {
  p.state = 'flee';
  let ox = p.x, oz = p.z; const ol = Math.hypot(ox, oz) || 1; ox /= ol; oz /= ol;
  let ax = p.x - R.x, az = p.z - R.z; const al = Math.hypot(ax, az) || 1; ax /= al; az /= al;
  p.fleeHeading = Math.atan2(ox + ax * 0.6, oz + az * 0.6);
  p.speed = 2;
  playAnim(p, 'Run', 0.15);
}

function scarePony(p) {
  makeFlee(p);
  stats.scares++;
  addScore(CFG.ptsScare, p, '#e07b00');
  sfx.neigh();
}

function zapPony(p) {
  p.state = 'hit';
  p.t = 0.6;
  p.flash = 0.6;
  stats.lasers++;
  addScore(CFG.ptsLaser, p, '#e01e1e');
  burst(p.x, p.y + 0.9 * p.scale, p.z, 0xff4040, 18, 4);
  playAnim(p, 'Hit', 0.08);
  sfx.neigh();
}

function updatePony(p, dt) {
  switch (p.state) {
    case 'walk': {
      const dx = p.target.x - p.x, dz = p.target.z - p.z;
      p.heading = angleLerp(p.heading, Math.atan2(dx, dz), 1 - Math.exp(-3 * dt));
      p.x += Math.sin(p.heading) * p.speed * dt;
      p.z += Math.cos(p.heading) * p.speed * dt;
      pushOut(p, 0.6);
      p.actions.Walk.timeScale = p.speed / 1.2;
      if (Math.hypot(p.x - R.x, p.z - R.z) <= CFG.scareDist) { scarePony(p); break; }
      if (poolT(p.x, p.z) < 1) {
        // ¡Al agua! Cuenta como poni bañándose
        p.state = 'swim';
        splash(p.x, p.z, 26);
        sfx.splash();
        poolCount++;
        updatePoolHud();
        if (poolCount >= CFG.maxInPool) gameOver();
      }
      break;
    }
    case 'hit': {
      p.t -= dt;
      if (p.t <= 0) makeFlee(p);
      break;
    }
    case 'flee': {
      p.speed = Math.min(CFG.ponyGallop, p.speed + 12 * dt);
      p.heading = angleLerp(p.heading, p.fleeHeading, 1 - Math.exp(-6 * dt));
      const nx = p.x + Math.sin(p.heading) * p.speed * dt;
      const nz = p.z + Math.cos(p.heading) * p.speed * dt;
      if (poolT(nx, nz) < 1.15) p.fleeHeading += 0.12;   // rodea la piscina al huir
      else { p.x = nx; p.z = nz; }
      pushOut(p, 0.6);
      p.actions.Run.timeScale = 1.3;
      if (Math.hypot(p.x, p.z) > CFG.exitRadius) p.remove = true;
      break;
    }
    case 'swim': {
      const dx = p.target.x - p.x, dz = p.target.z - p.z;
      if (Math.hypot(dx, dz) < 0.5) p.target = randomWaterPoint();
      p.heading = angleLerp(p.heading, Math.atan2(dx, dz), 1 - Math.exp(-1.5 * dt));
      const sp = 0.6;
      const nx = p.x + Math.sin(p.heading) * sp * dt, nz = p.z + Math.cos(p.heading) * sp * dt;
      if (poolT(nx, nz) < 0.92 || poolT(p.x, p.z) >= 0.92) { p.x = nx; p.z = nz; }
      else p.target = randomWaterPoint();
      const deep = groundHeight(p.x, p.z) < -0.6;
      playAnim(p, deep ? 'Trot' : 'Walk', 0.4);
      if (p.actions.Trot) p.actions.Trot.timeScale = 0.55;
      if (!deep) p.actions.Walk.timeScale = 0.5;
      break;
    }
  }

  // Altura: suelo en tierra; dentro del agua se hunde hasta nadar
  let yTarget = groundHeight(p.x, p.z);
  if (p.state === 'swim') yTarget = Math.max(yTarget, -0.78 * p.scale + Math.sin(performance.now() / 450 + p.scale * 20) * 0.04);
  p.y = damp(p.y, yTarget, 8, dt);

  if (p.flash > 0) {
    p.flash -= dt;
    const on = p.flash > 0 && Math.floor(p.flash * 20) % 2 === 0;
    p.mats.forEach((m) => { m.emissive.setHex(on ? 0xff2020 : 0x000000); m.emissiveIntensity = on ? 1.0 : 0; });
  }
  p.mixer.update(dt);
  p.group.position.set(p.x, p.y, p.z);
  p.group.rotation.y = p.heading;
}

function removePony(p) {
  scene.remove(p.group);
  p.mixer.stopAllAction();
  p.mats.forEach((m) => m.dispose());
}

// ---------- Láser ----------
function makeBeam() {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffeeee, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
  g.add(core, glow);
  g.visible = false;
  g.renderOrder = 4;
  scene.add(g);
  return { g, core, glow };
}
const beams = [makeBeam(), makeBeam()];
let beamLife = 0;

const particles = [];
const particleGeo = new THREE.SphereGeometry(0.08, 6, 4);
function burst(x, y, z, color, n, speed) {
  const m = new THREE.MeshBasicMaterial({ color, transparent: true });
  for (let i = 0; i < n; i++) {
    const s = new THREE.Mesh(particleGeo, m);
    s.position.set(x, y, z);
    s.userData.v = new THREE.Vector3(rand(-1, 1), rand(0.8, 2), rand(-1, 1)).multiplyScalar(speed * rand(0.4, 1));
    s.userData.life = rand(0.6, 1.1);
    scene.add(s); particles.push(s);
  }
}

function fireLaser() {
  if (state !== 'play') return;
  if (!weather.sunny) { hint('☁️ El láser necesita sol'); return; }
  if (laserCd > 0) { hint(`🔋 Láser recargando… ${laserCd.toFixed(1)} s`); return; }
  laserCd = CFG.laserCooldown;

  const dx = Math.sin(R.heading), dz = Math.cos(R.heading);
  let best = null, bestT = CFG.laserRange;
  for (const p of ponies) {
    if (p.state !== 'walk') continue;
    const rx = p.x - R.x, rz = p.z - R.z;
    const t = rx * dx + rz * dz;
    if (t < 0 || t > bestT) continue;
    if (Math.abs(rx * dz - rz * dx) < CFG.laserHitRadius * p.scale + 0.3) { best = p; bestT = t; }
  }
  const len = best ? bestT : CFG.laserRange;
  const end = new THREE.Vector3(R.x + dx * len, best ? best.y + 0.9 * best.scale : groundHeight(R.x, R.z) + 0.6, R.z + dz * len);
  for (let i = 0; i < 2; i++) {
    const o = eyes[i].getWorldPosition(new THREE.Vector3());
    const dir = end.clone().sub(o);
    const L = dir.length();
    const b = beams[i];
    b.g.position.copy(o).addScaledVector(dir, 0.5);
    b.g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    b.g.scale.set(1, L, 1);
    b.g.visible = true;
  }
  beamLife = 0.35;
  sfx.laser();
  if (best) zapPony(best);
}

// ---------- Sol y nubes ----------
const weather = { sunny: true, timer: rand(6, 10), f: 1 };
const wallBase = wall.material.color.clone();
const wallCloudy = new THREE.Color(0x8d939c);
function updateWeather(dt) {
  weather.timer -= dt;
  if (weather.timer <= 0) {
    weather.sunny = !weather.sunny;
    weather.timer = weather.sunny ? rand(CFG.sunnyMin, CFG.sunnyMax) : rand(CFG.cloudyMin, CFG.cloudyMax);
    updateWeatherHud();
    if (weather.sunny) sfx.sun(); else sfx.cloud();
  }
  weather.f = damp(weather.f, weather.sunny ? 1 : 0, 3, dt);
  applyLight(weather.f);
  $('weatherWarn').textContent = weather.timer < 1.3 ? (weather.sunny ? '⚠ ¡Se acerca una nube!' : '⚠ ¡Va a salir el sol!') : '';
}
function applyLight(f) {
  sun.intensity = sunBase * (0.12 + 0.88 * f);
  hemiLight.intensity = hemiBase * (0.6 + 0.4 * f);
  scene.backgroundIntensity = 0.6 + 0.4 * f;
  renderer.toneMappingExposure = 0.8 + 0.25 * f;
  wall.material.color.copy(wallCloudy).lerp(wallBase, f);
  if (panelMat) panelMat.emissiveIntensity = 0.25 * f;
}
function updateWeatherHud() {
  $('weather').classList.toggle('cloudy', !weather.sunny);
  $('weatherTitle').textContent = weather.sunny ? '☀️ SOL' : '☁️ NUBES';
  $('weatherDesc').textContent = weather.sunny ? 'Avanza y dispara · no gira' : 'Puede girar · no avanza';
}

// ---------- Entrada ----------
const keys = { up: false, down: false, left: false, right: false };
const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
};
addEventListener('keydown', (e) => {
  if (KEYMAP[e.code]) { keys[KEYMAP[e.code]] = true; e.preventDefault(); }
  if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) fireLaser(); }
  if (e.code === 'KeyC') toggleCam();
  if (e.code === 'KeyP') togglePause();
  if (e.code === 'Enter' && (state === 'menu' || state === 'over') && ponyTemplate) startGame();
});
addEventListener('keyup', (e) => { if (KEYMAP[e.code]) keys[KEYMAP[e.code]] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

document.querySelectorAll('#touch button').forEach((b) => {
  const k = b.dataset.key;
  const down = (e) => { e.preventDefault(); b.classList.add('active'); sfx.unlock(); if (k === 'fire') fireLaser(); else keys[k] = true; };
  const up = (e) => { e.preventDefault(); b.classList.remove('active'); if (k !== 'fire') keys[k] = false; };
  b.addEventListener('pointerdown', down);
  b.addEventListener('pointerup', up);
  b.addEventListener('pointercancel', up);
  b.addEventListener('pointerleave', up);
});

// Cámara: va detrás del carrito; arrastrar la gira, rueda/pellizco acerca
const cam = { yawOff: 0, pitch: 0.72, dist: 13, aerial: false };
function toggleCam() { cam.aerial = !cam.aerial; cam.yawOff = 0; }
$('camBtn').addEventListener('click', (e) => { e.currentTarget.blur(); toggleCam(); });
const camPointers = new Map();
let pinchDist = 0;
const canvasEl = renderer.domElement;
const pinchLen = () => { const [a, b] = [...camPointers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
canvasEl.addEventListener('pointerdown', (e) => {
  canvasEl.setPointerCapture(e.pointerId);
  camPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (camPointers.size === 2) pinchDist = pinchLen();
});
canvasEl.addEventListener('pointermove', (e) => {
  const p = camPointers.get(e.pointerId);
  if (!p) return;
  if (camPointers.size === 1) {
    cam.yawOff -= (e.clientX - p.x) * 0.006;
    cam.pitch = clamp(cam.pitch + (e.clientY - p.y) * 0.005, 0.15, 1.45);
  }
  p.x = e.clientX; p.y = e.clientY;
  if (camPointers.size === 2) {
    const d = pinchLen();
    if (pinchDist) cam.dist = clamp(cam.dist * pinchDist / d, 5, 30);
    pinchDist = d;
  }
});
const camUp = (e) => { camPointers.delete(e.pointerId); pinchDist = camPointers.size === 2 ? pinchLen() : 0; };
canvasEl.addEventListener('pointerup', camUp);
canvasEl.addEventListener('pointercancel', camUp);
canvasEl.addEventListener('wheel', (e) => { e.preventDefault(); cam.dist = clamp(cam.dist * Math.exp(e.deltaY * 0.001), 5, 30); }, { passive: false });

// ---------- HUD ----------
let score = 0;
const stats = { lasers: 0, scares: 0 };
let hintTimer = 0;
function hint(text) { $('hint').textContent = text; $('hint').classList.add('show'); hintTimer = 1.4; }
function updatePoolHud() {
  $('poolIcons').innerHTML = Array.from({ length: CFG.maxInPool }, (_, i) => `<span class="${i < poolCount ? 'on' : ''}">🐴</span>`).join('');
}
const popups = [];
function addScore(pts, p, color) {
  score += pts;
  $('scoreVal').textContent = score.toLocaleString('es-ES');
  sfx.points();
  const el = document.createElement('div');
  el.className = 'popup'; el.style.color = color; el.textContent = `+${pts}`;
  document.body.appendChild(el);
  popups.push({ el, pos: new THREE.Vector3(p.x, p.y + 2.2, p.z), life: 1.3 });
}
function updatePopups(dt) {
  for (let i = popups.length - 1; i >= 0; i--) {
    const pp = popups[i];
    pp.life -= dt; pp.pos.y += dt * 1.5;
    const s = pp.pos.clone().project(camera);
    pp.el.style.left = `${(s.x * 0.5 + 0.5) * innerWidth}px`;
    pp.el.style.top = `${(-s.y * 0.5 + 0.5) * innerHeight}px`;
    pp.el.style.opacity = Math.min(1, pp.life * 2);
    pp.el.style.display = s.z > 1 ? 'none' : '';
    if (pp.life <= 0) { pp.el.remove(); popups.splice(i, 1); }
  }
}
// Flechas en el borde hacia los ponis que no se ven
const arrows = [];
function updateArrows() {
  let n = 0;
  const W = innerWidth, H = innerHeight, m = 26;
  for (const p of ponies) {
    if (p.state !== 'walk') continue;
    tv.set(p.x, 1, p.z).project(camera);
    let { x, y } = tv;
    const behind = tv.z > 1;
    if (!behind && Math.abs(x) < 0.98 && Math.abs(y) < 0.95) continue;
    if (behind) { x = -x; y = -y; }
    const k = Math.max(Math.abs(x), Math.abs(y)) || 1;
    x /= k; y /= k;
    if (!arrows[n]) { const a = document.createElement('div'); a.className = 'arrow'; document.body.appendChild(a); arrows[n] = a; }
    const a = arrows[n++];
    a.style.display = 'block';
    a.style.left = `${clamp((x * 0.5 + 0.5) * W, m, W - m) - 9}px`;
    a.style.top = `${clamp((-y * 0.5 + 0.5) * H, m + 60, H - m - 40) - 9}px`;
    a.style.transform = `rotate(${Math.atan2(x, y)}rad)`;
  }
  for (let i = n; i < arrows.length; i++) arrows[i].style.display = 'none';
}

// ---------- Sonido ----------
const sfx = (() => {
  let ctx = null;
  const get = () => {
    if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ctx = new AC(); }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  const tone = (type, f0, f1, dur, vol = 0.15, delay = 0) => {
    const c = get(); if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  };
  const noise = (dur, vol, freq) => {
    const c = get(); if (!c) return;
    const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = c.createBufferSource(); s.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = c.createGain(); g.gain.value = vol;
    s.connect(f).connect(g).connect(c.destination); s.start();
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
      lfo.frequency.value = 22; lg.gain.value = 70; lfo.connect(lg).connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.07, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
      o.connect(g).connect(c.destination); o.start(t); lfo.start(t); o.stop(t + 0.7); lfo.stop(t + 0.7);
    },
    splash: () => noise(0.7, 0.35, 1400),
    points: () => { tone('triangle', 880, 1320, 0.12, 0.08); tone('triangle', 1320, 1760, 0.12, 0.06, 0.08); },
    cloud: () => tone('sine', 300, 180, 0.4, 0.06),
    sun: () => tone('sine', 400, 800, 0.35, 0.06),
    over: () => { tone('square', 440, 220, 0.4, 0.08); tone('square', 330, 110, 0.6, 0.08, 0.35); },
  };
})();

// ---------- Carrito: movimiento ----------
function updateRobot(dt) {
  const wantMove = (keys.up ? 1 : 0) - (keys.down ? 1 : 0);
  const wantTurn = (keys.left ? 1 : 0) - (keys.right ? 1 : 0);
  let targetVel = 0, targetTurn = 0;
  if (wantMove) {
    if (weather.sunny) targetVel = wantMove > 0 ? CFG.robotSpeed : -CFG.robotReverse;
    else hint('☁️ Sin sol no hay energía para avanzar');
  }
  if (wantTurn) {
    if (!weather.sunny) targetTurn = wantTurn * CFG.robotTurn;
    else hint('☀️ Con sol el carrito avanza, pero no puede girar');
  }
  R.vel = damp(R.vel, targetVel, weather.sunny ? 4 : 8, dt);
  R.turnVel = damp(R.turnVel, targetTurn, 10, dt);
  R.heading += R.turnVel * dt;

  const o = { x: R.x + Math.sin(R.heading) * R.vel * dt, z: R.z + Math.cos(R.heading) * R.vel * dt };
  const r = Math.hypot(o.x, o.z);
  if (r > CFG.arena) { o.x *= CFG.arena / r; o.z *= CFG.arena / r; }
  // No puede meterse en la piscina: se desliza por la orilla
  const blocked = (x, z) => poolT(x, z) < 1.1;
  if (blocked(o.x, o.z)) {
    if (!blocked(o.x, R.z)) o.z = R.z;
    else if (!blocked(R.x, o.z)) o.x = R.x;
    else { o.x = R.x; o.z = R.z; }
  }
  pushOut(o, CFG.robotRadius);
  R.x = o.x; R.z = o.z;

  const ry = groundHeight(R.x, R.z);
  robot.position.set(R.x, ry, R.z);
  robot.rotation.y = R.heading;
  // pequeño traqueteo al rodar
  robot.rotation.z = Math.abs(R.vel) > 0.3 ? Math.sin(performance.now() / 45) * 0.012 : 0;

  scareRing.position.set(R.x, ry + 0.04, R.z);
  aimLine.position.set(R.x + Math.sin(R.heading) * 1.2, ry + 0.05, R.z + Math.cos(R.heading) * 1.2);
  aimLine.rotation.y = R.heading;
  const ready = weather.sunny && laserCd <= 0;
  aimMat.opacity = ready ? 0.35 : 0.1;
  if (eyeMat) eyeMat.emissiveIntensity = ready ? 0.25 + Math.sin(performance.now() / 120) * 0.15 : 0;

  sun.position.set(R.x, 0, R.z).add(SUN_OFFSET);
  sun.target.position.set(R.x, 0, R.z);
}

// ---------- Cámara ----------
// Si la copa de una palmera queda entre la cámara y el carrito, se ocultan sus hojas
function updatePalmOcclusion() {
  const cx = camera.position.x, cz = camera.position.z;
  const ex = R.x - cx, ez = R.z - cz, len2 = ex * ex + ez * ez || 1;
  palms.forEach((g, i) => {
    const top = palmTops[i];
    const k = clamp(((top.x - cx) * ex + (top.z - cz) * ez) / len2, -0.1, 1);
    const d = Math.hypot(cx + ex * k - top.x, cz + ez * k - top.z);
    const hide = state === 'play' && !cam.aerial && d < 3.5 && camera.position.y < top.y + 3;
    for (let j = 1; j < g.children.length; j++) g.children[j].visible = !hide;
  });
}
const camTarget = new THREE.Vector3(0, 0, 0);
function updateCamera(dt, snap = false) {
  const want = new THREE.Vector3(), look = new THREE.Vector3();
  if (cam.aerial) {
    want.set(R.x * 0.4, 42, R.z * 0.4 + 24);
    look.set(R.x * 0.4, 0, R.z * 0.4 + 2);
  } else {
    const yaw = R.heading + Math.PI + cam.yawOff, cp = Math.cos(cam.pitch);
    look.set(R.x + Math.sin(R.heading) * 4, 0.6, R.z + Math.cos(R.heading) * 4);
    want.set(Math.sin(yaw) * cp, Math.sin(cam.pitch), Math.cos(yaw) * cp).multiplyScalar(cam.dist).add(tv.set(R.x, 0.8, R.z));
  }
  if (snap) { camera.position.copy(want); camTarget.copy(look); }
  camera.position.lerp(want, 1 - Math.exp(-4 * dt));
  camTarget.lerp(look, 1 - Math.exp(-6 * dt));
  camera.lookAt(camTarget);
}

// ---------- Estado de la partida ----------
let state = 'menu';   // menu | play | pause | over
let elapsed = 0, spawnTimer = 2, laserCd = 0;

function startGame() {
  if (!ponyTemplate) return;
  sfx.unlock();
  for (const p of ponies) removePony(p);
  ponies.length = 0;
  popups.forEach((pp) => pp.el.remove()); popups.length = 0;
  score = 0; poolCount = 0; elapsed = 0; spawnTimer = 1.5; laserCd = 0;
  stats.lasers = 0; stats.scares = 0;
  Object.assign(R, { x: 0, z: 16, heading: Math.PI, vel: 0, turnVel: 0 });
  pushOut(R, CFG.robotRadius + 0.5);
  Object.assign(weather, { sunny: true, timer: rand(6, 10), f: 1 });
  cam.yawOff = 0;
  $('scoreVal').textContent = '0';
  updatePoolHud(); updateWeatherHud();
  $('startScreen').classList.add('hidden');
  $('overScreen').classList.add('hidden');
  updateRobot(0);
  updateCamera(0, true);
  state = 'play';
}

function gameOver() {
  state = 'over';
  sfx.over();
  let best = score;
  try {
    best = Math.max(score, Number(localStorage.getItem('ponisPiscinaBest')) || 0);
    localStorage.setItem('ponisPiscinaBest', String(best));
  } catch { /* sin almacenamiento */ }
  $('finalScore').textContent = `${score.toLocaleString('es-ES')} pts`;
  $('statLaser').textContent = stats.lasers;
  $('statScare').textContent = stats.scares;
  $('statTime').textContent = `${Math.floor(elapsed / 60)}:${String(Math.floor(elapsed % 60)).padStart(2, '0')}`;
  $('statBest').textContent = best.toLocaleString('es-ES');
  setTimeout(() => $('overScreen').classList.remove('hidden'), 1200);
}

function togglePause() {
  if (state === 'play') { state = 'pause'; hint('⏸ Pausa (P para seguir)'); hintTimer = 1e9; }
  else if (state === 'pause') { state = 'play'; hintTimer = 0; }
}
$('startBtn').addEventListener('click', startGame);
$('againBtn').addEventListener('click', startGame);

function updateLaserHud() {
  const ready = laserCd <= 0;
  $('laserFill').style.width = `${(1 - laserCd / CFG.laserCooldown) * 100}%`;
  $('laser').classList.toggle('nosun', !weather.sunny);
  $('laser').classList.toggle('ready', ready && weather.sunny);
  $('laserLabel').textContent = !weather.sunny
    ? (ready ? '☁️ LÁSER SIN SOL' : `☁️ RECARGANDO ${laserCd.toFixed(1)} s`)
    : ready ? (isTouch ? '🔴 LÁSER LISTO' : '🔴 LÁSER LISTO (Espacio)') : `RECARGANDO ${laserCd.toFixed(1)} s`;
}

// ---------- Bucle principal ----------
const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  uTime.value = t;
  waterNormal.offset.set(t * 0.02, t * 0.013);
  waterNormal2.offset.set(-t * 0.015, t * 0.02);

  if (state === 'play') {
    elapsed += dt;
    updateWeather(dt);
    laserCd = Math.max(0, laserCd - dt);
    updateRobot(dt);
    spawnTimer -= dt;
    if (spawnTimer <= 0 && ponies.filter((p) => p.state === 'walk').length < 12) {
      spawnPony();
      spawnTimer = Math.max(1.5, 4.5 - elapsed * 0.02) * rand(0.75, 1.25);
    }
  }
  if (state === 'play' || state === 'over') {
    for (const p of ponies) updatePony(p, dt);
    for (let i = ponies.length - 1; i >= 0; i--) if (ponies[i].remove) { removePony(ponies[i]); ponies.splice(i, 1); }
  }

  if (beamLife > 0) {
    beamLife -= dt;
    const o = Math.max(0, beamLife / 0.35);
    for (const b of beams) { b.core.material.opacity = o; b.glow.material.opacity = o * 0.6; if (beamLife <= 0) b.g.visible = false; }
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    const s = particles[i];
    s.userData.life -= dt; s.userData.v.y -= 12 * dt;
    s.position.addScaledVector(s.userData.v, dt);
    s.scale.setScalar(Math.max(0.01, s.userData.life));
    if (s.userData.life <= 0) { scene.remove(s); particles.splice(i, 1); }
  }
  // salpicaduras del escenario original
  for (let i = splashes.length - 1; i >= 0; i--) {
    const m = splashes[i];
    m.userData.life -= dt * (m.userData.ripple ? 1.2 : 1.4);
    if (m.userData.ripple) m.scale.setScalar(1 + (1 - m.userData.life) * 2.5);
    else { m.userData.v.y -= 12 * dt; m.position.addScaledVector(m.userData.v, dt); }
    m.material.opacity = Math.max(0, m.userData.life);
    if (m.userData.life <= 0 || m.position.y < -1.5) { scene.remove(m); splashes.splice(i, 1); }
  }
  // palomas, palmeras y jacuzzi
  for (const d of doves) {
    const u = d.userData, a = t * u.sp + u.ph;
    d.position.set(Math.cos(a) * u.r * 1.4, u.h + Math.sin(a * 2) * 0.8, Math.sin(a) * u.r);
    d.rotation.y = -a;
    const f = Math.sin(t * 14 + u.ph) * 0.7;
    u.wl.rotation.z = f; u.wr.rotation.z = -f;
  }
  palms.forEach((p, i) => { p.rotation.z = Math.sin(t * 0.8 + i) * 0.012; });
  updateJacuzzi(t, dt);

  if (state === 'menu') {
    const a = t * 0.08;
    camera.position.lerp(tv.set(Math.sin(a) * 22, 7 + Math.sin(t * 0.3), Math.cos(a) * 17), 1 - Math.pow(0.2, dt));
    camTarget.lerp(new THREE.Vector3(0, 0, 0), 1 - Math.pow(0.2, dt));
    camera.lookAt(camTarget);
    robot.position.set(R.x, groundHeight(R.x, R.z), R.z);
    robot.rotation.y = R.heading;
    scareRing.position.set(R.x, 0.1, R.z);
    aimLine.position.set(R.x, 0.11, R.z - 1.2); aimLine.rotation.y = R.heading;
  } else if (state !== 'pause') {
    updateCamera(dt);
  }
  updatePalmOcclusion();

  if (hintTimer > 0) { hintTimer -= dt; if (hintTimer <= 0) $('hint').classList.remove('show'); }
  updateLaserHud();
  updatePopups(dt);
  if (state === 'play') updateArrows(); else arrows.forEach((a) => (a.style.display = 'none'));
  renderer.render(scene, camera);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

updatePoolHud();
updateWeatherHud();
loop();

// acceso para pruebas automáticas (solo con ?debug en la URL)
if (location.search.includes('debug')) {
  window.__game = { get state() { return state; }, get score() { return score; }, get poolCount() { return poolCount; }, get ready() { return !!ponyTemplate; }, ponies, R, weather, fireLaser, startGame, spawnPony, keys };
}
