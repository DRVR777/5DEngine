// particles.js — pure data particle system. Renderer reads `particles`
// and draws each as a sprite/billboard; this module owns physics + lifetime.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAParticles = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Emitter presets — each preset is a function (pos, dir) → array of particles.
  const PRESETS = {
    muzzleFlash: (pos, dir) => {
      const out = [];
      const baseDir = dir || { x: 0, y: 0, z: 1 };
      for (let i = 0; i < 6; i++) {
        const spread = 0.3;
        out.push({
          x: pos.x, y: pos.y, z: pos.z,
          vx: baseDir.x * 4 + (Math.random() - 0.5) * spread,
          vy: baseDir.y * 4 + (Math.random() - 0.5) * spread,
          vz: baseDir.z * 4 + (Math.random() - 0.5) * spread,
          life: 0, maxLife: 0.08 + Math.random() * 0.04,
          color: 0xffd166, size: 0.15 + Math.random() * 0.1,
          gravity: 0,
          kind: "muzzleFlash",
        });
      }
      return out;
    },
    bulletHit: (pos) => {
      const out = [];
      for (let i = 0; i < 12; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 3 + Math.random() * 4;
        out.push({
          x: pos.x, y: pos.y, z: pos.z,
          vx: Math.cos(a) * s, vy: (Math.random() - 0.5) * 2 + 1,
          vz: Math.sin(a) * s,
          life: 0, maxLife: 0.2 + Math.random() * 0.2,
          color: 0xffaa00, size: 0.08,
          gravity: -8,
          kind: "bulletHit",
        });
      }
      return out;
    },
    explosion: (pos) => {
      const out = [];
      for (let i = 0; i < 40; i++) {
        const a = Math.random() * Math.PI * 2;
        const e = Math.random() * Math.PI - Math.PI / 2;
        const s = 4 + Math.random() * 6;
        out.push({
          x: pos.x, y: pos.y, z: pos.z,
          vx: Math.cos(a) * Math.cos(e) * s,
          vy: Math.sin(e) * s + 2,
          vz: Math.sin(a) * Math.cos(e) * s,
          life: 0, maxLife: 0.5 + Math.random() * 0.5,
          color: Math.random() < 0.4 ? 0xff3300 : (Math.random() < 0.6 ? 0xff7700 : 0xffaa00),
          size: 0.3 + Math.random() * 0.4,
          gravity: -3,
          kind: "explosion",
        });
      }
      return out;
    },
    smoke: (pos) => {
      const out = [];
      for (let i = 0; i < 8; i++) {
        out.push({
          x: pos.x + (Math.random() - 0.5),
          y: pos.y,
          z: pos.z + (Math.random() - 0.5),
          vx: (Math.random() - 0.5) * 0.5,
          vy: 1.2 + Math.random() * 0.8,
          vz: (Math.random() - 0.5) * 0.5,
          life: 0, maxLife: 1.0 + Math.random() * 0.8,
          color: 0x888888, size: 0.5 + Math.random() * 0.3,
          gravity: -0.3,
          kind: "smoke",
        });
      }
      return out;
    },
  };

  function createSystem(opts) {
    opts = opts || {};
    const particles = [];
    const maxParticles = opts.maxParticles || 5000;

    function emit(preset, pos, dir) {
      const fn = PRESETS[preset];
      if (!fn) return 0;
      const fresh = fn(pos, dir);
      const room = maxParticles - particles.length;
      const accepted = Math.min(fresh.length, room);
      for (let i = 0; i < accepted; i++) particles.push(fresh[i]);
      return accepted;
    }

    // Tick all particles, advance physics, retire dead.
    function tick(dt) {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += dt;
        if (p.life >= p.maxLife) { particles.splice(i, 1); continue; }
        // Integrate
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        // Floor collision (basic)
        if (p.y < 0) { p.y = 0; p.vy = -p.vy * 0.3; p.vx *= 0.6; p.vz *= 0.6; }
      }
    }

    function clear() { particles.length = 0; }
    function count(kind) {
      if (!kind) return particles.length;
      return particles.filter(p => p.kind === kind).length;
    }

    function registerPreset(name, fn) {
      if (PRESETS[name]) throw new Error(`preset ${name} exists`);
      PRESETS[name] = fn;
    }

    return { particles, emit, tick, clear, count, registerPreset, PRESETS };
  }

  return { createSystem, PRESETS };
});
