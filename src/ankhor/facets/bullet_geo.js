/** bullet_geo — box 0.025x0.025x0.28, color 0xffff00 */
export default {
  priority: 30,
  tick(_t, data, _dt, _r) {
    if (data._init) return;
    data._init = true;
    data.bulletW = 0.025; data.bulletH = 0.025; data.bulletL = 0.28; data.bulletColor = 0xffff00;
  }
};
