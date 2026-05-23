/**
 * ecs_gunshot_alert.js — Gunshot alert propagation + approach movement for 5DEngine
 *
 * Ported from 5DEngineMassive/index.html:
 *   Line 5937:  _heroShotAlertT = 3.0 set on each hero shot
 *   Line 6888:  alert timer decrements per frame
 *   Lines 7083-7086: enemies within 9m without LOS get alerted
 *   Lines 7154-7166: alerted enemies move toward shot position at 0.7× speed,
 *                     arrive within 1.2m → clear alert
 *
 * Alert flow:
 *   weapon:fired (hero) → scan enemies within 9m of shot pos, set ai._heardShotT
 *   Per-tick: enemies with _heardShotT > 0 and !canSee move toward alert position
 *             ai_movement skips these entities (guard added there)
 *
 * Events emitted on Core:
 *   "enemy:heard_shot" { entityId, alertU, alertV }  — on alert set (once per shot)
 *   "enemy:alerting"   { entityId }                  — each tick while approaching
 *
 * Events listened to on Core:
 *   "weapon:fired" { entityId, ... }
 *
 * Usage:
 *   const sys = createGunshotAlertSystem();
 *   Core.addSystem(sys, 13, "gunshot_alert"); // after ai_movement:12
 */

export const GUNSHOT_ALERT_RADIUS     = 9;    // monolith line 7085: within 9m of shot
export const GUNSHOT_ALERT_DUR        = 3.0;  // monolith line 5937: alert lasts 3s
export const GUNSHOT_ALERT_SPEED_MUL  = 0.7;  // monolith line 7162: approach at 0.7×
export const GUNSHOT_ALERT_ARRIVE_DIST = 1.2;  // monolith line 7158: stop within 1.2m

/**
 * createGunshotAlertSystem() → system function
 */
export function createGunshotAlertSystem() {
  let _elapsed = 0;
  let _wired   = false;

  function system(dt, core) {
    _elapsed += dt;

    if (!_wired) {
      _wired = true;

      core.on("weapon:fired", ({ entityId }) => {
        // Only alert for hero shots
        const pc = core.getComponent(entityId, "PlayerControl");
        if (!pc) return;
        const shooterT = core.getComponent(entityId, "Transform");
        if (!shooterT) return;

        const shotU = shooterT.u;
        const shotV = shooterT.v;

        // Find hero so we can test LOS approximation (dist-based)
        const heroT = shooterT; // shooter IS the hero for weapon:fired

        const enemies = core.query("EnemyAI", "Transform", "Health");
        for (const id of enemies) {
          const ai = core.getComponent(id, "EnemyAI");
          const t  = core.getComponent(id, "Transform");
          const h  = core.getComponent(id, "Health");
          if (!ai || !t || !h || h.hp <= 0) continue;
          if (ai._wasChasing) continue; // already chasing hero

          const heroDistFromEnemy = Math.hypot(heroT.u - t.u, heroT.v - t.v);
          const canSee = heroDistFromEnemy <= (ai.sightRange ?? 12);
          if (canSee) continue; // has LOS to hero — doesn't need shot alert

          const shotDist = Math.hypot(t.u - shotU, t.v - shotV);
          if (shotDist >= GUNSHOT_ALERT_RADIUS) continue; // too far from shot

          ai._heardShotT = GUNSHOT_ALERT_DUR;
          ai._alertU     = shotU;
          ai._alertV     = shotV;
          core.emit("enemy:heard_shot", { entityId: id, alertU: shotU, alertV: shotV });
        }
      });
    }

    // Per-tick: alert approach movement
    const heroIds = core.query("PlayerControl", "Transform");
    const heroId  = heroIds[0] ?? null;
    const heroT   = heroId != null ? core.getComponent(heroId, "Transform") : null;

    const enemies = core.query("EnemyAI", "Transform", "Health");
    for (const id of enemies) {
      const ai = core.getComponent(id, "EnemyAI");
      const t  = core.getComponent(id, "Transform");
      const h  = core.getComponent(id, "Health");
      if (!ai || !t || !h) continue;
      if (!(ai._heardShotT > 0)) continue;
      if (h.hp <= 0) { ai._heardShotT = 0; continue; }

      // Cancel alert if hero now visible
      if (heroT) {
        const heroDist = Math.hypot(heroT.u - t.u, heroT.v - t.v);
        if (heroDist <= (ai.sightRange ?? 12)) {
          ai._heardShotT = 0;
          continue;
        }
      }

      ai._heardShotT -= dt;

      const adx   = (ai._alertU ?? t.u) - t.u;
      const adz   = (ai._alertV ?? t.v) - t.v;
      const aDist = Math.hypot(adx, adz);

      if (aDist <= GUNSHOT_ALERT_ARRIVE_DIST) {
        ai._heardShotT = 0; // arrived — stop searching
        continue;
      }

      const aAng = Math.atan2(adx, adz);
      const spd  = (ai.moveSpeed ?? 2.4) * GUNSHOT_ALERT_SPEED_MUL;
      t.u += Math.sin(aAng) * spd * dt;
      t.v += Math.cos(aAng) * spd * dt;

      core.emit("enemy:alerting", { entityId: id });
    }
  }

  return system;
}

export default {
  createGunshotAlertSystem,
  GUNSHOT_ALERT_RADIUS, GUNSHOT_ALERT_DUR,
  GUNSHOT_ALERT_SPEED_MUL, GUNSHOT_ALERT_ARRIVE_DIST,
};
