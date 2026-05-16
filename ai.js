// ai.js — finite-state machine for enemy NPCs.
// States: idle → seek → attack → dead. Pure functions over an `ai` facet
// + the world; engine doesn't know about specific behaviors.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAAI = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const STATES = ["idle", "seek", "attack", "dead"];

  function makeAI(opts) {
    opts = opts || {};
    return {
      state: "idle",
      sightRange:    opts.sightRange    != null ? opts.sightRange    : 12,
      attackRange:   opts.attackRange   != null ? opts.attackRange   : 1.6,
      moveSpeed:     opts.moveSpeed     != null ? opts.moveSpeed     : 3.0,
      attackDamage:  opts.attackDamage  != null ? opts.attackDamage  : 8,
      attackCooldown:opts.attackCooldown!= null ? opts.attackCooldown: 1.0,
      lastAttackT:   -Infinity,
      targetId:      null,
      patrolCenter:  opts.patrolCenter  || null,    // {u, v}
      patrolRadius:  opts.patrolRadius  != null ? opts.patrolRadius  : 6,
      heading:       opts.heading       != null ? opts.heading       : 0,
      wanderT:       0,                              // for idle wander cycle
    };
  }

  function dist(a, b) { return Math.hypot(a.u - b.u, a.v - b.v); }

  // Find nearest target with a `targetable` facet; returns {id, dist, entity}.
  function findNearestTarget(world, self, maxRange) {
    let best = null;
    for (const [id, e] of world.entities) {
      if (e === self) continue;
      if (!e.targetable) continue;
      if (e.health && e.health.dead) continue;
      if (!e.position) continue;
      const d = dist(self.position, e.position);
      if (d > maxRange) continue;
      if (!best || d < best.dist) best = { id, dist: d, entity: e };
    }
    return best;
  }

  // One AI tick. Mutates entity.position + entity.ai. Emits attack via cb.
  function tick(entity, world, dt, nowSec, callbacks) {
    if (!entity.ai) return;
    if (entity.health && entity.health.dead) {
      entity.ai.state = "dead";
      return;
    }
    const a = entity.ai;
    const cb = callbacks || {};

    // Re-evaluate targets every tick — cheap, prevents stale lock-on
    const target = findNearestTarget(world, entity, a.sightRange);

    if (!target) {
      a.state = "idle";
      a.targetId = null;
      // Idle wander around patrolCenter (or current pos)
      a.wanderT += dt;
      if (a.wanderT > 2) {
        a.wanderT = 0;
        a.heading = Math.random() * Math.PI * 2;
      }
      const cx = a.patrolCenter ? a.patrolCenter.u : entity.position.u;
      const cz = a.patrolCenter ? a.patrolCenter.v : entity.position.v;
      // Stay within patrolRadius
      const dToCenter = Math.hypot(entity.position.u - cx, entity.position.v - cz);
      if (dToCenter > a.patrolRadius) {
        // Aim back toward center
        a.heading = Math.atan2(cx - entity.position.u, cz - entity.position.v);
      }
      const stepU = Math.sin(a.heading) * a.moveSpeed * 0.4 * dt;
      const stepV = Math.cos(a.heading) * a.moveSpeed * 0.4 * dt;
      entity.position.u += stepU;
      entity.position.v += stepV;
      return;
    }

    a.targetId = target.id;
    if (target.dist > a.attackRange) {
      a.state = "seek";
      // Move toward target
      const du = target.entity.position.u - entity.position.u;
      const dv = target.entity.position.v - entity.position.v;
      const m = Math.hypot(du, dv) || 1;
      a.heading = Math.atan2(du, dv);
      entity.position.u += (du / m) * a.moveSpeed * dt;
      entity.position.v += (dv / m) * a.moveSpeed * dt;
    } else {
      a.state = "attack";
      if (nowSec - a.lastAttackT >= a.attackCooldown) {
        a.lastAttackT = nowSec;
        if (cb.onAttack) cb.onAttack(entity, target.entity, a.attackDamage);
      }
    }
  }

  return { STATES, makeAI, tick, findNearestTarget };
});
