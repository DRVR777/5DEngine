/** kinetic-hit facet — projectile hit detection + damage application.
 *  Lift-ready per docs/ACTOR_TRAJECTORY.md: builds an explicit
 *  {to, message} envelope before delivering. When the actor lift lands,
 *  the deliver becomes an `emit` and this handler returns the envelope
 *  instead of applying it directly.
 *
 *  Two checks per tick:
 *    1. Target hit — scan byKind(target_kind) for one within `radius`.
 *       On hit: damage envelope → target.health, optional self-despawn.
 *    2. Wall hit (when `stop_on_collider` true) — scan byFacet("collider")
 *       for any AABB the bullet penetrates by more than `radius`. On
 *       wall hit: despawn the bullet immediately, no damage envelope.
 *
 *  Wall check runs FIRST so bullets that brush a wall and a target in
 *  the same tick still register the wall stop (no damage leaking
 *  through the wall).
 *
 *  Data: {
 *    radius:              hit distance (m)
 *    damage:              hp to subtract from target
 *    target_kind:         kind to scan ("enemy", "barrel", "crate", ...)
 *    despawn_on_hit:      bool — despawn this Thing after a target hit
 *    stop_on_collider?:   bool — despawn this Thing if it overlaps any
 *                                Thing's collider AABB. Default false
 *                                (legacy demo bullets don't carry walls).
 *    pending_hits?:       [] — last hit envelopes recorded (for inspection)
 *  } */
export default {
  priority: 45,
  tick(thing, data, _dt, registry) {
    if (!data || data.radius == null) return;
    const pos = registry.facetData(thing.id, "position");
    if (!pos) return;

    if (data.stop_on_collider && hitsWall(thing, pos, data.radius, registry)) {
      spawnImpactDecal(registry, thing.id, pos.x, pos.y, pos.z);
      try { registry.despawn(thing.id, "wall-hit"); } catch (_) { /* already gone */ }
      return;
    }

    if (data.target_kind == null) return;
    const r2 = data.radius * data.radius;
    let hit = null;
    for (const target of registry.byKind(data.target_kind)) {
      if (target.id === thing.id) continue;
      const tpos = registry.facetData(target.id, "position");
      if (!tpos) continue;
      const du = tpos.x - pos.x;
      const dv = tpos.z - pos.z;
      if (du * du + dv * dv < r2) { hit = target; break; }
    }
    if (!hit) return;

    // Build the envelope first — this is the lift-ready shape. When the
    // actor model lands, `envelope` becomes the emit and is RETURNED;
    // today we deliver it inline.
    const envelope = {
      to: hit.id,
      message: { kind: "damage", amount: data.damage, source: thing.id, at: Date.now() / 1000 },
    };

    const targetHealth = registry.facetData(hit.id, "health");
    if (targetHealth && typeof targetHealth.hp === "number") {
      targetHealth.hp -= envelope.message.amount;
    }

    if (!Array.isArray(data.pending_hits)) data.pending_hits = [];
    data.pending_hits.push(envelope);

    spawnImpactDecal(registry, thing.id, pos.x, pos.y, pos.z);
    if (data.despawn_on_hit) registry.despawn(thing.id, "kinetic-hit");
  }
};

function spawnImpactDecal(registry, sourceId, x, y, z) {
  const tuningName = "decal-particle-impact-tuning";
  let ttl_default = 0;
  for (const t of registry.byKind("tuning")) {
    if (t.name !== tuningName) continue;
    const tn = registry.facetData(t.id, "tuning");
    if (tn && typeof tn.ttl_default === "number") ttl_default = tn.ttl_default;
    break;
  }
  if (ttl_default <= 0) return;
  const seq = (Date.now() % 1000000);
  const id = `decal-particle/impact-${sourceId.replace(/[/]/g, "_")}-${seq}`;
  try {
    registry.spawn({
      id, kind: "decal-particle", name: id,
      facets: [
        { name: "position",    data: { x, y, z } },
        { name: "mesh",        data: { tuning_ref: tuningName } },
        { name: "ttl",         data: { remaining: ttl_default } },
        { name: "expand-fade", data: {} },
      ],
    });
  } catch (_) { /* duplicate id within the same ms is fine to skip */ }
}

function hitsWall(thing, pos, radius, registry) {
  for (const id of registry.byFacet("collider")) {
    if (id === thing.id) continue;
    const cpos = registry.facetData(id, "position");
    if (!cpos) continue;
    const col = registry.facetData(id, "collider");
    if (!col || typeof col.half_x !== "number" || typeof col.half_z !== "number") continue;
    const dx = pos.x - cpos.x;
    const dz = pos.z - cpos.z;
    if (Math.abs(dx) < col.half_x + radius && Math.abs(dz) < col.half_z + radius) return true;
  }
  return false;
}
