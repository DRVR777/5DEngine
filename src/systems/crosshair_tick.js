const CROSSHAIR_BLOOM_SCALE = 26;
const APEX_BORDER = "rgba(255,210,0,0.85)";
const APEX_SHADOW = "0 0 8px rgba(255,200,0,0.5)";
const BASE_BORDER = "rgba(0,200,255,0.7)";
const BASE_SHADOW = "0 0 6px rgba(0,200,255,0.4)";

export function mountCrosshairTick() {
  function tick(scopeEl, crosshairEl, { isSniperScope, aiming, moveSpread, heroDead, heroApexMode }) {
    if (scopeEl) scopeEl.style.display = isSniperScope ? "block" : "none";
    if (crosshairEl) {
      crosshairEl.style.visibility = isSniperScope ? "hidden" : "visible";
      const base = aiming ? 10 : 16;
      const bloom = (base + moveSpread * CROSSHAIR_BLOOM_SCALE).toFixed(1) + "px";
      crosshairEl.style.width  = bloom;
      crosshairEl.style.height = bloom;
      crosshairEl.style.opacity     = heroDead ? "0" : "1";
      crosshairEl.style.borderColor = heroApexMode ? APEX_BORDER : BASE_BORDER;
      crosshairEl.style.boxShadow   = heroApexMode ? APEX_SHADOW : BASE_SHADOW;
    }
  }
  return { tick };
}
