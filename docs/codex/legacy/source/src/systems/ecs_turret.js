/**
 * ecs_turret.js — Auto-turret AI and fire control for 5DEngine
 *
 * Ported from 5DEngineMassive/index.html lines 2136-2231:
 *   _TURRET_HP=60, _TURRET_AMMO=40, _TURRET_RANGE=10, _TURRET_FIRE_RATE=1.8
 *   Find nearest enemy in range → rotate heading → fire at 1.8 rps
 *   Enemy melee: hp -= en.damage * dt * 0.8 when dist < en.attackRange
 *   No-target + ammo=0 → remove turret
 *
 * Turret entities carry a Turret component:
 *   { u, v, hp, maxHp, ammo, fireT, heading }
 *
 * Events consumed:
 *   "turret:placed" { u, v } — hero deploys a turret
 *
 * Events emitted on Core:
 *   "turret:fired"      { turretId, u, v, dirU, dirV, speed, damage, range }
 *   "turret:destroyed"  { turretId, u, v }
 *   "turret:ammo_empty" { turretId, u, v }
 *
 * Usage:
 *   const sys = createTurretSystem();
 *   sys.wireListeners(Core);
 *   Core.addSystem(sys, 14, "turret");
 */

export const TURRET_HP           = 60;   // monolith line 2138
export const TURRET_AMMO         = 40;   // monolith line 2139
export const TURRET_RANGE        = 10;   // monolith line 2140
export const TURRET_FIRE_RATE    = 1.8;  // monolith line 2141 (shots/s)
export const TURRET_BULLET_DAMAGE = 20;  // monolith line 2195
export const TURRET_BULLET_SPEED  = 90;  // monolith line 2195
export const TURRET_BULLET_RANGE  = 14;  // monolith line 2195: RANGE * 1.4
export const TURRET_IDLE_ROTATE   = 0.9; // monolith line 2216 (rad/s, idle rotation)
export const TURRET_MELEE_FACTOR  = 0.8; // monolith line 2203

export function createTurretSystem() {
  function system(dt, core) {
    const turrets = core.query("Turret");
    const enemies  = core.query("EnemyAI", "Transform");

    for (const tid of turrets) {
      const t = core.getComponent(tid, "Turret");
      if (!t) continue;

      let nearDist = TURRET_RANGE;
      let nearEid  = null;
      let nearT    = null;
      let nearAI   = null;

      for (const eid of enemies) {
        const et = core.getComponent(eid, "Transform");
        if (!et) continue;
        const d = Math.hypot(et.u - t.u, et.v - t.v);
        if (d < nearDist) {
          nearDist = d;
          nearEid  = eid;
          nearT    = et;
          nearAI   = core.getComponent(eid, "EnemyAI");
        }
      }

      if (nearT) {
        const dx = nearT.u - t.u, dz = nearT.v - t.v;
        t.heading = Math.atan2(dx, dz);
        t.fireT -= dt;
        if (t.fireT <= 0 && t.ammo > 0) {
          t.fireT = 1 / TURRET_FIRE_RATE;
          t.ammo--;
          const dirU = Math.sin(t.heading);
          const dirV = Math.cos(t.heading);
          core.emit("turret:fired", {
            turretId: tid, u: t.u, v: t.v,
            dirU, dirV,
            speed:  TURRET_BULLET_SPEED,
            damage: TURRET_BULLET_DAMAGE,
            range:  TURRET_BULLET_RANGE,
          });
        }

        const attackRange = nearAI ? (nearAI.attackRange || 1.6) : 1.6;
        if (nearDist < attackRange) {
          const meleeDmg = nearAI ? (nearAI.damage || 6) : 6;
          t.hp -= meleeDmg * dt * TURRET_MELEE_FACTOR;
          if (t.hp <= 0) {
            core.emit("turret:destroyed", { turretId: tid, u: t.u, v: t.v });
            core.destroyEntity(tid);
            continue;
          }
        }
      } else {
        t.heading += TURRET_IDLE_ROTATE * dt;
        if (t.ammo <= 0) {
          core.emit("turret:ammo_empty", { turretId: tid, u: t.u, v: t.v });
          core.destroyEntity(tid);
          continue;
        }
      }
    }
  }

  function wireListeners(core) {
    core.on("turret:placed", ({ u, v }) => {
      const id = core.createEntity();
      core.addComponent(id, "Turret", {
        u, v,
        hp:      TURRET_HP,
        maxHp:   TURRET_HP,
        ammo:    TURRET_AMMO,
        fireT:   0,
        heading: 0,
      });
    });
  }

  system.wireListeners = wireListeners;
  return system;
}

export default {
  createTurretSystem,
  TURRET_HP, TURRET_AMMO, TURRET_RANGE, TURRET_FIRE_RATE,
  TURRET_BULLET_DAMAGE, TURRET_BULLET_SPEED, TURRET_BULLET_RANGE,
  TURRET_IDLE_ROTATE, TURRET_MELEE_FACTOR,
};
