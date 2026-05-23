/** kinetic-hit facet — projectile hit detection + damage application.
 *  Lift-ready per docs/ACTOR_TRAJECTORY.md: builds an explicit
 *  {to, message} envelope before delivering. When the actor lift lands,
 *  the deliver becomes an `emit` and this handler returns the envelope
 *  instead of applying it directly.
 *
 *  Data: {
 *    radius:           hit distance (m)
 *    damage:           hp to subtract from target
 *    target_kind:      kind to scan ("enemy", "barrel", "crate", ...)
 *    despawn_on_hit:   bool — if true, despawn this Thing after a hit
 *    pending_hits?:    [] — last hit envelopes recorded (for inspection)
 *  } */
export default {
  priority: 45,
  tick(thing, data, _dt, registry) {
    if (!data || data.radius == null || data.target_kind == null) return;
    const pos = registry.facetData(thing.id, "position");
    if (!pos) return;

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

    if (data.despawn_on_hit) registry.despawn(thing.id, "kinetic-hit");
  }
};
