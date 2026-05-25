/** weather — 6 presets, Markov transitions, tick from legacy GTAWeather */
const PRESETS = {
  clear:      { visibility:1.0,  skyTint:{r:0.53,g:0.81,b:0.92}, particleEmitter:null,        ambientLoop:null,            windSpeed:1.0, lightning:false },
  light_rain: { visibility:0.85, skyTint:{r:0.45,g:0.55,b:0.62}, particleEmitter:{kind:"rain", rate:30, area:40}, ambientLoop:"rain_light.ogg",   windSpeed:2.5, lightning:false },
  heavy_rain: { visibility:0.55, skyTint:{r:0.30,g:0.35,b:0.42}, particleEmitter:{kind:"rain", rate:120,area:40}, ambientLoop:"rain_heavy.ogg",   windSpeed:5.0, lightning:false },
  storm:      { visibility:0.30, skyTint:{r:0.18,g:0.20,b:0.25}, particleEmitter:{kind:"rain", rate:220,area:60}, ambientLoop:"thunder.ogg",       windSpeed:9.0, lightning:true  },
  snow:       { visibility:0.65, skyTint:{r:0.85,g:0.87,b:0.90}, particleEmitter:{kind:"snow", rate:60, area:50}, ambientLoop:"wind_cold.ogg",      windSpeed:3.0, lightning:false },
  fog:        { visibility:0.25, skyTint:{r:0.78,g:0.80,b:0.82}, particleEmitter:null,        ambientLoop:"fog_silence.ogg", windSpeed:0.5, lightning:false },
};
const TRANSITIONS = {
  clear:      { clear:0.7,  light_rain:0.15, fog:0.10, snow:0.05 },
  light_rain: { light_rain:0.5, clear:0.25, heavy_rain:0.20, fog:0.05 },
  heavy_rain: { heavy_rain:0.4, light_rain:0.30, storm:0.20, clear:0.10 },
  storm:      { storm:0.5, heavy_rain:0.40, clear:0.10 },
  snow:       { snow:0.7,  clear:0.20, fog:0.10 },
  fog:        { fog:0.6,  clear:0.30, light_rain:0.10 },
};
function _roll(current, rng) {
  const row = TRANSITIONS[current]||TRANSITIONS.clear;
  let r = (rng||Math.random)();
  for(const [next,p] of Object.entries(row)){
    if(r<p)return next;
    r-=p;
  }
  return current;
}
export default {
  priority: 9,
  init(_t, data) {
    data.current = data.current || "clear";
    data.intensity = data.intensity ?? 1.0;
    data.elapsedInState = 0;
    data.transitionInterval = data.transitionInterval || 60;
  },
  tick(_t, data, dt) {
    data.elapsedInState += dt;
    if(data.elapsedInState >= data.transitionInterval){
      data.elapsedInState = 0;
      data.current = _roll(data.current);
    }
    // Expose current preset values for render adapter
    const p = PRESETS[data.current] || PRESETS.clear;
    data.visibility = p.visibility * data.intensity;
    data.skyTint = p.skyTint;
    data.windSpeed = p.windSpeed;
    data.particleEmitter = p.particleEmitter;
    data.ambientLoop = p.ambientLoop;
    data.lightning = p.lightning;
  }
};
