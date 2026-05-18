/**
 * ecs_fire_patch.js — Fire patch damage zones for 5DEngine
 *
 * Ported from 5DEngineMassive/index.html lines 3811-3822, 8272-8318:
 *   firePatches = []; default radius=1.5, duration=6.0
 *   fp.timeLeft -= dt; if <=0 → remove
 *   hero in radius: fp.dmgT -= dt; at 0 → heroHp -= 6, dmgT = 0.5
 *   enemy in radius: ai._fireDmgT -= dt; at 0 → hp -= 8, dmgT = 0.5
 *
 * FirePatch entities carry a FirePatch component:
 *   { u, v, radius, timeLeft, heroDmgT }
 * Enemy fire CD is stored as ai._fireDmgT (EnemyAI component).
 *
 * Events consumed:
 *   "fire:patch_spawned" { u, v, radius?, duration? }
 *
 * Events emitted on Core:
 *   "fire:hero_damage"    { damage }               — hero hit every 0.5s
 *   "fire:enemy_damage"   { entityId, damage }     — enemy hit every 0.5s
 *   "fire:patch_expired"  { u, v }                 — patch timed out
 *
 * Usage:
 *   const sys = createFirePatchSystem();
 *   sys.wireListeners(Core);
 *   Core.addSystem(sys, 11, "fire_patch");
 */

export const FIRE_RADIUS           = 1.5; // monolith line 3813: radius default
export const FIRE_DURATION         = 6.0; // monolith line 3813: duration default
export const FIRE_HERO_DAMAGE      = 6;   // monolith line 8287
export const FIRE_HERO_DMG_INTERVAL = 0.5; // monolith line 8285: dmgT = 0.5
export const FIRE_ENEMY_DAMAGE      = 8;   // monolith line 8301
export const FIRE_ENEMY_DMG_INTERVAL = 0.5; // monolith line 8300

export function createFirePatchSystem() {
  function system(dt, core) {
    const patches = core.query("FirePatch");
    const enemies  = core.query("EnemyAI", "Transform");
    const heroIds  = core.query("PlayerControl", "Transform");

    for (const pid of patches) {
      const fp = core.getComponent(pid, "FirePatch");
      if (!fp) continue;

      fp.timeLeft -= dt;
      if (fp.timeLeft <= 0) {
        core.emit("fire:patch_expired", { u: fp.u, v: fp.v });
        core.destroyEntity(pid);
        continue;
      }

      // Hero damage
      for (const hid of heroIds) {
        const ht = core.getComponent(hid, "Transform");
        if (!ht) continue;
        if (Math.hypot(ht.u - fp.u, ht.v - fp.v) < fp.radius) {
          fp.heroDmgT -= dt;
          if (fp.heroDmgT <= 0) {
            fp.heroDmgT = FIRE_HERO_DMG_INTERVAL;
            core.emit("fire:hero_damage", { damage: FIRE_HERO_DAMAGE });
          }
        }
      }

      // Enemy damage
      for (const eid of enemies) {
        const et = core.getComponent(eid, "Transform");
        const ai = core.getComponent(eid, "EnemyAI");
        if (!et || !ai) continue;
        if (Math.hypot(et.u - fp.u, et.v - fp.v) < fp.radius) {
          ai._fireDmgT = (ai._fireDmgT || 0) - dt;
          if (ai._fireDmgT <= 0) {
            ai._fireDmgT = FIRE_ENEMY_DMG_INTERVAL;
            core.emit("fire:enemy_damage", { entityId: eid, damage: FIRE_ENEMY_DAMAGE });
          }
        }
      }
    }
  }

  function wireListeners(core) {
    core.on("fire:patch_spawned", ({ u, v, radius, duration }) => {
      const id = core.createEntity();
      core.addComponent(id, "FirePatch", {
        u, v,
        radius:   radius   ?? FIRE_RADIUS,
        timeLeft: duration ?? FIRE_DURATION,
        heroDmgT: 0,
      });
    });
  }

  system.wireListeners = wireListeners;
  return system;
}

export default {
  createFirePatchSystem,
  FIRE_RADIUS, FIRE_DURATION,
  FIRE_HERO_DAMAGE, FIRE_HERO_DMG_INTERVAL,
  FIRE_ENEMY_DAMAGE, FIRE_ENEMY_DMG_INTERVAL,
};
