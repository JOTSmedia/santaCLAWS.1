/* SANTA CLAWS — 3D layer (Three.js r160, vendored)
   1. Hero: the key art becomes a lit 3D relief (depth from the image itself), with
      cursor/scroll-driven camera, a moving red key light, metallic glints and glowing eyes.
   2. World: a full-page 3D snowfall + rising embers that the camera travels through as you scroll.
   3. Cards: subtle 3D tilt on hover (desktop pointers only).
   Falls back silently to the existing 2D site when WebGL is unavailable. */
import * as THREE from '../vendor/three.module.min.js?v=17';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = matchMedia('(max-width: 999px)').matches || /iPhone|iPad|Android/i.test(navigator.userAgent);
const DPR = Math.min(devicePixelRatio || 1, isMobile ? 1 : 1.5);
const IMG = 'assets/santa-claws-hero.jpg?v=17';

function webglOK() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); }
  catch (e) { return false; }
}
if (!webglOK()) throw new Error('no-webgl'); // site stays on its 2D visuals

/* ---------- shared input ---------- */
const input = { mx: 0, my: 0, tx: 0, ty: 0, scroll: 0 };
addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse') return;
  input.tx = (e.clientX / innerWidth) * 2 - 1;
  input.ty = (e.clientY / innerHeight) * 2 - 1;
}, { passive: true });
addEventListener('scroll', () => { input.scroll = scrollY; }, { passive: true });
input.scroll = scrollY;

/* =========================================================
   1. HERO RELIEF
   ========================================================= */
