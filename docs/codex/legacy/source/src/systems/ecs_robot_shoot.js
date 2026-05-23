/**
 * ecs_robot_shoot.js — Robot plasma bolt ranged attack for 5DEngine
 *
 * Ported from 5DEngineMassive/index.html lines 7215-7232:
 *   Line 7216: trigger: type=robot, canSee, dist < 10
 *   Line 7217: cooldown 1.5s (en._lastShootT)
 *   Line 7219: direction: Math.atan2(hero.u - ep.u, hero.v - ep.v)
 *   Line 7220: shootPitch = Math.atan2(1.2 - 0.1, dist) (arc over terrain)
 *   Line 7230: speed=14, damage=12, range=12
 *
 * Events emitted on Core:
 *   "robot:plasma_shot" { entityId, u, v, dirU, dirV, speed, damage, range }
 *
 * Usage:
 *   const sys = createRobotShootSystem();
 *   Core.addSystem(sys, 13, "robot_shoot"); // after ai_movement:12
 */

export const ROBOT_SHOOT_RANGE      = 10;   // monolith line 7216: dist < 10
export const ROBOT_SHOOT_CD         = 1.5;  // monolith line 7217: 1.5s cooldown
export const ROBOT_SHOOT_SPEED      = 14;   // monolith line 7230
export const ROBOT_SHOOT_DAMAGE     = 12;   // monolith line 7230
export const ROBOT_SHOOT_MAX_RANGE  = 12;   // monolith line 7230: bullet travels 12m

/**
 * createRobotShootSystem() → system function
 */
export function createRobotShootSystem() {
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
      if (ai.type !== "robot") continue;
      if (h.hp <= 0) continue;
      if (!heroT) continue;

      const dist   = Math.hypot(heroT.u - t.u, heroT.v - t.v);
      const canSee = dist <= (ai.sightRange ?? 14);
      if (!canSee || dist >= ROBOT_SHOOT_RANGE) continue;

      const lastShoot = ai._robotShootT ?? -999;
      if (_elapsed - lastShoot < ROBOT_SHOOT_CD) continue;

      ai._robotShootT = _elapsed;

      const dx  = heroT.u - t.u;
      const dz  = heroT.v - t.v;
      const mag = Math.hypot(dx, dz) || 1;

      // Pitch arc over terrain (monolith line 7220-7221)
      const shootPitch = Math.atan2(1.1, dist); // 1.2-0.1 = 1.1 height diff
      const cosP       = Math.cos(shootPitch);

      core.emit("robot:plasma_shot", {
        entityId: id,
        u:    t.u,
        v:    t.v,
        dirU: (dx / mag) * cosP,
        dirV: (dz / mag) * cosP,
        speed:   ROBOT_SHOOT_SPEED,
        damage:  ROBOT_SHOOT_DAMAGE,
        range:   ROBOT_SHOOT_MAX_RANGE,
      });
    }
  }

  return system;
}

export default {
  createRobotShootSystem,
  ROBOT_SHOOT_RANGE, ROBOT_SHOOT_CD,
  ROBOT_SHOOT_SPEED, ROBOT_SHOOT_DAMAGE, ROBOT_SHOOT_MAX_RANGE,
};
