/**
 * ecs_mine.js — Proximity mine placement and detonation for 5DEngine
 *
 * Ported from 5DEngineMassive/index.html lines 2233-2302:
 *   _mines.push({ u, v, armed: false, armT: 1.2 });
 *   if (!mn.armed) { mn.armT -= dt; if (mn.armT <= 0) mn.armed = true; }
 *   if (hypot(ep.u - mn.u, ep.v - mn.v) < 1.2) → detonate
 *   blast radius 3.0m: dmg = round(90 * (1 - d / 3.0))
 *
 * Mine entities carry a Mine component: { u, v, armT, armed }
 * All damage/kill side-effects are expressed as emitted events.
 *
 * Events consumed:
 *   "mine:placed" { u, v } — hero drops a mine at (u, v)
 *
 * Events emitted on Core:
 *   "mine:armed"        { mineId }                   — when arming delay expires
 *   "mine:detonated"    { mineId, u, v }             — mine triggered by enemy
 *   "mine:blast_damage" { entityId, damage, u, v }   — per enemy in blast radius
 *
 * Usage:
 *   const sys = createMineSystem();
 *   sys.wireListeners(Core);
 *   Core.addSystem(sys, 14, "mine");
 */

export const MINE_ARM_TIME    = 1.2; // monolith line 2250: armT: 1.2
export const MINE_TRIGGER_DIST = 1.2; // monolith line 2264: < 1.2
export const MINE_BLAST_RADIUS = 3.0; // monolith line 2272: _mBlast = 3.0
export const MINE_MAX_DAMAGE   = 90;  // monolith line 2279: 90 * (1 - d / _mBlast)

export function createMineSystem() {
  function system(dt, core) {
    const mines   = core.query("Mine");
    const enemies = core.query("EnemyAI", "Transform");

    for (const mid of mines) {
      const mn = core.getComponent(mid, "Mine");
      if (!mn) continue;

      if (!mn.armed) {
        mn.armT -= dt;
        if (mn.armT <= 0) {
          mn.armed = true;
          core.emit("mine:armed", { mineId: mid });
        }
      }

      if (!mn.armed) continue;

      let detonated = false;
      for (const eid of enemies) {
        const t = core.getComponent(eid, "Transform");
        if (!t) continue;
        if (Math.hypot(t.u - mn.u, t.v - mn.v) < MINE_TRIGGER_DIST) {
          core.emit("mine:detonated", { mineId: mid, u: mn.u, v: mn.v });

          for (const eid2 of enemies) {
            const t2 = core.getComponent(eid2, "Transform");
            if (!t2) continue;
            const d = Math.hypot(t2.u - mn.u, t2.v - mn.v);
            if (d < MINE_BLAST_RADIUS) {
              const damage = Math.round(MINE_MAX_DAMAGE * (1 - d / MINE_BLAST_RADIUS));
              core.emit("mine:blast_damage", { entityId: eid2, damage, u: t2.u, v: t2.v });
            }
          }

          core.destroyEntity(mid);
          detonated = true;
          break;
        }
      }
      if (detonated) continue;
    }
  }

  function wireListeners(core) {
    core.on("mine:placed", ({ u, v }) => {
      const id = core.createEntity();
      core.addComponent(id, "Mine", { u, v, armT: MINE_ARM_TIME, armed: false });
    });
  }

  system.wireListeners = wireListeners;
  return system;
}

export default {
  createMineSystem,
  MINE_ARM_TIME,
  MINE_TRIGGER_DIST,
  MINE_BLAST_RADIUS,
  MINE_MAX_DAMAGE,
};
