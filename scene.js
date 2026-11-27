// The lake, mountains, yacht, sky, weather and underwater world, drawn in 3D with three.js (the older standalone scene)
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { Water } from 'three/addons/objects/Water.js';
import { ParametricGeometry } from 'three/addons/geometries/ParametricGeometry.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  EffectComposer, RenderPass, EffectPass, BloomEffect, SMAAEffect, ToneMappingEffect, ToneMappingMode,
  VignetteEffect, Effect
} from 'postprocessing';

const Env = window.LakeEnv;
const stage = document.getElementById('stage');
const canvas = document.getElementById('scene');
const section = document.getElementById('dive');
const reduce = matchMedia('(prefers-reduced-motion: reduce)');

// ---------------------------------------------------------------- renderer
const renderer = new THREE.WebGLRenderer({ canvas, powerPreference: 'high-performance', antialias: false, stencil: false, depth: true });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 30000);
const camOther = camera.clone();

// ---------------------------------------------------------------- noise (JS)
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
function fbm(x, y, o = 5) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; } return s; }
function ridged(x, y, o = 6) {
  let s = 0, a = 0.5, f = 1, w = 1;
  for (let i = 0; i < o; i++) { let n = 1 - Math.abs(vnoise(x * f, y * f) * 2 - 1); n *= n * w; w = Math.min(1, n * 1.8); s += n * a; f *= 2.1; a *= 0.5; }
  return s;
}
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------- terrain height
const LAKE = new THREE.Vector2(0, -220);
function heightAt(x, z) {
  const dx = x - LAKE.x, dz = z - LAKE.y, r = Math.hypot(dx, dz), ang = Math.atan2(dz, dx);
  const rl = 640 + 220 * (fbm(Math.cos(ang) * 1.6 + 5, Math.sin(ang) * 1.6 + 5, 4) - 0.5) * 2;
  if (r < rl) {
    const t = r / rl;
    return -38 * Math.pow(1 - t * t, 0.55) + 2.2 * (fbm(x * 0.03, z * 0.03, 3) - 0.5) - 0.8;
  }
  const e = r - rl;
  const foot = Math.min(e * 0.05, 18) + 14 * fbm(x * 0.004, z * 0.004, 3) * sstep(0, 200, e);
  // raise the mountains at the back (across the lake)
  const front = sstep(0.2, -0.9, Math.sin(ang)) * 0.6 + 0.55;
  const m = sstep(150, 900, e);
  const wx2 = x + (fbm(x * 0.0008, z * 0.0008, 3) - 0.5) * 900, wz2 = z + (fbm(x * 0.0008 + 9, z * 0.0008 + 4, 3) - 0.5) * 900;
  const rr = ridged(wx2 * 0.00095 + 3.1, wz2 * 0.00095 + 1.7, 8);
  const peaks = (Math.pow(rr, 1.1) * 600 + fbm(x * 0.003, z * 0.003, 5) * 110) * m * front;
  return foot + peaks;
}

// ---------------------------------------------------------------- season colors
const SEASON = {
  spring: { veg: [[0.30, 0.46, 0.20], [0.42, 0.56, 0.26]], bloom: [0.86, 0.66, 0.72], snowLine: 360, water: 0x1a5466 },
  summer: { veg: [[0.09, 0.22, 0.08], [0.14, 0.30, 0.10]], bloom: null, snowLine: 760, water: 0x0f526e },
  autumn: { veg: [[0.62, 0.30, 0.09], [0.74, 0.50, 0.14]], bloom: [0.48, 0.16, 0.08], snowLine: 430, water: 0x234c58 },
  winter: { veg: [[0.24, 0.23, 0.19], [0.30, 0.28, 0.23]], bloom: null, snowLine: 170, water: 0x2a4a5c }
};

function colorFor(season, x, y, z, ny, snowShift) {
  const S = SEASON[season];
  const n = fbm(x * 0.02 + 11, z * 0.02 + 7, 3), n2 = vnoise(x * 0.11, z * 0.11);
  if (y < -0.6) { // lake bed sand
    const k = 0.85 + 0.25 * n;
    return [0.62 * k, 0.56 * k, 0.43 * k];
  }
  if (y < 3) return [0.45 + 0.1 * n, 0.42 + 0.08 * n, 0.36 + 0.06 * n]; // pebbles on the shore
  const rock = [0.34 + 0.12 * n2, 0.32 + 0.1 * n2, 0.30 + 0.09 * n2];
  const vegLine = 260 + 120 * n;
  const steep = sstep(0.82, 0.62, ny);
  let c;
  if (y < vegLine) {
    const v = S.veg[0].map((a, i) => lerp(a, S.veg[1][i], n2));
    c = S.bloom && n > 0.62 ? v.map((a, i) => lerp(a, S.bloom[i], (n - 0.62) * 2.2)) : v;
    c = c.map((a, i) => lerp(a, rock[i], Math.max(steep, sstep(vegLine - 60, vegLine, y))));
  } else c = rock;
  const snowLine = S.snowLine - snowShift + 80 * (n - 0.5);
  const snow = sstep(snowLine - 70, snowLine + 70, y + 90 * (n - 0.5)) * sstep(0.45, 0.7, ny);
  return c.map(a => lerp(a, 0.9, snow));
}

