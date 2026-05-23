// camera_spine.js — 4-zone camera positioning per conviction.pdf §5.1.
//
// One scalar input — distance from character along the look-back axis,
// normalized to [0..1] of the configured max — yields a named ZONE plus
// per-zone interpolation parameters. The renderer reads the result and
// positions the camera + sets hero visibility + decides input mode.
//
// Zones (configurable):
//   INSIDE        (0–12%)  — camera at character center, character mesh
//                            fades transparent so we don't see the inside
//                            of our own head.
//   FIRST_PERSON  (12–30%) — just outside character, FPS framing.
//   THIRD_PERSON  (30–60%) — orbitable over-the-shoulder, default game view.
//   BIRD_VIEW     (60–100%)— pulled back + lifted, flying-mode framing.
//
// Pure functions, no DOM, no THREE.js — render-engine glue lives in
// index.html. Tests live in test_iter_131.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CameraSpine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const ZONES = ["INSIDE", "FIRST_PERSON", "THIRD_PERSON", "BIRD_VIEW"];

  // Default zone boundaries (fractions of camDistMax). Matches conviction.pdf §5.1.
  const DEFAULT_BOUNDS = {
    INSIDE:       [0.00, 0.12],
    FIRST_PERSON: [0.12, 0.30],
    THIRD_PERSON: [0.30, 0.60],
    BIRD_VIEW:    [0.60, 1.00],
  };

  function _smoothstep(t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return t * t * (3 - 2 * t);
  }

  function _clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }

  // The big one: zoom ∈ [0..1] → { zone, localT, params }.
  // localT is 0..1 progress *within* the zone — useful for blending mesh
  // visibility or FOV at zone edges.
  function evaluate(zoom, opts) {
    opts = opts || {};
    const bounds = opts.bounds || DEFAULT_BOUNDS;
    const camDistMax = opts.camDistMax != null ? opts.camDistMax : 15;
    const z = _clamp01(zoom);

    let zone = "THIRD_PERSON";
    let lo = 0, hi = 1;
    // Inclusive-lower, exclusive-upper — so boundary value belongs to upper zone.
    // The last zone gets inclusive upper to cover z=1.0.
    for (let i = 0; i < ZONES.length; i++) {
      const name = ZONES[i];
      const [a, b] = bounds[name];
      const isLast = i === ZONES.length - 1;
      if (z >= a && (isLast ? z <= b : z < b)) { zone = name; lo = a; hi = b; break; }
    }
    const localT = (hi === lo) ? 0 : (z - lo) / (hi - lo);

    // Derive runtime params per zone — these are READ by the renderer to
    // place the camera + decide rendering mode without it caring about names.
    let params;
    switch (zone) {
      case "INSIDE":
        params = {
          distMul:       0.0,             // camera at character center
          heightOffset:  1.7,             // about eye level
          heroVisible:   false,
          heroOpacity:   _smoothstep(1 - localT),  // fade in as we exit
          inputMode:     "look",          // mouse controls head only
          fovBias:       0,
          allowShooting: false,
        };
        break;
      case "FIRST_PERSON":
        params = {
          distMul:       0.15 + 0.15 * localT,   // 0.15..0.30 of max
          heightOffset:  1.78,
          heroVisible:   false,
          heroOpacity:   0,
          inputMode:     "fps",
          fovBias:       0,
          allowShooting: true,
        };
        break;
      case "THIRD_PERSON":
        params = {
          distMul:       0.30 + 0.30 * _smoothstep(localT),  // smooth pull-back
          heightOffset:  1.2 + 0.4 * localT,
          heroVisible:   true,
          heroOpacity:   1,
          inputMode:     "orbit",
          fovBias:       0,
          allowShooting: true,
        };
        break;
      case "BIRD_VIEW":
        params = {
          distMul:       0.6 + 0.4 * _smoothstep(localT),    // 0.6..1.0
          heightOffset:  2.0 + 8.0 * localT,                  // climbs into sky
          heroVisible:   true,
          heroOpacity:   1,
          inputMode:     "fly",
          fovBias:       0.05 * localT,
          allowShooting: false,
        };
        break;
    }
    params.distance = params.distMul * camDistMax;

    return { zone, localT, zoom: z, params };
  }

  // Inverse: given a target zone, return a zoom value that lands inside it
  // (centered). Useful for keybind "snap to first-person" / "snap to bird".
  function zoomForZone(zone, opts) {
    opts = opts || {};
    const bounds = opts.bounds || DEFAULT_BOUNDS;
    if (!bounds[zone]) return null;
    const [a, b] = bounds[zone];
    return (a + b) / 2;
  }

  // Lerp zoom from current to target along the spine over `dt` seconds.
  // Used for smooth snap-zoom (Q to first-person, Z to bird, etc.).
  function lerpZoom(current, target, dt, speed) {
    speed = speed != null ? speed : 6;
    const d = target - current;
    const step = d * Math.min(1, dt * speed);
    return current + step;
  }

  function listZones() { return ZONES.slice(); }
  function getDefaultBounds() {
    return JSON.parse(JSON.stringify(DEFAULT_BOUNDS));
  }

  return {
    evaluate, zoomForZone, lerpZoom,
    listZones, getDefaultBounds,
    ZONES, DEFAULT_BOUNDS,
    VERSION: "0.1.0-iter131",
  };
});
