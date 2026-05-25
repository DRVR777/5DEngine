/** weather — 6 presets exactly from legacy GTAWeather: clear/light_rain/heavy_rain/storm/snow/fog + transitions */
export default {
  priority: 9,
  tick(_t, d, _dt, _r) {
    if (d._init) return; d._init = true; d.current = "clear";
    d.presets = {
      clear:      { visibility:1.0, skyTint:{r:0.53,g:0.81,b:0.92}, windSpeed:1.0 },
      light_rain: { visibility:0.85, skyTint:{r:0.45,g:0.55,b:0.62}, windSpeed:2.5 },
      heavy_rain: { visibility:0.55, skyTint:{r:0.30,g:0.35,b:0.42}, windSpeed:5.0 },
      storm:      { visibility:0.30, skyTint:{r:0.18,g:0.20,b:0.25}, windSpeed:9.0, lightning:true },
      snow:       { visibility:0.65, skyTint:{r:0.85,g:0.87,b:0.90}, windSpeed:3.0 },
      fog:        { visibility:0.25, skyTint:{r:0.78,g:0.80,b:0.82}, windSpeed:0.5 },
    };
  }
};
