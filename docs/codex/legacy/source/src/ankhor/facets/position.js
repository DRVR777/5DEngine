/** position facet — integrate velocity if present. Other facets read position.
 *  Data: { x, y, z, heading?, velocity? } */
export default {
  priority: 10,
  tick(_thing, data, dt) {
    if (!data?.velocity) return;
    data.x = (data.x || 0) + (data.velocity.x || 0) * dt;
    data.y = (data.y || 0) + (data.velocity.y || 0) * dt;
    data.z = (data.z || 0) + (data.velocity.z || 0) * dt;
  }
};