// ---------------------------------------------------------------- shared uniforms + caustics
const U = { time: { value: 0 }, caus: { value: 0 } };
const GLSL_NOISE = `
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y); }
float fbm3(vec2 p){ float s = 0., a = .5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 3; i++){ s += a * vn(p); p = m * p; a *= .5; } return s; }
float caus(vec2 p, float t){
  vec2 w = p + vec2(fbm3(p * .7 + t * .12), fbm3(p * .7 - t * .1 + 3.)) * 1.6;
  float a = vn(w * 2. + vec2(t * .35, 0.));
  float b = vn(w * 2.3 - vec2(0., t * .3) + 7.);
  return pow(clamp(1. - abs(a - b) * 3.2, 0., 1.), 7.);
}
`;
function withCaustics(mat, detail = false) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = U.time; sh.uniforms.uCaus = U.caus;
    sh.vertexShader = 'varying vec3 vWPos;\n' + sh.vertexShader.replace('#include <project_vertex>',
      `#include <project_vertex>
      vec4 wp4 = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        wp4 = instanceMatrix * wp4;
      #endif
      vWPos = (modelMatrix * wp4).xyz;`);
    if (detail) sh.fragmentShader = sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        float dn = fbm3(vWPos.xz * .045), dn2 = vn(vWPos.xz * .5), st = vn(vec2(vWPos.y * .12, vWPos.x * .004 + vWPos.z * .004));
        diffuseColor.rgb *= .74 + .4 * dn + .14 * (dn2 - .5) + .16 * (st - .5);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          float e = .08;
          vec2 q = vWPos.xz * .06;
          float hC = vn(q) + .5 * vn(q * 2.1), hX = vn(q + vec2(e, 0.)) + .5 * vn((q + vec2(e, 0.)) * 2.1), hZ = vn(q + vec2(0., e)) + .5 * vn((q + vec2(0., e)) * 2.1);
          vec2 q2 = vWPos.xz * .35;
          float gC = vn(q2), gX = vn(q2 + vec2(e, 0.)), gZ = vn(q2 + vec2(0., e));
          vec3 bw = vec3(-(hX - hC) / e * .55 - (gX - gC) / e * .14, 0., -(hZ - hC) / e * .55 - (gZ - gC) / e * .14);
          normal = normalize(normal + (viewMatrix * vec4(bw, 0.)).xyz);
        }`);
    sh.fragmentShader = 'uniform float uTime; uniform float uCaus; varying vec3 vWPos;\n' + GLSL_NOISE + sh.fragmentShader.replace(
      '#include <fog_fragment>',
      `float cDepth = smoothstep(0.3, -0.8, vWPos.y) * exp(vWPos.y * 0.035) * exp(-length(vWPos - cameraPosition) * 0.045);
       if (uCaus > 0.001 && cDepth > 0.002) gl_FragColor.rgb += vec3(0.55, 0.85, 1.0) * caus(vWPos.xz * 0.32, uTime) * uCaus * cDepth * 0.55;
       #include <fog_fragment>`);
  };
  return mat;
}

// ---------------------------------------------------------------- sky + sun
const sky = new Sky(); sky.scale.setScalar(20000); scene.add(sky);
const envSky = new Sky(); envSky.scale.setScalar(20000);
const envScene = new THREE.Scene(); envScene.add(envSky);
const sun = new THREE.Vector3();
const SUN_EL = 24, SUN_AZ = 245;
sun.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - SUN_EL), THREE.MathUtils.degToRad(SUN_AZ));
for (const s of [sky, envSky]) s.material.uniforms.sunPosition.value.copy(sun);
const pmrem = new THREE.PMREMGenerator(renderer);
let envRT = null;
function refreshEnv() {
  for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG', 'cloudCoverage', 'cloudDensity'])
    envSky.material.uniforms[k].value = sky.material.uniforms[k].value;
  if (envRT) envRT.dispose();
  envRT = pmrem.fromScene(envScene);
  scene.environment = envRT.texture;
}

const sunLight = new THREE.DirectionalLight(0xfff1df, 3.2);
sunLight.position.copy(sun).multiplyScalar(200);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
Object.assign(sunLight.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 500 });
sunLight.shadow.bias = -0.0004;
scene.add(sunLight, sunLight.target);
const hemi = new THREE.HemisphereLight(0xcfe3f5, 0x3b3a30, 0.9);
scene.add(hemi);

// ---------------------------------------------------------------- water
const normalsTex = new THREE.TextureLoader().load(
  'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/textures/waternormals.jpg',
  t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; });
const water = new Water(new THREE.PlaneGeometry(20000, 20000), {
  textureWidth: 512, textureHeight: 512, waterNormals: normalsTex, sunDirection: sun.clone(),
  sunColor: 0xffffff, waterColor: SEASON.winter.water, distortionScale: 2.6, fog: true
});
water.rotation.x = -Math.PI / 2;
water.material.uniforms.size.value = 2.2;
scene.add(water);

