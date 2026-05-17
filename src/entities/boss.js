// boss.js — special enemy with multi-phase attack patterns + telegraphs.
// Boss is just another entity with a `boss` facet on top of `ai`+`health`.
// Phases switch by hp threshold; each phase exposes a different rotation
// of attacks. Telegraphs fire BEFORE each attack so the player can react.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTABoss = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const PHASES = {
    intro: {
      name: "intro",
      attacks: ["slam"],
      telegraphMs: 800,
      cooldownMs: 2500,
      moveSpeed: 2.0,
    },
    enraged: {
      name: "enraged",
      attacks: ["slam", "swipe", "missile"],
      telegraphMs: 500,
      cooldownMs: 1500,
      moveSpeed: 3.5,
    },
    desperate: {
      name: "desperate",
      attacks: ["swipe", "missile", "scream"],
      telegraphMs: 300,
      cooldownMs: 900,
      moveSpeed: 5.0,
    },
  };

  // Each attack: { range, damage, cone (rad), telegraphParticle, hitParticle, effects }
  const ATTACKS = {
    slam: {
      range: 3.0,
      damage: 25,
      cone: Math.PI * 2,        // full radius
      telegraphParticle: "explosion",
      hitParticle: "bulletHit",
      knockback: 4,
    },
    swipe: {
      range: 4.0,
      damage: 18,
      cone: Math.PI / 2,        // 90° arc
      telegraphParticle: "muzzleFlash",
      hitParticle: "bulletHit",
      knockback: 2,
    },
    missile: {
      range: 30,
      damage: 30,
      cone: 0.2,
      telegraphParticle: "muzzleFlash",
      hitParticle: "explosion",
      knockback: 6,
    },
    scream: {
      range: 8,
      damage: 12,
      cone: Math.PI * 2,
      telegraphParticle: "explosion",
      hitParticle: "smoke",
      knockback: 1,
      stun: 0.8,
    },
  };

  function makeBoss(opts) {
    opts = opts || {};
    return {
      name: opts.name || "Overlord",
      phase: "intro",
      attackQueue: [],          // [{type, telegraphedAt, scheduledAt}]
      lastAttackAt: -Infinity,
      attackIndex: 0,           // round-robin through phase.attacks
      stunUntil: 0,
      maxHp: opts.maxHp || 500,
      lootMultiplier: opts.lootMultiplier || 5,
    };
  }

  // Determine phase from hp fraction. >70% intro, 30-70% enraged, <30% desperate.
  function phaseForHp(currentHp, maxHp) {
    const frac = currentHp / maxHp;
    if (frac > 0.7) return "intro";
    if (frac > 0.3) return "enraged";
    return "desperate";
  }

  function inCone(attackerHeading, targetU, targetV, attackerU, attackerV, cone) {
    const du = targetU - attackerU, dv = targetV - attackerV;
    const dist = Math.hypot(du, dv);
    if (dist === 0) return true;
    const ang = Math.atan2(du, dv);
    const diff = Math.abs(((ang - attackerHeading + Math.PI) % (Math.PI * 2)) - Math.PI);
    return diff <= cone / 2;
  }

  // Update boss every tick. cb has: telegraph(attack, pos, dir), strike(attack, hits)
  // Returns the new boss state ({phase, attacked, telegraphed}).
  function tick(boss, position, heading, target, dt, nowMs, cb) {
    cb = cb || {};
    const out = { telegraphed: null, attacked: null };
    if (!boss || !target) return out;

    // Phase transition
    const targetHp = target.health ? target.health.current : boss.maxHp;
    // Note: boss owns its own health; phase is based on boss's own hp
    const myHp = (cb.bossHp != null) ? cb.bossHp : boss.maxHp;
    boss.phase = phaseForHp(myHp, boss.maxHp);
    const phase = PHASES[boss.phase];

    if (nowMs < boss.stunUntil) return out;

    // Resolve telegraphed attacks whose scheduledAt has elapsed.
    for (let i = boss.attackQueue.length - 1; i >= 0; i--) {
      const q = boss.attackQueue[i];
      if (nowMs >= q.scheduledAt) {
        const atk = ATTACKS[q.type];
        if (!atk) { boss.attackQueue.splice(i, 1); continue; }
        const du = target.position ? target.position.u - position.u : 0;
        const dv = target.position ? target.position.v - position.v : 0;
        const dist = Math.hypot(du, dv);
        let hit = false;
        if (dist <= atk.range && (atk.cone >= Math.PI * 2 - 1e-6 ||
            inCone(heading, target.position.u, target.position.v, position.u, position.v, atk.cone))) {
          hit = true;
        }
        const hits = hit ? [{ targetId: cb.targetId, attack: q.type, damage: atk.damage, knockback: atk.knockback }] : [];
        if (cb.strike) cb.strike(q.type, hits, position);
        out.attacked = { type: q.type, hit, dist };
        boss.attackQueue.splice(i, 1);
      }
    }

    // Issue new attack if cooldown elapsed
    if (nowMs - boss.lastAttackAt >= phase.cooldownMs) {
      const atkType = phase.attacks[boss.attackIndex % phase.attacks.length];
      boss.attackIndex++;
      boss.lastAttackAt = nowMs;
      const scheduledAt = nowMs + phase.telegraphMs;
      boss.attackQueue.push({ type: atkType, telegraphedAt: nowMs, scheduledAt });
      if (cb.telegraph) cb.telegraph(atkType, position, heading);
      out.telegraphed = { type: atkType, in: phase.telegraphMs };
    }

    return out;
  }

  function applyStun(boss, durationMs, nowMs) {
    boss.stunUntil = nowMs + durationMs;
  }

  return { PHASES, ATTACKS, makeBoss, phaseForHp, tick, applyStun, inCone };
});
