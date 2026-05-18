/**
 * ecs_robot_emp.js — Robot EMP burst system for 5DEngine
 *
 * Ported from 5DEngineMassive/index.html lines 7234-7253:
 *   Line 7235: trigger: type=robot, canSee, dist < 12m
 *   Line 7236: cooldown: 8.0s
 *   Line 7247: effect applies when hero dist < 4m
 *   Line 7248: hero sprint disabled for 2.5s (_heroEmpT = 2.5)
 *
 * Events emitted on Core:
 *   "robot:emp"   { entityId, u, v }           — for VFX ring + audio (always)
 *   "hero:emped"  { duration, sourceId }        — when hero within 4m (sprint disable)
 *
 * Usage:
 *   const sys = createRobotEmpSystem();
 *   Core.addSystem(sys, 15, "robot_emp"); // after ai_movement:12, before status_effects:15
 */

export const ROBOT_EMP_TRIGGER_DIST = 12;   // monolith line 7235: dist < 12
export const ROBOT_EMP_EFFECT_DIST  = 4;    // monolith line 7247: dist < 4 for hero effect
export const ROBOT_EMP_CD           = 8.0;  // monolith line 7236
export const ROBOT_EMP_DUR          = 2.5;  // monolith line 7248: sprint disabled 2.5s

/**
 * createRobotEmpSystem() → system function
 */
export function createRobotEmpSystem() {
  let _elapsed = 0;

  function system(dt, core) {
    _elapsed += dt;

    const enemies = core.query("EnemyAI", "Transform", "Health");
    if (!enemies.length) return;

    const heroIds = core.query("PlayerControl", "Transform");
    const heroId  = heroIds[0] ?? null;
    const heroT   = heroId != null ? core.getComponent(heroId, "Transform") : null;
    const heroH   = heroId != null ? core.getComponent(heroId, "Health")    : null;

    for (const id of enemies) {
      const ai = core.getComponent(id, "EnemyAI");
      const t  = core.getComponent(id, "Transform");
      const h  = core.getComponent(id, "Health");
      if (!ai || !t || !h) continue;
      if (ai.type !== "robot") continue;
      if (h.hp <= 0) continue;

      if (!heroT) continue;

      const dist   = Math.hypot(heroT.u - t.u, heroT.v - t.v);
      const canSee = dist <= (ai.sightRange ?? 14);
      if (!canSee || dist >= ROBOT_EMP_TRIGGER_DIST) continue;

      const lastEmp = ai._empT ?? -999;
      if (_elapsed - lastEmp < ROBOT_EMP_CD) continue;

      // Fire EMP
      ai._empT = _elapsed;
      core.emit("robot:emp", { entityId: id, u: t.u, v: t.v });

      // Apply hero effect if close enough and alive
      if (heroH && heroH.hp > 0 && dist < ROBOT_EMP_EFFECT_DIST) {
        core.emit("hero:emped", { duration: ROBOT_EMP_DUR, sourceId: id });
      }
    }
  }

  return system;
}

export default {
  createRobotEmpSystem,
  ROBOT_EMP_TRIGGER_DIST, ROBOT_EMP_EFFECT_DIST,
  ROBOT_EMP_CD, ROBOT_EMP_DUR,
};
