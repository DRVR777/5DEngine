/** ttl facet — countdown lifetime; despawn at 0. Data: { remaining } */
export default {
  priority: 90,
  tick(thing, data, dt, registry) {
    if (!data) return;
    data.remaining = (data.remaining ?? 0) - dt;
    if (data.remaining <= 0) registry.despawn(thing.id, "ttl-expired");
  }
};
