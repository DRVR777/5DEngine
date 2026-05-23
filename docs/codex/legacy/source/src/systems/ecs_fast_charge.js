/**
 * ecs_fast_charge.js — Fast enemy charge dash system for 5DEngine
 *
 * Ported from 5DEngineMassive/index.html lines 7391-7408:
 *   Line 7392: trigger: type=fast, canSee, dist 2–8m
 *   Line 7393: cooldown: random 3.5–5.5s interval (default 4.0s)
 *   Line 7396: chargeDur = 0.38s
 *   Line 7407: burst speed = moveSpeed × 2.2
 *
 * Sets ai._charging = true during charge so ecs_ai_movement skips normal movement.
 * Both trigger and first-tick movement fire in the same tick (faithful to monolith).
 *
 * Events emitted on Core:
 *   "fast:charge"       { entityId }  — on charge initiation
 *   "fast:charge_ended" { entityId }  — when chargeDur expires
 *
 * Usage:
 *   const sys = createFastChargeSystem();
 *   Core.addSystem(sys, 11, "fast_charge"); // before ai_movement:12
 */

export const FAST_CHARGE_MIN_DIST  = 2.0;   // monolith line 7392: dist > 2.0
export const FAST_CHARGE_MAX_DIST  = 8.0;   // monolith line 7392: dist < 8
export const FAST_CHARGE_DUR       = 0.38;  // monolith line 7396
export const FAST_CHARGE_SPEED_MUL = 2.2;   // monolith line 7407
export const FAST_CHARGE_CD_MIN    = 3.5;   // monolith line 7395: 3.5 + rand*2
export const FAST_CHARGE_CD_RAND   = 2.0;   // monolith line 7395

/**
 * createFastChargeSystem({ randFn }) → system function
 * randFn: () => [0,1) — injectable for deterministic tests
 */
export function createFastChargeSystem({ randFn = Math.random } = {}) {
  let _elapsed = 0;

  function system(dt, core) {
    _elapsed += dt;

    const enemies = core.query("EnemyAI", "Transform", "Health");
    if (!enemies.length) return;

    const heroIds = core.query("PlayerControl", "Transform");
    const heroId  = heroIds[0] ?? null;
    const heroT   = heroId != null ? core.getComponent(heroId, "Transform") : null;

    for (const id of enemies) {
      const ai = core.getComponent(id, "EnemyAI");
      const t  = core.getComponent(id, "Transform");
      const h  = core.getComponent(id, "Health");
      if (!ai || !t || !h) continue;
      if (ai.type !== "fast") continue;
      if (h.hp <= 0) continue;

      // ── Trigger new charge when not already charging ───────────────────────
      if (!ai._chargeDur && heroT) {
        const dx   = heroT.u - t.u;
        const dz   = heroT.v - t.v;
        const dist = Math.hypot(dx, dz);

        const canSee = dist <= (ai.sightRange ?? 16);
        if (canSee && dist > FAST_CHARGE_MIN_DIST && dist < FAST_CHARGE_MAX_DIST) {
          const interval   = ai._chargeInterval ?? FAST_CHARGE_CD_MIN;
          const lastCharge = ai._chargeLastT ?? -999;
          if (_elapsed - lastCharge >= interval) {
            ai._chargeLastT    = _elapsed;
            ai._chargeInterval = FAST_CHARGE_CD_MIN + randFn() * FAST_CHARGE_CD_RAND;
            ai._chargeDur      = FAST_CHARGE_DUR;
            ai._chargeDirU     = dx / (dist || 1);
            ai._chargeDirV     = dz / (dist || 1);
            core.emit("fast:charge", { entityId: id });
          }
        }
      }

      // ── Execute active charge (also applies on the trigger tick) ───────────
      if (ai._chargeDur > 0) {
        ai._charging = true;
        t.u += ai._chargeDirU * (ai.moveSpeed ?? 5.0) * FAST_CHARGE_SPEED_MUL * dt;
        t.v += ai._chargeDirV * (ai.moveSpeed ?? 5.0) * FAST_CHARGE_SPEED_MUL * dt;
        ai._chargeDur -= dt;
        if (ai._chargeDur <= 0) {
          ai._chargeDur = 0;
          ai._charging  = false;
          core.emit("fast:charge_ended", { entityId: id });
        }
      } else {
        ai._charging = false;
      }
    }
  }

  return system;
}

export default {
  createFastChargeSystem,
  FAST_CHARGE_MIN_DIST, FAST_CHARGE_MAX_DIST,
  FAST_CHARGE_DUR, FAST_CHARGE_SPEED_MUL,
  FAST_CHARGE_CD_MIN, FAST_CHARGE_CD_RAND,
};