function initHero() {
  const stage = document.getElementById('hero-stage');
  const canvas = document.getElementById('hero3d');
  if (!stage || !canvas) return null;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(DPR);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1672 / 941, 0.1, 100);
  const ASPECT = 1672 / 941;

  const seg = isMobile ? [180, 102] : [320, 180];
  const geo = new THREE.PlaneGeometry(ASPECT, 1, seg[0], seg[1]);

  const uniforms = {
    uMap: { value: null },
    uTime: { value: 0 },
    uDepth: { value: 0.11 },
    uLight: { value: new THREE.Vector3(0.2, 0.25, 0.6) },
    uReveal: { value: 0 },
    uDraw: { value: 0 },
    uOutline: { value: null },
    uTips: { value: [[0.689,0.0457,1],[0.5987,0.0861,1],[0.759,0.1658,1],[0.6148,0.1817,1],[0.3774,0.4102,0],[0.4007,0.1583,1],[0.2889,0.1637,1],[0.2656,0.1498,1],[0.6262,0.4697,0],[0.1459,0.0542,0],[0.8182,0.0829,1],[0.6687,0.4729,0],[0.3768,0.4612,0],[0.9109,0.0404,1],[0.3379,0.4091,0],[0.2608,0.0861,0],[0.744,0.4346,0],[0.3911,0.457,0],[0.1477,0.0903,0],[0.3086,0.118,0],[0.4324,0.458,0],[0.6124,0.4527,0],[0.6106,0.4857,0],[0.2524,0.0967,0],[0.6645,0.1615,1],[0.6394,0.492,0],[0.5933,0.424,0],[0.7715,0.1222,0],[0.82,0.1424,1],[0.6986,0.1594,1],[0.3923,0.4846,0],[0.7105,0.4761,0],[0.1172,0.1605,0],[0.4342,0.1605,1],[0.6531,0.492,0],[0.6944,0.4155,0]].map(a => new THREE.Vector3(a[0], a[1], a[2])) }, // icicle tips (z=0) and blood-drip tips (z=1), traced from the artwork
    uOBox: { value: new THREE.Vector4(0.4473684, 0.5257177, 0.1721573, 0.4633369) }, // u0,u1,v0,v1 of the outline texture
    uAspect: { value: ASPECT },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */`
      uniform sampler2D uMap; uniform float uDepth; uniform float uTime;
      varying vec2 vUv; varying float vH; varying vec3 vPos;
      float lum(vec3 c){ return dot(c, vec3(.299,.587,.114)); }
      float heightAt(vec2 uv){
        vec3 c = textureLod(uMap, uv, 4.0).rgb;            // blurred sample = smooth relief
        float l = smoothstep(.04, .72, lum(c));             // bright metal/frost comes forward
        float red = clamp(c.r - max(c.g, c.b), 0., 1.);     // blood-red claws a touch forward
        float center = 1. - smoothstep(.15, .62, distance(uv * vec2(1.25,1.), vec2(.625,.5)));
        return l * .8 + red * .5 + center * .35;
      }
      void main(){
        vUv = uv;
        float h = heightAt(uv);
        vH = h;
        vec3 p = position;
        float edge = smoothstep(0., .08, uv.x) * smoothstep(1., .92, uv.x) * smoothstep(0., .08, uv.y) * smoothstep(1., .92, uv.y);
        p.z += h * uDepth * edge;
        vPos = p;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uMap; uniform vec3 uLight; uniform float uTime; uniform float uReveal; uniform float uAspect; uniform float uDraw;
      uniform sampler2D uOutline; uniform vec4 uOBox; uniform vec3 uTips[36];
      varying vec2 vUv; varying float vH; varying vec3 vPos;
      float lum(vec3 c){ return dot(c, vec3(.299,.587,.114)); }
      float glowAt(vec2 uv, vec2 c, vec2 r){ vec2 d = (uv - c) / r; return exp(-dot(d,d)); }
      void main(){
        vec3 base = texture(uMap, vUv).rgb;
        // surface normal from the relief
        vec3 n = normalize(cross(dFdx(vPos), dFdy(vPos)));
        // fine detail normal from the sharp image for crisp metal texture
        float hl = lum(textureLod(uMap, vUv, 1.5).rgb);
        n = normalize(n + vec3(-dFdx(hl), -dFdy(hl), 0.) * 2.2);
        vec3 L = normalize(uLight - vPos);
        float diff = clamp(dot(n, L), 0., 1.);
        vec3 V = vec3(0., 0., 1.);
        vec3 H = normalize(L + V);
        float metal = smoothstep(.35, .85, lum(base));
        float spec = pow(clamp(dot(n, H), 0., 1.), 42.) * metal;
        // red key light + cool fill
        vec3 col = base * (.72 + .42 * diff);
        col += spec * vec3(1.0, .45, .38) * 1.35;
        float rim = pow(1. - clamp(n.z, 0., 1.), 2.) * .55;
        col += rim * vec3(.85, .12, .16) * metal;
        // glowing eyes (pulse + flicker)
        float t = uTime;
        float pulse = .72 + .28 * (.5 + .5 * sin(t * 2.2)) + .15 * sin(t * 11.) * step(.93, fract(t * .37)); // shared by both eyes
        vec2 r = vec2(.0085, .0045);
        float eyes = glowAt(vUv, vec2(.476, .87), r) + glowAt(vUv, vec2(.534, .87), r);
        float halo = glowAt(vUv, vec2(.476, .87), r * 2.4) + glowAt(vUv, vec2(.534, .87), r * 2.4);
        col += vec3(1., .12, .1) * eyes * 2.4 * pulse + vec3(.9, .05, .08) * halo * .32 * pulse;
        col += vec3(1., .85, .8) * pow(eyes, 3.) * .9 * pulse;
        // breathing red glow behind the claws/lettering
        float claw = glowAt(vUv, vec2(.5, .42), vec2(.36, .3));
        col += vec3(.55, .02, .06) * claw * (.12 + .08 * sin(t * 1.3)) * (1. - metal * .5);
        // red light tracing the real inside edge of the "A" in CLAWS (traced from the artwork; see assets/a-outline.png)
        {
          vec2 q = (vUv - uOBox.xz) / (uOBox.yw - uOBox.xz);
          if (q.x > 0. && q.x < 1. && q.y > 0. && q.y < 1.) {
            vec4 o = texture(uOutline, q);
            float d = (1. - o.r) * 7.;                       // distance to the outline, in artwork pixels
            float s = o.g;                                    // position along the outline (0..1, from the apex)
            float drawn = smoothstep(uDraw, uDraw - .03, s);  // draws on from the apex
            float core = exp(-pow(d / 1.1, 2.)) * step(.004, o.r);
            float glow = exp(-pow(d / 4.2, 2.)) * .5 * step(.004, o.r);
            float ds = abs(fract(s - t * .16) - .5);
            float spark = exp(-pow((.5 - ds) / .03, 2.));
            float beat = .75 + .25 * sin(t * 2.2);
            float k = drawn * (core * (1.1 + spark * 1.6) + glow * beat + spark * glow * 1.6);
            col += vec3(1., .08, .1) * k * 1.5 + vec3(1., .75, .7) * core * spark * drawn * .9;
          }
        }
        // animated icicles: a cold glint slides down the ice, and drops form at the tips and fall
        {
          float l0 = lum(base);
          float ice = smoothstep(.42, .7, l0) * smoothstep(-.02, .06, base.b - base.r) * step(vUv.y, .56) * step(.05, vUv.y);
          float glint = pow(max(0., sin(vUv.y * 140. + t * 3.2 + vUv.x * 40.)), 18.);
          col += vec3(.75, .9, 1.) * ice * glint * .55;
          for (int i = 0; i < 36; i++) {
            vec3 tp = uTips[i];
            float fi = float(i);
            float P = 3.2 + fract(fi * .371) * 3.4;           // each tip drips on its own rhythm
            float tau = mod(t + fract(fi * .618) * P, P);
            float grow = smoothstep(0., 1.3, tau);            // drop swells at the tip
            float fall = max(0., tau - 1.3);
            float dy = .5 * 2.2 * fall * fall;                // accelerates as it falls (uv units)
            vec2 c = vec2(tp.x, tp.y - .004 - dy);
            vec2 d = (vUv - c) * vec2(uAspect, 1.);
            d.y /= (1. + min(fall * 2.5, 1.4));               // stretches while falling
            float r = mix(.0025, .0065, grow);
            float drop = smoothstep(r, r * .35, length(d)) * (1. - smoothstep(.05, .11, dy));
            float hl = smoothstep(r * .55, 0., length(d - vec2(-.0018, .0020)));
            vec3 dc = tp.z > .5 ? vec3(.62, .02, .05) : vec3(.70, .82, .95);
            col = mix(col, dc + hl * .7, drop * .92);
            col += (tp.z > .5 ? vec3(.5, .02, .04) : vec3(.35, .45, .6)) * smoothstep(r * 2.6, r, length(d)) * (1. - smoothstep(.05, .11, dy)) * .35;
          }
        }
        // cinematic grade + reveal
        col = mix(vec3(lum(col)), col, 1.08);
        col *= smoothstep(0., 1., uReveal);
        // feather every edge so the artwork melts into the page instead of reading as a rectangle
        float fx = smoothstep(0., .16, vUv.x) * smoothstep(1., .84, vUv.x);
        float fy = smoothstep(0., .22, vUv.y) * smoothstep(1., .9, vUv.y);
        vec2 q = (vUv - vec2(.5, .52)) * vec2(1.05, 1.25);
        float vig = 1. - smoothstep(.42, .78, length(q));
        float a = fx * fy * mix(1., vig, .55);
        gl_FragColor = vec4(col * a, a);
        #include <colorspace_fragment>
      }`,
    extensions: { derivatives: true },
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.scale.setScalar(1.0); // edges are feathered by the stage mask, so no overscan needed
  scene.add(mesh);

  new THREE.TextureLoader().load('assets/a-outline.png?v=17', o => {
    o.colorSpace = THREE.NoColorSpace; o.generateMipmaps = false;
    o.minFilter = THREE.LinearFilter; o.magFilter = THREE.LinearFilter;
    uniforms.uOutline.value = o;
  });
  const tex = new THREE.TextureLoader().load(IMG, t => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    uniforms.uMap.value = t;
    document.documentElement.classList.add('hero3d-on');
  });

  function fit() {
    const r = stage.getBoundingClientRect();
    if (!r.width || !r.height) return;
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    // distance so the plane height (1) fills the view
    const fov = THREE.MathUtils.degToRad(camera.fov);
    camera.userData.dist = (0.5 / Math.tan(fov / 2)) * 1.1; // pulled back so the whole artwork (eyes included) stays in frame
    camera.updateProjectionMatrix();
  }
  fit();
  addEventListener('resize', fit);
  new ResizeObserver(fit).observe(stage);

  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(stage);

  const t0 = performance.now();
  return function frame(now) {
    if (!visible || !uniforms.uMap.value) return;
    const t = (now - t0) / 1000;
    uniforms.uTime.value = t;
    const loaded = document.body.classList.contains('loaded');
    uniforms.uReveal.value += ((loaded ? 1 : 0) - uniforms.uReveal.value) * 0.04;
    if (loaded && !camera.userData.drawStart) camera.userData.drawStart = t + 0.8;
    if (camera.userData.drawStart) uniforms.uDraw.value = Math.min(1.05, Math.max(0, (t - camera.userData.drawStart) / 3)); // A outline draws on over 3 s

    // idle sway on touch devices / when the mouse is still
    const idleX = Math.sin(t * .35) * .35, idleY = Math.cos(t * .27) * .25;
    const gx = isMobile ? idleX : input.tx, gy = isMobile ? idleY : input.ty;
    input.mx += (gx - input.mx) * 0.05;
    input.my += (gy - input.my) * 0.05;

    const r = stage.getBoundingClientRect();
    const sp = THREE.MathUtils.clamp(-r.top / Math.max(1, r.height), 0, 1); // 0 → 1 as the hero scrolls away
    const d = camera.userData.dist || 2;
    camera.position.set(input.mx * .07, -input.my * .045 - sp * .05, d * (1 - sp * .05));
    camera.lookAt(0, -sp * .02, 0);
    mesh.rotation.x = -sp * .22;
    uniforms.uDepth.value = (isMobile ? .08 : .11) * (1 + sp * .6);
    uniforms.uLight.value.set(input.mx * .9, -input.my * .6 + .2, .55);

    renderer.render(scene, camera);
  };
}

