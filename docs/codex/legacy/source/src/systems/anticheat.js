// anticheat.js — server-authoritative validation per
// DECENTRALIZED_GAME_SERVER_NETWORKING_STRATEGY.md.
//
// Detects: teleporting, speed hacks, ammo invariants, bullet-spawn-from-
// -nowhere, impossible damage, mod tampering. Decisions:
//   reject  — drop the action, no state change
//   warn    — accept but log
//   throttle — accept but rate-limit subsequent actions from this player
//   ban     — remove player after N strikes
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAAnticheat = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const DECISIONS = ["accept", "warn", "throttle", "reject", "ban"];

  function createValidator(opts) {
    opts = opts || {};
    const config = Object.assign({
      maxSpeedMps: 12,                // any move > this/sec is teleport
      maxJumpHeight: 4,
      strikesUntilBan: 5,
      throttleStrikes: 2,
      maxFireRateHz: 16,              // 16 shots/sec sanity ceiling
      damageMaxMultiplier: 1.2,       // bullet damage > def.damage * this
    }, opts.config || {});

    const playerStrikes = new Map();    // playerId → count
    const banned = new Set();
    const log = [];                     // {playerId, kind, ts, action}
    const lastSeen = new Map();         // playerId → {pos, ts, lastFireT}

    function _log(playerId, kind, decision, detail) {
      log.push({ playerId, kind, decision, ts: Date.now(), detail });
      if (log.length > 1000) log.shift();
    }

    function _strike(playerId, kind, detail) {
      const cur = (playerStrikes.get(playerId) || 0) + 1;
      playerStrikes.set(playerId, cur);
      if (cur >= config.strikesUntilBan) {
        banned.add(playerId);
        _log(playerId, kind, "ban", { strikes: cur, ...detail });
        return "ban";
      }
      if (cur >= config.throttleStrikes) {
        _log(playerId, kind, "throttle", { strikes: cur, ...detail });
        return "throttle";
      }
      _log(playerId, kind, "warn", { strikes: cur, ...detail });
      return "warn";
    }

    // ---- Validators ----

    // Movement: position delta over dt → speed.
    function validateMove(playerId, prevPos, newPos, dt) {
      if (banned.has(playerId)) return { decision: "reject", reason: "banned" };
      const du = newPos.u - prevPos.u, dv = newPos.v - prevPos.v;
      const dist = Math.hypot(du, dv);
      if (dt <= 0) return { decision: "reject", reason: "bad_dt" };
      const speed = dist / dt;
      if (speed > config.maxSpeedMps * 1.5) {
        return { decision: "reject", reason: "teleport", speed, max: config.maxSpeedMps };
      }
      if (speed > config.maxSpeedMps) {
        const d = _strike(playerId, "speed_hack", { speed, max: config.maxSpeedMps });
        return { decision: d, reason: "speed_hack", speed, max: config.maxSpeedMps };
      }
      // Vertical: jump height
      const dy = (newPos.y || 0) - (prevPos.y || 0);
      if (dy > config.maxJumpHeight) {
        return { decision: "reject", reason: "jump_height", dy, max: config.maxJumpHeight };
      }
      return { decision: "accept" };
    }

    // Fire: fire-rate sanity + ammo conservation.
    function validateFire(playerId, weapon, ammoBefore, ammoAfter, nowSec) {
      if (banned.has(playerId)) return { decision: "reject", reason: "banned" };
      const seen = lastSeen.get(playerId) || {};
      // Ammo must decrease by exactly 1 (per shot). For shotgun pellets,
      // weapon.def.pelletsPerShot or 1.
      const expected = (weapon && weapon.pelletsPerShot) ? 1 : 1;  // mag uses 1 round per trigger
      if (ammoBefore - ammoAfter !== expected) {
        const d = _strike(playerId, "ammo_invariant",
          { weapon: weapon && weapon.name, ammoBefore, ammoAfter });
        return { decision: d, reason: "ammo_invariant" };
      }
      // Fire rate
      if (seen.lastFireT != null) {
        const dt = nowSec - seen.lastFireT;
        if (dt > 0) {
          const hz = 1 / dt;
          const cap = Math.max(weapon && weapon.fireRate, config.maxFireRateHz);
          if (hz > cap * 1.2) {
            const d = _strike(playerId, "fire_rate", { hz, cap });
            return { decision: d, reason: "fire_rate" };
          }
        }
      }
      lastSeen.set(playerId, { ...seen, lastFireT: nowSec });
      return { decision: "accept" };
    }

    // Bullet spawn: bullet must originate within radius of the firer.
    function validateBulletSpawn(playerId, firerPos, bulletPos, maxRadius) {
      if (banned.has(playerId)) return { decision: "reject", reason: "banned" };
      const r = maxRadius != null ? maxRadius : 1.5;
      const d = Math.hypot(bulletPos.u - firerPos.u, bulletPos.v - firerPos.v);
      if (d > r) {
        const dec = _strike(playerId, "bullet_spawn_far", { dist: d, max: r });
        return { decision: dec, reason: "bullet_spawn_far", dist: d };
      }
      return { decision: "accept" };
    }

    // Damage: claimed damage must not exceed weapon.damage * configured multiplier.
    function validateDamageClaim(playerId, claimedDamage, weaponDef) {
      if (banned.has(playerId)) return { decision: "reject", reason: "banned" };
      if (!weaponDef || typeof weaponDef.damage !== "number") {
        return { decision: "warn", reason: "no_weapon_def" };
      }
      const cap = weaponDef.damage * config.damageMaxMultiplier;
      if (claimedDamage > cap) {
        const d = _strike(playerId, "damage_inflated",
          { claimed: claimedDamage, cap, weapon: weaponDef.name });
        return { decision: d, reason: "damage_inflated", claimed: claimedDamage, cap };
      }
      return { decision: "accept" };
    }

    // Identity check: a signed action's signature must match its claimed
    // pubkey (if a manifest+sign module is wired in, defer to that).
    function validateSignedAction(playerId, action, verifyFn) {
      if (banned.has(playerId)) return { decision: "reject", reason: "banned" };
      if (!action.signature || !action.signer) {
        const d = _strike(playerId, "unsigned_action", { action: action.type });
        return { decision: d, reason: "unsigned_action" };
      }
      if (verifyFn && !verifyFn(action)) {
        const d = _strike(playerId, "bad_signature", { action: action.type });
        return { decision: d, reason: "bad_signature" };
      }
      return { decision: "accept" };
    }

    function getStrikes(playerId) { return playerStrikes.get(playerId) || 0; }
    function isBanned(playerId) { return banned.has(playerId); }
    function unban(playerId) {
      banned.delete(playerId);
      playerStrikes.delete(playerId);
    }
    function recentLog(n) { return log.slice(-(n || 50)); }
    function reset() {
      playerStrikes.clear();
      banned.clear();
      log.length = 0;
      lastSeen.clear();
    }

    return {
      DECISIONS, config,
      validateMove, validateFire, validateBulletSpawn,
      validateDamageClaim, validateSignedAction,
      getStrikes, isBanned, unban, recentLog, reset,
    };
  }

  return { createValidator, DECISIONS };
});
