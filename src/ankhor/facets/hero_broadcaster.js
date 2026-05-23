/** hero-broadcaster facet — sits on the hero Thing and, each tick, writes
 *  the hero's current (x, z) into every other Thing's facet that already
 *  declares `heroU` / `heroV` slots. That is the "subscription" — any
 *  facet (pickup-radius, magnet, damage-zone, status-zone, respawn-on-collect,
 *  …) gets activated automatically by virtue of having the slots.
 *
 *  Data: { } — no params. The hero's own position facet is the source.
 *
 *  Priority 5: runs before the position handler so consumers see the
 *  current pose during this tick. */
export default {
  priority: 5,
  tick(thing, _data, _dt, registry) {
    const pos = registry.facetData(thing.id, "position");
    if (!pos) return;
    const heroU = pos.x;
    const heroV = pos.z;

    // Walk every facet store and update any facet data that declares
    // heroU / heroV slots. The registry's facetStore maps facetName →
    // Map<thingId, facetData>. We touch each facetData in place; no
    // updateFacet round-trip because the data object is shared.
    for (const [, perThing] of registry.facetStore) {
      for (const [otherId, fd] of perThing) {
        if (otherId === thing.id) continue;
        if (fd == null) continue;
        if ("heroU" in fd || "heroV" in fd) {
          fd.heroU = heroU;
          fd.heroV = heroV;
        }
      }
    }
  }
};
