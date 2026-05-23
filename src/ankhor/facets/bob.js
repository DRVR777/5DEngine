/** bob facet — sinusoidal vertical oscillation. Writes position.y.
 *  Data: { base, amplitude, period_ms, phase? } */
export default {
  priority: 20,
  init(_thing, data) {
    if (data && data.phase == null) data.phase = Math.random() * Math.PI * 2;
  },
  tick(thing, data, _dt, registry) {
    if (!data) return;
    const pos = registry.facetData(thing.id, "position");
    if (!pos) return;
    const t = (typeof performance !== "undefined" ? performance.now() : Date.now()) / (data.period_ms || 280);
    pos.y = (data.base || 0.7) + Math.sin(t + (data.phase || 0)) * (data.amplitude || 0.18);
  }
};
