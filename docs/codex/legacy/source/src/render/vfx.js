// vfx.js — lightweight in-world visual effects (sphere particles, casings, damage numbers, shockwaves)
// Distinct from particle_system.js (which uses InstancedMesh for high-count emitters).
// Call Vfx.init(THREE, scene, camera) once after scene is ready, then Vfx.tick(dt) every frame.

let _THREE = null, _scene = null, _camera = null;

// Sphere particles
let _pGeo, _pMatYellow, _pMatOrange, _pMatRed, _pMatCyan, _pMatWhite, _pMatsMap;
const _particles = [], _pPool = [];

// Shell casings
let _shellGeo, _shellMat;
const _casings = [];
const _CASING_MAX = 40;

// Damage numbers
const _dmgNums = [];

// Shockwaves
let _swGeo, _swBaseMat;
const _shockwaves = [];

// Muzzle flash
let _muzzleLight;
let _muzzleLightT = 0;

// Enemy grenade warning ring geometry (used externally — exported for direct use)
export let warnRingGeo = null;
export let warnRingMat = null;

export function init(THREE, scene, camera) {
  _THREE = THREE; _scene = scene; _camera = camera;

  _pGeo       = new THREE.SphereGeometry(0.06, 4, 4);
  _pMatYellow = new THREE.MeshBasicMaterial({ color: 0xffee00 });
  _pMatOrange = new THREE.MeshBasicMaterial({ color: 0xff6600 });
  _pMatRed    = new THREE.MeshBasicMaterial({ color: 0xff2244 });
  _pMatCyan   = new THREE.MeshBasicMaterial({ color: 0x00ccff });
  _pMatWhite  = new THREE.MeshBasicMaterial({ color: 0xffffff });
  _pMatsMap   = { yellow: _pMatYellow, orange: _pMatOrange, red: _pMatRed, cyan: _pMatCyan, white: _pMatWhite };

  _shellGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.065, 5);
  _shellMat = new THREE.MeshBasicMaterial({ color: 0xccaa33 });

  _swGeo     = new THREE.TorusGeometry(1, 0.07, 6, 40);
  _swBaseMat = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.85, depthWrite: false });

  _muzzleLight = new THREE.PointLight(0xffcc44, 0, 8);
  scene.add(_muzzleLight);

  warnRingGeo = new THREE.TorusGeometry(3.2, 0.09, 6, 36);
  warnRingGeo.rotateX(Math.PI / 2);
  warnRingMat = new THREE.MeshBasicMaterial({ color: 0xff2200, transparent: true, opacity: 0.75, depthWrite: false });
}

export function spawnParticles(x, y, z, count, colorKey, speed, lifetime) {
  const mat = _pMatsMap[colorKey] || _pMatYellow;
  for (let i = 0; i < count; i++) {
    const mesh = _pPool.length ? _pPool.pop() : new _THREE.Mesh(_pGeo, mat);
    mesh.material = mat;
    mesh.position.set(x, y, z);
    mesh.scale.setScalar(1);
    mesh.visible = true;
    _scene.add(mesh);
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    const spd   = speed * (0.4 + Math.random() * 0.6);
    _particles.push({
      mesh,
      vx: Math.sin(phi) * Math.cos(theta) * spd,
      vy: (Math.random() * 0.5 + 0.5) * spd,
      vz: Math.sin(phi) * Math.sin(theta) * spd,
      life: lifetime, maxLife: lifetime,
    });
  }
}

export function ejectCasing(x, y, z, yaw) {
  if (_casings.length >= _CASING_MAX) { const old = _casings.shift(); _scene.remove(old.mesh); }
  const mesh = new _THREE.Mesh(_shellGeo, _shellMat.clone());
  mesh.position.set(x, y, z);
  _scene.add(mesh);
  const ejectAng = yaw + Math.PI * 0.5 + (Math.random() - 0.5) * 0.3;
  _casings.push({
    mesh,
    vx: Math.sin(ejectAng) * (2 + Math.random()),
    vy: 2.5 + Math.random() * 1.5,
    vz: Math.cos(ejectAng) * (2 + Math.random()),
    life: 1.8, bounced: false,
  });
}

