/** magnet facet — pull position toward (heroU, heroV) when within range.
 *  Mirrors src/systems/coin_drop_tick.js lines 23–29. Caller injects heroU/heroV
 *  each frame via registry.updateFacet.
 *  Data: { range, speed, heroU?, heroV? } */
export default {
  priority: 35,
  tick(thing, data, dt, registry) {
    if (!data) return;
    const hu = data.heroU, hv = data.heroV;
    if (hu == null || hv == null) return;
    const pos = registry.facetData(thing.id, "position");
    if (!pos) return;
    const du = hu - pos.x, dv = hv - pos.z;
    const d = Math.hypot(du, dv);
    if (d > 0 && d < data.range) {
      const pull = data.speed * (1 - d / data.range);
      pos.x += (du / d) * pull * dt;
      pos.z += (dv / d) * pull * dt;
    }
  }
};
