/** aabb-collision facet — runs on movers (hero today; vehicles + NPCs
 *  later). After the mover writes its new position this tick, this
 *  facet scans every Thing carrying a `collider` facet and, if their
 *  AABBs overlap, pushes the mover back along the shallowest axis.
 *
 *  Priority 11: runs immediately AFTER hero-input-move (10) so the
 *  free position write already happened. Subsequent facets see the
 *  resolved position.
 *
 *  Naive O(N*M) scan — fine at ~20 colliders. The 5D-truth spatial
 *  index (per docs/SECOND_ABSTRACTION_PHASE.md "Missing for true 5D")
 *  is the eventual broadphase upgrade and will fold u/v in at the
 *  same time.
 *
 *  Mover's own half-extents from data.half_x/half_z (or hero-tuning
 *  body_radius if mover is hero and data is empty).
 *
 *  Lift-ready: builds pushX/pushZ as locals before assigning.
 *
 *  Data: { half_x?, half_z?, _last_overlap_count? }  on the mover */
export default {
  priority: 11,
  tick(thing, data, _dt, registry) {
    const pos = registry.facetData(thing.id, "position");
    if (!pos) return;

    const me = resolveMoverExtents(thing, data, registry);
    if (me.half_x <= 0 || me.half_z <= 0) return;

    let overlaps = 0;
    for (const id of registry.byFacet("collider")) {
      if (id === thing.id) continue;
      const cpos = registry.facetData(id, "position");
      if (!cpos) continue;
      const col = registry.facetData(id, "collider");
      if (!col || typeof col.half_x !== "number" || typeof col.half_z !== "number") continue;

      const dx = pos.x - cpos.x;
      const dz = pos.z - cpos.z;
      const overlapX = (me.half_x + col.half_x) - Math.abs(dx);
      if (overlapX <= 0) continue;
      const overlapZ = (me.half_z + col.half_z) - Math.abs(dz);
      if (overlapZ <= 0) continue;

      // Push along the shallowest axis.
      let pushX = 0, pushZ = 0;
      if (overlapX < overlapZ) {
        pushX = (dx >= 0 ? 1 : -1) * overlapX;
      } else {
        pushZ = (dz >= 0 ? 1 : -1) * overlapZ;
      }
      pos.x += pushX;
      pos.z += pushZ;
      overlaps += 1;
    }

    if (data) data._last_overlap_count = overlaps;
  }
};

function resolveMoverExtents(thing, data, registry) {
  if (data && typeof data.half_x === "number" && typeof data.half_z === "number") {
    return { half_x: data.half_x, half_z: data.half_z };
  }
  const tuningName = tuningNameFor(thing, registry);
  if (tuningName) {
    for (const t of registry.byKind("tuning")) {
      if (t.name !== tuningName) continue;
      const tn = registry.facetData(t.id, "tuning");
      if (tn && typeof tn.body_radius === "number") {
        return { half_x: tn.body_radius, half_z: tn.body_radius };
      }
      break;
    }
  }
  return { half_x: 0, half_z: 0 };
}

function tuningNameFor(thing, registry) {
  if (thing.kind === "hero") return "hero-tuning";
  const mesh = registry.facetData(thing.id, "mesh");
  if (mesh && typeof mesh.tuning_ref === "string" && mesh.tuning_ref) return mesh.tuning_ref;
  return null;
}
