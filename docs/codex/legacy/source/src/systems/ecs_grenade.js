/**
 * ecs_grenade.js — ECS grenade system (fuse countdown + AoE explosion) for 5DEngine
 *
 * Ported from 5DEngineMassive/index.html:
 *   _explodeGrenade (line 2307): RADIUS=14, MAX_DMG=80, knockback strength=14
 *   default fuse = 2.5s (line 2301)
 *   knockback duration = 0.28s (line 2401)
 *   stagger radius = 5m, stagger duration = 1.5s (line 2403)
 *
 * Grenade component:
 *   Grenade: { fuseLeft, u, v, y, kind, ownerId, blastRadius, maxDmg, kbStrength }
 *   - fuseLeft:    seconds until explosion
 *   - kind:        "frag" | "smoke" | "flash" | "acid" | "fire" (default "frag")
 *   - ownerId:     entity that threw it (for scoring)
 *   - blastRadius: AoE radius (default 14m from monolith)
 *   - maxDmg:      peak damage at center (default 80)
 *   - kbStrength:  knockback force at center (default 14)
 *
 * Events emitted on Core:
 *   "grenade:exploded"  { grenadeId, u, v, kind, hits: [{entityId, dmg, kbU, kbV}] }
 *   "grenade:knockback" { entityId, kbU, kbV, kbT }   — per-target blast push
 *   "grenade:stagger"   { entityId }                   — within 5m, stumble 1.5s
 *
 * Events listened to on Core:
 *   "grenade:throw" { ownerId, u, v, y?, kind?, fuseOverride? }
 *     → spawns a Grenade entity with a default 2.5s fuse
 *
 * Usage:
 *   const sys = createGrenadeSystem();
 *   Core.addSystem(sys, 22, "grenade"); // after status:15, before regen:35
 */

export const GRENADE_FUSE        = 2.5;  // seconds (monolith line 2301)
export const GRENADE_RADIUS      = 14;   // blast radius in metres (monolith line 2388)
export const GRENADE_MAX_DMG     = 80;   // peak damage at blast center (monolith line 2388)
export const GRENADE_KB_STRENGTH = 14;   // knockback magnitude at center (monolith line 2398)
export const GRENADE_KB_DUR      = 0.28; // knockback seconds (monolith line 2401)
export const GRENADE_STAGGER_R   = 5;    // stagger radius (monolith line 2403)
export const GRENADE_STAGGER_DUR = 1.5;  // stagger seconds (monolith line 2403)

/**
 * spawnGrenade(core, opts) → grenadeEntityId
 * Pure spawn helper — does not require the system to be running.
 */
export function spawnGrenade(core, opts = {}) {
  const id = core.createEntity();
  core.addComponent(id, "Grenade", {
    fuseLeft:    opts.fuseOverride ?? GRENADE_FUSE,
    u:           opts.u ?? 0,
    v:           opts.v ?? 0,
    y:           opts.y ?? 0.5,
    kind:        opts.kind ?? "frag",
    ownerId:     opts.ownerId ?? null,
    blastRadius: opts.blastRadius ?? GRENADE_RADIUS,
    maxDmg:      opts.maxDmg     ?? GRENADE_MAX_DMG,
    kbStrength:  opts.kbStrength ?? GRENADE_KB_STRENGTH,
  });
  return id;
}

/**
 * explodeGrenade(core, grenadeId) → array of hit records
 * Pure explosion logic — queries enemies and hero for AoE.
 * Returns [{entityId, dmg, kbU, kbV}] for all entities hit.
 * Destroys the grenade entity after explosion.
 */
export function explodeGrenade(core, grenadeId) {
  const g = core.getComponent(grenadeId, "Grenade");
  if (!g) return [];

  const { u, v, kind, blastRadius, maxDmg, kbStrength, ownerId } = g;
  const hits = [];

  if (kind === "frag") {
    // AoE damage + knockback on all entities with Transform + Health
    const targets = core.query("Transform", "Health");
    for (const tid of targets) {
      if (tid === ownerId) continue; // don't self-damage

      const t = core.getComponent(tid, "Transform");
      const h = core.getComponent(tid, "Health");
      if (!t || !h || h.hp <= 0) continue;

      const dx = t.u - u, dz = t.v - v;
      const d  = Math.hypot(dx, dz);
      if (d >= blastRadius) continue;

      const dmg = Math.round(maxDmg * (1 - d / blastRadius));
      if (dmg <= 0) continue;

      h.hp = Math.max(0, h.hp - dmg);

      // Knockback vector (outward from explosion)
      const len = d || 1;
      const kbStr = Math.max(0, kbStrength * (1 - d / blastRadius));
      const kbU = (dx / len) * kbStr;
      const kbV = (dz / len) * kbStr;

      hits.push({ entityId: tid, dmg, kbU, kbV });

      core.emit("grenade:knockback", { entityId: tid, kbU, kbV, kbT: GRENADE_KB_DUR });
      if (d < GRENADE_STAGGER_R) {
        core.emit("grenade:stagger", { entityId: tid, duration: GRENADE_STAGGER_DUR });
      }
    }
  }

  core.emit("grenade:exploded", { grenadeId, u, v, kind, hits, ownerId });
  core.destroyEntity(grenadeId);
  return hits;
}

/**
 * createGrenadeSystem() → system function
 */
export function createGrenadeSystem() {
  let _wired = false;

  function system(dt, core) {
    if (!_wired) {
      _wired = true;

      core.on("grenade:throw", (opts) => {
        spawnGrenade(core, opts);
      });
    }

    // Tick all live grenades
    const ids = core.query("Grenade");
    const toExplode = [];

    for (const id of ids) {
      const g = core.getComponent(id, "Grenade");
      if (!g) continue;

      g.fuseLeft -= dt;
      if (g.fuseLeft <= 0) {
        toExplode.push(id);
      }
    }

    // Explode after the query loop to avoid mutation during iteration
    for (const id of toExplode) {
      explodeGrenade(core, id);
    }
  }

  return system;
}

export default { createGrenadeSystem, spawnGrenade, explodeGrenade,
                 GRENADE_FUSE, GRENADE_RADIUS, GRENADE_MAX_DMG,
                 GRENADE_KB_STRENGTH, GRENADE_KB_DUR, GRENADE_STAGGER_R };
