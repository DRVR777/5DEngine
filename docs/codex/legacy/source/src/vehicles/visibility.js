// visibility.js — entity render-visibility based on day-night + light sources.
// At noon, everything visible. At night, only entities within a light cone
// or carrying a torch are rendered.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAVisibility = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Light sources: {pos: {u,v}, radius, intensity, kind}
  function createLightField() {
    const sources = new Map();   // id → {pos, radius, intensity, kind}
    let nextId = 1;

    function add(opts) {
      const id = opts.id || `light_${nextId++}`;
      sources.set(id, {
        id,
        pos: opts.pos || { u: 0, v: 0 },
        radius: opts.radius || 5,
        intensity: opts.intensity != null ? opts.intensity : 1.0,
        kind: opts.kind || "lamp",       // "lamp" | "torch" | "fire" | "spotlight"
      });
      return id;
    }
    function remove(id) { return sources.delete(id); }
    function update(id, partial) {
      const s = sources.get(id);
      if (!s) return false;
      Object.assign(s, partial);
      return true;
    }
    function list() { return Array.from(sources.values()); }
    function get(id) { return sources.get(id) || null; }

    // Lightness at a position: 0..1, computed as max contribution from any source.
    function lightnessAt(pos) {
      let best = 0;
      for (const s of sources.values()) {
        const d = Math.hypot(pos.u - s.pos.u, pos.v - s.pos.v);
        if (d > s.radius) continue;
        const falloff = 1 - d / s.radius;
        const contribution = falloff * s.intensity;
        if (contribution > best) best = contribution;
      }
      return Math.min(1, best);
    }

    return { sources, add, remove, update, list, get, lightnessAt };
  }

  // Day-night light level: 0..1 (1 = noon, 0 = midnight).
  // hour: 0..24. Twilight bands 5-7am sunrise, 17-19 sunset.
  function ambientLight(hour) {
    if (hour >= 7 && hour <= 17) return 1.0;
    if (hour >= 5 && hour < 7) {
      // sunrise: 5 → 0.0, 7 → 1.0
      return (hour - 5) / 2;
    }
    if (hour > 17 && hour <= 19) {
      // sunset: 17 → 1.0, 19 → 0.0
      return 1 - (hour - 17) / 2;
    }
    return 0;
  }

  // Effective visibility for an entity at this hour given light field.
  // Returns 0..1 (caller can threshold or fade).
  //   carrying: entity-attached light (e.g. carries a torch) — adds a flat boost
  //   minOutdoor: minimum baseline (so players never disappear entirely)
  function entityVisibility(entityPos, hour, lightField, opts) {
    opts = opts || {};
    const ambient = ambientLight(hour);
    const lamp = lightField ? lightField.lightnessAt(entityPos) : 0;
    const carry = opts.carrying ? opts.carrying : 0;
    const base = opts.minOutdoor != null ? opts.minOutdoor : 0.1;
    const total = Math.min(1, ambient + lamp + carry);
    return Math.max(opts.alwaysVisible ? 1 : base, total);
  }

  // Threshold-style decision: render or skip?
  function isVisible(entityPos, hour, lightField, opts) {
    opts = opts || {};
    const v = entityVisibility(entityPos, hour, lightField, opts);
    return v >= (opts.threshold != null ? opts.threshold : 0.15);
  }

  // Bulk classify: returns Map<entityId, {visibility, visible}> for the whole world.
  // entities: Map<id, entity>; carryingFn: (entity) → number; isPlayerFn: (entity) → bool
  function classifyEntities(entities, hour, lightField, opts) {
    opts = opts || {};
    const out = new Map();
    const threshold = opts.threshold != null ? opts.threshold : 0.15;
    for (const [id, e] of entities) {
      if (!e.position) { out.set(id, { visibility: 1, visible: true }); continue; }
      const isPlayer = opts.isPlayerFn ? opts.isPlayerFn(e) : false;
      const carrying = opts.carryingFn ? opts.carryingFn(e) : 0;
      const v = entityVisibility(e.position, hour, lightField,
        { carrying, alwaysVisible: isPlayer });
      out.set(id, { visibility: v, visible: v >= threshold });
    }
    return out;
  }

  return {
    createLightField, ambientLight, entityVisibility, isVisible, classifyEntities,
  };
});
