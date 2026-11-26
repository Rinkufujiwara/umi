// ホーム画面の3D：低ポリゴンの山と森、霧、湖。手前は水の断面。タスク＝湖に浮かぶブイ
import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import SunCalc from 'https://cdn.jsdelivr.net/npm/suncalc@1.9.0/+esm';

// ---------------------------------------------------------------- noise
function hash(x, y) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, o = 4) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; } return s; };
const ridged = (x, y, o = 5) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { const n = 1 - Math.abs(vnoise(x * f, y * f) * 2 - 1); s += n * n * a; f *= 2.1; a *= 0.5; } return s; };
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------- world shape
export const FRONT = 18;            // 手前の断面の位置（z）
export const BED = 40;              // 湖の深さ
// 左岸だけが近い。右は遠くの山まで水がひろがる
export const shoreL = z => -52 - 10 * Math.sin(z * 0.013 + 1) - 4 * Math.sin(z * 0.05);
const shoreR = z => 680 + 70 * Math.sin(z * 0.004 + 2);
function height(x, z) {
  const L = shoreL(z), R = shoreR(z);
  const back = sstep(-640, -900, z) * (ridged(x * 0.0026 + 5, z * 0.0026 + 7) * 260 + 50); // 奥の山
  if (x < L) { // 左：低く平らな陸
    const d = L - x;
    const flat = 0.9 + d * 0.035 + 5 * fbm(x * 0.02 + 4, z * 0.02, 4) * sstep(0, 30, d);
    const far = sstep(260, 520, d) * (ridged(x * 0.003 + 1.3, z * 0.003 + 2.1) * 200 + 30);
    return flat + far + back;
  }
  if (x > R) { // 右：ずっと遠くの山
    const e = x - R;
    return 2 + e * 0.25 + ridged(x * 0.0028, z * 0.0028 + 3) * 240 * sstep(0, 220, e) + back;
  }
  const k = sstep(0, 70, x - L) * sstep(0, 120, R - x);
  const bed = -3 - (BED - 3) * Math.pow(k, 0.8) + 2 * (fbm(x * 0.05, z * 0.05, 2) - 0.5);
  return back > 1 ? Math.max(bed, back - 30) : bed;
}

// ---------------------------------------------------------------- palettes
const PAL = {
  spring: { grass: [0x9bb88f, 0x7fa27a], tree: [0x4f7a5c, 0x5f8c66, 0x7aa37a, 0xd9a7b6], rock: 0x8d969c, fog: 0xc9d8e0, skyTop: 0x9cc3dc, skyBot: 0xeef0ec, water: 0x4f8a8f },
  summer: { grass: [0x86ab84, 0x6a9474], tree: [0x2f5e4b, 0x3b6e55, 0x4a7c60, 0x5a8a6a], rock: 0x86919a, fog: 0xc4d6df, skyTop: 0x8fbfdc, skyBot: 0xeaf0ee, water: 0x3f8088 },
  autumn: { grass: [0xa9ad8a, 0x93a07f], tree: [0x3e6455, 0x456b5b, 0x355a4d, 0xb9804a, 0xcf9d5a, 0x9c6446], rock: 0x8f9396, fog: 0xd3d6d4, skyTop: 0xa3c1d6, skyBot: 0xf1ece4, water: 0x4c7f84 },
  winter: { grass: [0xdde6ea, 0xc9d6dc], tree: [0x3d5a55, 0x4b6a63, 0xe9f0f3, 0xd7e2e6], rock: 0x9aa4ab, fog: 0xd6e0e6, skyTop: 0xa9c4d8, skyBot: 0xf1f4f6, water: 0x56858c }
};

