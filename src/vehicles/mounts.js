// mounts.js — rideable mounts (horses, etc.) with stamina + speed tiers.
// A mount has speedTiers: walk/trot/canter/gallop with per-tier
// staminaCostPerSec. Riding consumes stamina; resting refills it.
// Mount can be summoned (whistle), dismissed, tamed (bond+).
//
// State: { id, species, ownerId, currentRider, position, gait,
//          stamina, maxStamina, bond, mood }
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAMounts = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const GAITS = ["idle", "walk", "trot", "canter", "gallop"];

  // Default species: speed in m/s + stamina cost per second
  const DEFAULT_SPECIES = {
    horse: {
      maxStamina: 100, restorePerSec: 5,
      gaits: {
        idle: { speed: 0,   costPerSec: -2 },  // negative = restores while idle
        walk: { speed: 2,   costPerSec: 0 },
        trot: { speed: 5,   costPerSec: 2 },
        canter:{ speed: 9,  costPerSec: 6 },
        gallop:{ speed: 14, costPerSec: 12 },
      },
    },
    camel: {
      maxStamina: 150, restorePerSec: 3,
      gaits: {
        idle: { speed: 0, costPerSec: -1 },
        walk: { speed: 1.5, costPerSec: 0 },
        trot: { speed: 4,   costPerSec: 1 },
        canter:{ speed: 7,  costPerSec: 4 },
        gallop:{ speed: 11, costPerSec: 8 },
      },
    },
    pony: {
      maxStamina: 60, restorePerSec: 4,
      gaits: {
        idle: { speed: 0, costPerSec: -2 },
        walk: { speed: 1.5, costPerSec: 0 },
        trot: { speed: 3.5, costPerSec: 1.5 },
        canter:{ speed: 6,  costPerSec: 4 },
        gallop:{ speed: 9,  costPerSec: 8 },
      },
    },
  };

  function _clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }

  function createSystem(opts) {
    opts = opts || {};
    const config = Object.assign({
      dismountWhenExhausted: true,
      summonRange: 100,
      tameBondThreshold: 50,
    }, opts.config || {});

    const species = new Map();
    for (const [id, s] of Object.entries(DEFAULT_SPECIES)) species.set(id, s);
    const mounts = new Map();
    let nextMountId = 1;
    const events = [];

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 500) events.shift();
    }

    function registerSpecies(id, spec) {
      if (typeof id !== "string" || !id) return { ok: false };
      if (species.has(id)) return { ok: false, reason: "duplicate" };
      if (!spec || !spec.gaits || typeof spec.maxStamina !== "number") {
        return { ok: false, reason: "bad_spec" };
      }
      species.set(id, spec);
      return { ok: true };
    }

    function spawn(opts2) {
      opts2 = opts2 || {};
      if (!opts2.species || !species.has(opts2.species)) {
        return { ok: false, reason: "no_species" };
      }
      const sp = species.get(opts2.species);
      const id = opts2.id || ("mount_" + (nextMountId++));
      if (mounts.has(id)) return { ok: false, reason: "duplicate" };
      const m = {
        id, species: opts2.species,
        ownerId: opts2.ownerId || null,
        currentRider: null,
        position: opts2.position || { u: 0, v: 0, y: 0 },
        gait: "idle",
        stamina: opts2.stamina != null ? opts2.stamina : sp.maxStamina,
        maxStamina: sp.maxStamina,
        bond: opts2.bond != null ? opts2.bond : 0,
        spawnedAt: Date.now(),
        wild: opts2.ownerId == null,
      };
      mounts.set(id, m);
      _log("spawn", { id, species: opts2.species, wild: m.wild });
      return { ok: true, mountId: id, mount: m };
    }

    function despawn(id) {
      if (!mounts.has(id)) return { ok: false };
      mounts.delete(id);
      _log("despawn", { id });
      return { ok: true };
    }

    function mount(mountId, playerId) {
      const m = mounts.get(mountId);
      if (!m) return { ok: false, reason: "no_mount" };
      if (m.currentRider) return { ok: false, reason: "occupied" };
      if (m.ownerId && m.ownerId !== playerId) {
        return { ok: false, reason: "not_owner" };
      }
      m.currentRider = playerId;
      m.gait = "walk";
      _log("mount", { mountId, playerId });
      return { ok: true };
    }

    function dismount(mountId, playerId) {
      const m = mounts.get(mountId);
      if (!m) return { ok: false, reason: "no_mount" };
      if (m.currentRider !== playerId) return { ok: false, reason: "not_rider" };
      m.currentRider = null;
      m.gait = "idle";
      _log("dismount", { mountId, playerId });
      return { ok: true };
    }

    function setGait(mountId, playerId, gait) {
      const m = mounts.get(mountId);
      if (!m) return { ok: false, reason: "no_mount" };
      if (m.currentRider !== playerId) return { ok: false, reason: "not_rider" };
      if (!GAITS.includes(gait)) return { ok: false, reason: "bad_gait" };
      const sp = species.get(m.species);
      if (!sp.gaits[gait]) return { ok: false, reason: "gait_unavailable" };
      m.gait = gait;
      _log("gait", { mountId, gait });
      return { ok: true };
    }

    // Tick: applies stamina cost based on gait, moves the mount along direction
    function tick(mountId, dt, opts2) {
      opts2 = opts2 || {};
      const m = mounts.get(mountId);
      if (!m) return null;
      const sp = species.get(m.species);
      const gait = sp.gaits[m.gait];
      if (!gait) return null;

      // Apply stamina cost
      const cost = gait.costPerSec * dt;
      m.stamina = _clamp(m.stamina - cost, 0, m.maxStamina);
      // Free-time recovery
      if (m.gait === "idle" || !m.currentRider) {
        m.stamina = _clamp(m.stamina + sp.restorePerSec * dt, 0, m.maxStamina);
      }
      // Auto-dismount if exhausted
      if (m.stamina === 0 && m.currentRider && config.dismountWhenExhausted) {
        const rider = m.currentRider;
        m.currentRider = null;
        m.gait = "idle";
        _log("exhausted", { mountId, rider });
      }
      // Move along given direction
      if (opts2.direction && m.currentRider) {
        const speed = gait.speed;
        const len = Math.hypot(opts2.direction.u || 0, opts2.direction.v || 0);
        if (len > 0) {
          const du = (opts2.direction.u / len) * speed * dt;
          const dv = (opts2.direction.v / len) * speed * dt;
          m.position.u += du;
          m.position.v += dv;
        }
      }
      return m;
    }

    function feed(mountId, playerId) {
      const m = mounts.get(mountId);
      if (!m) return { ok: false };
      if (m.ownerId && m.ownerId !== playerId) return { ok: false, reason: "not_owner" };
      m.stamina = m.maxStamina;
      m.bond = _clamp(m.bond + 5, 0, 100);
      _log("fed", { mountId, bond: m.bond });
      return { ok: true, bond: m.bond, stamina: m.stamina };
    }

    function tame(mountId, playerId) {
      const m = mounts.get(mountId);
      if (!m) return { ok: false, reason: "no_mount" };
      if (!m.wild) return { ok: false, reason: "not_wild" };
      if (m.bond < config.tameBondThreshold) {
        return { ok: false, reason: "bond_too_low", required: config.tameBondThreshold };
      }
      m.wild = false;
      m.ownerId = playerId;
      _log("tamed", { mountId, playerId });
      return { ok: true };
    }

    function pet(mountId, playerId) {
      const m = mounts.get(mountId);
      if (!m) return { ok: false };
      m.bond = _clamp(m.bond + 2, 0, 100);
      _log("petted", { mountId, bond: m.bond });
      return { ok: true, bond: m.bond };
    }

    function summon(playerId, opts2) {
      opts2 = opts2 || {};
      // Find nearest mount owned by player within summonRange of opts2.position
      const playerPos = opts2.position;
      if (!playerPos) return { ok: false, reason: "no_position" };
      let best = null, bestDist = config.summonRange;
      for (const m of mounts.values()) {
        if (m.ownerId !== playerId) continue;
        if (m.currentRider) continue;
        const d = Math.hypot(m.position.u - playerPos.u, m.position.v - playerPos.v);
        if (d <= bestDist) { bestDist = d; best = m; }
      }
      if (!best) return { ok: false, reason: "none_in_range" };
      best.position = { u: playerPos.u, v: playerPos.v, y: playerPos.y || 0 };
      _log("summon", { mountId: best.id });
      return { ok: true, mountId: best.id };
    }

    function getMount(id) { return mounts.get(id) || null; }
    function listMounts(filter) {
      filter = filter || {};
      const out = [];
      for (const m of mounts.values()) {
        if (filter.ownerId && m.ownerId !== filter.ownerId) continue;
        if (filter.wild != null && m.wild !== filter.wild) continue;
        if (filter.ridden != null) {
          const isRidden = !!m.currentRider;
          if (isRidden !== filter.ridden) continue;
        }
        out.push(m);
      }
      return out;
    }

    function listSpecies() { return Array.from(species.keys()); }
    function recentEvents(n) { return events.slice(-(n || 50)); }
    function getConfig() { return Object.assign({}, config); }

    return {
      GAITS, DEFAULT_SPECIES,
      registerSpecies, listSpecies,
      spawn, despawn, getMount, listMounts,
      mount, dismount, setGait, tick,
      feed, pet, tame, summon,
      recentEvents, getConfig,
    };
  }

  return { GAITS, DEFAULT_SPECIES, createSystem };
});
