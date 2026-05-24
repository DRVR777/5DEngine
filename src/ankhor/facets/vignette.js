/** vignette facet — native Ankhor replacement for mountVignetteTick.
 *
 * Legacy contract (src/systems/vignette_tick.js):
 *   lowHpPulse = hp < maxHp*0.3 ? 0.22 + sin(now/350)*0.12 : 0
 *   vignetteAmt += (lowHpPulse - vignetteAmt) * min(1, dt*6)
 *   if el exists, el.style.opacity = vignetteAmt.toFixed(3)
 */

const LOW_HP_FRAC = 0.3;
const PULSE_BASE = 0.22;
const PULSE_AMP = 0.12;
const PULSE_PERIOD_MS = 350;
const SPRING_RATE = 6;

export default {
  priority: 19,

  tick(_thing, data, dt, registry) {
    const hero = registry.byKind("hero")[0];
    const health = hero ? registry.facetData(hero.id, "health") : null;
    const hp = typeof health?.hp === "number" ? health.hp : 0;
    const maxHp = typeof health?.maxHp === "number" ? health.maxHp : 100;
    const nowMs = typeof data.nowMs === "number"
      ? data.nowMs
      : (typeof performance !== "undefined" ? performance.now() : Date.now());

    const current = readAmount(data);
    const lowHpPulse = hp < maxHp * LOW_HP_FRAC
      ? PULSE_BASE + Math.sin(nowMs / PULSE_PERIOD_MS) * PULSE_AMP
      : 0;
    const next = current + (lowHpPulse - current) * Math.min(1, dt * SPRING_RATE);
    writeAmount(data, next);

    const el = data.el || data.element || null;
    if (el?.style) el.style.opacity = next.toFixed(3);
    data.lastOpacity = next.toFixed(3);
  },
};

function readAmount(data) {
  if (typeof data.amount === "number") return data.amount;
  if (typeof data.vignetteAmt === "number") return data.vignetteAmt;
  if (typeof data._vignetteAmt === "number") return data._vignetteAmt;
  return 0;
}

function writeAmount(data, value) {
  data.amount = value;
  data.vignetteAmt = value;
  data._vignetteAmt = value;
}
