/** ttl facet — countdown lifetime; despawn at 0.
 *  Data: { remaining } — caller must initialise `remaining` to a positive
 *  number on spawn. Missing or non-numeric `remaining` despawns immediately. */
export default {
  priority: 90,
  tick(thing, data, dt, registry) {
    if (!data || typeof data.remaining !== "number") {
      registry.despawn(thing.id, "ttl-malformed");
      return;
    }
    data.remaining -= dt;
    if (data.remaining <= 0) registry.despawn(thing.id, "ttl-expired");
  }
};
