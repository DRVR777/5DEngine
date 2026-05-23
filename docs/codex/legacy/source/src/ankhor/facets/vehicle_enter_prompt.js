/** vehicle-enter-prompt facet — on hero. Detects edge-down on the
 *  interact key while a vehicle is within `interact_range_m`. Toggles
 *  hero.inventory.in_vehicle_id ↔ null. The vehicle's `vehicle-drive`
 *  facet reads that field to decide whether to take input that tick.
 *
 *  Priority 14: after hero-input-move (10) + aabb-collision (11) +
 *  hero-shoot (12), so hero state for the frame is stable.
 *
 *  Edge detection via _lastInteractHeld so a held key doesn't
 *  re-toggle every frame.
 *
 *  Numbers from hero-tuning (interact_range_m, key_interact).
 *  No hardcoded fallbacks.
 *
 *  Data: { _lastInteractHeld? } */
export default {
  priority: 14,
  tick(thing, data, _dt, registry) {
    if (!data) return;
    const tn = resolveHeroTuning(registry);
    if (!tn) return;
    const inputs = registry.byKind("input");
    if (inputs.length === 0) return;
    const input = registry.facetData(inputs[0].id, "input-state");
    if (!input) return;

    const held = !!(input.keys && input.keys[tn.key_interact]);
    const wasHeld = !!data._lastInteractHeld;
    data._lastInteractHeld = held;
    if (!held || wasHeld) return;

    const inv = registry.facetData(thing.id, "inventory");
    if (!inv) return;

    if (inv.in_vehicle_id) {
      inv.in_vehicle_id = null;
      return;
    }

    const pos = registry.facetData(thing.id, "position");
    if (!pos) return;
    const r2 = tn.interact_range_m * tn.interact_range_m;
    for (const v of registry.byKind("vehicle")) {
      const vpos = registry.facetData(v.id, "position");
      if (!vpos) continue;
      const du = vpos.x - pos.x, dv = vpos.z - pos.z;
      if (du * du + dv * dv < r2) { inv.in_vehicle_id = v.id; return; }
    }
  }
};

function resolveHeroTuning(registry) {
  for (const t of registry.byKind("tuning")) {
    if (t.name !== "hero-tuning") continue;
    const tn = registry.facetData(t.id, "tuning");
    if (!tn) return null;
    if (typeof tn.interact_range_m !== "number") return null;
    if (typeof tn.key_interact     !== "string") return null;
    return tn;
  }
  return null;
}
