/** destructible-explode facet — when the host's health.hp drops to 0,
 *  apply AOE damage to nearby damageable Things, spawn impact decals
 *  at the host's position, and despawn the host. Cascade is implicit:
 *  another barrel taking enough damage will detonate on its own next
 *  tick when its destructible-explode runs.
 *
 *  Reads `destructible` facet on the host for { blastRadius, damage }.
 *  Scans `target_kinds_aoe` from destructible data (default: explosive
 *  kinds — barrel, crate, enemy). NO hardcoded numbers in handler.
 *
 *  Priority 27: just before enemy-death-cleanup (28), so a barrel that
 *  cascade-kills an adjacent enemy applies damage in the same frame
 *  that the enemy dies. Both fire their own cleanup.
 *
 *  Lift-ready: build AOE envelope list as locals first; the per-target
 *  applies become emit fan-out after the actor lift.
 *
 *  Data: { _detonated? } — sentinel so the same Thing can't fire twice. */
export default {
  priority: 27,
  tick(thing, data, _dt, registry) {
    if (!data || data._detonated) return;
    const health = registry.facetData(thing.id, "health");
    if (!health || typeof health.hp !== "number") return;
    if (health.hp > 0) return;

    const d = registry.facetData(thing.id, "destructible");
    if (!d) return;
    const radius = pickNum(d.blastRadius, d.blast_radius);
    const damage = pickNum(d.damage, d.max_damage);
    if (radius <= 0 || damage <= 0) return;

    const pos = registry.facetData(thing.id, "position");
    if (!pos) return;

    data._detonated = true;

    const kinds = Array.isArray(d.target_kinds_aoe) && d.target_kinds_aoe.length > 0
                ? d.target_kinds_aoe
                : ["enemy", "barrel", "crate"];

    const envelopes = [];
    const r2 = radius * radius;
    for (const k of kinds) {
      for (const target of registry.byKind(k)) {
        if (target.id === thing.id) continue;
        const tpos = registry.facetData(target.id, "position");
        if (!tpos) continue;
        const du = tpos.x - pos.x;
        const dv = tpos.z - pos.z;
        const d2 = du * du + dv * dv;
        if (d2 >= r2) continue;
        const dist = Math.sqrt(d2);
        const falloff = Math.max(0, 1 - dist / radius);
        envelopes.push({
          to: target.id,
          message: { kind: "damage", amount: damage * falloff, source: thing.id, at: Date.now() / 1000 },
        });
      }
    }

    for (const env of envelopes) {
      const th = registry.facetData(env.to, "health");
      if (th && typeof th.hp === "number") th.hp -= env.message.amount;
    }

    spawnExplosionPuffs(registry, thing.id, pos.x, pos.y, pos.z);

    try { registry.despawn(thing.id, "exploded"); } catch (_) { /* gone */ }
  }
};

function pickNum(a, b) {
  if (typeof a === "number") return a;
  if (typeof b === "number") return b;
  return 0;
}

function spawnExplosionPuffs(registry, sourceId, x, y, z) {
  const tuningName = "decal-particle-impact-tuning";
  let ttl_default = 0;
  for (const t of registry.byKind("tuning")) {
    if (t.name !== tuningName) continue;
    const tn = registry.facetData(t.id, "tuning");
    if (tn && typeof tn.ttl_default === "number") ttl_default = tn.ttl_default;
    break;
  }
  if (ttl_default <= 0) return;
  const safeId = sourceId.replace(/[/]/g, "_");
  const baseSeq = Date.now() % 1000000;
  const offsets = [[0, 0], [0.35, 0.2], [-0.35, -0.2], [0.2, -0.35], [-0.2, 0.35]];
  for (let i = 0; i < offsets.length; i++) {
    const [ox, oz] = offsets[i];
    const id = `decal-particle/explosion-${safeId}-${baseSeq}-${i}`;
    try {
      registry.spawn({
        id, kind: "decal-particle", name: id,
        facets: [
          { name: "position",    data: { x: x + ox, y: y + 0.5, z: z + oz } },
          { name: "mesh",        data: { tuning_ref: tuningName } },
          { name: "ttl",         data: { remaining: ttl_default } },
          { name: "expand-fade", data: {} },
        ],
      });
    } catch (_) { /* duplicate id ok to skip */ }
  }
}
