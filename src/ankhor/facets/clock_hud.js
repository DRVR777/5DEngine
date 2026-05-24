/** clock-hud facet - native Ankhor replacement for mountClockHudTick. */

export default {
  priority: 96,

  tick(thing, data, _dt, registry) {
    const t = readHudTuning(registry);
    if (!t) return;

    const el = ensureElement(thing, data, registry, t);
    if (!el) return;

    const now = nowMs();
    const hour = readHour(data, registry);
    let gameH;
    let gameM;
    let dayMix;
    if (hour != null) {
      gameH = Math.floor(hour);
      gameM = Math.floor((hour - gameH) * 60);
      dayMix = Math.max(0, Math.min(1, (hour >= 6 && hour < 19) ? 1 - Math.abs(hour - 12.5) / 6.5 : 0));
    } else {
      const dayFrac = ((now / 1000) % 60) / 60;
      gameH = Math.floor(dayFrac * 24);
      gameM = Math.floor((dayFrac * 24 - gameH) * 60);
      dayMix = t.clock_fallback_day_mix;
    }

    const isPM = gameH >= 12;
    const h12 = ((gameH % 12) || 12).toString().padStart(2, "0");
    const mStr = gameM.toString().padStart(2, "0");
    const icon = dayMix > 0.7 ? "\u2600" : (dayMix > 0.3 ? "\u26c5" : "\u{1f319}");
    el.textContent = `${icon} ${h12}:${mStr} ${isPM ? "PM" : "AM"}`;
    el.style.color = dayMix > 0.5 ? t.clock_day_color : t.clock_night_color;

    data.text = el.textContent;
    data.color = el.style.color;
  },
};

function ensureElement(thing, data, registry, t) {
  if (data._el) return data._el;
  if (typeof document === "undefined") return null;
  const overlay = registry.facetData(thing.id, "hud-overlay");
  const root = overlay ? overlay._el : null;
  if (!root) return null;

  const el = document.createElement("div");
  el.style.cssText = `
    position:absolute; right:${t.clock_right_px}px; top:${t.clock_top_px}px;
    color:${t.clock_day_color};
  `;
  root.appendChild(el);
  data._el = el;
  return el;
}

function readHudTuning(registry) {
  for (const tt of registry.byKind("tuning")) {
    if (tt.name !== "hud-default-tuning") continue;
    const t = registry.facetData(tt.id, "tuning");
    if (!t) return null;
    if (typeof t.clock_right_px !== "number") return null;
    if (typeof t.clock_top_px !== "number") return null;
    if (typeof t.clock_fallback_day_mix !== "number") return null;
    if (typeof t.clock_day_color !== "string") return null;
    if (typeof t.clock_night_color !== "string") return null;
    return t;
  }
  return null;
}

function readHour(data, registry) {
  if (typeof data.hour === "number") return data.hour;
  for (const id of registry.byFacet("day-night-cycle")) {
    const fd = registry.facetData(id, "day-night-cycle");
    if (fd && typeof fd.hour === "number") return fd.hour;
  }
  return null;
}

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
