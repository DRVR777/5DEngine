/**
 * ecs_enemy_bullet.js — Enemy projectile travel and hero hit detection for 5DEngine
 *
 * Ported from 5DEngineMassive/index.html lines 6888-6920:
 *   Line 6890-6893: move posU/posV/posY += dir * speed * dt, traveled += speed * dt
 *   Line 6895-6896: hero hit: du²+dv² < 0.36 (0.6m) && |dh| < 0.9
 *   Line 6908: poisonOnHit applies StatusEffects.apply("hero", "poison")
 *   Line 6913-6914: near-miss: du²+dv² < 2.25 (1.5m) && |dh| < 1.2
 *   Line 6918: remove when traveled >= range
 *
 * Spawns EnemyBullet entities from ranged attack events:
 *   poisoner:venom_dart, robot:plasma_shot, sniper:shot
 *
 * EnemyBullet component shape:
 *   { posU, posV, posY, dirU, dirV, dirY, speed, damage, range, traveled, poisonOnHit }
 *
 * Events listened on Core:
 *   "poisoner:venom_dart" { u, v, dirU, dirV, dirY, speed, damage, range }
 *   "robot:plasma_shot"   { u, v, dirU, dirV, speed, damage, range }
 *   "sniper:shot"         { u, v, dirU, dirV, speed, damage, range }
 *
 * Events emitted on Core:
 *   "enemy_bullet:hit"      { bulletId, damage, poisonOnHit, posU, posV, posY }
 *   "enemy_bullet:near_miss" { bulletId }
 *   "enemy_bullet:expired"  { bulletId }
 *
 * Usage:
 *   const sys = createEnemyBulletSystem();
 *   Core.addSystem(sys, 11, "enemy_bullet"); // after ranged attack systems:13, before render
 */

export const ENEMY_BULLET_HIT_RADIUS_SQ  = 0.36;  // line 6896: 0.6m²
export const ENEMY_BULLET_HIT_Y_HALF     = 0.9;   // line 6896: ±0.9m vertical window
export const ENEMY_BULLET_NEAR_MISS_SQ   = 2.25;  // line 6913: 1.5m²
export const ENEMY_BULLET_NEAR_MISS_Y    = 1.2;   // line 6914
export const ENEMY_BULLET_NEAR_MISS_CD   = 0.5;   // line 6915: half-second cooldown
export const ENEMY_BULLET_HERO_Y         = 1.0;   // hero center height offset (line 6895)

/**
 * createEnemyBulletSystem() → system function
 */
export function createEnemyBulletSystem() {
  let _nearMissT = 0;

  function _spawnBullet(core, posU, posV, posY, dirU, dirV, dirY, speed, damage, range, poisonOnHit) {
    const id = core.createEntity();
    core.addComponent(id, "EnemyBullet", {
      posU, posV, posY,
      dirU, dirV, dirY: dirY ?? 0,
      speed, damage, range,
      traveled: 0,
      poisonOnHit: !!poisonOnHit,
    });
    return id;
  }

  function system(dt, core) {
    _nearMissT = Math.max(0, _nearMissT - dt);

    // Find hero transform once
    const heroIds = core.query("PlayerControl", "Transform");
    const heroId  = heroIds[0] ?? null;
    const heroT   = heroId != null ? core.getComponent(heroId, "Transform") : null;

    // Move all enemy bullets and check collision
    const bullets = core.query("EnemyBullet");
    for (const bid of bullets) {
      const b = core.getComponent(bid, "EnemyBullet");
      if (!b) continue;

      b.posU     += b.dirU * b.speed * dt;
      b.posV     += b.dirV * b.speed * dt;
      b.posY     += b.dirY * b.speed * dt;
      b.traveled += b.speed * dt;

      if (heroT) {
        const du = heroT.u - b.posU;
        const dv = heroT.v - b.posV;
        const dh = (heroT.y ?? 0) + ENEMY_BULLET_HERO_Y - b.posY;

        const distSq = du * du + dv * dv;

        if (distSq < ENEMY_BULLET_HIT_RADIUS_SQ && Math.abs(dh) < ENEMY_BULLET_HIT_Y_HALF) {
          core.emit("enemy_bullet:hit", {
            bulletId:    bid,
            damage:      b.damage,
            poisonOnHit: b.poisonOnHit,
            posU:        b.posU,
            posV:        b.posV,
            posY:        b.posY,
          });
          core.destroyEntity(bid);
          continue;
        }

        // Near-miss whiz
        if (_nearMissT <= 0 && distSq < ENEMY_BULLET_NEAR_MISS_SQ && Math.abs(dh) < ENEMY_BULLET_NEAR_MISS_Y) {
          _nearMissT = ENEMY_BULLET_NEAR_MISS_CD;
          core.emit("enemy_bullet:near_miss", { bulletId: bid });
        }
      }

      if (b.traveled >= b.range) {
        core.emit("enemy_bullet:expired", { bulletId: bid });
        core.destroyEntity(bid);
      }
    }
  }

  // Wire up spawn listeners — called once by the ECS boot to attach event handlers
  function wireListeners(core) {
    core.on("poisoner:venom_dart", e => {
      _spawnBullet(core, e.u, e.v, (e.y ?? 1.1), e.dirU, e.dirV, e.dirY, e.speed, e.damage, e.range, true);
    });
    core.on("robot:plasma_shot", e => {
      _spawnBullet(core, e.u, e.v, (e.y ?? 1.3), e.dirU, e.dirV, 0, e.speed, e.damage, e.range, false);
    });
    core.on("sniper:shot", e => {
      _spawnBullet(core, e.u, e.v, (e.y ?? 1.4), e.dirU, e.dirV, 0, e.speed, e.damage, e.range, false);
    });
  }

  system.wireListeners = wireListeners;
  return system;
}

export default {
  createEnemyBulletSystem,
  ENEMY_BULLET_HIT_RADIUS_SQ, ENEMY_BULLET_HIT_Y_HALF,
  ENEMY_BULLET_NEAR_MISS_SQ, ENEMY_BULLET_NEAR_MISS_Y,
  ENEMY_BULLET_NEAR_MISS_CD, ENEMY_BULLET_HERO_Y,
};
