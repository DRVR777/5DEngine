/**
 * ecs_knockback.js — Impulse knockback + stagger duration system for 5DEngine
 *
 * Ported from 5DEngineMassive/index.html:
 *   Bullet KB: strength=3.5, duration=0.1s (line 6635-6637)
 *   Grenade KB: strength=14, duration=0.28s (line 2398-2401)
 *   Stagger:    duration=1.5s (line 2403), bullet heavy-hit=0.6s (line 6641)
 *
 * Components added dynamically by this system:
 *   Knockback: { u, v, timeLeft }
 *     - u, v: velocity impulse (units/s) applied to Transform each tick
 *     - timeLeft: seconds remaining before impulse expires
 *   Stagger: { duration, remaining }
 *     - remaining: seconds until stagger expires
 *     - AI movement system should check hasComponent(id, "Stagger") to suppress movement
 *
 * When multiple knockback sources hit in the same tick, their impulses accumulate
 * and timeLeft is set to the max of existing vs incoming duration.
 *
 * Events emitted on Core:
 *   "knockback:ended" { entityId }   — Knockback component expired and removed
 *   "stagger:started" { entityId, duration } — first stagger applied to entity
 *   "stagger:ended"   { entityId }   — Stagger component expired and removed
 *
 * Events listened to on Core:
 *   "bullet:knockback"  { entityId, kbU, kbV, kbT }
 *   "grenade:knockback" { entityId, kbU, kbV, kbT }
 *   "bullet:stagger"    { entityId, duration }
 *   "grenade:stagger"   { entityId, duration }
 *
 * Usage:
 *   const sys = createKnockbackSystem();
 *   Core.addSystem(sys, 16, "knockback"); // after status:15, before stamina:18
 */

/**
 * createKnockbackSystem() → system function
 */
export function createKnockbackSystem() {
  let _wired = false;

  function system(dt, core) {
    if (!_wired) {
      _wired = true;

      const applyKnockback = (entityId, kbU, kbV, kbT) => {
        if (!core.getComponent(entityId, "Transform")) return; // entity must have position
        const kb = core.getComponent(entityId, "Knockback");
        if (kb) {
          kb.u += kbU;
          kb.v += kbV;
          kb.timeLeft = Math.max(kb.timeLeft, kbT);
        } else {
          core.addComponent(entityId, "Knockback", { u: kbU, v: kbV, timeLeft: kbT });
        }
      };

      const applyStagger = (entityId, duration) => {
        if (!core.getComponent(entityId, "EnemyAI")) return; // only stagger entities with AI
        const s = core.getComponent(entityId, "Stagger");
        if (s) {
          s.remaining = Math.max(s.remaining, duration);
        } else {
          core.addComponent(entityId, "Stagger", { duration, remaining: duration });
          core.emit("stagger:started", { entityId, duration });
        }
      };

      core.on("bullet:knockback",  ({ entityId, kbU, kbV, kbT }) => applyKnockback(entityId, kbU, kbV, kbT));
      core.on("grenade:knockback", ({ entityId, kbU, kbV, kbT }) => applyKnockback(entityId, kbU, kbV, kbT));
      core.on("bullet:stagger",    ({ entityId, duration })       => applyStagger(entityId, duration));
      core.on("grenade:stagger",   ({ entityId, duration })       => applyStagger(entityId, duration));
    }

    // Tick Knockback — apply velocity impulse and decay
    const kbIds = core.query("Knockback", "Transform");
    for (const id of kbIds) {
      const kb = core.getComponent(id, "Knockback");
      const t  = core.getComponent(id, "Transform");
      if (!kb || !t) continue;

      t.u += kb.u * dt;
      t.v += kb.v * dt;
      kb.timeLeft -= dt;

      if (kb.timeLeft <= 0) {
        core.removeComponent(id, "Knockback");
        core.emit("knockback:ended", { entityId: id });
      }
    }

    // Tick Stagger — count down and signal expiry
    const staggerIds = core.query("Stagger");
    for (const id of staggerIds) {
      const s = core.getComponent(id, "Stagger");
      if (!s) continue;

      s.remaining -= dt;
      if (s.remaining <= 0) {
        core.removeComponent(id, "Stagger");
        core.emit("stagger:ended", { entityId: id });
      }
    }
  }

  return system;
}

export default { createKnockbackSystem };
