/** bullet_physics — SUBSTEPS=5, hit radius 0.6 */
export default {
  priority: 35,
  tick(_t, data, _dt, _r) {
    if (data._init) return;
    data._init = true;
    data.substeps = 5;
    data.hitRadius = 0.6;
  }
};