// the surface seen from underwater
const surfaceUnder = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.ShaderMaterial({
  uniforms: { uTime: U.time, uN: { value: normalsTex }, uSun: { value: sun }, uBright: { value: 1 },
              uFogC: { value: new THREE.Color() }, uFogD: { value: 0.05 } },
  vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform float uTime; uniform sampler2D uN; uniform vec3 uSun; uniform float uBright; uniform vec3 uFogC; uniform float uFogD;
  varying vec3 vW;
  void main(){
    vec3 v = normalize(vW - cameraPosition);
    vec2 p = vW.xz * .05;
    vec3 n = texture2D(uN, p + vec2(uTime * .02, uTime * .013)).xyz + texture2D(uN, p * 1.7 - vec2(uTime * .017, -uTime * .021)).xyz - 1.;
    n = normalize(vec3(n.x, 2.4, n.z));
    float up = v.y + n.x * .12 + n.z * .08;
    float win = smoothstep(.6, .72, up);
    vec3 deep = vec3(.03, .17, .24);
    vec3 skyc = vec3(.72, .9, 1.) * uBright;
    vec3 col = mix(deep * (1. + .6 * n.x), skyc, win);
    vec3 rs = normalize(vec3(uSun.x * .75, uSun.y, uSun.z * .75));
    col += vec3(1., .97, .9) * pow(max(dot(normalize(v + vec3(n.x, 0., n.z) * .15), rs), 0.), 60.) * 6. * uBright;
    float d = length(vW - cameraPosition);
    col = mix(uFogC, col, exp(-d * uFogD * .55));
    gl_FragColor = vec4(col, 1.);
  }`,
  side: THREE.FrontSide
}));
surfaceUnder.rotation.x = Math.PI / 2;
surfaceUnder.position.y = -0.03;
surfaceUnder.visible = false;
scene.add(surfaceUnder);

// ---------------------------------------------------------------- terrain
const TER_SIZE = 7200, TER_SEG = 300;
const terGeo = new THREE.PlaneGeometry(TER_SIZE, TER_SIZE, TER_SEG, TER_SEG);
terGeo.rotateX(-Math.PI / 2);
const PATCH = { x0: -80, x1: 80, z0: -110, z1: 50 };
{
  const pos = terGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + LAKE.x, z = pos.getZ(i) + LAKE.y;
    let y = heightAt(x, z);
    if (x > PATCH.x0 - 30 && x < PATCH.x1 + 30 && z > PATCH.z0 - 30 && z < PATCH.z1 + 30) y -= 1.2;
    pos.setXYZ(i, x, y, z);
  }
  terGeo.computeVertexNormals();
}
// bake terrain shading (darker hollows and mountain shadows from the sun) into the vertices
const terShade = new Float32Array(terGeo.attributes.position.count);
function bakeTerrainLight() {
  const N = TER_SEG + 1, cell = TER_SIZE / TER_SEG, pos = terGeo.attributes.position;
  const hg = new Float32Array(N * N);
  for (let i = 0; i < pos.count; i++) hg[i] = pos.getY(i);
  const H = (ix, iz) => hg[Math.max(0, Math.min(N - 1, iz)) * N + Math.max(0, Math.min(N - 1, ix))];
  const sx = sun.x, sz = sun.z, hl = Math.hypot(sx, sz), dx = sx / hl, dz = sz / hl, rise = sun.y / hl;
  for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) {
    const i = iz * N + ix, h = hg[i];
    let avg = 0, c = 0;
    for (let r = 2; r <= 6; r += 2) for (const [ox, oz] of [[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r], [r, -r], [-r, r]]) { avg += H(ix + ox, iz + oz); c++; }
    avg /= c;
    const ao = Math.max(0.45, Math.min(1.08, 0.82 + (h - avg) / 160));
    let lit = 1;
    for (let k = 1; k < 70; k++) {
      const t = k * 1.5;
      const hh = H(Math.round(ix + dx * t), Math.round(iz + dz * t));
      const ry = h + rise * t * cell;
      if (hh > ry + 2) { lit = 0.42; break; }
    }
    terShade[i] = ao * lit;
  }
}
const terColors = { cur: new Float32Array(terGeo.attributes.position.count * 3) };
terGeo.setAttribute('color', new THREE.BufferAttribute(terColors.cur, 3));
const terrain = new THREE.Mesh(terGeo, withCaustics(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 }), true));
terrain.receiveShadow = false;
scene.add(terrain);

// lake bed nearby (fine sand ripples)
const patchGeo = new THREE.PlaneGeometry(PATCH.x1 - PATCH.x0, PATCH.z1 - PATCH.z0, 220, 220);
patchGeo.rotateX(-Math.PI / 2);
{
  const pos = patchGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + (PATCH.x0 + PATCH.x1) / 2, z = pos.getZ(i) + (PATCH.z0 + PATCH.z1) / 2;
    const rip = 0.09 * Math.sin(x * 1.6 + z * 0.4 + fbm(x * 0.15, z * 0.15, 3) * 6) + 0.25 * (fbm(x * 0.4, z * 0.4, 3) - 0.5);
    pos.setXYZ(i, x, heightAt(x, z) + rip, z);
  }
  patchGeo.computeVertexNormals();
}
const patchColors = new Float32Array(patchGeo.attributes.position.count * 3);
patchGeo.setAttribute('color', new THREE.BufferAttribute(patchColors, 3));
const patch = new THREE.Mesh(patchGeo, withCaustics(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })));
scene.add(patch);

function bakeColors(geo, season, snowShift, out) {
  const pos = geo.attributes.position, nor = geo.attributes.normal, sh = geo === terGeo ? terShade : null;
  for (let i = 0; i < pos.count; i++) {
    const c = colorFor(season, pos.getX(i), pos.getY(i), pos.getZ(i), nor.getY(i), snowShift);
    const f = sh ? sh[i] : 1;
    out[i * 3] = c[0] * f; out[i * 3 + 1] = c[1] * f; out[i * 3 + 2] = c[2] * f;
  }
  return out;
}
const colorAnim = { from: null, to: null, from2: null, to2: null, t: 1 };
function setSeasonColors(season, snowShift, instant) {
  const to = bakeColors(terGeo, season, snowShift, new Float32Array(terColors.cur.length));
  const to2 = bakeColors(patchGeo, season, snowShift, new Float32Array(patchColors.length));
  if (instant) { terColors.cur.set(to); patchColors.set(to2); terGeo.attributes.color.needsUpdate = patchGeo.attributes.color.needsUpdate = true; colorAnim.t = 1; return; }
  Object.assign(colorAnim, { from: terColors.cur.slice(), to, from2: patchColors.slice(), to2, t: 0 });
}
function stepColors(dt) { // dt: real seconds
  if (colorAnim.t >= 1) return;
  colorAnim.t = Math.min(1, colorAnim.t + dt / 1.6);
  const e = colorAnim.t * colorAnim.t * (3 - 2 * colorAnim.t);
  const a = colorAnim.from, b = colorAnim.to, c = terColors.cur;
  for (let i = 0; i < c.length; i++) c[i] = a[i] + (b[i] - a[i]) * e;
  const a2 = colorAnim.from2, b2 = colorAnim.to2;
  for (let i = 0; i < patchColors.length; i++) patchColors[i] = a2[i] + (b2[i] - a2[i]) * e;
  terGeo.attributes.color.needsUpdate = patchGeo.attributes.color.needsUpdate = true;
}

bakeTerrainLight();

// rocks
{
  const rockMat = withCaustics(new THREE.MeshStandardMaterial({ color: 0x5c5a52, roughness: 1 }), true);
  for (let i = 0; i < 34; i++) {
    const g = new THREE.IcosahedronGeometry(1, 3);
    const p = g.attributes.position, sx = hash(i, 3) * 40, sz = hash(i, 4) * 40;
    for (let k = 0; k < p.count; k++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, k);
      const d = 0.75 + 0.5 * fbm(v.x * 1.4 + sx, v.y * 1.4 + v.z * 1.1 + sz, 4);
      v.multiplyScalar(d); v.y *= 0.62; p.setXYZ(k, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, rockMat);
    const x = lerp(PATCH.x0 + 10, PATCH.x1 - 10, hash(i, 1)), z = lerp(PATCH.z0 + 10, PATCH.z1 - 20, hash(i, 2));
    const s = 0.5 + Math.pow(hash(i, 5), 2) * 3.4;
    m.scale.setScalar(s); m.position.set(x, heightAt(x, z) + s * 0.15, z); m.rotation.y = hash(i, 6) * 6;
    scene.add(m);
  }
}

// water plants
const GRASS_N = 1400;
const grassGeo = new THREE.PlaneGeometry(0.07, 1, 1, 6); grassGeo.translate(0, 0.5, 0);
const grassMat = new THREE.MeshStandardMaterial({ color: 0x48602e, roughness: 0.8, side: THREE.DoubleSide });
grassMat.onBeforeCompile = sh => {
  sh.uniforms.uTime = U.time;
  sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>',
    `#include <begin_vertex>
     vec3 ip = vec3(instanceMatrix[3]);
     float hh = position.y;
     transformed.x += sin(uTime * 1.1 + ip.x * .45 + ip.z * .3) * .28 * hh * hh;
     transformed.z += cos(uTime * .8 + ip.z * .5) * .12 * hh * hh;`);
};
const grass = new THREE.InstancedMesh(grassGeo, grassMat, GRASS_N);
{
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  let k = 0;
  for (let i = 0; k < GRASS_N && i < GRASS_N * 4; i++) {
    const x = lerp(PATCH.x0 + 4, PATCH.x1 - 4, hash(i, 21)), z = lerp(PATCH.z0 + 4, PATCH.z1 - 4, hash(i, 22));
    if (fbm(x * 0.05, z * 0.05, 3) < 0.5) continue;
    const h = 0.5 + hash(i, 23) * 1.6;
    e.set((hash(i, 24) - 0.5) * 0.3, hash(i, 25) * 6.3, (hash(i, 26) - 0.5) * 0.3);
    m4.compose(new THREE.Vector3(x, heightAt(x, z) - 0.05, z), q.setFromEuler(e), new THREE.Vector3(1 + hash(i, 27), h, 1));
    grass.setMatrixAt(k++, m4);
  }
  grass.count = k;
}
scene.add(grass);

// ---------------------------------------------------------------- yacht
const yacht = new THREE.Group();
{
  const L = 10, B = 3.2, D = 0.95, F = 0.95;
  const halfW = u => u < 0.38 ? (B / 2) * (0.8 + 0.2 * u / 0.38) : (B / 2) * Math.max(0, 1 - Math.pow((u - 0.38) / 0.62, 2.1));
  const depth = u => D * Math.max(0.28, 1 - Math.pow(Math.abs(u - 0.48) / 0.62, 2));
  const sheer = u => F + 0.3 * u * u;
  const hullGeo = new ParametricGeometry((u, v, t) => {
    const a = (v - 0.5) * Math.PI, w = halfW(u), s = sheer(u);
    t.set(w * Math.sin(a), s - (s + depth(u)) * Math.pow(Math.cos(a), 1.5), (u - 0.5) * L);
  }, 80, 32);
  const hp = hullGeo.attributes.position, hc = new Float32Array(hp.count * 3);
  for (let i = 0; i < hp.count; i++) {
    const y = hp.getY(i);
    const c = y < 0.08 ? [0.04, 0.08, 0.16] : (y > 0.3 && y < 0.38) ? [0.05, 0.2, 0.45] : [0.92, 0.93, 0.94];
    hc.set(c, i * 3);
  }
  hullGeo.setAttribute('color', new THREE.BufferAttribute(hc, 3));
  const hullMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08, side: THREE.DoubleSide });
  const hull = new THREE.Mesh(hullGeo, hullMat);

  // deck
  const outline = new THREE.Shape();
  for (let i = 0; i <= 40; i++) { const u = i / 40; const p = [halfW(u) * 0.985, (u - 0.5) * L]; i ? outline.lineTo(...p) : outline.moveTo(...p); }
  for (let i = 40; i >= 0; i--) { const u = i / 40; outline.lineTo(-halfW(u) * 0.985, (u - 0.5) * L); }
  const deckGeo = new THREE.ShapeGeometry(outline); deckGeo.rotateX(Math.PI / 2);
  const dp = deckGeo.attributes.position;
  for (let i = 0; i < dp.count; i++) dp.setY(i, sheer(dp.getZ(i) / L + 0.5) - 0.03);
  deckGeo.computeVertexNormals();
  const deck = new THREE.Mesh(deckGeo, new THREE.MeshStandardMaterial({ color: 0xb08a5c, roughness: 0.75, side: THREE.DoubleSide }));

  // cabin
  const cabin = new THREE.Mesh(new RoundedBoxGeometry(2.1, 0.62, 3.3, 4, 0.22), new THREE.MeshPhysicalMaterial({ color: 0xf2f3f4, roughness: 0.3, clearcoat: 0.8 }));
  cabin.position.set(0, F + 0.3, -0.7);
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x0c1a24, roughness: 0.05, metalness: 0.2, clearcoat: 1 });
  for (const sx of [-1, 1]) {
    const g = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.18, 2.2), glassMat);
    g.position.set(sx * 1.06, F + 0.38, -0.7); yacht.add(g);
  }
  // railing
  const metal = new THREE.MeshStandardMaterial({ color: 0xc9ced3, metalness: 0.95, roughness: 0.25 });
  const railPts = [];
  for (let i = 2; i <= 36; i++) { const u = i / 40; railPts.push(new THREE.Vector3(halfW(u) * 0.93, sheer(u) + 0.6, (u - 0.5) * L)); }
  for (const sx of [1, -1]) {
    const curve = new THREE.CatmullRomCurve3(railPts.map(p => new THREE.Vector3(p.x * sx, p.y, p.z)));
    yacht.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 0.015, 5), metal));
    for (let i = 0; i < railPts.length; i += 5) {
      const p = railPts[i];
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6, 5), metal);
      st.position.set(p.x * sx, p.y - 0.3, p.z); yacht.add(st);
    }
  }
  // mast and boom
  const mastZ = 0.9, mastH = 13.5;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, mastH, 12), metal);
  mast.position.set(0, F + mastH / 2, mastZ);
  const boomL = 4.2;
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, boomL, 10), metal);
  boom.rotation.x = Math.PI / 2; boom.position.set(0, F + 1.45, mastZ - boomL / 2);
  // sail (a curved surface)
  const sailMat = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.85, side: THREE.DoubleSide });
  const main = new ParametricGeometry((u, v, t) => {
    const foot = boomL * 0.97, h0 = F + 1.5, H = mastH - 1.0;
    const z = mastZ - u * foot * (1 - v) - u * 0.25 * Math.sin(Math.PI * v) * (1 - v);
    const camber = 0.32 * Math.sin(Math.PI * u) * (1 - 0.7 * v);
    t.set(camber, h0 + v * H, z);
  }, 24, 32);
  const jib = new ParametricGeometry((u, v, t) => {
    const top = new THREE.Vector3(0, F + mastH * 0.82, mastZ + 0.05);
    const tack = new THREE.Vector3(0, sheer(0.98) + 0.15, L / 2 - 0.3);
    const clew = new THREE.Vector3(0.25, F + 0.6, mastZ - 1.2);
    const luff = top.clone().lerp(tack, 1 - v);
    const leech = top.clone().lerp(clew, 1 - v);
    const p = luff.lerp(leech, u);
    p.x += 0.42 * Math.sin(Math.PI * u) * (1 - v * 0.8);
    t.copy(p);
  }, 24, 32);
  const mainS = new THREE.Mesh(main, sailMat), jibS = new THREE.Mesh(jib, sailMat);
  // rigging
  const wire = new THREE.LineBasicMaterial({ color: 0x2b2f33 });
  const top = new THREE.Vector3(0, F + mastH, mastZ);
  const wires = [[top, new THREE.Vector3(0, sheer(1) + 0.1, L / 2)], [top, new THREE.Vector3(0, F + 0.4, -L / 2 + 0.1)],
                 [top, new THREE.Vector3(B / 2 * 0.95, F + 0.05, mastZ)], [top, new THREE.Vector3(-B / 2 * 0.95, F + 0.05, mastZ)]];
  for (const [a, b] of wires) yacht.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), wire));
  // keel
  const keel = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.5, 1.4), new THREE.MeshStandardMaterial({ color: 0x0b1420, roughness: 0.5 }));
  keel.position.set(0, -D - 0.6, 0.1);
  yacht.add(hull, deck, cabin, mast, boom, mainS, jibS, keel);
  yacht.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
}
yacht.position.set(14, 0, -48);
yacht.rotation.y = 1.15;
scene.add(yacht);
sunLight.target = yacht;

// ---------------------------------------------------------------- underwater: light shafts, particles, fish
const shaftMat = new THREE.ShaderMaterial({
  uniforms: { uTime: U.time, uI: { value: 0 } },
  vertexShader: `varying vec2 vUv; varying float vSeed; void main(){ vUv = uv; vSeed = position.z;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xy, 0., 1.); }`,
  fragmentShader: `uniform float uTime; uniform float uI; varying vec2 vUv; varying float vSeed;
    ${GLSL_NOISE}
    void main(){
      float edge = pow(sin(vUv.x * 3.14159), 2.5);
      float fall = pow(vUv.y, 1.6) * smoothstep(1., .9, vUv.y);
      float flick = .55 + .45 * vn(vec2(vSeed * 7. + uTime * .25, vUv.y * 2.));
      float streak = .6 + .4 * vn(vec2(vUv.x * 6. + vSeed, uTime * .1));
      gl_FragColor = vec4(vec3(.6, .85, 1.), edge * fall * flick * streak * uI * .22);
    }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false
});
const shafts = new THREE.Group();
for (let i = 0; i < 22; i++) {
  const g = new THREE.PlaneGeometry(1.5 + hash(i, 31) * 3.5, 70, 1, 1);
  g.translate(0, -35, 0);
  const pz = g.attributes.position; for (let k = 0; k < pz.count; k++) pz.setZ(k, i * 1.37);
  const m = new THREE.Mesh(g, shaftMat);
  m.position.set(lerp(-40, 50, hash(i, 32)), 0, lerp(-90, 25, hash(i, 33)));
  m.rotation.z = -0.32 + (hash(i, 34) - 0.5) * 0.08;
  m.userData.spin = hash(i, 35) * 6;
  shafts.add(m);
}
shafts.visible = false;
scene.add(shafts);

