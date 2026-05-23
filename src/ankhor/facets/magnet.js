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
    const x = pos.x ?? pos.u ?? 0, z = pos.z ?? pos.v ?? 0;
    const du = hu - x, dv = hv - z;
    const d = Math.hypot(du, dv);
    const range = data.range || 3.0;
    if (d > 0 && d < range) {
      const pull = (data.speed || 9) * (1 - d / range);
      pos.x = x + (du / d) * pull * dt;
      pos.z = z + (dv / d) * pull * dt;
    }
  }
};
