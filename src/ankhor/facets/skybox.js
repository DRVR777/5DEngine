/** skybox — 5 presets exactly from legacy mountSkybox */
export default {
  priority: 5,
  tick(_t, data, _dt, _r) {
    if (data._init) return;
    data._init = true;
    data.presets = {
      day:    { bg: 0x87ceeb, fog: 0x87ceeb, fogNear: 40, fogFar: 140, ambColor: 0xffffff, ambInt: 0.9, sunColor: 0xffffff, sunInt: 1.1 },
      sunset: { bg: 0xff7744, fog: 0xee6633, fogNear: 20, fogFar: 90,  ambColor: 0xff9966, ambInt: 0.8, sunColor: 0xff8800, sunInt: 1.4 },
      night:  { bg: 0x060a1a, fog: 0x060a1a, fogNear: 15, fogFar: 60,  ambColor: 0x223366, ambInt: 0.3, sunColor: 0x3366aa, sunInt: 0.4 },
      holo:   { bg: 0x010810, fog: 0x010810, fogNear: 30, fogFar: 100, ambColor: 0x00ccff, ambInt: 0.4, sunColor: 0x00ffaa, sunInt: 0.6 },
      space:  { bg: 0x000008, fog: 0x000008, fogNear: 60, fogFar: 300, ambColor: 0x8866ff, ambInt: 0.2, sunColor: 0xffffff, sunInt: 2.0 },
    };
    data.current = "day";
  }
};
