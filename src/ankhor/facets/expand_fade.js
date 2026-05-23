/** expand-fade facet — animates a short-lived particle from a starting
 *  scale/opacity to an ending scale/opacity over its ttl lifetime.
 *  Tracks initial ttl on first tick, then computes progress k =
 *  1 - remaining/initial each frame. Reads scale_start/end +
 *  opacity_start/end from the spawn's mesh.tuning_ref tuning.
 *
 *  Priority 24: between health-display (65) and mesh (70) — actually
 *  must run BEFORE mesh tick so the threeObj scale is set before the
 *  mesh handler positions it. Priority 60 puts it before mesh (70).
 *  Picked 60.
 *
 *  Lift-ready: computes new scale + opacity as locals, assigns last.
 *
 *  Data: { _initial_ttl?, _ttl_resolved? }  */
export default {
  priority: 60,
  tick(thing, data, _dt, registry) {
    if (!data) return;
    const ttl = registry.facetData(thing.id, "ttl");
    if (!ttl || typeof ttl.remaining !== "number") return;

    if (!data._ttl_resolved) {
      data._initial_ttl = ttl.remaining;
      data._ttl_resolved = true;
    }
    const initial = data._initial_ttl > 0 ? data._initial_ttl : 1;
    const k = Math.max(0, Math.min(1, 1 - ttl.remaining / initial));

    const tuning = resolveTuning(thing, registry);
    if (!tuning) return;

    const newScale   = tuning.scale_start   + (tuning.scale_end   - tuning.scale_start)   * k;
    const newOpacity = tuning.opacity_start + (tuning.opacity_end - tuning.opacity_start) * k;

    const mesh = registry.facetData(thing.id, "mesh");
    if (!mesh || !mesh.threeObj) return;
    mesh.threeObj.scale.set(newScale, newScale, newScale);
    const mat = mesh.threeObj.material;
    if (mat) {
      mat.opacity = newOpacity;
      mat.transparent = true;
    }
  }
};

function resolveTuning(thing, registry) {
  const mesh = registry.facetData(thing.id, "mesh");
  if (!mesh || typeof mesh.tuning_ref !== "string") return null;
  for (const t of registry.byKind("tuning")) {
    if (t.name !== mesh.tuning_ref) continue;
    const tn = registry.facetData(t.id, "tuning");
    if (!tn) return null;
    if (typeof tn.scale_start   !== "number") return null;
    if (typeof tn.scale_end     !== "number") return null;
    if (typeof tn.opacity_start !== "number") return null;
    if (typeof tn.opacity_end   !== "number") return null;
    return {
      scale_start:   tn.scale_start,
      scale_end:     tn.scale_end,
      opacity_start: tn.opacity_start,
      opacity_end:   tn.opacity_end,
    };
  }
  return null;
}
