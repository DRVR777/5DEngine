/** emissive-pulse facet — oscillate material.emissiveIntensity on the mesh.
 *  Data: { base, amplitude, period_ms } */
export default {
  priority: 22,
  tick(thing, data, _dt, registry) {
    if (!data) return;
    const mesh = registry.facetData(thing.id, "mesh");
    if (!mesh?.threeObj) return;
    const t = (typeof performance !== "undefined" ? performance.now() : Date.now()) / (data.period_ms || 120);
    const intensity = (data.base || 0.7) + (data.amplitude || 0.3) * Math.sin(t);
    mesh.threeObj.traverse?.((o) => {
      if (o.material && "emissiveIntensity" in o.material) o.material.emissiveIntensity = intensity;
    });
  }
};