export function spawnDamageNumber(worldX, worldY, worldZ, text, color) {
  const layer = document.getElementById("dmgNumLayer");
  if (!layer) return;
  const el = document.createElement("div");
  el.textContent = text;
  el.style.cssText = `position:absolute;font-family:ui-monospace,'Cascadia Code',Consolas,monospace;font-weight:bold;font-size:14px;color:${color};text-shadow:0 1px 3px #000a;pointer-events:none;user-select:none;white-space:nowrap;`;
  layer.appendChild(el);
  _dmgNums.push({ el, wx: worldX, wy: worldY, wz: worldZ, riseY: 0, life: 1.0 });
}

export function spawnShockwave(u, v) {
  const mesh = new _THREE.Mesh(_swGeo, _swBaseMat.clone());
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(u, 0.08, v);
  _scene.add(mesh);
  _shockwaves.push({ mesh, maxR: 5, t: 0, dur: 0.55 });
}

export function triggerMuzzleFlash(x, y, z) {
  _muzzleLight.position.set(x, y, z);
  _muzzleLight.intensity = 4;
  _muzzleLightT = 0.06;
}

export function getMuzzleLight() { return _muzzleLight; }
export function getShockwaves() { return _shockwaves; }

export function getCounts() {
  return {
    particles: _particles.length,
    particlePool: _pPool.length,
    casings: _casings.length,
    damageNumbers: _dmgNums.length,
    shockwaves: _shockwaves.length,
  };
}

export function tick(dt) {
  // Particles
  for (let i = _particles.length - 1; i >= 0; i--) {
    const p = _particles[i];
    p.life -= dt;
    if (p.life <= 0) { _scene.remove(p.mesh); _pPool.push(p.mesh); _particles.splice(i, 1); continue; }
    p.vx *= 0.88; p.vz *= 0.88; p.vy -= 22 * dt;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    p.mesh.scale.setScalar(p.life / p.maxLife);
  }
  // Damage numbers
  for (let i = _dmgNums.length - 1; i >= 0; i--) {
    const n = _dmgNums[i];
    n.life -= dt * 1.4; n.riseY += dt * 2.0;
    if (n.life <= 0) { n.el.remove(); _dmgNums.splice(i, 1); continue; }
    const v = new _THREE.Vector3(n.wx, n.wy + n.riseY, n.wz);
    v.project(_camera);
    if (v.z > 1) { n.el.style.display = "none"; continue; }
    n.el.style.left = ((v.x * 0.5 + 0.5) * window.innerWidth) + "px";
    n.el.style.top  = ((-v.y * 0.5 + 0.5) * window.innerHeight) + "px";
    n.el.style.opacity = Math.max(0, n.life).toFixed(2);
    n.el.style.display = "block";
  }
  // Shell casings
  for (let i = _casings.length - 1; i >= 0; i--) {
    const c = _casings[i];
    c.life -= dt;
    if (c.life <= 0) { _scene.remove(c.mesh); _casings.splice(i, 1); continue; }
    c.vy -= 9.8 * dt;
    c.mesh.position.x += c.vx * dt; c.mesh.position.y += c.vy * dt; c.mesh.position.z += c.vz * dt;
    c.mesh.rotation.z += dt * 18;
    if (!c.bounced && c.mesh.position.y <= 0.03) {
      c.mesh.position.y = 0.03; c.vy = Math.abs(c.vy) * 0.35; c.vx *= 0.6; c.vz *= 0.6; c.bounced = true;
    }
    c.mesh.material.opacity = Math.min(1, c.life / 0.4);
    c.mesh.material.transparent = c.life < 0.4;
  }
  // Shockwaves
  for (let i = _shockwaves.length - 1; i >= 0; i--) {
    const sw = _shockwaves[i];
    sw.t += dt;
    const pct = Math.min(1, sw.t / sw.dur);
    if (pct >= 1) { _scene.remove(sw.mesh); _shockwaves.splice(i, 1); continue; }
    sw.mesh.scale.setScalar(sw.maxR * pct);
    sw.mesh.material.opacity = 0.85 * (1 - pct);
  }
  // Muzzle flash fade
  if (_muzzleLightT > 0) {
    _muzzleLightT -= dt;
    _muzzleLight.intensity = Math.max(0, (_muzzleLightT / 0.06) * 4);
    if (_muzzleLightT <= 0) _muzzleLight.intensity = 0;
  }
}

export const Vfx = { init, tick, spawnParticles, ejectCasing, spawnDamageNumber, spawnShockwave, triggerMuzzleFlash, getMuzzleLight, getShockwaves, getCounts };
export default Vfx;