/* =========================================================
   2. WORLD — 3D snow + embers, camera travels with scroll
   ========================================================= */
function initWorld() {
  const canvas = document.getElementById('world3d');
  if (!canvas) return null;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
  renderer.setPixelRatio(DPR);
  renderer.setSize(innerWidth, innerHeight, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 200);
  camera.position.set(0, 0, 10);

  const BOX = { x: 70, y: 80, z: 70 };
  function field(count, opts) {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3), seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - .5) * BOX.x;
      pos[i * 3 + 1] = (Math.random() - .5) * BOX.y;
      pos[i * 3 + 2] = -Math.random() * BOX.z + 6;
      seed[i] = Math.random();
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: {
        uTime: { value: 0 }, uScroll: { value: 0 }, uDpr: { value: DPR },
        uSpeed: { value: opts.speed }, uSize: { value: opts.size }, uColor: { value: new THREE.Color(opts.color) },
        uH: { value: BOX.y }, uWind: { value: 0 }, uAlpha: { value: opts.alpha }, uEmber: { value: opts.ember ? 1 : 0 },
      },
      vertexShader: /* glsl */`
        uniform float uTime, uScroll, uDpr, uSpeed, uSize, uH, uWind, uEmber;
        attribute float aSeed; varying float vA; varying float vSeed;
        void main(){
          vec3 p = position;
          float depth = clamp((10. - p.z) / 70., 0., 1.);           // 0 near → 1 far
          float par = mix(1.0, .25, depth);                         // near layers move more with scroll
          float fall = uTime * uSpeed * (.6 + aSeed * .8);
          float y = p.y - fall + uScroll * .012 * par;
          y = mod(y + uH * .5, uH) - uH * .5;
          p.y = y;
          p.x += sin(uTime * (.3 + aSeed) + aSeed * 40.) * (.6 + uEmber * .9) + uWind * par;
          p.z += cos(uTime * .2 + aSeed * 20.) * .4;
          vec4 mv = modelViewMatrix * vec4(p, 1.);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uSize * (.5 + aSeed) * uDpr * (22. / -mv.z);
          vA = (1. - depth * .65) * (uEmber > .5 ? (.55 + .45 * sin(uTime * 6. + aSeed * 60.)) : 1.);
          vSeed = aSeed;
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uColor; uniform float uAlpha; uniform float uEmber;
        varying float vA; varying float vSeed;
        void main(){
          vec2 c = gl_PointCoord - .5;
          float d = length(c);
          float a = smoothstep(.5, .0, d);
          a = uEmber > .5 ? pow(a, 2.2) : pow(a, 1.4);
          vec3 col = uEmber > .5 ? mix(uColor, vec3(1., .78, .5), pow(a, 3.)) : uColor;
          gl_FragColor = vec4(col, a * vA * uAlpha);
        }`,
    });
    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false;
    scene.add(pts);
    return m;
  }
  const snow = field(isMobile ? 900 : 2200, { speed: 1.1, size: 2.4, color: '#dfe7ec', alpha: .75 });
  const embers = field(isMobile ? 90 : 220, { speed: -1.6, size: 3.2, color: '#ff3a2a', alpha: .9, additive: true, ember: true });

  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  });

  const t0 = performance.now();
  let wind = 0, lastScroll = scrollY;
  return function frame(now) {
    const t = (now - t0) / 1000;
    // scroll velocity adds a gust; camera drifts through the field as you descend the page
    const v = scrollY - lastScroll; lastScroll = scrollY;
    wind += (THREE.MathUtils.clamp(v * .05, -2, 2) - wind) * .05;
    for (const m of [snow, embers]) {
      m.uniforms.uTime.value = t;
      m.uniforms.uScroll.value = input.scroll;
      m.uniforms.uWind.value = wind;
    }
    const doc = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    const p = input.scroll / doc;
    camera.position.x = input.mx * 1.2;
    camera.position.y = -input.my * .8;
    camera.position.z = 10 - p * 14;            // dolly forward through the snow as the story progresses
    camera.rotation.z = Math.sin(t * .1) * .015;
    renderer.render(scene, camera);
  };
}

