// weather.js — weather state machine + particle integration.
// State drives: visibility, particle emitter rate, audio cues, sky tint.
// Cycles through clear → light_rain → heavy_rain → storm → snow → fog
// based on probability transition matrix, OR set explicitly.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAWeather = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Weather presets — each owns rendering hints + emitter spec.
  const PRESETS = {
    clear: {
      name: "clear",
      visibility: 1.0,        // [0..1] fog density inverse
      skyTint: { r: 0.53, g: 0.81, b: 0.92 },
      particleEmitter: null,
      ambientLoop: null,
      windSpeed: 1.0,
    },
    light_rain: {
      name: "light_rain",
      visibility: 0.85,
      skyTint: { r: 0.45, g: 0.55, b: 0.62 },
      particleEmitter: { kind: "rain", rate: 30, area: 40 },
      ambientLoop: "rain_light.ogg",
      windSpeed: 2.5,
    },
    heavy_rain: {
      name: "heavy_rain",
      visibility: 0.55,
      skyTint: { r: 0.30, g: 0.35, b: 0.42 },
      particleEmitter: { kind: "rain", rate: 120, area: 40 },
      ambientLoop: "rain_heavy.ogg",
      windSpeed: 5.0,
    },
    storm: {
      name: "storm",
      visibility: 0.30,
      skyTint: { r: 0.18, g: 0.20, b: 0.25 },
      particleEmitter: { kind: "rain", rate: 220, area: 60 },
      ambientLoop: "thunder.ogg",
      windSpeed: 9.0,
      lightning: true,
    },
    snow: {
      name: "snow",
      visibility: 0.65,
      skyTint: { r: 0.85, g: 0.87, b: 0.90 },
      particleEmitter: { kind: "snow", rate: 60, area: 50 },
      ambientLoop: "wind_cold.ogg",
      windSpeed: 3.0,
    },
    fog: {
      name: "fog",
      visibility: 0.25,
      skyTint: { r: 0.78, g: 0.80, b: 0.82 },
      particleEmitter: null,
      ambientLoop: "fog_silence.ogg",
      windSpeed: 0.5,
    },
  };

  // Markov-style transition probabilities (rough values, sum ≈ 1 per row).
  const TRANSITIONS = {
    clear:      { clear: 0.7,  light_rain: 0.15, fog: 0.10, snow: 0.05 },
    light_rain: { light_rain: 0.5,  clear: 0.25, heavy_rain: 0.20, fog: 0.05 },
    heavy_rain: { heavy_rain: 0.4, light_rain: 0.30, storm: 0.20, clear: 0.10 },
    storm:      { storm: 0.5,  heavy_rain: 0.40, clear: 0.10 },
    snow:       { snow: 0.7,   clear: 0.20, fog: 0.10 },
    fog:        { fog: 0.6,    clear: 0.30, light_rain: 0.10 },
  };

  function createSystem(opts) {
    opts = opts || {};
    let current = opts.initial || "clear";
    let intensity = 1.0;        // multiplier for emitter rate
    let elapsedInState = 0;
    let nextTransitionAt = opts.transitionInterval || 60;  // sec

    function getCurrent() { return PRESETS[current] || PRESETS.clear; }
    function getName() { return current; }
    function getIntensity() { return intensity; }
    function setIntensity(v) { intensity = Math.max(0, Math.min(1, v)); }

    // Force a specific weather state.
    function setWeather(name) {
      if (!PRESETS[name]) return false;
      current = name;
      elapsedInState = 0;
      return true;
    }

    // Roll the dice on next state per TRANSITIONS table.
    function rollNext(rng) {
      rng = rng || Math.random;
      const row = TRANSITIONS[current] || TRANSITIONS.clear;
      let r = rng();
      for (const [next, p] of Object.entries(row)) {
        if (r < p) { current = next; elapsedInState = 0; return next; }
        r -= p;
      }
      return current;
    }

    // tick — auto-transition every transitionInterval seconds.
    function tick(dt, rng) {
      elapsedInState += dt;
      if (elapsedInState >= nextTransitionAt) {
        elapsedInState = 0;
        return rollNext(rng);
      }
      return null;
    }

    // Hook into a particle system: emits weather particles per tick.
    // particleSystem: object with .emit(presetName, pos, dir) → count
    function emitParticles(particleSystem, listenerPos, dt) {
      const cur = getCurrent();
      if (!cur.particleEmitter || !particleSystem) return 0;
      const spec = cur.particleEmitter;
      const expected = spec.rate * intensity * dt;
      const actualCount = Math.floor(expected) + ((Math.random() < (expected % 1)) ? 1 : 0);
      let total = 0;
      for (let i = 0; i < actualCount; i++) {
        const pos = {
          x: listenerPos.u + (Math.random() - 0.5) * spec.area,
          y: 20 + Math.random() * 5,    // spawn above listener
          z: listenerPos.v + (Math.random() - 0.5) * spec.area,
        };
        const dir = spec.kind === "rain" ? { x: 0, y: -1, z: 0 } : { x: 0, y: -0.5, z: 0 };
        // Use a custom preset if registered, else fall back to existing
        const usePreset = particleSystem.PRESETS && particleSystem.PRESETS[spec.kind]
          ? spec.kind
          : "smoke";
        total += particleSystem.emit(usePreset, pos, dir);
      }
      return total;
    }

    // Apply weather effects to the renderer (returns the diff).
    function applyToScene(scene) {
      const cur = getCurrent();
      const out = {
        skyColor: cur.skyTint,
        fogDensity: 1 - cur.visibility,
        windSpeed: cur.windSpeed,
      };
      if (scene && scene.applyWeather) {
        try { scene.applyWeather(out); } catch (e) {}
      }
      return out;
    }

    // Random-lightning chance (only fires in storms; render hooks listen).
    function tryLightning(rng) {
      const cur = getCurrent();
      if (!cur.lightning) return false;
      return (rng || Math.random)() < 0.05;
    }

    function registerPreset(name, def) {
      if (PRESETS[name]) throw new Error(`preset ${name} exists`);
      PRESETS[name] = def;
    }

    return {
      PRESETS, TRANSITIONS,
      getCurrent, getName, getIntensity, setIntensity,
      setWeather, rollNext, tick,
      emitParticles, applyToScene, tryLightning,
      registerPreset,
    };
  }

  return { createSystem, PRESETS };
});
