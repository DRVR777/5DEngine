// weather_forecast.js — predict next-N-minutes weather window with
// smooth transitions. Deterministic by seed; same seed → same forecast.
//
// Weather kinds: "clear" / "cloudy" / "rain" / "heavy_rain" / "storm" /
//                "snow" / "fog"
// Each forecast slot has:
//   { startMs, endMs, kind, intensity (0..1), transitioning }
// Adjacent slots interpolate intensity for smooth fades.
//
// API:
//   forecast({startTs, durationMs, seed, climate, slotMs?}) →
//     { slots:[...], climate, seed }
//   weatherAt(forecast, ts) → {kind, intensity, fade}
//   advance(forecast, prevTs, newTs) → events for changes between prev & new
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAWeatherForecast = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const KINDS = ["clear", "cloudy", "rain", "heavy_rain", "storm", "snow", "fog"];

  // Climate biases — chance weights per kind for a given climate.
  const CLIMATE_BIAS = {
    temperate: { clear: 4, cloudy: 3, rain: 2, heavy_rain: 1, storm: 0.5, snow: 0.2, fog: 1 },
    desert:    { clear: 8, cloudy: 1, rain: 0.2, heavy_rain: 0.1, storm: 0.1, snow: 0, fog: 0.3 },
    arctic:    { clear: 2, cloudy: 3, rain: 0.2, heavy_rain: 0.1, storm: 0.3, snow: 4, fog: 2 },
    tropical:  { clear: 2, cloudy: 3, rain: 3, heavy_rain: 2, storm: 1, snow: 0, fog: 1 },
    coastal:   { clear: 3, cloudy: 3, rain: 2, heavy_rain: 1, storm: 1, snow: 0.2, fog: 3 },
  };

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function _weightedPick(weights, rng) {
    const entries = Object.entries(weights);
    let sum = 0;
    for (const [, w] of entries) sum += w;
    const target = rng() * sum;
    let acc = 0;
    for (const [k, w] of entries) {
      acc += w;
      if (target < acc) return k;
    }
    return entries[entries.length - 1][0];
  }

  function _intensityFor(kind, rng) {
    // Storm/heavy_rain skew toward higher intensity; clear/cloudy low
    if (kind === "clear") return rng() * 0.3;
    if (kind === "cloudy") return 0.3 + rng() * 0.3;
    if (kind === "fog") return 0.4 + rng() * 0.4;
    if (kind === "rain") return 0.4 + rng() * 0.4;
    if (kind === "heavy_rain") return 0.6 + rng() * 0.4;
    if (kind === "storm") return 0.7 + rng() * 0.3;
    if (kind === "snow") return 0.3 + rng() * 0.5;
    return 0.5;
  }

  function forecast(opts) {
    opts = opts || {};
    const startTs = opts.startTs != null ? opts.startTs : Date.now();
    const durationMs = opts.durationMs || 30 * 60 * 1000;   // 30 min
    const slotMs = opts.slotMs || 5 * 60 * 1000;            // 5 min per slot
    const seed = opts.seed != null ? opts.seed : 1;
    const climate = opts.climate || "temperate";
    const bias = CLIMATE_BIAS[climate] || CLIMATE_BIAS.temperate;
    const rng = mulberry32(seed);
    const nSlots = Math.ceil(durationMs / slotMs);
    const slots = [];
    let prevKind = opts.startKind || _weightedPick(bias, rng);
    for (let i = 0; i < nSlots; i++) {
      // Mild persistence: 50% chance to stay same kind, otherwise re-roll
      let kind;
      if (rng() < 0.5) kind = prevKind;
      else kind = _weightedPick(bias, rng);
      const slotStart = startTs + i * slotMs;
      const slotEnd = Math.min(startTs + durationMs, slotStart + slotMs);
      slots.push({
        startMs: slotStart, endMs: slotEnd,
        kind, intensity: _intensityFor(kind, rng),
        transitioning: kind !== prevKind,
      });
      prevKind = kind;
    }
    return { slots, climate, seed, startTs, durationMs, slotMs };
  }

  function weatherAt(fc, ts) {
    if (!fc || !fc.slots || fc.slots.length === 0) return null;
    if (ts < fc.slots[0].startMs) return null;
    if (ts >= fc.slots[fc.slots.length - 1].endMs) return null;
    for (let i = 0; i < fc.slots.length; i++) {
      const s = fc.slots[i];
      if (ts >= s.startMs && ts < s.endMs) {
        // If next slot has different kind, fade over last 30s of this slot
        let fade = 0;
        if (i + 1 < fc.slots.length && fc.slots[i + 1].kind !== s.kind) {
          const fadeStart = s.endMs - 30000;
          if (ts >= fadeStart) {
            fade = (ts - fadeStart) / 30000;
          }
        }
        return {
          kind: s.kind,
          intensity: s.intensity,
          fade,
          nextKind: fade > 0 ? fc.slots[i + 1].kind : null,
        };
      }
    }
    return null;
  }

  // Compute events that fired between prevTs and newTs (transitions).
  function advance(fc, prevTs, newTs) {
    if (!fc || newTs <= prevTs) return [];
    const events = [];
    for (let i = 1; i < fc.slots.length; i++) {
      const s = fc.slots[i];
      // Transition event at slot's startMs if kind differs from prev slot
      if (fc.slots[i - 1].kind !== s.kind) {
        if (s.startMs > prevTs && s.startMs <= newTs) {
          events.push({
            kind: "transition",
            from: fc.slots[i - 1].kind,
            to: s.kind,
            at: s.startMs,
            intensity: s.intensity,
          });
        }
      }
    }
    return events;
  }

  // List unique kinds in the forecast
  function uniqueKinds(fc) {
    const set = new Set();
    for (const s of fc.slots) set.add(s.kind);
    return Array.from(set);
  }

  // Find next time-of-kind (e.g. "when does it next rain?")
  function nextOf(fc, kindMatch, fromTs) {
    fromTs = fromTs != null ? fromTs : (fc.startTs || 0);
    const matcher = typeof kindMatch === "function"
      ? kindMatch
      : (k) => k === kindMatch;
    for (const s of fc.slots) {
      if (s.startMs >= fromTs && matcher(s.kind)) return s;
    }
    return null;
  }

  return {
    KINDS, CLIMATE_BIAS,
    forecast, weatherAt, advance,
    uniqueKinds, nextOf,
  };
});
