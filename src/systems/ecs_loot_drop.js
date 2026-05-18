/**
 * ecs_loot_drop.js — Enemy kill detection + loot drop system for 5DEngine
 *
 * Ported from 5DEngineMassive/index.html lines 1175-1182 (enemy type drop tables)
 * and lines 6650-6675 (pickup spawn on kill).
 *
 * This system is the authoritative kill detector for bullets and grenades.
 * When an enemy's HP reaches 0 via bullet:hit or grenade:exploded, it:
 *   1. Emits "enemy:killed" so score/AI/wave systems can react
 *   2. Spawns pickup entities (ammo + health) at the enemy's last position
 *   3. Emits "loot:dropped" for each pickup spawned
 *
 * Drop table (monolith lines 1175-1182, all 8 enemy types):
 *   grunt:      pistol_9mm ×12
 *   heavy:      pistol_9mm ×24 + 30hp
 *   fast:       pistol_9mm ×6
 *   poisoner:   pistol_9mm ×8
 *   incendiary: pistol_9mm ×10
 *   robot:      rifle_556  ×20 + 40hp
 *   boss:       rifle_556  ×60 + 80hp
 *   sniper:     rifle_556  ×15
 *
 * Events emitted on Core:
 *   "enemy:killed"  { entityId, type, heroId }
 *   "loot:dropped"  { u, v, kind, qty, ammoType? }
 *
 * Events listened to on Core:
 *   "bullet:hit"      { bulletId, targetId, dmg, ... }
 *   "grenade:exploded" { hits: [{entityId, dmg, kbU, kbV}], ownerId? }
 *
 * Usage:
 *   const sys = createLootDropSystem();
 *   Core.addSystem(sys, 11, "loot_drop"); // after bullet:9, combat:10, before ai:12
 *
 * To override the drop table (e.g. for testing or difficulty scaling):
 *   const sys = createLootDropSystem({ grunt: { dropAmmo: "pistol_9mm", dropQty: 5, dropHealth: 0 } });
 */

import { spawnPickup } from "./ecs_pickup.js";

// Default drop table — monolith line 1175-1182 parity
export const DROP_TABLE = {
  grunt:      { dropAmmo: "pistol_9mm", dropQty: 12, dropHealth:  0 },
  heavy:      { dropAmmo: "pistol_9mm", dropQty: 24, dropHealth: 30 },
  fast:       { dropAmmo: "pistol_9mm", dropQty:  6, dropHealth:  0 },
  poisoner:   { dropAmmo: "pistol_9mm", dropQty:  8, dropHealth:  0 },
  incendiary: { dropAmmo: "pistol_9mm", dropQty: 10, dropHealth:  0 },
  robot:      { dropAmmo: "rifle_556",  dropQty: 20, dropHealth: 40 },
  boss:       { dropAmmo: "rifle_556",  dropQty: 60, dropHealth: 80 },
  sniper:     { dropAmmo: "rifle_556",  dropQty: 15, dropHealth:  0 },
};

function _processKill(core, entityId, heroId, dropTable) {
  const ai = core.getComponent(entityId, "EnemyAI");
  const t  = core.getComponent(entityId, "Transform");
  if (!ai || !t) return;

  const type = ai.type ?? "grunt";
  core.emit("enemy:killed", { entityId, type, heroId: heroId ?? null });

  const def = dropTable[type];
  if (!def) return;

  if (def.dropAmmo && def.dropQty > 0) {
    spawnPickup(core, "ammo", t.u, t.v, { ammoItem: def.dropAmmo, qty: def.dropQty });
    core.emit("loot:dropped", { u: t.u, v: t.v, kind: "ammo", ammoType: def.dropAmmo, qty: def.dropQty });
  }

  if (def.dropHealth > 0) {
    spawnPickup(core, "health", t.u, t.v, { amount: def.dropHealth });
    core.emit("loot:dropped", { u: t.u, v: t.v, kind: "health", qty: def.dropHealth });
  }
}

/**
 * createLootDropSystem(dropTable?) → system function
 * @param {object} [dropTable] - override drop table (defaults to DROP_TABLE)
 */
export function createLootDropSystem(dropTable = DROP_TABLE) {
  let _wired = false;

  function system(dt, core) {
    if (!_wired) {
      _wired = true;

      // Bullet kill detection — bullet has already reduced hp before emitting
      core.on("bullet:hit", ({ bulletId, targetId }) => {
        const h = core.getComponent(targetId, "Health");
        if (!h || h.hp > 0) return; // still alive

        const b = core.getComponent(bulletId, "Bullet");
        _processKill(core, targetId, b?.ownerId ?? null, dropTable);
      });

      // Grenade kill detection — iterate hits, check hp for each
      core.on("grenade:exploded", ({ hits, ownerId }) => {
        for (const { entityId } of hits) {
          const h = core.getComponent(entityId, "Health");
          if (!h || h.hp > 0) continue;
          _processKill(core, entityId, ownerId ?? null, dropTable);
        }
      });
    }
  }

  return system;
}

export default { createLootDropSystem, DROP_TABLE };
