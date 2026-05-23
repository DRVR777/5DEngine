/** enemy-shoot facet — ranged enemy AI. When the broadcast hero pose
 *  is within the variant's `ranged_attack_range`, fires an enemy
 *  bullet toward the hero at cadence `ranged_attack_interval`. Sibling
 *  of `attack-target` (which is melee). A variant can have one or both.
 *
 *  All numbers come from the spawn's variant tuning via
 *  `mesh.tuning_ref`. Required keys (strict — handler no-ops if any
 *  missing):
 *    ranged_attack_range, ranged_attack_interval, ranged_damage,
 *    ranged_bullet_speed, ranged_bullet_ttl, ranged_bullet_hit_radius,
 *    ranged_muzzle_y, ranged_muzzle_forward
 *
 *  Lift-ready per docs/ACTOR_TRAJECTORY.md: builds the spawn envelope
 *  as a local before delivering. **FOURTH spawn-envelope handler**
 *  after particle-emitter (736), hero-shoot (741), drop-on-death (742).
 *  Strike condition already met (3/3 logged iter 742); deferred behind
 *  user playability pivot per GAME_HTML_INVENTORY sequencing.
 *
 *  Data: { heroU?, heroV?, _next_fire_at?, _seq? } */
export default {
  priority: 33,
  tick(thing, data, _dt, registry) {
    if (!data || data.heroU == null || data.heroV == null) return;
    const pos = registry.facetData(thing.id, "position");
    if (!pos) return;

    const t = resolveRanged(thing, registry);
    if (t === null) return;

    const du = data.heroU - pos.x;
    const dv = data.heroV - pos.z;
    const dist2 = du * du + dv * dv;
    if (dist2 > t.range * t.range) return;

    const nowSec = Date.now() / 1000;
    if (data._next_fire_at && nowSec < data._next_fire_at) return;
    data._next_fire_at = nowSec + t.interval;

    const dist = Math.sqrt(dist2);
    if (dist < 1e-6) return;
    const dirX = du / dist;
    const dirZ = dv / dist;

    const seq = (data._seq = (data._seq || 0) + 1);
    const envelope = {
      to: `bullet/enemy-${thing.id.replace(/[/]/g, "_")}-${seq}`,
      message: {
        kind: "spawn",
        facets: [
          { name: "position", data: {
            x: pos.x + dirX * t.muzzle_forward,
            y: t.muzzle_y,
            z: pos.z + dirZ * t.muzzle_forward,
            velocity: { x: dirX * t.bullet_speed, y: 0, z: dirZ * t.bullet_speed },
          }},
          { name: "mesh",        data: { tuning_ref: "bullet-enemy-tuning" } },
          { name: "ttl",         data: { remaining: t.bullet_ttl } },
          { name: "kinetic-hit", data: { radius: t.bullet_hit_radius, damage: t.damage,
                                         target_kind: "hero", despawn_on_hit: true, stop_on_collider: true } },
        ],
      },
    };

    try {
      registry.spawn({ id: envelope.to, kind: "bullet", name: envelope.to, facets: envelope.message.facets });
    } catch (e) {
      console.warn(`[ankhor] enemy-shoot spawn ${envelope.to}:`, e.message);
    }
  }
};

function resolveRanged(thing, registry) {
  const mesh = registry.facetData(thing.id, "mesh");
  if (!mesh || typeof mesh.tuning_ref !== "string") return null;
  for (const t of registry.byKind("tuning")) {
    if (t.name !== mesh.tuning_ref) continue;
    const tn = registry.facetData(t.id, "tuning");
    if (!tn) return null;
    if (typeof tn.ranged_attack_range     !== "number") return null;
    if (typeof tn.ranged_attack_interval  !== "number") return null;
    if (typeof tn.ranged_damage           !== "number") return null;
    if (typeof tn.ranged_bullet_speed     !== "number") return null;
    if (typeof tn.ranged_bullet_ttl       !== "number") return null;
    if (typeof tn.ranged_bullet_hit_radius!== "number") return null;
    if (typeof tn.ranged_muzzle_y         !== "number") return null;
    if (typeof tn.ranged_muzzle_forward   !== "number") return null;
    return {
      range:             tn.ranged_attack_range,
      interval:          tn.ranged_attack_interval,
      damage:            tn.ranged_damage,
      bullet_speed:      tn.ranged_bullet_speed,
      bullet_ttl:        tn.ranged_bullet_ttl,
      bullet_hit_radius: tn.ranged_bullet_hit_radius,
      muzzle_y:          tn.ranged_muzzle_y,
      muzzle_forward:    tn.ranged_muzzle_forward,
    };
  }
  return null;
}
