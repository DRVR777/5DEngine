/** lighting — exact constants from mountLighting legacy source */
export default {
  priority: 6,
  init(_t, data) {
    data.ambColor = 0xffffff;
    data.ambInt = 0.9;
    data.sunColor = 0xffffff;
    data.sunInt = 1.1;
    data.shadowMapSize = 2048;
    data.shadowCamHalf = 40;
    data.sunPos = { x: 20, y: 30, z: 10 };
  }
};
