/**
 * ecs_ai_movement.js — ECS enemy AI movement and state machine for 5DEngine
 *
 * Ported from 5DEngineMassive/index.html lines 7048-7561:
 *   BehaviorTree.makeEnemyTree → wander/alert/chase state machine
 *   onPatrol (line 7467): orbit patrol at radius 4–8m, angle += 0.35 rad/s
 *   onChase  (line 7182): move toward hero at moveSpeed, stop at attackRange
 *   canSee   (line 7081): dist <= sightRange (smoke/crouch ignored in ECS)
 *   loseRange (line 7063): sightRange * 2.5
 *
 * Enemy type defaults (monolith line 1175–1182):
 *   grunt:      moveSpeed 2.4, wanderSpeed 1.0, sightRange 12, attackRange 1.6
 *   heavy:      moveSpeed 1.2, wanderSpeed 0.6, sightRange 10, attackRange 2.0
 *   fast:       moveSpeed 5.0, wanderSpeed 2.5, sightRange 16, attackRange 1.2
 *   poisoner:   moveSpeed 2.0, wanderSpeed 0.8, sightRange 12, attackRange 1.8
 *   incendiary: moveSpeed 2.2, wanderSpeed 0.9, sightRange 12, attackRange 1.8
 *   robot:      moveSpeed 1.0, wanderSpeed 0.4, sightRange 14, attackRange 2.2
 *   boss:       moveSpeed 1.8, wanderSpeed 0.5, sightRange 20, attackRange 3.0
 *   sniper:     moveSpeed 0.9, wanderSpeed 0.3, sightRange 22, attackRange 20
 *
 * Components required on enemy entity:
 *   EnemyAI:   { type, state, sightRange, attackRange, moveSpeed, wanderSpeed,
 *                heading, _wasChasing, _patrolAngle, _patrolR, _originU, _originV,
 *                _lastHeroU, _lastHeroV }
 *   Transform: { u, v, y }
 *   Health:    { hp }
 *
 * Components required on hero entity:
 *   PlayerControl, Transform, Faction { id: "player" }
 *
 * Events emitted on Core:
 *   "enemy:alerted"             { enemyId, heroId }  — on first LOS detection
 *   "enemy:reached_attack_range" { enemyId, heroId }  — every tick within attackRange
 *
 * Usage:
 *   const sys = createAIMovementSystem();
 *   Core.addSystem(sys, 12, "ai_movement");
 */

const LOSE_RANGE_MUL   = 2.5;  // give up chase when dist > sightRange * 2.5
const WANDER_ANGLE_RATE = 0.35; // radians/second (monolith: dt * 0.35)
const WANDER_RADIUS_BASE = 4.0; // inner orbit radius (monolith: 4 + random*4)
const WANDER_RADIUS_RAND = 4.0; // additional random radius

export function createAIMovementSystem() {

  function _findHero(core) {
    const ids = core.query("PlayerControl", "Transform");
    return ids.find(id => {
      const f = core.getComponent(id, "Faction");
      return !f || f.id === "player";
    }) ?? null;
  }

  function system(dt, core) {
    const heroId = _findHero(core);
    const heroT  = heroId != null ? core.getComponent(heroId, "Transform") : null;

    const enemies = core.query("EnemyAI", "Transform", "Health");

    for (const id of enemies) {
      const ai = core.getComponent(id, "EnemyAI");
      const t  = core.getComponent(id, "Transform");
      const h  = core.getComponent(id, "Health");

      if (h.hp <= 0) continue;

      const sightRange  = ai.sightRange  ?? 12;
      const attackRange = ai.attackRange ?? 1.8;
      const loseRange   = sightRange * LOSE_RANGE_MUL;
      const moveSpeed   = ai.moveSpeed   ?? 2.4;
      const wanderSpeed = ai.wanderSpeed ?? 1.0;

      // Distance and direction to hero
      let dist = Infinity, dx = 0, dz = 0;
      if (heroT) {
        dx = heroT.u - t.u;
        dz = heroT.v - t.v;
        dist = Math.hypot(dx, dz);
      }

      const canSee = heroT != null && dist <= sightRange;
      const state  = ai.state ?? "wander";

      // ── State transitions ────────────────────────────────────────────────────
      if (canSee && state !== "chase") {
        ai.state = "chase";
        if (!ai._wasChasing) {
          ai._wasChasing = true;
          core.emit("enemy:alerted", { enemyId: id, heroId });
        }
      } else if (!canSee && state === "chase" && dist > loseRange) {
        ai.state = "wander";
        ai._wasChasing = false;
      }

      const curState = ai.state ?? "wander";

      // ── Wander: orbit patrol (monolith onPatrol callback) ────────────────────
      if (curState === "wander") {
        if (ai._originU == null) { ai._originU = t.u; ai._originV = t.v; }
        if (ai._patrolR == null) ai._patrolR = Math.random() * WANDER_RADIUS_RAND;
        ai._patrolAngle = ((ai._patrolAngle ?? 0) + dt * WANDER_ANGLE_RATE);

        const r  = WANDER_RADIUS_BASE + ai._patrolR;
        const pu = ai._originU + Math.cos(ai._patrolAngle) * r;
        const pv = ai._originV + Math.sin(ai._patrolAngle) * r;
        const ddx = pu - t.u, ddz = pv - t.v;
        const m   = Math.hypot(ddx, ddz) || 1;
        t.u += (ddx / m) * wanderSpeed * dt;
        t.v += (ddz / m) * wanderSpeed * dt;
        ai.heading = Math.atan2(ddx, ddz);
        continue;
      }

      // ── Chase: move toward hero (or last known position) ────────────────────
      if (heroT) { ai._lastHeroU = heroT.u; ai._lastHeroV = heroT.v; }
      const targetU = ai._lastHeroU ?? t.u;
      const targetV = ai._lastHeroV ?? t.v;
      const ddx = targetU - t.u, ddz = targetV - t.v;
      const m   = Math.hypot(ddx, ddz) || 1;

      if (dist > attackRange) {
        t.u += (ddx / m) * moveSpeed * dt;
        t.v += (ddz / m) * moveSpeed * dt;
        ai.heading = Math.atan2(ddx, ddz);
      } else {
        core.emit("enemy:reached_attack_range", { enemyId: id, heroId });
      }
    }
  }

  return system;
}

export default { createAIMovementSystem };