const SNOW_N = 3000;
const snowGeo = new THREE.BufferGeometry();
{
  const a = new Float32Array(SNOW_N * 3);
  for (let i = 0; i < SNOW_N; i++) a.set([Math.random() * 40, Math.random() * 40, Math.random() * 40], i * 3);
  snowGeo.setAttribute('position', new THREE.BufferAttribute(a, 3));
}
const marine = new THREE.Points(snowGeo, new THREE.ShaderMaterial({
  uniforms: { uTime: U.time, uCam: { value: new THREE.Vector3() }, uPR: { value: 1 } },
  vertexShader: `uniform float uTime; uniform vec3 uCam; uniform float uPR; varying float vA;
    void main(){
      vec3 p = position + vec3(sin(uTime * .1 + position.y) * .6, -uTime * .12, cos(uTime * .08 + position.x) * .5);
      p = mod(p - uCam, 40.) - 20. + uCam;
      vec4 mv = modelViewMatrix * vec4(p, 1.);
      float d = -mv.z;
      vA = smoothstep(26., 6., d) * smoothstep(.5, 2., d);
      gl_PointSize = uPR * 26. / d;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `varying float vA; void main(){ float r = length(gl_PointCoord - .5); gl_FragColor = vec4(vec3(.78, .9, .95), smoothstep(.5, 0., r) * vA * .55); }`,
  transparent: true, depthWrite: false, fog: false
}));
marine.frustumCulled = false; marine.visible = false;
scene.add(marine);

const FISH_N = 90;
let fishGeo;
{
  const body = new THREE.SphereGeometry(1, 14, 10); body.scale(0.09, 0.13, 0.42);
  const tail = new THREE.ConeGeometry(0.12, 0.24, 4); tail.rotateX(Math.PI / 2); tail.scale(0.25, 1.1, 1); tail.translate(0, 0, -0.5);
  fishGeo = mergeGeometries([body.toNonIndexed(), tail.toNonIndexed()]);
  fishGeo.computeVertexNormals();
}
const fish = new THREE.InstancedMesh(fishGeo, new THREE.MeshStandardMaterial({ color: 0x9fb2bc, metalness: 0.7, roughness: 0.32 }), FISH_N);
const fishData = Array.from({ length: FISH_N }, (_, i) => ({ o: new THREE.Vector3(hash(i, 41) - 0.5, (hash(i, 42) - 0.5) * 0.6, hash(i, 43) - 0.5).multiplyScalar(7), ph: hash(i, 44) * 6, s: 0.8 + hash(i, 45) * 0.5 }));
fish.visible = false;
scene.add(fish);
function updateFish(t) {
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const c = (tt) => new THREE.Vector3(10 + Math.cos(tt * 0.09) * 16, -12 + Math.sin(tt * 0.13) * 4, -26 + Math.sin(tt * 0.09) * 14);
  const c0 = c(t), c1 = c(t + 0.3), dir = c1.clone().sub(c0).normalize();
  const look = new THREE.Matrix4();
  fishData.forEach((f, i) => {
    const p = c0.clone().add(f.o).add(new THREE.Vector3(Math.sin(t * 0.7 + f.ph) * 0.6, Math.sin(t * 0.5 + f.ph) * 0.3, Math.cos(t * 0.6 + f.ph) * 0.6));
    look.lookAt(new THREE.Vector3(), dir.clone().multiplyScalar(-1).add(new THREE.Vector3(0, 0, 0)), up);
    q.setFromRotationMatrix(look);
    q.multiply(new THREE.Quaternion().setFromAxisAngle(up, Math.sin(t * 6 + f.ph) * 0.12));
    m4.compose(p, q, new THREE.Vector3(f.s, f.s, f.s));
    fish.setMatrixAt(i, m4);
  });
  fish.instanceMatrix.needsUpdate = true;
}

// ---------------------------------------------------------------- weather particles (above water)
const RAIN_N = 6000;
const rainGeo = new THREE.BufferGeometry();
{
  const p = new Float32Array(RAIN_N * 2 * 3), e = new Float32Array(RAIN_N * 2);
  for (let i = 0; i < RAIN_N; i++) {
    const x = Math.random() * 60, y = Math.random() * 40, z = Math.random() * 60;
    p.set([x, y, z, x, y, z], i * 6); e.set([0, 1], i * 2);
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  rainGeo.setAttribute('aEnd', new THREE.BufferAttribute(e, 1));
}
const rainMat = new THREE.ShaderMaterial({
  uniforms: { uTime: U.time, uCam: { value: new THREE.Vector3() }, uAmt: { value: 0 }, uWind: { value: 0 } },
  vertexShader: `attribute float aEnd; uniform float uTime; uniform vec3 uCam; uniform float uAmt; uniform float uWind; varying float vA;
    void main(){
      vec3 vel = vec3(uWind * 6., -22., uWind * 2.);
      vec3 p = position + vel * uTime;
      p = mod(p - uCam + vec3(30., 8., 30.), vec3(60., 40., 60.)) - vec3(30., 8., 30.) + uCam;
      p -= vel * .035 * aEnd;
      float keep = step(fract(position.x * 7.13 + position.z * 3.7), uAmt);
      vA = keep;
      vec4 mv = modelViewMatrix * vec4(p, 1.);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `varying float vA; void main(){ if (vA < .5) discard; gl_FragColor = vec4(1.6, 1.7, 1.8, .35); }`,
  transparent: true, depthWrite: false
});
const rainLines = new THREE.LineSegments(rainGeo, rainMat); rainLines.frustumCulled = false;
scene.add(rainLines);

const FLAKE_N = 5000;
const flakeGeo = new THREE.BufferGeometry();
{
  const a = new Float32Array(FLAKE_N * 3);
  for (let i = 0; i < FLAKE_N; i++) a.set([Math.random() * 60, Math.random() * 40, Math.random() * 60], i * 3);
  flakeGeo.setAttribute('position', new THREE.BufferAttribute(a, 3));
}
const flakeMat = new THREE.ShaderMaterial({
  uniforms: { uTime: U.time, uCam: { value: new THREE.Vector3() }, uAmt: { value: 0 }, uWind: { value: 0 }, uPR: { value: 1 } },
  vertexShader: `uniform float uTime; uniform vec3 uCam; uniform float uAmt; uniform float uWind; uniform float uPR; varying float vA;
    void main(){
      vec3 p = position + vec3(uWind * 2.5 + sin(uTime * .7 + position.y) * .4, -1.6, cos(uTime * .5 + position.x) * .3) * uTime;
      p = mod(p - uCam + vec3(30., 8., 30.), vec3(60., 40., 60.)) - vec3(30., 8., 30.) + uCam;
      vA = step(fract(position.x * 5.17 + position.z * 2.3), uAmt);
      vec4 mv = modelViewMatrix * vec4(p, 1.);
      gl_PointSize = uPR * 60. / -mv.z;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `varying float vA; void main(){ if (vA < .5) discard; float r = length(gl_PointCoord - .5); gl_FragColor = vec4(2.4, 2.45, 2.5, smoothstep(.5, .15, r) * .95); }`,
  transparent: true, depthWrite: false
});
const flakes = new THREE.Points(flakeGeo, flakeMat); flakes.frustumCulled = false;
scene.add(flakes);

// petals and falling leaves
const LEAF_N = 260;
const leafGeo = new THREE.PlaneGeometry(0.07, 0.05);
const leaves = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ roughness: 0.7, side: THREE.DoubleSide }), LEAF_N);
leaves.frustumCulled = false;
const leafData = Array.from({ length: LEAF_N }, (_, i) => ({ p: new THREE.Vector3(Math.random() * 40 - 20, Math.random() * 12, Math.random() * 40 - 30),
  r: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6), v: 0.35 + Math.random() * 0.4, sp: Math.random() * 6, i }));
scene.add(leaves);
let leafKind = null;
function setLeafKind(season) {
  leafKind = season === 'spring' ? 'petal' : season === 'autumn' ? 'leaf' : null;
  const col = new THREE.Color();
  leafData.forEach((d, i) => {
    if (leafKind === 'petal') col.setRGB(0.95, 0.72 + hash(i, 61) * 0.1, 0.8);
    else col.set([0xc8642c, 0xb3432a, 0xd99a35, 0x8a5a2b][i % 4]);
    leaves.setColorAt(i, col);
  });
  if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
}
let leafAmt = 0;
function updateLeaves(dt, t) {
  const target = leafKind ? 1 : 0;
  leafAmt += (target - leafAmt) * Math.min(1, dt * 1.5);
  leaves.visible = leafAmt > 0.01 && !under;
  if (!leaves.visible) return;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  const size = leafKind === 'leaf' ? 1.5 : 1;
  for (const d of leafData) {
    d.p.y -= d.v * dt; d.p.x += (Math.sin(t * 0.8 + d.sp) * 0.6 + 0.4 + wx.wind) * dt; d.p.z += Math.cos(t * 0.6 + d.sp) * 0.3 * dt;
    d.r.x += dt * 1.3; d.r.y += dt * 0.7;
    if (d.p.y < 0) { d.p.y = 10 + Math.random() * 4; d.p.x = Math.random() * 40 - 20; d.p.z = Math.random() * 40 - 30; }
    const world = d.p.clone().add(new THREE.Vector3(camera.position.x, 0, camera.position.z - 6));
    const s = size * leafAmt * (1 - wx.rain * 0.8);
    m4.compose(world, q.setFromEuler(d.r), new THREE.Vector3(s, s, s));
    leaves.setMatrixAt(d.i, m4);
  }
  leaves.instanceMatrix.needsUpdate = true;
}

// ---------------------------------------------------------------- post processing
class SplitEffect extends Effect {
  constructor() {
    super('SplitEffect', `
      uniform sampler2D uOther; uniform float uLine; uniform float uT; uniform float uUnder; uniform float uExposure; uniform float uFlash; uniform float uGrey;
      void mainUv(inout vec2 uv){
        if (uUnder > .5) uv += vec2(sin(uv.y * 38. + uT * 1.3), cos(uv.x * 28. + uT * 1.1)) * .0012;
      }
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
        vec3 c = inputColor.rgb;
        float wave = uLine + .008 * sin(uv.x * 22. + uT * 2.2) + .004 * sin(uv.x * 57. - uT * 3.1);
        if (uLine > -.5) {
          if (uv.y < wave) {
            vec2 o = vec2(sin(uv.y * 40. + uT * 1.6), 0.) * .002;
            c = texture2D(uOther, uv + o).rgb;
          } else {
            c = mix(c, c * vec3(.9, .97, 1.), smoothstep(.06, 0., uv.y - wave));
          }
          float m = exp(-abs(uv.y - wave) * 420.);
          c = mix(c, vec3(2.2, 2.5, 2.7), m * .55);
          c *= 1. - .35 * exp(-max(wave - uv.y, 0.) * 60.) * step(uv.y, wave);
        }
        float lum = dot(c, vec3(.2126, .7152, .0722));
        c = mix(c, vec3(lum) * vec3(.96, .99, 1.03), uGrey * .7);
        c += vec3(.9, .95, 1.) * uFlash;
        outputColor = vec4(c * uExposure, inputColor.a);
      }`, {
      uniforms: new Map([['uOther', new THREE.Uniform(null)], ['uLine', new THREE.Uniform(-1)], ['uT', new THREE.Uniform(0)],
                         ['uUnder', new THREE.Uniform(0)], ['uExposure', new THREE.Uniform(1)], ['uFlash', new THREE.Uniform(0)], ['uGrey', new THREE.Uniform(0)]])
    });
  }
}
const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
const split = new SplitEffect();
const bloom = new BloomEffect({ intensity: 0.55, luminanceThreshold: 1.4, luminanceSmoothing: 0.2, mipmapBlur: true });
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new EffectPass(camera, split));
composer.addPass(new EffectPass(camera, bloom, new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }), new VignetteEffect({ offset: 0.3, darkness: 0.45 })));
composer.addPass(new EffectPass(camera, new SMAAEffect()));
let otherRT = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType });

// ---------------------------------------------------------------- above / below configuration
let under = false;
const fogAbove = new THREE.FogExp2(0xb9c7d3, 0.00016);
const fogUnder = new THREE.FogExp2(0x0d4a5e, 0.05);
scene.fog = fogAbove;
const bgUnder = new THREE.Color(0x0d4a5e);
function configure(isUnder) {
  under = isUnder;
  water.visible = !isUnder; sky.visible = !isUnder;
  surfaceUnder.visible = shafts.visible = marine.visible = fish.visible = isUnder;
  rainLines.visible = !isUnder && wx.rain > 0.01;
  flakes.visible = !isUnder && wx.snow > 0.01;
  scene.fog = isUnder ? fogUnder : fogAbove;
  scene.background = isUnder ? bgUnder : null;
  U.caus.value = isUnder ? (1 - wx.cloud * 0.75) : 0;
}

// ---------------------------------------------------------------- camera path (scroll)
const KEYS = [
  [0.00, [0, 3.2, 24], [4, 3.6, -90]],
  [0.08, [0, 1.7, 20], [4, 2.0, -90]],
  [0.14, [0, 0.45, 17], [4, 0.9, -90]],
  [0.22, [0, -1.6, 13], [4, 2.5, -60]],
  [0.40, [0, -5.5, 4], [6, -1.5, -60]],
  [0.60, [0, -13, -8], [8, -15, -60]],
  [0.80, [0, -21, -18], [9, -30, -60]],
  [1.00, [0, -27, -26], [6, -35, -56]]
];
function pathAt(p) {
  let i = 0;
  while (i < KEYS.length - 2 && p > KEYS[i + 1][0]) i++;
  const [p0, a0, b0] = KEYS[i], [p1, a1, b1] = KEYS[i + 1];
  const t = sstep(p0, p1, p);
  return { pos: new THREE.Vector3(...a0.map((v, k) => lerp(v, a1[k], t))), look: new THREE.Vector3(...b0.map((v, k) => lerp(v, b1[k], t))) };
}
const SPLIT0 = 0.14, SPLIT1 = 0.22;

// ---------------------------------------------------------------- state: season / weather
const wx = (({ label, ...v }) => v)(Env.target());
let season = null, snowShift = -1;
function applySeason(s, instant) {
  const shift = Math.round((wx.snow > 0.3 ? 120 : 0));
  if (s === season && shift === snowShift) return;
  season = s; snowShift = shift;
  setSeasonColors(s, shift, instant);
  setLeafKind(s);
}
let envTimer = 0, lastEnvKey = '';
function updateWeather(dt, realDt) {
  const tg = Env.target();
  for (const k in wx) wx[k] += (tg[k] - wx[k]) * Math.min(1, realDt * 1.6);
  const u = sky.material.uniforms;
  u.turbidity.value = 2.5 + wx.cloud * 8;
  u.rayleigh.value = 1.1 + wx.cloud * 1.8 + wx.fog;
  u.mieCoefficient.value = 0.004 + wx.fog * 0.02;
  u.mieDirectionalG.value = 0.8;
  u.cloudCoverage.value = 0.12 + wx.cloud * 0.8;
  u.cloudDensity.value = 0.25 + wx.cloud * 0.6;
  u.cloudSpeed.value = 0.00002 + wx.wind * 0.0001;
  u.showSunDisc.value = wx.cloud < 0.6 ? 1 : 0;
  sunLight.intensity = 2.4 * (1 - wx.cloud * 0.72);
  hemi.intensity = 0.9 + wx.cloud * 0.3;
  water.material.uniforms.sunColor.value.setScalar(1 - wx.cloud * 0.85);
  water.material.uniforms.distortionScale.value = 2.2 + wx.wind * 4 + wx.rain * 2;
  const fogCol = new THREE.Color().setRGB(0.70, 0.78, 0.86).lerp(new THREE.Color(0.56, 0.6, 0.64), wx.cloud * 0.8 + wx.thunder * 0.2).lerp(new THREE.Color(0.8, 0.82, 0.84), wx.fog);
  fogAbove.color.copy(fogCol);
  fogAbove.density = 0.00023 + wx.fog * 0.0045 + wx.rain * 0.0009 + wx.snow * 0.0012;
  rainMat.uniforms.uAmt.value = wx.rain; rainMat.uniforms.uWind.value = wx.wind;
  flakeMat.uniforms.uAmt.value = wx.snow; flakeMat.uniforms.uWind.value = wx.wind;
  shaftMat.uniforms.uI.value = 1 - wx.cloud * 0.8;
  surfaceUnder.material.uniforms.uBright.value = 1 - wx.cloud * 0.6;
  // rebuild the sky reflection once the weather has settled
  envTimer -= dt;
  const key = [wx.cloud, wx.fog].map(v => v.toFixed(2)).join();
  if (envTimer <= 0 && key !== lastEnvKey) { refreshEnv(); lastEnvKey = key; envTimer = 1.2; }
}

// ---------------------------------------------------------------- resize, input
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = camOther.aspect = w / h;
  camera.updateProjectionMatrix(); camOther.updateProjectionMatrix();
  otherRT.setSize(Math.round(w * renderer.getPixelRatio() * 0.6), Math.round(h * renderer.getPixelRatio() * 0.6));
  const pr = renderer.getPixelRatio();
  marine.material.uniforms.uPR.value = flakeMat.uniforms.uPR.value = pr * h / 800;
}
addEventListener('resize', resize);
const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
stage.addEventListener('pointermove', e => {
  const r = stage.getBoundingClientRect();
  mouse.x = (e.clientX - r.left) / r.width * 2 - 1; mouse.y = (e.clientY - r.top) / r.height * 2 - 1;
});

// ---------------------------------------------------------------- scroll
let target = 0, P = 0;
function readScroll() {
  if (window.LakeDepth) { target = Math.max(0, Math.min(1, window.LakeDepth())); return; }
  const r = section.getBoundingClientRect();
  target = Math.max(0, Math.min(1, -r.top / (section.offsetHeight - innerHeight)));
}
window.LakeScene = { get progress() { return P; } };

// ---------------------------------------------------------------- loop
let clock = 0, last = performance.now(), flashV = 0, nextBolt = 4;
function placeCamera(cam, pos, look) {
  cam.position.copy(pos);
  cam.lookAt(look.x + mouse.sx * 3, look.y - mouse.sy * 1.5, look.z);
}
function frame(now) {
  const realDt = Math.min(0.5, (now - last) / 1000);
  const dt = Math.min(0.05, realDt); last = now;
  if (!reduce.matches) clock += dt;
  U.time.value = clock;
  readScroll();
  P += (target - P) * (1 - Math.exp(-dt * 6));
  if (Math.abs(target - P) < 1e-4) P = target;
  mouse.sx += (mouse.x - mouse.sx) * Math.min(1, dt * 2); mouse.sy += (mouse.y - mouse.sy) * Math.min(1, dt * 2);

  updateWeather(dt, realDt);
  stepColors(realDt);
  // thunder
  flashV = Math.max(0, flashV - dt * 3);
  if (wx.thunder > 0.5) { nextBolt -= dt; if (nextBolt <= 0) { nextBolt = 4 + Math.random() * 7; flashV = 1; } }
  Env.flash = flashV;

  // yacht: rocks on the waves
  const heel = 0.05 + wx.wind * 0.12;
  yacht.position.y = -0.08 + Math.sin(clock * 0.8) * 0.09 * (1 + wx.wind);
  yacht.rotation.set(Math.sin(clock * 0.6) * 0.015 * (1 + wx.wind), 1.15, heel + Math.sin(clock * 0.5) * 0.025 * (1 + wx.wind));
  water.material.uniforms.time.value = clock * (0.35 + wx.wind * 0.5);

  const { pos, look } = pathAt(P);
  const inSplit = P > SPLIT0 && P < SPLIT1;
  const k = sstep(SPLIT0, SPLIT1, P);
  const isUnder = P >= SPLIT1;

  if (inSplit) {
    // draw the lower half (underwater) separately and composite it with the upper half (above water)
    const posU = pos.clone(); posU.y = Math.min(pos.y, -0.4);
    placeCamera(camOther, posU, look);
    configure(true);
    marine.material.uniforms.uCam.value.copy(posU);
    updateFish(clock);
    renderer.setRenderTarget(otherRT); renderer.render(scene, camOther); renderer.setRenderTarget(null);
    const posA = pos.clone(); posA.y = Math.max(pos.y, 0.35);
    placeCamera(camera, posA, look);
    configure(false);
    split.uniforms.get('uOther').value = otherRT.texture;
    split.uniforms.get('uLine').value = k;
  } else {
    placeCamera(camera, pos, look);
    configure(isUnder);
    split.uniforms.get('uLine').value = -1;
    if (isUnder) { marine.material.uniforms.uCam.value.copy(pos); updateFish(clock); }
  }
  rainMat.uniforms.uCam.value.copy(camera.position);
  flakeMat.uniforms.uCam.value.copy(camera.position);
  updateLeaves(dt, clock);
  shafts.children.forEach(m => { m.lookAt(camera.position.x, m.position.y, camera.position.z); m.rotateZ(-0.32); });
  const depthT = sstep(SPLIT1, 1, P);
  fogUnder.density = lerp(0.032, 0.05, depthT);
  fogUnder.color.setRGB(lerp(0.045, 0.006, depthT), lerp(0.24, 0.075, depthT), lerp(0.31, 0.12, depthT)).multiplyScalar(1 - wx.cloud * 0.35);
  bgUnder.copy(fogUnder.color);
  surfaceUnder.material.uniforms.uFogC.value.copy(fogUnder.color);
  surfaceUnder.material.uniforms.uFogD.value = fogUnder.density;
  if (under || inSplit) { sunLight.intensity *= 0.5; hemi.intensity *= 0.45; }
  split.uniforms.get('uT').value = clock;
  split.uniforms.get('uUnder').value = isUnder ? 1 : 0;
  split.uniforms.get('uExposure').value = (isUnder ? lerp(0.5, 0.75, depthT) : 0.3) * (1 - wx.cloud * 0.15);
  split.uniforms.get('uGrey').value = isUnder ? wx.cloud * 0.3 : Math.min(1, wx.cloud * 0.9 + wx.fog * 0.4);
  split.uniforms.get('uFlash').value = isUnder ? flashV * 0.05 : flashV * 0.35;

  composer.render(dt);
  window.dispatchEvent(new CustomEvent('lake:frame', { detail: { P } }));
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- start
resize();
configure(false);
applySeason(Env.auto.season, true);
refreshEnv();
window.LakeScene.setSeason = (s, instant) => applySeason(s, instant);
window.LakeScene.refreshSnow = () => { const s = season; season = null; applySeason(s); };
readScroll(); P = target;
requestAnimationFrame(frame);
document.documentElement.classList.add('ready');
