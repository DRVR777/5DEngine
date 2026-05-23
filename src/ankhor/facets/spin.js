/** spin facet — rotation. Writes position.heading (legacy y-axis) AND/OR
 *  directly to mesh.threeObj.rotation per-axis (used by multi-axis pickups).
 *  Data: { speed?, x?, y?, z? } — speed is legacy y; x/y/z are radians/sec. */
export default {
  priority: 21,
  tick(thing, data, dt, registry) {
    if (!data) return;
    const pos = registry.facetData(thing.id, "position");
    if (pos) pos.heading = (pos.heading || 0) + (data.speed || data.y || 0) * dt;
    const mesh = registry.facetData(thing.id, "mesh");
    if (mesh?.threeObj && (data.x != null || data.y != null || data.z != null)) {
      if (data.x) mesh.threeObj.rotation.x += data.x * dt;
      if (data.y) mesh.threeObj.rotation.y += data.y * dt;
      if (data.z) mesh.threeObj.rotation.z += data.z * dt;
    }
  }
};