export function createHome(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const fog = new THREE.Fog(0xc9d8e0, 90, 760);
  scene.fog = fog;
  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 4000);

  // 空（上は青、地平線は白っぽい）
  const skyU = { top: { value: new THREE.Color() }, bot: { value: new THREE.Color() } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(2500, 32, 16), new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform vec3 top; uniform vec3 bot; varying vec3 vP;
      void main(){ float h = normalize(vP).y; gl_FragColor = vec4(mix(bot, top, smoothstep(-.02, .45, h)), 1.); }`
  }));
  scene.add(sky);

  // 光
  const hemi = new THREE.HemisphereLight(0xdbe9f2, 0x6f8577, 1.5);
  const sun = new THREE.DirectionalLight(0xfff2e2, 1.7);
  sun.position.set(-160, 220, -260);
  scene.add(hemi, sun);

  // ---------------------------------------------------------------- terrain (flat shaded)
  const Z0 = -1100, Z1 = FRONT, X0 = -560, X1 = 1300, SEG_X = 230, SEG_Z = 190;
  const tg = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0, SEG_X, SEG_Z);
  tg.rotateX(-Math.PI / 2);
  tg.translate((X0 + X1) / 2, 0, (Z0 + Z1) / 2);
  {
    const p = tg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + (hash(i, 1) - 0.5) * 2.2, z = p.getZ(i) + (Math.abs(p.getZ(i) - FRONT) < 0.1 ? 0 : (hash(i, 2) - 0.5) * 2.2);
      p.setXYZ(i, x, height(x, z), z);
    }
  }
  const terGeo = tg.toNonIndexed();
  terGeo.computeVertexNormals();
  const terCol = new Float32Array(terGeo.attributes.position.count * 3);
  terGeo.setAttribute('color', new THREE.BufferAttribute(terCol, 3));
  const terrain = new THREE.Mesh(terGeo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }));
  scene.add(terrain);

  // 手前の土の断面（湖の外側）
  const skirtPts = [];
  for (let i = 0; i <= 320; i++) { const x = X0 + (X1 - X0) * i / 320; skirtPts.push([x, height(x, FRONT)]); }
  const skirtGeo = new THREE.BufferGeometry();
  {
    const pos = [], col = [];
    for (let i = 0; i < skirtPts.length - 1; i++) {
      const [x0, y0] = skirtPts[i], [x1, y1] = skirtPts[i + 1], b = -BED - 40;
      pos.push(x0, y0, FRONT, x1, y1, FRONT, x0, b, FRONT, x1, y1, FRONT, x1, b, FRONT, x0, b, FRONT);
      const c0 = new THREE.Color(0x3d5a5c), c1 = new THREE.Color(0x1b3138);
      for (const yy of [y0, y1, b, y1, b, b]) { const c = c0.clone().lerp(c1, sstep(0, -BED, yy)); col.push(c.r, c.g, c.b); }
    }
    skirtGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    skirtGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    skirtGeo.computeVertexNormals();
  }
  const skirt = new THREE.Mesh(skirtGeo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }));
  scene.add(skirt);

  // ---------------------------------------------------------------- pine trees (instanced)
  const pine = (() => {
    const parts = [];
    const trunk = new THREE.CylinderGeometry(0.18, 0.25, 1.2, 5); trunk.translate(0, 0.6, 0); parts.push(trunk);
    [[1.7, 2.6, 1.6], [1.35, 2.3, 3.0], [0.95, 2.0, 4.3]].forEach(([r, h, y]) => { const c = new THREE.ConeGeometry(r, h, 6); c.translate(0, y, 0); parts.push(c); });
    const g = mergeGeometries(parts.map(p => p.toNonIndexed()));
    g.computeVertexNormals();
    return g;
  })();
  const TREE_N = 4200;
  const trees = new THREE.InstancedMesh(pine, new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9 }), TREE_N);
  const treeData = [];
  {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    let k = 0;
    for (let i = 0; k < TREE_N && i < TREE_N * 12; i++) {
      const z = lerp(FRONT - 6, -560, Math.pow(hash(i, 11), 0.75));
      const x = shoreL(z) - 6 - Math.pow(hash(i, 13), 1.3) * 420;
      const y = height(x, z);
      if (y < 1.5 || y > 150) continue;
      if (fbm(x * 0.03 + 9, z * 0.03, 3) < 0.42) continue; // 林の切れ目
      const s = 0.9 + hash(i, 14) * 1.5 + (y > 60 ? 0.6 : 0);
      m4.compose(new THREE.Vector3(x, y - 0.3, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash(i, 15) * 6.3), new THREE.Vector3(s, s * (0.9 + hash(i, 16) * 0.5), s));
      trees.setMatrixAt(k, m4); treeData.push(hash(i, 17)); k++;
    }
    trees.count = k;
  }
  scene.add(trees);

  // ---------------------------------------------------------------- mist bands
  const mistTex = (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(128, 32, 4, 128, 32, 128);
    gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.scale(1, 0.5); g.fillRect(0, 0, 256, 128);
    return new THREE.CanvasTexture(c);
  })();
  const mists = [];
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(420, 60), new THREE.MeshBasicMaterial({ map: mistTex, transparent: true, depthWrite: false, opacity: 0.55, fog: false }));
    m.position.set((hash(i, 21) - 0.5) * 300, 14 + hash(i, 22) * 60, -120 - i * 55);
    m.userData.speed = 0.6 + hash(i, 23); mists.push(m); scene.add(m);
  }

  // ---------------------------------------------------------------- water surface
  const normals = new THREE.TextureLoader().load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/textures/waternormals.jpg',
    t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; });
  const waterDepth = FRONT - Z0;
  const water = new Water(new THREE.PlaneGeometry(1500, waterDepth), {
    textureWidth: 512, textureHeight: 512, waterNormals: normals, sunDirection: sun.position.clone().normalize(),
    sunColor: 0x9a9890, waterColor: 0x4f8a8f, distortionScale: 0.5, fog: true, alpha: 1
  });
  water.rotation.x = -Math.PI / 2;
  water.position.set(560, 0, (Z0 + FRONT) / 2);
  water.material.uniforms.size.value = 6;
  scene.add(water);


  // ---------------------------------------------------------------- 手前側の世界（空から見るときだけ）
  const EXT_Z1 = FRONT + 380;
  const tgE = new THREE.PlaneGeometry(X1 - X0, EXT_Z1 - FRONT, SEG_X, 60);
  tgE.rotateX(-Math.PI / 2); tgE.translate((X0 + X1) / 2, 0, (FRONT + EXT_Z1) / 2);
  { const p = tgE.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i) + (hash(i, 7) - 0.5) * 2.2, z = p.getZ(i); p.setXYZ(i, x, height(x, z), z); } }
  const extGeo = tgE.toNonIndexed(); extGeo.computeVertexNormals();
  const extCol = new Float32Array(extGeo.attributes.position.count * 3);
  extGeo.setAttribute('color', new THREE.BufferAttribute(extCol, 3));
  const extLand = new THREE.Mesh(extGeo, terrain.material);
  const extWaterMat = new THREE.MeshStandardMaterial({ color: 0x4f8a8f, roughness: 0.75, metalness: 0, envMapIntensity: 0.25 });
  normals.repeat.set(1, 1);
  extWaterMat.normalMap = normals; extWaterMat.normalScale.set(0.22, 0.22);
  const extWater = new THREE.Mesh(new THREE.PlaneGeometry(1500, EXT_Z1 - Z0), extWaterMat);
  extWater.rotation.x = -Math.PI / 2; extWater.position.set(560, 0.03, (Z0 + EXT_Z1) / 2);
  const extTrees = new THREE.InstancedMesh(pine, trees.material, 1600);
  const extTreeData = [];
  {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(); let k = 0;
    for (let i = 0; k < 1600 && i < 16000; i++) {
      const z = lerp(FRONT, EXT_Z1, hash(i, 211)), x = shoreL(z) - 6 - Math.pow(hash(i, 213), 1.3) * 420, y = height(x, z);
      if (y < 1.5 || y > 150 || fbm(x * 0.03 + 9, z * 0.03, 3) < 0.42) continue;
      const sc = 0.9 + hash(i, 214) * 1.5;
      m4.compose(new THREE.Vector3(x, y - 0.3, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash(i, 215) * 6.3), new THREE.Vector3(sc, sc, sc));
      extTrees.setMatrixAt(k, m4); extTreeData.push(hash(i, 217)); k++;
    }
    extTrees.count = k;
  }
  const extGroup = new THREE.Group(); extGroup.add(extLand, extWater, extTrees); extGroup.visible = false; scene.add(extGroup);

  // ---------------------------------------------------------------- front cutaway of the water
  const cutU = { uTime: { value: 0 }, uL: { value: shoreL(FRONT) }, uR: { value: 900 }, uBed: { value: BED }, uTop: { value: new THREE.Color(0x6fa6a8) }, uDeep: { value: new THREE.Color(0x0f2d38) } };
  const cut = new THREE.Mesh(new THREE.PlaneGeometry(900 - shoreL(FRONT) + 4, BED + 6, 1, 1), new THREE.ShaderMaterial({
    uniforms: cutU, transparent: true, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float uTime; uniform float uL; uniform float uR; uniform float uBed; uniform vec3 uTop; uniform vec3 uDeep; varying vec3 vW;
      float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
        return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y); }
      void main(){
        float d = -vW.y;                                   // 水深
        if (d < 0.) discard;
        float k = clamp(d / uBed, 0., 1.);
        vec3 c = mix(uTop, uDeep, pow(k, .55));
        // 上から差しこむ光の筋
        float rays = vn(vec2(vW.x * .12 + vW.y * .05 + uTime * .05, 1.)) * vn(vec2(vW.x * .05 - uTime * .03, 3.));
        c += vec3(.55, .8, .85) * pow(rays, 2.2) * (1. - k) * .55;
        // 水面のすぐ下の明るい帯
        c += vec3(.5, .75, .78) * exp(-d * .35) * .5;
        float edge = smoothstep(uL - 2., uL + 6., vW.x);
        float a = mix(.7, .985, smoothstep(0., 16., d)) * edge;
        gl_FragColor = vec4(c, a);
      }`
  }));
  cut.position.set((900 + shoreL(FRONT)) / 2, -(BED + 6) / 2 + 0.02, FRONT + 0.05);
  cut.renderOrder = 10;
  scene.add(cut);
  // 水面の線（断面の上の縁）
  const rim = new THREE.Mesh(new THREE.PlaneGeometry(900 - shoreL(FRONT), 0.35), new THREE.MeshBasicMaterial({ color: 0xe6f3f2, transparent: true, opacity: 0.8, fog: false }));
  rim.position.set((900 + shoreL(FRONT)) / 2, -0.1, FRONT + 0.08); rim.renderOrder = 11;
  scene.add(rim);

  // ---------------------------------------------------------------- lake bed: 沈んだブイが、そのまま積もっていく（いちばん新しいものが山の上）
  const PILE = new THREE.Vector3(24, 0, -34); PILE.y = height(PILE.x, PILE.z);
  const HEAP_MAX = 1500;
  let heapN = 0;
  function heapSlot(j, n) { // j=0 がいちばん新しい（てっぺん）
    const R = 2.0 * Math.sqrt(n) + 1.5, H = 1.35 * Math.sqrt(n) + 0.6;
    const r = R * Math.sqrt(j / Math.max(1, n)) * 0.95;
    const a = j * 2.39996 + 0.7;
    const x = PILE.x + Math.cos(a) * r, z = PILE.z + Math.sin(a) * r * 0.85;
    return new THREE.Vector3(x, PILE.y + 0.9 + H * Math.pow(1 - r / R, 1.3), z);
  }
  const pileTop = () => heapSlot(0, heapN + 1).add(new THREE.Vector3(0, 1.2, 0));

  // ---------------------------------------------------------------- buoy geometry（浮いているブイと、積もったブイで共用）
  const buoyGeo = (() => {
    const prof = [[0, -0.55], [0.55, -0.5], [0.85, -0.25], [0.9, 0], [0.75, 0.22], [0.42, 0.3], [0, 0.32]].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(prof, 12);
  })();
  const capGeo = new THREE.ConeGeometry(0.42, 0.75, 8); capGeo.translate(0, 0.62, 0);
  const KIND = { must: 0xe0533f, self: 0xf2b134, none: 0xf4f1ea };
  const heapBody = new THREE.InstancedMesh(buoyGeo, new THREE.MeshStandardMaterial({ color: 0xdfe8e8, roughness: 0.6, flatShading: true }), HEAP_MAX);
  const heapCap = new THREE.InstancedMesh(capGeo, new THREE.MeshStandardMaterial({ roughness: 0.6, flatShading: true }), HEAP_MAX);
  heapBody.count = heapCap.count = 0; scene.add(heapBody, heapCap);
  function setSunk(kinds) { // kinds：新しい順
    const n = Math.min(HEAP_MAX, kinds.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color(), sc = new THREE.Vector3(2.4, 2.4, 2.4);
    for (let j = 0; j < n; j++) {
      const seed = n - j; // 古いものほど同じ向きのまま
      e.set((hash(seed, 51) - 0.5) * 2.6, hash(seed, 52) * 6.3, (hash(seed, 53) - 0.5) * 2.6);
      m4.compose(heapSlot(j, n), q.setFromEuler(e), sc);
      heapBody.setMatrixAt(j, m4); heapCap.setMatrixAt(j, m4);
      heapCap.setColorAt(j, c.set(KIND[kinds[j] || 'none']).multiplyScalar(0.85));
    }
    heapN = n; heapBody.count = heapCap.count = n;
    heapBody.instanceMatrix.needsUpdate = heapCap.instanceMatrix.needsUpdate = true;
    if (heapCap.instanceColor) heapCap.instanceColor.needsUpdate = true;
  }

  // まわりを飾る：岩・海藻・サンゴ（山の並びのじゃまにならない所だけ）
  const inGrid = (x, z) => Math.hypot(x - PILE.x, (z - PILE.z) * 1.1) < 34;
  {
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x5f7472, flatShading: true, roughness: 0.95 });
    let n = 0;
    for (let i = 0; n < 46 && i < 400; i++) {
      const x = lerp(shoreL(0) + 6, 150, hash(i, 61)), z = lerp(-14, -160, hash(i, 62));
      if (inGrid(x, z) || height(x, z) > -12) continue;
      const g = new THREE.DodecahedronGeometry(1, 0), p = g.attributes.position;
      for (let v = 0; v < p.count; v++) p.setXYZ(v, p.getX(v) * (0.8 + hash(i * 7 + v, 63) * 0.4), p.getY(v) * (0.55 + hash(i * 7 + v, 64) * 0.3), p.getZ(v) * (0.8 + hash(i * 7 + v, 65) * 0.4));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, rockMat), sc = 1.5 + hash(i, 66) * 4.5;
      m.scale.setScalar(sc); m.position.set(x, height(x, z) + sc * 0.25, z); m.rotation.y = hash(i, 67) * 6;
      scene.add(m); n++;
    }
    // 海藻（ゆれる）
    const weedGeo = new THREE.PlaneGeometry(0.5, 1, 1, 6); weedGeo.translate(0, 0.5, 0);
    const weedMat = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.8, flatShading: true });
    weedMat.onBeforeCompile = sh => {
      sh.uniforms.uT = cutU.uTime;
      sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 ip = vec3(instanceMatrix[3]); float hh = position.y;
        transformed.x += sin(uT * .9 + ip.x * .3 + ip.z * .2 + hh * 1.5) * .35 * hh;
        transformed.z += cos(uT * .7 + ip.z * .4) * .15 * hh;`);
    };
    const WEED_N = 900;
    const weed = new THREE.InstancedMesh(weedGeo, weedMat, WEED_N);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    const WEED_C = [0x4f7d68, 0x5f8f74, 0x3f6b5e, 0x7a9a6a];
    let w = 0;
    for (let i = 0; w < WEED_N && i < WEED_N * 6; i++) {
      const cx = lerp(shoreL(0) + 4, 140, hash(i % 60, 71)), cz = lerp(-16, -160, hash(i % 60, 72));
      const x = cx + (hash(i, 73) - 0.5) * 9, z = cz + (hash(i, 74) - 0.5) * 9;
      if (inGrid(x, z) || height(x, z) > -10) continue;
      const hgt = 3 + hash(i, 75) * 7;
      m4.compose(new THREE.Vector3(x, height(x, z) - 0.1, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash(i, 76) * 6.3), new THREE.Vector3(1, hgt, 1));
      weed.setMatrixAt(w, m4); weed.setColorAt(w, c.set(WEED_C[w % 4])); w++;
    }
    weed.count = w; scene.add(weed);
    // サンゴ（低ポリの枝）
    const coralGeo = (() => {
      const parts = [];
      for (let b = 0; b < 6; b++) {
        const cyl = new THREE.CylinderGeometry(0.12, 0.2, 1.6 + hash(b, 81), 5);
        cyl.translate(0, 0.8, 0); cyl.rotateZ((hash(b, 82) - 0.5) * 1.1); cyl.rotateY(b * 1.05);
        parts.push(cyl.toNonIndexed());
        const tip = new THREE.IcosahedronGeometry(0.28, 0); const v = new THREE.Vector3(0, 1.7, 0).applyEuler(new THREE.Euler(0, b * 1.05, (hash(b, 82) - 0.5) * 1.1));
        tip.translate(v.x, v.y, v.z); parts.push(tip.toNonIndexed());
      }
      const g = mergeGeometries(parts); g.computeVertexNormals(); return g;
    })();
    const CORAL_C = [0xe7a7a0, 0xf0c39a, 0xc7b4e0, 0xe9c9d3, 0x9fd0c8];
    const coral = new THREE.InstancedMesh(coralGeo, new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.6 }), 70);
    let cn = 0;
    for (let i = 0; cn < 70 && i < 500; i++) {
      const x = lerp(shoreL(0) + 8, 130, hash(i, 91)), z = lerp(-16, -150, hash(i, 92));
      if (inGrid(x, z) || height(x, z) > -14) continue;
      const sc = 1.4 + hash(i, 93) * 2.4;
      m4.compose(new THREE.Vector3(x, height(x, z) - 0.2, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash(i, 94) * 6.3), new THREE.Vector3(sc, sc, sc));
      coral.setMatrixAt(cn, m4); coral.setColorAt(cn, c.set(CORAL_C[cn % CORAL_C.length])); cn++;
    }
    coral.count = cn; scene.add(coral);
  }
  // 湖底のほのかな光
  const bedLight = new THREE.PointLight(0x9fe0e6, 140, 110, 1.4);
  bedLight.position.set(PILE.x, PILE.y + 24, PILE.z + 8);
  scene.add(bedLight);

  // ---------------------------------------------------------------- buoys (= タスク)
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xeef3f3, roughness: 0.45, flatShading: true });
  const lampGeo = new THREE.SphereGeometry(0.16, 10, 8); lampGeo.translate(0, 1.08, 0);
  const buoys = new Map();
  const buoyRoot = new THREE.Group(); scene.add(buoyRoot);

  function makeBuoy(t) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(buoyGeo, bodyMat);
    const cap = new THREE.Mesh(capGeo, new THREE.MeshStandardMaterial({ color: KIND[t.kind || 'none'], roughness: 0.5, flatShading: true }));
    const lamp = new THREE.Mesh(lampGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: KIND[t.kind || 'none'], emissiveIntensity: 1.4 }));
    g.add(body, cap, lamp);
    g.userData = { id: t.id, ph: Math.random() * 6.28, sinking: false, cap, lamp };
    return g;
  }
  // 深さごとの置き場所：今日は手前、今週は中ほど、いつかは遠く
    // 置き場所：u＝重さ（0 左の浅瀬 → 1 右の沖）、v＝時間の余裕（0 手前 → 1 奥）
  function placeUV(id, u, v) {
    const h = (k) => { let s = 0; for (const ch of id) s = (s * 31 + ch.charCodeAt(0) + k) >>> 0; return (s % 10000) / 10000; };
    const z = lerp(10, -235, Math.min(1, Math.max(0, v + (h(1) - 0.5) * 0.04)));
    const xmax = (132 - z) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect * 0.82 - 6;
    const x0 = shoreL(z) + 12, x1 = Math.max(x0 + 20, xmax);
    const x = lerp(x0, x1, Math.min(1, Math.max(0, u + (h(2) - 0.5) * 0.06)));
    return new THREE.Vector3(x, 0, z);
  }
  function setTasks(list) {
    const keep = new Set(list.map(t => t.id));
    for (const [id, b] of buoys) if (!keep.has(id) && !b.userData.sinking) { buoyRoot.remove(b); buoys.delete(id); }
    for (const t of list) {
      let b = buoys.get(t.id);
      const key = `${t.u.toFixed(3)},${t.v.toFixed(3)}`;
      const spot = placeUV(t.id, t.u, t.v);
      if (!b) { b = makeBuoy(t); buoys.set(t.id, b); buoyRoot.add(b); b.position.copy(spot); }
      else if (b.userData.key !== key) b.userData.target = spot;
      b.userData.key = key; b.userData.home = spot;
      b.userData.sec = t.sec;
      b.userData.cap.material.color.set(KIND[t.kind || 'none']);
      b.userData.lamp.material.emissive.set(KIND[t.kind || 'none']);
      b.userData.base = lerp(3.3, 4.6, t.v); b.scale.setScalar(b.userData.base); // 遠いほど少し大きくして見やすく
      b.visible = !t.hidden;
    }
    resolveOverlap();
  }
  function resolveOverlap() {
    const arr = [...buoys.values()].filter(b => !b.userData.sinking);
    for (let it = 0; it < 12; it++) for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
      const a = arr[i].userData.target || arr[i].position, b = arr[j].userData.target || arr[j].position;
      const dx = a.x - b.x, dz = a.z - b.z, d = Math.hypot(dx, dz), min = 13;
      if (d < min && d > 0.001) { const p = (min - d) / 2; a.x += dx / d * p; a.z += dz / d * p; b.x -= dx / d * p; b.z -= dz / d * p; }
    }
  }

  // しぶきと波紋
  const fx = [];
  const ringGeo = new THREE.RingGeometry(0.8, 1, 40); ringGeo.rotateX(-Math.PI / 2);
  const dropGeo = new THREE.SphereGeometry(0.09, 6, 4);
  const dropMat = new THREE.MeshBasicMaterial({ color: 0xf2fbfb });
  function splash(p) {
    for (let r = 0; r < 3; r++) {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false }));
      m.position.set(p.x, 0.06, p.z); buoyRoot.add(m);
      fx.push({ m, t: -r * 0.22, kind: 'ring' });
    }
    for (let i = 0; i < 18; i++) {
      const m = new THREE.Mesh(dropGeo, dropMat); m.position.set(p.x, 0.3, p.z); buoyRoot.add(m);
      const a = Math.random() * 6.28, s = 1.5 + Math.random() * 2.5;
      fx.push({ m, t: 0, kind: 'drop', v: new THREE.Vector3(Math.cos(a) * s, 4 + Math.random() * 4, Math.sin(a) * s) });
    }
  }
  // 泡
  const bubbleMat = new THREE.MeshBasicMaterial({ color: 0xdff4f4, transparent: true, opacity: 0.55 });
  function bubbles(p) {
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(dropGeo, bubbleMat); m.scale.setScalar(1 + Math.random() * 2);
      m.position.set(p.x + (Math.random() - 0.5), p.y + Math.random(), p.z + (Math.random() - 0.5)); buoyRoot.add(m);
      fx.push({ m, t: 0, kind: 'bubble', v: new THREE.Vector3(0, 2 + Math.random() * 2, 0) });
    }
  }
  // 沈める：ポチャン → 断面の中をゆっくり沈み → 湖底の結晶になる
  function sink(id) {
    const b = buoys.get(id);
    if (!b || b.userData.sinking) return Promise.resolve();
    b.userData.sinking = true;
    splash(b.position);
    return new Promise(res => {
      b.userData.sinkT = 0;
      b.userData.done = () => { buoyRoot.remove(b); buoys.delete(id); res(); };
      b.userData.sinkFrom = b.position.clone();
      b.userData.bubbled = false;
    });
  }

  // ---------------------------------------------------------------- 小さな背びれ（そろそろ危ないタスクを、横からつついて揺らす）
  const ringSmall = new THREE.RingGeometry(0.5, 0.62, 28); ringSmall.rotateX(-Math.PI / 2);
  const finGeo = (() => {
    const sh = new THREE.Shape();
    sh.moveTo(-1.1, 0); sh.quadraticCurveTo(-0.2, 0.6, 0.35, 2.1); sh.quadraticCurveTo(0.45, 1.0, 1.0, 0); sh.lineTo(-1.1, 0);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.22, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 1, curveSegments: 5 });
    g.translate(0, -0.35, -0.11); g.rotateY(Math.PI / 2);
    return g.toNonIndexed();
  })();
  const finMat = new THREE.MeshStandardMaterial({ color: 0x4f5f68, roughness: 0.55, flatShading: true });
  // 水の中の黒い影（どの角度から見てもサメと分かるように）
  const shadowTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 56, 2, 32, 64, 60); gr.addColorStop(0, 'rgba(10,30,40,.75)'); gr.addColorStop(1, 'rgba(10,30,40,0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(32, 64, 18, 58, 0, 0, Math.PI * 2); g.fill(); return new THREE.CanvasTexture(c); })();
  const shadowGeo = new THREE.PlaneGeometry(1.6, 4.6); shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.8 });
  const alerts = new Map();  // taskId -> fin
  function setAlerts(ids) {
    const want = new Set(ids.slice(0, 3));
    for (const [id, f] of alerts) if (!want.has(id) && f.leaving === undefined) f.leaving = 0;
    let k = 0;
    for (const id of want) {
      if (alerts.has(id) && alerts.get(id).leaving === undefined) continue;
      const b = buoys.get(id); if (!b) continue;
      const g = new THREE.Group();
      const fin = new THREE.Mesh(finGeo, finMat), sh = new THREE.Mesh(shadowGeo, shadowMat);
      sh.position.y = -0.25; g.add(fin, sh);
      g.scale.setScalar(1.5);
      const a0 = Math.random() * 6.28;
      g.position.set(b.position.x + Math.cos(a0) * 14, -2.5, b.position.z + Math.sin(a0) * 14);
      buoyRoot.add(g);
      alerts.set(id, { g, fin, t: -(k++) * 2.3, rise: 0, wake: 0, rest: new THREE.Vector3() });
    }
  }
  const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();
  function steer(f, to, speed, dt) {
    const p = f.g.position; tmpV.set(to.x - p.x, 0, to.z - p.z);
    const d = tmpV.length(); if (d < 0.01) return 0;
    const step = Math.min(d, speed * dt); p.x += tmpV.x / d * step; p.z += tmpV.z / d * step;
    p.z = Math.min(p.z, FRONT - 4); p.x = Math.max(p.x, shoreL(p.z) + 3);
    if (d > 3) { const yaw = Math.atan2(tmpV.x, tmpV.z); f.g.rotation.y += (((yaw - f.g.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 4); }
    return d;
  }
  function updateAlerts(dt) {
    for (const [id, f] of alerts) {
      const b = buoys.get(id), p = f.g.position;
      f.t += dt;
      if (f.leaving !== undefined || !b || b.userData.sinking) {   // 潜って去る
        f.leaving = (f.leaving || 0) + dt; p.y -= dt * 2;
        if (f.leaving > 1.5) { buoyRoot.remove(f.g); alerts.delete(id); }
        continue;
      }
      if (f.t < 0) continue;
      f.rise = Math.min(1, f.rise + dt * 0.7);
      p.y = lerp(-2.5, 0, f.rise) + Math.sin(f.t * 2.2) * 0.05;
      f.g.visible = b.visible;
      // ブイのまわりを楕円で回り、一点だけすっと近づいて鼻先で触れ、また弧を描いて離れる。速さに緩急
      const bp = b.position, s = b.scale.x / 3.4;
      if (f.a === undefined) { f.a = Math.atan2(f.g.position.z - bp.z, f.g.position.x - bp.x); f.a0 = Math.random() * 6.28; f.ph = Math.random() * 6.28; }
      const near = Math.pow(Math.max(0, Math.cos(f.a - f.a0)), 6);          // 触れる地点に近いほど 1
      const speed = (0.75 + 0.35 * Math.sin(f.t * 0.9 + f.ph)) * (1 + near * 0.6); // 近づくときは少し速く
      f.a += dt * speed;
      const R = (5.5 - near * 3.4) * s * (1 + 0.12 * Math.sin(2 * f.a + f.ph));
      tmpV2.set(bp.x + Math.cos(f.a) * R, 0, bp.z + Math.sin(f.a) * R * 0.85);
      let moving = steer(f, tmpV2, f.rise < 0.95 ? 9 : 30, dt) > 0.05;
      // 触れた瞬間にブイが揺れる（1周に1回）
      const touch = ((f.a - f.a0) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      if (touch < 0.25 && !f.bumped && f.rise > 0.9) { b.userData.nudge = 1; f.bumped = true; }
      if (touch > 1) f.bumped = false;
      // 進む向き＋泳ぐときの小さな左右の振り
      const tx = -Math.sin(f.a), tz = Math.cos(f.a) * 0.85, yaw = Math.atan2(tx, tz) + Math.sin(f.t * 3.2 + f.ph) * 0.12;
      f.g.rotation.y += (((yaw - f.g.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 5);
      f.g.rotation.z = Math.sin(f.t * 1.6 + f.ph) * 0.06;
      moving = true;
      f.wake += dt;
      if (moving && f.wake > 0.25 && f.rise > 0.6) {
        f.wake = 0;
        const m = new THREE.Mesh(ringSmall, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false }));
        m.position.set(p.x, 0.05, p.z); buoyRoot.add(m); fx.push({ m, t: 0, kind: 'wake' });
      }
    }
  }

  // ---------------------------------------------------------------- picking
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    ndc.set((clientX - r.left) / r.width * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const list = [...buoys.values()].filter(b => b.visible && !b.userData.sinking);
    const hits = ray.intersectObjects(list, true);
    if (hits.length) { let o = hits[0].object; while (o && !o.userData.id) o = o.parent; if (o) return o.userData.id; }
    // 当たらなくても、画面上でいちばん近いブイ（30px 以内）を選ぶ。遠くの小さいブイも押しやすく
    let best = null, bd = 30;
    for (const b of list) {
      const v = b.position.clone(); v.y += 0.6 * b.scale.y; v.project(camera);
      const x = (v.x + 1) / 2 * r.width + r.left, y = (1 - v.y) / 2 * r.height + r.top, d = Math.hypot(x - clientX, y - clientY);
      if (d < bd) { bd = d; best = b.userData.id; }
    }
    return best;
  }
  let hovered = null;
  function setHover(id) {
    if (hovered === id) return;
    for (const [bid, b] of buoys) b.userData.lamp.material.emissiveIntensity = bid === id ? 3.2 : 1.4;
    hovered = id;
  }

  // ---------------------------------------------------------------- season / weather
  const tmpC = new THREE.Color();
  let season = null;
  function setSeason(s) {
    if (s === season || !PAL[s]) return; season = s;
    const P = PAL[s];
    const g0 = new THREE.Color(P.grass[0]), g1 = new THREE.Color(P.grass[1]), rock = new THREE.Color(P.rock), snow = new THREE.Color(0xf1f5f7);
    const sand = new THREE.Color(0xa8a28a), bedC = new THREE.Color(0x5e7d78);
    for (const [geo, colArr] of [[terGeo, terCol], [extGeo, extCol]]) {
    const pos = geo.attributes.position, nor = geo.attributes.normal;
    for (let i = 0; i < pos.count; i += 3) {
      let y = 0, ny = 0, x = 0, z = 0;
      for (let k = 0; k < 3; k++) { y += pos.getY(i + k) / 3; ny += nor.getY(i + k) / 3; x += pos.getX(i + k) / 3; z += pos.getZ(i + k) / 3; }
      if (y < -1) tmpC.copy(bedC).lerp(new THREE.Color(0x3c5f62), sstep(-5, -BED, y));
      else if (y < 1.8) tmpC.copy(sand);
      else {
        tmpC.copy(g0).lerp(g1, hash(i, 41));
        tmpC.lerp(rock, Math.max(sstep(0.8, 0.55, ny), sstep(70, 170, y)));
        const sl = s === 'winter' ? 30 : s === 'spring' ? 230 : s === 'autumn' ? 260 : 330;
        tmpC.lerp(snow, sstep(sl - 20, sl + 30, y + 30 * (hash(i, 42) - 0.5)) * sstep(0.45, 0.7, ny));
      }
      tmpC.multiplyScalar(0.94 + hash(i, 43) * 0.12);
      for (let k = 0; k < 3; k++) colArr.set([tmpC.r, tmpC.g, tmpC.b], (i + k) * 3);
    }
    geo.attributes.color.needsUpdate = true;
    }
    for (let i = 0; i < trees.count; i++) trees.setColorAt(i, tmpC.set(P.tree[Math.floor(treeData[i] * P.tree.length)]));
    trees.instanceColor.needsUpdate = true;
    for (let i = 0; i < extTrees.count; i++) extTrees.setColorAt(i, tmpC.set(P.tree[Math.floor(extTreeData[i] * P.tree.length)]));
    if (extTrees.instanceColor) extTrees.instanceColor.needsUpdate = true;
    baseFog.set(P.fog); skyTop.set(P.skyTop); skyBot.set(P.skyBot); waterCol.set(P.water);
  }
  const baseFog = new THREE.Color(), skyTop = new THREE.Color(), skyBot = new THREE.Color(), waterCol = new THREE.Color();
  const wx = { cloud: 0, rain: 0, snow: 0, fog: 0, wind: 0.2 };
  let wxTarget = { ...wx };
  function setWeather(t) { wxTarget = { cloud: t.cloud, rain: t.rain, snow: t.snow, fog: t.fog, wind: t.wind }; }

  // 雨・雪
  const PREC_N = 3000;
  const precGeo = new THREE.BufferGeometry();
  { const a = new Float32Array(PREC_N * 3); for (let i = 0; i < PREC_N; i++) a.set([Math.random() * 120 - 60, Math.random() * 60, Math.random() * 120 - 90], i * 3); precGeo.setAttribute('position', new THREE.BufferAttribute(a, 3)); }
  const precMat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uRain: { value: 0 }, uSnow: { value: 0 }, uPR: { value: 1 } }, transparent: true, depthWrite: false,
    vertexShader: `uniform float uT; uniform float uRain; uniform float uSnow; uniform float uPR; varying float vA;
      void main(){ vec3 p = position; float sp = mix(5., 40., step(.5, uRain));
        p.y = mod(p.y - uT * sp, 60.); p.x += sin(uT * .6 + position.z) * uSnow;
        vA = step(fract(position.x * 3.7 + position.z * 1.3), max(uRain, uSnow));
        vec4 mv = modelViewMatrix * vec4(p, 1.); gl_PointSize = uPR * (uRain > .5 ? 40. : 90.) / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uRain; varying float vA; void main(){ if (vA < .5) discard; vec2 c = gl_PointCoord - .5;
      float a = uRain > .5 ? smoothstep(.06, 0., abs(c.x)) * .5 : smoothstep(.5, .1, length(c)) * .9; gl_FragColor = vec4(1., 1., 1., a); }`
  });
  const prec = new THREE.Points(precGeo, precMat); prec.frustumCulled = false; scene.add(prec);


  // ---------------------------------------------------------------- 時間帯（SunCalc で本物の太陽の高さ）
  const PHASE = {
    night: { top: 0x0b1626, bot: 0x22344a, fog: 0x1a2838 },
    twilight: { top: 0x4a5c82, bot: 0xe2a487, fog: 0x8a8aa0 },
    golden: { top: 0x8db0cd, bot: 0xf2d2ac, fog: 0xd9ccbd }
  };
  let sunAlt = 30;
  const stars = (() => {
    const N = 1600, a = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const u = hash(i, 101), v = hash(i, 102) * 0.9 + 0.05, th = u * Math.PI * 2, ph = Math.acos(v);
      a.set([Math.sin(ph) * Math.cos(th) * 2200, Math.cos(ph) * 2200, Math.sin(ph) * Math.sin(th) * 2200], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3));
    const m = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
    const p = new THREE.Points(g, m); scene.add(p); return p;
  })();
  function setTime(date, lat, lon) {
    if (lat == null || lon == null) { lat = 37.9; lon = -date.getTimezoneOffset() / 4; } // 位置は使わず、時差からおおよその経度を出す
    const pos = SunCalc.getPosition(date, lat, lon);
    sunAlt = pos.altitude * 180 / Math.PI;
    const az = pos.azimuth, alt = Math.max(pos.altitude, 0.05);
    sun.position.set(-Math.sin(az) * Math.cos(alt), Math.sin(alt), Math.cos(az) * Math.cos(alt)).multiplyScalar(400);
    // 画面の奥（-z）側に太陽があるほうが湖がきれいに光るので、昼は少し奥へ寄せる
    sun.position.z = Math.min(sun.position.z, 120);
    water.material.uniforms.sunDirection.value.copy(sun.position).normalize();
  }
  const phaseCol = (key, dayHex) => {
    const a = sunAlt, out = new THREE.Color(dayHex), c = new THREE.Color();
    if (a >= 14) return out;
    if (a >= 5) return c.set(PHASE.golden[key]).lerp(out, sstep(5, 14, a));
    if (a >= -2) return c.set(PHASE.twilight[key]).lerp(new THREE.Color(PHASE.golden[key]), sstep(-2, 5, a));
    if (a >= -10) return c.set(PHASE.night[key]).lerp(new THREE.Color(PHASE.twilight[key]), sstep(-10, -2, a));
    return c.set(PHASE.night[key]);
  };

  // ---------------------------------------------------------------- camera stations
  const STATIONS = {
    home: { pos: [0, 30, 132], look: [0, -34, -460] },
    today: null, week: null, month: null
  };
  const cam = { px: 0, py: 30, pz: 132, uf: 70 };
  const camPos = new THREE.Vector3(0, 30, 132), camQuat = new THREE.Quaternion();
  const UP = { home: [0, 1, 0], map: [-1, 0, 0], bed: [0, 1, 0] };
  const qFrom = (pos, look, up) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(...pos), new THREE.Vector3(...look), new THREE.Vector3(...up).normalize()));
  camQuat.copy(qFrom(STATIONS.home.pos, STATIONS.home.look, UP.home));
  let fly = null;   // { p0, p1, q0, q1, u0, u1, t, dur, res }
  const easeIO = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function flyTo(st, dur) {
    return new Promise(res => { fly = { p0: camPos.clone(), p1: new THREE.Vector3(...st.pos), q0: camQuat.clone(), q1: qFrom(st.pos, st.look, st.up), u0: cam.uf, u1: st.uf, start: performance.now(), dur, res }; });
  }
  function jumpTo(st) { fly = null; camPos.set(...st.pos); camQuat.copy(qFrom(st.pos, st.look, st.up)); cam.uf = st.uf; }
  let insets = { left: 250, top: 170, right: 20, bottom: 20 };
  function stationFor(name, ins) {
    if (ins) insets = ins;
    const st = stationRaw(name); st.up = UP[name] || UP.home; return st;
  }
  function stationRaw(name) {
    if (name === 'home') return { ...STATIONS.home, uf: 70 };
    if (name === 'map') { // 浮いているブイがちょうど収まる高さまで上がる（左の列と上の札のぶん余白をとる）
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const b of buoys.values()) { if (b.userData.sinking || !b.visible) continue; const p = b.userData.home || b.position; x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
      if (!isFinite(x0)) { x0 = -40; x1 = 80; z0 = -200; z1 = 10; }
      // 空からは回して見る：画面の上＝陸（軽い）、下＝沖（重い）、左＝急ぐ（手前 +z）、右＝余裕（奥）
      const w = innerWidth, hgt = innerHeight, leftPx = insets.left, topPx = insets.top;
      const spanH = Math.max(60, z1 - z0) + 40, spanV = Math.max(60, x1 - x0) + 40;
      const fracW = (w - leftPx - insets.right) / w, fracH = (hgt - topPx - insets.bottom) / hgt, tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const h = Math.max(spanV / (2 * tanV * fracH), spanH / (2 * tanV * camera.aspect * fracW));
      const visW = 2 * h * tanV * camera.aspect, visH = 2 * h * tanV;
      const cz = (z0 + z1) / 2 + visW * (leftPx / w) / 2, cx = (x0 + x1) / 2 - visH * (topPx / hgt) / 2;
      return { pos: [cx + 0.5, h, cz], look: [cx, 0, cz], uf: 70 };
    }
    const top = heapSlot(0, Math.max(1, heapN)), H = top.y - PILE.y;
    // 引いて、山の全体とまわりの湖底が見えるように
    return { pos: [PILE.x + 6, Math.min(-3, PILE.y + H + 24), Math.min(FRONT - 2, PILE.z + 44 + H * 0.6)], look: [PILE.x, PILE.y + H * 0.35, PILE.z - 4], uf: 150 };
  }
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  addEventListener('pointermove', e => { pointer.x = e.clientX / innerWidth * 2 - 1; pointer.y = e.clientY / innerHeight * 2 - 1; });

  // ---------------------------------------------------------------- resize / loop
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // 縦長の画面では引いて全体を入れる
    camera.fov = w / h < 1 ? 58 : 42;
    camera.updateProjectionMatrix();
    precMat.uniforms.uPR.value = renderer.getPixelRatio() * h / 800;
  }
  addEventListener('resize', resize); resize();

  const listeners = [];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let clock = 0, last = performance.now();
  const v3 = new THREE.Vector3();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!reduce.matches) clock += dt;
    for (const k in wx) wx[k] += (wxTarget[k] - wx[k]) * Math.min(1, dt * 1.2);

    // カメラ
    pointer.sx += (pointer.x - pointer.sx) * Math.min(1, dt * 1.5); pointer.sy += (pointer.y - pointer.sy) * Math.min(1, dt * 1.5);
    if (fly) { // 位置と向きを同時に、なめらかに
      const k = Math.min(1, (now - fly.start) / 1000 / fly.dur), e = easeIO(k); // 実時間で進める（コマ落ちしても長さは同じ）
      camPos.lerpVectors(fly.p0, fly.p1, e); camQuat.slerpQuaternions(fly.q0, fly.q1, e); cam.uf = lerp(fly.u0, fly.u1, e);
      if (k >= 1) { const r = fly.res; fly = null; r(); }
    }
    cam.px = camPos.x; cam.py = camPos.y; cam.pz = camPos.z;
    const mapK = sstep(60, 220, cam.py), sway = 1 - mapK; // 空から見るときはカーソルで揺らさない
    camera.position.set(cam.px + pointer.sx * 1.2 * sway, cam.py - pointer.sy * 0.6 * sway, cam.pz);
    camera.quaternion.copy(camQuat);
    camera.rotateY(-pointer.sx * 0.012 * sway); camera.rotateX(-pointer.sy * 0.006 * sway);
    // 空から見るときは手前の世界をつなぎ、断面は消す
    const extK = sstep(36, 70, cam.py);
    extGroup.visible = extK > 0.01;
    cut.visible = rim.visible = skirt.visible = extK < 0.99;
    water.visible = extK < 0.5;
    cut.material.opacity = 1;
    extWaterMat.color.copy(water.material.uniforms.waterColor.value).multiplyScalar(0.95);
    const inside = sstep(FRONT + 1, FRONT - 3, cam.pz) * sstep(0.5, -2, cam.py);

    // 空と霧（天気と、水の中かどうか）
    const grey = Math.min(1, wx.cloud * 0.9 + wx.fog * 0.5);
    const night = 1 - sstep(-10, 2, sunAlt);
    skyU.top.value.copy(phaseCol('top', skyTop.getHex())).lerp(tmpC.set(0x9aa6ae).multiplyScalar(1 - night * 0.8), grey);
    skyU.bot.value.copy(phaseCol('bot', skyBot.getHex())).lerp(tmpC.set(0xc4cacd).multiplyScalar(1 - night * 0.8), grey);
    const fogAbove = phaseCol('fog', baseFog.getHex()).lerp(tmpC.set(0xb7bec2).multiplyScalar(1 - night * 0.75), grey);
    stars.material.opacity = night * (1 - grey) * (1 - inside);
    fog.color.copy(fogAbove).lerp(tmpC.set(0x123842), inside);
    fog.near = lerp(lerp(120, 20, wx.fog), 2, inside); fog.far = lerp(lerp(1250, 240, wx.fog + wx.rain * 0.3), cam.uf, inside);
    scene.background = inside > 0.5 ? fog.color : null;
    sky.visible = inside < 0.95;
    const day = sstep(-6, 12, sunAlt);
    hemi.intensity = lerp(0.42, lerp(1.5, 1.1, grey), day);
    hemi.color.set(0x8fa6c8).lerp(tmpC.set(0xdbe9f2), day);
    sun.intensity = lerp(1.7, 0.5, grey) * sstep(-3, 10, sunAlt);
    sun.color.set(0xffb27a).lerp(tmpC.set(0xfff2e2), sstep(2, 20, sunAlt));
    water.material.uniforms.sunColor.value.set(0x9a9890).multiplyScalar(lerp(0.25, 1, day));
    for (const b of buoys.values()) b.userData.lamp.material.emissiveIntensity = (hovered === b.userData.id ? 3.2 : 1.4) * (1 + night * 1.6);
    water.material.uniforms.waterColor.value.copy(waterCol).lerp(tmpC.set(0x5d7478), grey * 0.6);
    water.material.uniforms.time.value = clock * (0.25 + wx.wind * 0.6);
    water.material.uniforms.distortionScale.value = 0.45 + wx.wind * 1.2 + wx.rain * 1.2;
    cutU.uTime.value = clock;
    cutU.uTop.value.set(0x6fa6a8).multiplyScalar(lerp(0.3, 1, day) * (1 - grey * 0.25));
    cutU.uDeep.value.set(0x0f2d38).multiplyScalar(lerp(0.45, 1, day));
    precMat.uniforms.uT.value = clock; precMat.uniforms.uRain.value = wx.rain > 0.3 ? 1 : 0; precMat.uniforms.uSnow.value = wx.snow;
    prec.visible = (wx.rain > 0.05 || wx.snow > 0.05) && inside < 0.5;
    prec.position.set(camera.position.x, 0, camera.position.z - 30);
    for (const m of mists) { m.visible = cam.py < 120; m.position.x += m.userData.speed * dt * (0.5 + wx.wind); if (m.position.x > 260) m.position.x = -260; m.lookAt(camera.position.x, m.position.y, camera.position.z); m.material.opacity = 0.45 + wx.fog * 0.4; m.material.color.copy(fog.color).lerp(tmpC.set(0xffffff), 0.55 * day); }

    // ブイ
    for (const b of buoys.values()) {
      const u = b.userData;
      if (u.sinking) {
        u.sinkT += dt;
        const t = u.sinkT;
        if (t < 0.35) { b.position.y = -0.2 * t / 0.35; b.rotation.z = 0.3 * t / 0.35; }
        else {
          const k = (t - 0.35) / 3.4;
          b.position.y = lerp(-0.2, (u.land || pileTop()).y, Math.pow(Math.min(1, k), 1.3)); b.scale.setScalar(lerp(b.scale.x, 2.4, dt * 0.8));
          const kk = Math.min(1, k), tp = u.land || (u.land = pileTop()); b.position.x = lerp(u.sinkFrom.x, tp.x, kk * kk); b.position.z = lerp(u.sinkFrom.z, tp.z, kk * kk);
          b.rotation.z = 0.3 + k * 1.6; b.rotation.x = k * 0.8;
          if (!u.bubbled && t > 0.5) { u.bubbled = true; bubbles(b.position); }
          if (k >= 1) u.done();
        }
        continue;
      }
      if (u.target) { b.position.lerp(u.target, Math.min(1, dt * 1.5)); if (b.position.distanceTo(u.target) < 0.05) delete u.target; }
      if (u.base) b.scale.setScalar(u.base * (1 + sstep(60, 220, cam.py) * 1.6)); // 空から見るときは大きく
      const amp = 0.08 + wx.wind * 0.12;
      b.position.y = Math.sin(clock * 0.9 + u.ph) * amp;
      if (u.nudge) { u.nudge = Math.max(0, u.nudge - dt * 1.6); }
      b.rotation.z = Math.sin(clock * 0.7 + u.ph) * (0.04 + wx.wind * 0.06) + (u.nudge ? Math.sin(clock * 22) * 0.3 * u.nudge : 0);
      b.rotation.x = Math.cos(clock * 0.6 + u.ph) * 0.03;
    }
    updateAlerts(dt);
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i]; f.t += dt;
      if (f.kind === 'wake') { const s = 1 + f.t * 3; f.m.scale.set(s, 1, s); f.m.material.opacity = Math.max(0, 0.5 * (1 - f.t / 1.4)); if (f.t > 1.4) { buoyRoot.remove(f.m); fx.splice(i, 1); } continue; }
      if (f.kind === 'ring') { if (f.t < 0) continue; const s = 1 + f.t * 4; f.m.scale.set(s, 1, s); f.m.material.opacity = Math.max(0, 0.8 * (1 - f.t / 1.6)); if (f.t > 1.6) { buoyRoot.remove(f.m); fx.splice(i, 1); } }
      else if (f.kind === 'drop') { f.v.y -= 14 * dt; f.m.position.addScaledVector(f.v, dt); if (f.m.position.y < 0) { buoyRoot.remove(f.m); fx.splice(i, 1); } }
      else { f.m.position.addScaledVector(f.v, dt); f.m.position.x += Math.sin(f.t * 6 + i) * 0.01; if (f.m.position.y > -0.3 || f.t > 6) { buoyRoot.remove(f.m); fx.splice(i, 1); } }
    }
    renderer.render(scene, camera);

    // ラベルの位置（画面の座標）を外に渡す
    const pts = [];
    for (const [id, b] of buoys) {
      if (b.userData.sinking || !b.visible) continue;
      v3.copy(b.position); v3.y += 1.5 * b.scale.y; v3.project(camera);
      if (v3.z > 1) continue;
      pts.push({ id, x: (v3.x + 1) / 2 * canvas.clientWidth, y: (1 - v3.y) / 2 * canvas.clientHeight, sec: b.userData.sec, dist: camera.position.distanceTo(b.position) });
    }
    listeners.forEach(fn => fn(pts, { inside }));
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    setTasks, sink, setSunk, flyTo, jumpTo, setSeason, setWeather, setAlerts, setTime, pick, setHover, STATIONS, stationFor, cam, camera,
    onFrame: fn => listeners.push(fn),
    get sunkCount() { return heapN; },
    get sunAlt() { return sunAlt; }
  };
}
