/** fps-tick facet - native Ankhor replacement for mountFpsTick.
 *
 * State lives on the hud facet data:
 *   frames, windowT, display
 *
 * The legacy optional DOM write (`el.textContent = display + " FPS"`) is
 * not wired in the substrate yet; the canonical state is the display field.
 */
export default {
  priority: 94,
  tick(_thing, data, _dt, registry) {
    const t = readHudTuning(registry);
    if (!t) return;

    if (typeof data.frames !== "number") data.frames = 0;
    if (typeof data.windowT !== "number") data.windowT = nowMs();
    if (typeof data.display !== "number") data.display = 0;

    const now = nowMs();
    data.frames += 1;
    const elapsed = now - data.windowT;
    if (elapsed >= t.fps_window_ms) {
      const fps = Math.round(data.frames * t.fps_window_ms / elapsed);
      data.display = fps;
      data.frames = 0;
      data.windowT = now;
      data.lastFps = fps;
    }
  }
};

function readHudTuning(registry) {
  for (const t of registry.byKind("tuning")) {
    if (t.name !== "hud-default-tuning") continue;
    const tn = registry.facetData(t.id, "tuning");
    if (!tn) return null;
    if (typeof tn.fps_window_ms !== "number") return null;
    return tn;
  }
  return null;
}

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
