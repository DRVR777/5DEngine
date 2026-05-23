/** opacity-pulse facet — oscillate material.opacity on a named mesh child.
 *  Data: { base, amplitude, period_ms, child_name? } — pulse only that named
 *  child, or all transparent children when child_name is null. */
export default {
  priority: 23,
  tick(thing, data, _dt, registry) {
    if (!data) return;
    const mesh = registry.facetData(thing.id, "mesh");
    if (!mesh?.threeObj) return;
    const t = (typeof performance !== "undefined" ? performance.now() : Date.now()) / (data.period_ms || 400);
    const opacity = (data.base || 0.25) + (data.amplitude || 0.15) * Math.sin(t);
    mesh.threeObj.traverse?.((o) => {
      if (!o.material) return;
      if (data.child_name && o.name !== data.child_name) return;
      if (o.material.transparent) o.material.opacity = opacity;
    });
  }
};
