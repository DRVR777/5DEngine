// particle_system.js — 5DEngine GPU-friendly particle emitters
// All emitters use instanced meshes (THREE.InstancedMesh) for performance.
// Emitter types: fire, sparks, smoke, impact, muzzle, portal, rain_splash
//
// API (window.ParticleSystem):
//   init(THREE, scene)             — call once after scene is ready
//   emit(type, pos, opts)          — spawn burst at position
//   addEmitter(type, pos, opts)    — continuous emitter, returns id
//   removeEmitter(id)              — stop continuous emitter
//   tick(dt)                       — call every frame

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ParticleSystem = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  let _THREE = null;
  let _scene = null;

  // ---- Particle pool ----
  // Each emitter gets its own InstancedMesh pool of MAX_PARTICLES particles.
  // Dead particles sit at scale(0) off-screen; alive ones are updated each frame.

  const MAX_PER_EMITTER = 256;

  const _emitters = new Map();   // id → EmitterState
  let _nextId = 1;

  const _dummy = null;   // set after THREE is ready

  // Preset configs
  const PRESETS = {
    fire: {
      count: 64,
      color:    [0xff5500, 0xff8800, 0xffcc00],
      size:     0.18,
      sizeDecay: 0.6,
      life:     0.9,
      speed:    3.5,
      spread:   0.6,
      gravity:  2.0,
      fadeOut:  true,
      shape:    "sphere",
    },
    sparks: {
      count: 48,
      color:    [0xffd166, 0xffffff, 0xff8800],
      size:     0.06,
      sizeDecay: 0.2,
      life:     0.6,
      speed:    5.0,
      spread:   1.8,
      gravity:  -12.0,
      fadeOut:  true,
      shape:    "point",
    },
    smoke: {
      count: 32,
      color:    [0x334455, 0x445566, 0x556677],
      size:     0.35,
      sizeDecay: -0.5,   // grows over time
      life:     2.2,
      speed:    1.0,
      spread:   0.4,
      gravity:  -0.8,
      fadeOut:  true,
      shape:    "sphere",
    },
    impact: {
      count: 24,
      color:    [0xffffff, 0xffd166, 0xff8800],
      size:     0.08,
      sizeDecay: 1.2,
      life:     0.3,
      speed:    4.0,
      spread:   2.0,
      gravity:  -9.0,
      fadeOut:  true,
      shape:    "point",
    },
    muzzle: {
      count: 12,
      color:    [0xffffff, 0xffd166],
      size:     0.12,
      sizeDecay: 2.0,
      life:     0.08,
      speed:    3.0,
      spread:   0.4,
      gravity:  0,
      fadeOut:  true,
      shape:    "sphere",
    },
    portal: {
      count: 48,
      color:    [0x00ccff, 0x8800ff, 0x00ffaa],
      size:     0.12,
      sizeDecay: 0.0,
      life:     1.4,
      speed:    1.5,
      spread:   1.2,
      gravity:  -0.5,
      fadeOut:  true,
      shape:    "ring",   // spiral outward
    },
    rain_splash: {
      count: 16,
      color:    [0x88aacc, 0xaabbdd],
      size:     0.05,
      sizeDecay: 0.8,
      life:     0.25,
      speed:    1.8,
      spread:   0.8,
      gravity:  -6.0,
      fadeOut:  true,
      shape:    "flat",
    },
  };

  function _rnd(a, b) { return a + Math.random() * (b - a); }
  function _pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function _makeParticleMesh(preset) {
    const geo = preset.shape === "point"
      ? new _THREE.SphereGeometry(0.5, 4, 3)
      : preset.shape === "flat"
      ? new _THREE.PlaneGeometry(1, 1)
      : new _THREE.SphereGeometry(0.5, 6, 4);

    const mat = new _THREE.MeshBasicMaterial({
      color: _pick(preset.color),
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
    });

    const mesh = new _THREE.InstancedMesh(geo, mat, MAX_PER_EMITTER);
    mesh.frustumCulled = false;
    mesh.count = MAX_PER_EMITTER;
    _scene.add(mesh);
    return mesh;
  }

  function _spawnParticle(state, idx, pos, preset, burstDir) {
    const p = state.particles[idx];
    p.alive = true;
    p.life  = preset.life + _rnd(-0.1, 0.1) * preset.life;
    p.age   = 0;
    p.x = pos.x; p.y = pos.y; p.z = pos.z;

    // Velocity
    let vx, vy, vz;
    if (preset.shape === "ring") {
      const angle = Math.random() * Math.PI * 2;
      vx = Math.cos(angle) * preset.speed;
      vz = Math.sin(angle) * preset.speed;
      vy = _rnd(0, preset.speed * 0.5);
    } else {
      const spd = preset.speed * _rnd(0.5, 1.0);
      vx = _rnd(-1, 1) * preset.spread;
      vz = _rnd(-1, 1) * preset.spread;
      vy = (burstDir ? burstDir.y : 1.0) * spd + _rnd(0, spd * 0.3);
    }
    p.vx = vx; p.vy = vy; p.vz = vz;
    p.size = preset.size * _rnd(0.7, 1.3);
    p.color = _pick(preset.color);
  }

  const _mat4  = new (function () {})();  // placeholder; overwritten after init

  function _tick(dt) {
    if (!_THREE) return;
    const dummy = new _THREE.Object3D();
    const col   = new _THREE.Color();

    for (const [, state] of _emitters) {
      const preset  = state.preset;
      let needsUpdate = false;

      // Continuous emitter: spawn N particles per second
      if (state.continuous) {
        state.spawnAcc = (state.spawnAcc || 0) + dt * preset.count;
        while (state.spawnAcc >= 1) {
          state.spawnAcc -= 1;
          // find a dead slot
          const dead = state.particles.findIndex(p => !p.alive);
          if (dead >= 0) _spawnParticle(state, dead, state.pos, preset, null);
        }
      }

      // Update particles
      for (let i = 0; i < MAX_PER_EMITTER; i++) {
        const p = state.particles[i];
        if (!p.alive) {
          dummy.scale.setScalar(0);
          dummy.updateMatrix();
          state.mesh.setMatrixAt(i, dummy.matrix);
          continue;
        }
        p.age += dt;
        if (p.age >= p.life) {
          p.alive = false;
          dummy.scale.setScalar(0);
          dummy.updateMatrix();
          state.mesh.setMatrixAt(i, dummy.matrix);
          needsUpdate = true;
          continue;
        }
        const t = p.age / p.life;
        // Physics
        p.vy += preset.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        // Size
        const decay = preset.sizeDecay * t;
        const sz = Math.max(0.001, p.size * (1 - (preset.sizeDecay > 0 ? decay : 0)) * (preset.sizeDecay < 0 ? (1 + Math.abs(preset.sizeDecay) * t) : 1));
        // Opacity
        const opacity = preset.fadeOut ? Math.max(0, 1 - t * t) : 1;

        dummy.position.set(p.x, p.y, p.z);
        dummy.scale.setScalar(sz);
        dummy.updateMatrix();
        state.mesh.setMatrixAt(i, dummy.matrix);
        col.setHex(p.color);
        state.mesh.setColorAt(i, col);
        if (state.mesh.material.opacity !== undefined) {
          state.mesh.material.opacity = opacity;
        }
        needsUpdate = true;
      }

      if (needsUpdate) {
        state.mesh.instanceMatrix.needsUpdate = true;
        if (state.mesh.instanceColor) state.mesh.instanceColor.needsUpdate = true;
      }

      // Clean up finished one-shot emitters
      if (!state.continuous && state.particles.every(p => !p.alive)) {
        _scene.remove(state.mesh);
        state.mesh.geometry.dispose();
        state.mesh.material.dispose();
        _emitters.delete(state.id);
      }
    }
  }

  function _makeState(type, pos, opts, continuous) {
    const basePreset = PRESETS[type] || PRESETS.impact;
    const preset = Object.assign({}, basePreset, opts || {});
    const particles = Array.from({ length: MAX_PER_EMITTER }, () => ({
      alive: false, age: 0, life: 0,
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
      size: 0, color: 0,
    }));
    const mesh = _makeParticleMesh(preset);
    const id = _nextId++;
    const state = {
      id, type, preset, particles, mesh, continuous,
      pos: pos ? { x: pos.x, y: pos.y, z: pos.z } : { x:0, y:0, z:0 },
      spawnAcc: 0,
    };
    _emitters.set(id, state);
    return state;
  }

  function init(THREE, scene) {
    _THREE = THREE;
    _scene = scene;
  }

  // One-shot burst at position
  function emit(type, pos, opts) {
    if (!_THREE || !_scene) return;
    const preset = Object.assign({}, PRESETS[type] || PRESETS.impact, opts || {});
    const state = _makeState(type, pos, opts, false);
    const count = Math.min(preset.count, MAX_PER_EMITTER);
    for (let i = 0; i < count; i++) _spawnParticle(state, i, pos, preset, opts && opts.dir);
    return state.id;
  }

  // Continuous emitter — call removeEmitter(id) to stop
  function addEmitter(type, pos, opts) {
    if (!_THREE || !_scene) return -1;
    return _makeState(type, pos, opts, true).id;
  }

  function removeEmitter(id) {
    const state = _emitters.get(id);
    if (!state) return;
    _scene.remove(state.mesh);
    state.mesh.geometry.dispose();
    state.mesh.material.dispose();
    _emitters.delete(id);
  }

  function setEmitterPos(id, pos) {
    const state = _emitters.get(id);
    if (!state) return;
    state.pos.x = pos.x; state.pos.y = pos.y; state.pos.z = pos.z;
  }

  return { init, emit, addEmitter, removeEmitter, setEmitterPos, tick: _tick, PRESETS };
});
