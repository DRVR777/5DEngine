/** dodge facet — native Ankhor replacement for the legacy
 *  mountDodgeTick (data/legacy/dodge.json).
 *
 *  Legacy contract (src/systems/dodge_tick.js):
 *
 *    mountDodgeTick({ get, set, actions })
 *      tick(dt) {
 *        if (get.dodgeCooldown() > 0) dodgeCooldown -= dt;
 *        if (dodgeT <= 0) { dodgeBashDone = false; return; }
 *        dodgeT -= dt;
 *        pos += (dodgeVelU * dt, dodgeVelV * dt) in u/v plane
 *        actions.spawnTrail(pos.u, pos.y, pos.v);
 *        if (!dodgeBashDone && actions.tryBash(pos)) dodgeBashDone = true;
 *      }
 *
 *  Native version:
 *    - State on hero.inventory: dodge_cooldown, dodge_t, dodge_vel_x,
 *      dodge_vel_z, dodge_bash_done.
 *    - Legacy u/v plane → substrate x/z (hero stays on 3D position
 *      facet until the hero migration adds u, v).
 *    - Trail decals spawned via direct registry.spawn each active tick
 *      (no $emit DSL detour) — same kind/tuning_ref/ttl as legacy spec.
 *    - tryBash is no-op (legacy spec bound it to $noop; bash collision
 *      will be its own facet).
 *
 *  Priority 20: ahead of cam-pitch-springs (21) and hero-knockback
 *  (22) — dodge movement should land before camera/knockback react.
 *
 *  NO hardcoded numbers; no `??` fallbacks. */
export default {
  priority: 20,
  tick(_thing, _data, dt, registry) {
    const tn = readHeroTuning(registry);
    if (!tn) return;

    const heroes = registry.byKind("hero");
    if (heroes.length === 0) return;
    const hero = heroes[0];
    const inv = registry.facetData(hero.id, "inventory");
    const pos = registry.facetData(hero.id, "position");
    if (!inv || !pos) return;

    if (typeof inv.dodge_cooldown  !== "number")  inv.dodge_cooldown  = 0;
    if (typeof inv.dodge_t         !== "number")  inv.dodge_t         = 0;
    if (typeof inv.dodge_vel_x     !== "number")  inv.dodge_vel_x     = 0;
    if (typeof inv.dodge_vel_z     !== "number")  inv.dodge_vel_z     = 0;
    if (typeof inv.dodge_bash_done !== "boolean") inv.dodge_bash_done = false;

    if (inv.dodge_cooldown > 0) inv.dodge_cooldown -= dt;

    if (inv.dodge_t <= 0) {
      inv.dodge_bash_done = false;
      return;
    }

    inv.dodge_t -= dt;
    pos.x += inv.dodge_vel_x * dt;
    pos.z += inv.dodge_vel_z * dt;
    spawnTrail(pos, registry, tn);
  },
};

function readHeroTuning(registry) {
  for (const t of registry.byKind("tuning")) {
    if (t.name !== "hero-tuning") continue;
    const tn = registry.facetData(t.id, "tuning");
    if (!tn) return null;
    if (typeof tn.dodge_trail_ttl !== "number") return null;
    return tn;
  }
  return null;
}

function spawnTrail(pos, registry, tn) {
  const seq = (registry._dodgeTrailSeq = (registry._dodgeTrailSeq || 0) + 1);
  const id  = `decal-particle/dodge-trail-${seq}`;
  try {
    registry.spawn({
      id, kind: "decal-particle", name: id,
      facets: [
        { name: "position",    data: { x: pos.x, y: pos.y, z: pos.z } },
        { name: "mesh",        data: { tuning_ref: "decal-particle-impact-tuning" } },
        { name: "ttl",         data: { remaining: tn.dodge_trail_ttl } },
        { name: "expand-fade", data: {} },
      ],
    });
  } catch (_) { /* duplicate id within same ms ok to skip */ }
}
