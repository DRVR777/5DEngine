/** hero-broadcaster facet — sits on the hero Thing and, each tick, writes
 *  the hero's current (x, z) into the facet data of every Thing whose
 *  facet name is in HERO_CONSUMERS.
 *
 *  Priority 5: runs before position handler so consumers see the current
 *  pose during this tick.
 *
 *  HERO_CONSUMERS is the explicit subscription list — adding a new
 *  hero-aware facet means: write the handler and append its name here.
 *  This keeps the broadcaster pure (no key sniffing on facet data;
 *  works even when injectDefaults didn't pre-create heroU/heroV keys).
 *
 *  Lift-ready: when the actor lift lands, this becomes an emit fan-out
 *  of `{to: thingId, message: {kind: "hero-pose", x, z}}` envelopes. */
const HERO_CONSUMERS = [
  "pickup-radius",
  "magnet",
  "damage-zone",
  "status-zone",
  "respawn-on-collect",
  "chase-target",
  "attack-target",
  "enemy-shoot",
];

export default {
  priority: 5,
  tick(thing, _data, _dt, registry) {
    const pos = registry.facetData(thing.id, "position");
    if (!pos) return;
    const heroU = pos.x;
    const heroV = pos.z;

    for (const facetName of HERO_CONSUMERS) {
      const perThing = registry.facetStore.get(facetName);
      if (!perThing) continue;
      for (const [otherId, fd] of perThing) {
        if (otherId === thing.id) continue;
        if (fd == null) continue;
        fd.heroU = heroU;
        fd.heroV = heroV;
      }
    }
  }
};
