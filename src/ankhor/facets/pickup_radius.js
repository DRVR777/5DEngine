/** pickup-radius facet — detect when hero is within collection radius.
 *  Despawns the Thing on collection. Caller injects heroU/heroV.
 *  Data: { radius, heroU?, heroV?, on_pickup_action?, collected? } */
export default {
  priority: 40,
  tick(thing, data, _dt, registry) {
    if (!data || data.collected) return;
    const pos = registry.facetData(thing.id, "position");
    if (!pos) return;
    const hu = data.heroU, hv = data.heroV;
    if (hu == null || hv == null) return;
    const du = hu - pos.x;
    const dv = hv - pos.z;
    if (du * du + dv * dv < data.radius * data.radius) {
      data.collected = true;
      data.collected_at = (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;
      registry.despawn(thing.id, `pickup:${data.on_pickup_action || "default"}`);
    }
  }
};
