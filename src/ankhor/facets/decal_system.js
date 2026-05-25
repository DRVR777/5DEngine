/** decal_system — blood r 0.4-0.75, opacity 0.82, oil opacity 0.72, scorch 0.3x0.3 */
export default {
  priority: 45,
  tick(_t, data, _dt, _r) {
    if (data._init) return;
    data._init = true;
    data.bloodOpacity = 0.82; data.oilOpacity = 0.72; data.decalRadius = 0.4;
  }
};
