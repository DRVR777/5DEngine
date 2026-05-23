// guns.js — 7 gun types as DATA, not code. Adding an 8th gun = one entry.
// Bullet is its own entity facet so the engine doesn't special-case it.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAGuns = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // 4 ammo types: pistol_9mm, rifle_556, shotgun_12g, energy_cell.
  // Rocket gun fires a self-contained projectile (no ammo type) — kept
  // explicit so we don't conflate "ammo" with "munition".
  const GUNS = {
    pistol: {
      name: "pistol", damage: 18, fireRate: 5,    magSize: 12, ammoType: "pistol_9mm",
      range: 30, projectileSpeed: 80, accuracy: 0.92, kind: "hitscan",
    },
    smg: {
      name: "smg", damage: 12, fireRate: 14, magSize: 30, ammoType: "pistol_9mm",
      range: 25, projectileSpeed: 80, accuracy: 0.78, kind: "hitscan",
    },
    rifle: {
      name: "rifle", damage: 28, fireRate: 7, magSize: 30, ammoType: "rifle_556",
      range: 80, projectileSpeed: 120, accuracy: 0.88, kind: "hitscan",
    },
    shotgun: {
      name: "shotgun", damage: 9, fireRate: 1.5, magSize: 8, ammoType: "shotgun_12g",
      range: 12, projectileSpeed: 70, accuracy: 0.55, kind: "hitscan",
      pellets: 8,
    },
    sniper: {
      name: "sniper", damage: 95, fireRate: 0.7, magSize: 5, ammoType: "rifle_556",
      range: 200, projectileSpeed: 200, accuracy: 0.99, kind: "hitscan",
    },
    rocket: {
      name: "rocket", damage: 120, fireRate: 0.6, magSize: 4, ammoType: "rocket",
      range: 100, projectileSpeed: 35, accuracy: 0.95, kind: "projectile",
      blastRadius: 4,
    },
    plasma: {
      name: "plasma", damage: 22, fireRate: 8, magSize: 25, ammoType: "energy_cell",
      range: 60, projectileSpeed: 60, accuracy: 0.85, kind: "projectile",
      blastRadius: 1,
    },
  };

  function get(name) { return GUNS[name] || null; }
  function names() { return Object.keys(GUNS); }
  function register(name, def) {
    if (GUNS[name]) throw new Error(`gun ${name} already registered`);
    GUNS[name] = Object.assign({ name, kind: "hitscan" }, def);
  }

  // Build a "gun instance" — a player carries one of these.
  // tracks current ammo, cooldown, last-fire time.
  function makeInstance(typeName) {
    const def = get(typeName);
    if (!def) throw new Error(`unknown gun type: ${typeName}`);
    return {
      type: typeName,
      ammo: def.magSize,        // currently-loaded
      reserve: def.magSize * 3, // pool to reload from
      lastFireT: -Infinity,
    };
  }

  // Try to fire. Returns the bullet entity payload (for the caller to insert
  // into the world), or { fired: false, reason: "..." }.
  // dir = unit vector (u, v); ownerId = entity id firing.
  function fire(instance, ownerPos, dir, nowSec) {
    const def = get(instance.type);
    if (!def) return { fired: false, reason: "unknown_gun" };
    const cooldown = 1 / def.fireRate;
    if (nowSec - instance.lastFireT < cooldown) {
      return { fired: false, reason: "cooldown" };
    }
    if (instance.ammo <= 0) return { fired: false, reason: "empty_mag" };
    instance.ammo -= 1;
    instance.lastFireT = nowSec;
    const bullets = [];
    const count = def.pellets || 1;
    for (let i = 0; i < count; i++) {
      const spread = (1 - def.accuracy) * 0.5;
      const sx = (Math.random() - 0.5) * spread;
      const sy = (Math.random() - 0.5) * spread;
      bullets.push({
        type: "bullet",
        ownerId: instance.ownerId || null,
        gunType: def.name,
        damage: def.damage,
        kind: def.kind,
        range: def.range,
        speed: def.projectileSpeed,
        blastRadius: def.blastRadius || 0,
        position: { u: ownerPos.u, v: ownerPos.v, y: (ownerPos.y || 1.4) },
        velocity: { u: dir.u + sx, v: dir.v + sy, y: 0 },
        spawnedAt: nowSec,
        traveled: 0,
      });
    }
    return { fired: true, bullets, gun: def.name };
  }

  function reload(instance) {
    const def = get(instance.type);
    if (!def) return false;
    const need = def.magSize - instance.ammo;
    const give = Math.min(need, instance.reserve);
    instance.ammo += give;
    instance.reserve -= give;
    return give > 0;
  }

  // Tick a bullet — returns true if the bullet should be retired (out of
  // range, hit floor, etc).
  function tickBullet(bullet, dt) {
    bullet.position.u += bullet.velocity.u * bullet.speed * dt;
    bullet.position.v += bullet.velocity.v * bullet.speed * dt;
    bullet.traveled += bullet.speed * dt;
    if (bullet.traveled >= bullet.range) return true;
    return false;
  }

  return { GUNS, get, names, register, makeInstance, fire, reload, tickBullet };
});