/* =========================================================
   3. CARD TILT (desktop pointers)
   ========================================================= */
function initTilt() {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  document.querySelectorAll('.tilt3d').forEach(el => {
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      const ang = Math.min(9, Math.hypot(x, y) * 16);
      el.style.setProperty('--tilt', `${-y} ${x} 0 ${ang}deg`);
      el.style.setProperty('--gx', `${(x + .5) * 100}%`);
      el.style.setProperty('--gy', `${(y + .5) * 100}%`);
      el.classList.add('tilting');
    });
    el.addEventListener('pointerleave', () => { el.style.setProperty('--tilt', '0 1 0 0deg'); el.classList.remove('tilting'); });
  });
}

/* ---------- boot ---------- */
let heroFrame = null, worldFrame = null;
try { heroFrame = initHero(); } catch (e) { console.warn('hero3d disabled', e); }
try { worldFrame = initWorld(); if (worldFrame) document.documentElement.classList.add('world3d-on'); } catch (e) { console.warn('world3d disabled', e); }
initTilt();

let running = true;
document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) requestAnimationFrame(loop); });
function loop(now) {
  if (!running) return;
  heroFrame && heroFrame(now);
  worldFrame && worldFrame(now);
  if (!reduced) requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
if (reduced) { // render a couple of still frames, then stop
  setTimeout(() => requestAnimationFrame(loop), 600);
  setTimeout(() => requestAnimationFrame(loop), 5200);
}
