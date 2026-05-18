/**
 * ecs_sniper_shoot.js — Sniper fire cycle state machine for 5DEngine
 *
 * Ported from 5DEngineMassive/index.html lines 7410-7464:
 *   Line 7421: snPhase = (elapsed - _sniperPhaseT) % 4.0
 *   Line 7422: isLockon = snPhase >= 2.8
 *   Line 7451: fire when snPhase >= 3.95 AND cooldown > 3.5s
 *   Line 7452: _sniperPhaseT reset to now on shot (cycle restarts)
 *   Line 7414: retreat if hero < 9m
 *
 * Phase state machine (per entity, 4s cycle):
 *   0.0 – 2.79s: tracking (normal chase)
 *   2.8 – 3.94s: lock-on (laser sight visible, VFX)
 *   3.95s+:      fire → reset phase to 0
 *
 * Events emitted on Core:
 *   "sniper:locking"       { entityId }                           — on lock-on start
 *   "sniper:lock_released" { entityId }                           — on lock-on end/phase wrap
 *   "sniper:shot"          { entityId, u, v, targetU, targetV }   — on fire
 *   "sniper:retreat"       { entityId, heroU, heroV }             — hero < 9m (move back)
 *
 * Usage:
 *   const sys = createSniperShootSystem();
 *   Core.addSystem(sys, 13, "sniper_shoot"); // after ai_movement:12
 */

export const SNIPER_PHASE_DUR    = 4.0;   // monolith: cycle length
export const SNIPER_LOCKON_PHASE = 2.8;   // monolith line 7422: lock-on starts
export const SNIPER_SHOT_PHASE   = 3.95;  // monolith line 7451: fire threshold
export const SNIPER_SHOT_CD      = 3.5;   // monolith line 7451: minimum between shots
export const SNIPER_RETREAT_DIST = 9;     // monolith line 7414: back away if hero < 9m
export const SNIPER_BULLET_SPEED = 30;    // monolith line 7457
export const SNIPER_BULLET_RANGE = 25;    // monolith line 7457

/**
 * createSniperShootSystem() → system function
 */
export function createSniperShootSystem() {
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
      if (ai.type !== "sniper") continue;
      if (h.hp <= 0) continue;
      if (!heroT) continue;

      const dist   = Math.hypot(heroT.u - t.u, heroT.v - t.v);
      const canSee = dist <= (ai.sightRange ?? 22);
      if (!canSee) continue;

      // Retreat if hero too close
      if (dist < SNIPER_RETREAT_DIST) {
        core.emit("sniper:retreat", { entityId: id, heroU: heroT.u, heroV: heroT.v });
      }

      // Initialize phase timer on first sight
      if (ai._sniperPhaseT == null) ai._sniperPhaseT = _elapsed;

      const snPhase   = (_elapsed - ai._sniperPhaseT) % SNIPER_PHASE_DUR;
      const isLocking = snPhase >= SNIPER_LOCKON_PHASE;

      // Lock-on state transitions (emit once per edge)
      if (isLocking && !ai._wasLocking) {
        ai._wasLocking = true;
        core.emit("sniper:locking", { entityId: id });
      } else if (!isLocking && ai._wasLocking) {
        ai._wasLocking = false;
        core.emit("sniper:lock_released", { entityId: id });
      }

      // Fire
      if (snPhase >= SNIPER_SHOT_PHASE) {
        const lastShot = ai._sniperShotT ?? -999;
        if (_elapsed - lastShot > SNIPER_SHOT_CD) {
          ai._sniperShotT  = _elapsed;
          ai._sniperPhaseT = _elapsed; // restart cycle
          ai._wasLocking   = false;

          const dx   = heroT.u - t.u;
          const dz   = heroT.v - t.v;
          const mag  = Math.hypot(dx, dz) || 1;
          core.emit("sniper:shot", {
            entityId: id,
            u: t.u, v: t.v,
            targetU:  heroT.u, targetV: heroT.v,
            dirU:     dx / mag, dirV: dz / mag,
          });
          // Also emit lock_released to signal VFX to hide laser
          core.emit("sniper:lock_released", { entityId: id });
        }
      }
    }
  }

  return system;
}

export default {
  createSniperShootSystem,
  SNIPER_PHASE_DUR, SNIPER_LOCKON_PHASE, SNIPER_SHOT_PHASE,
  SNIPER_SHOT_CD, SNIPER_RETREAT_DIST,
  SNIPER_BULLET_SPEED, SNIPER_BULLET_RANGE,
};
