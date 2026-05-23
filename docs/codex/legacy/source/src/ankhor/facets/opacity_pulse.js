/** opacity-pulse facet — oscillate material.opacity on a named mesh child.
 *  Data: { base, amplitude, period_ms, child_name?, fade_from_ttl_window? }
 *  If `fade_from_ttl_window` is set AND the Thing has a `ttl` facet, the
 *  opacity is additionally scaled by min(1, ttl.remaining / fade_window)
 *  so the visual fades out as the Thing's lifetime expires. */
export default {
  priority: 23,
  tick(thing, data, _dt, registry) {
    if (!data) return;
    const mesh = registry.facetData(thing.id, "mesh");
    if (!mesh?.threeObj) return;
    const t = (typeof performance !== "undefined" ? performance.now() : Date.now()) / data.period_ms;
    let opacity = data.base + data.amplitude * Math.sin(t);
    if (typeof data.fade_from_ttl_window === "number") {
      const ttl = registry.facetData(thing.id, "ttl");
      if (ttl && typeof ttl.remaining === "number") {
        opacity *= Math.min(1, Math.max(0, ttl.remaining / data.fade_from_ttl_window));
      }
    }
    mesh.threeObj.traverse?.((o) => {
      if (!o.material) return;
      if (data.child_name && o.name !== data.child_name) return;
      if (o.material.transparent) o.material.opacity = opacity;
    });
  }
};
