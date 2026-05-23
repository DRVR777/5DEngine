/** damage-flash facet — pulses the HUD's full-screen flash element
 *  red when the hero takes damage. Reads hero.health.hp each tick,
 *  remembers the last value, and on a drop ≥ `damage_flash_min_drop`
 *  triggers a flash that fades over `damage_flash_decay_seconds`.
 *
 *  Sibling of hud-overlay on the same hud Thinga. Reads the
 *  installed `_flashEl` from the hud-overlay facet data.
 *
 *  Priority 96: runs immediately after hud-overlay (95) so the el
 *  exists, and so the flash repaints atop the freshly-painted HUD.
 *
 *  All tuning from hud-default-tuning (color, max opacity, decay
 *  window, min drop threshold). No hardcoded numbers per CLAUDE.md.
 *
 *  Data: { _lastHp?, _flashStart? } */
const D = "hud-default-tuning";

export default {
  priority: 96,
  tick(thing, data, _dt, registry) {
    if (!data) return;
    const overlay = registry.facetData(thing.id, "hud-overlay");
    if (!overlay || !overlay._flashEl) return;
    const t = resolveTuning(registry);
    if (!t) return;

    const heroes = registry.byKind("hero");
    if (heroes.length === 0) return;
    const health = registry.facetData(heroes[0].id, "health");
    if (!health || typeof health.hp !== "number") return;
    const hp = health.hp;

    if (typeof data._lastHp === "number") {
      const drop = data._lastHp - hp;
      if (drop >= t.damage_flash_min_drop) data._flashStart = Date.now() / 1000;
    }
    data._lastHp = hp;

    let opacity = 0;
    if (typeof data._flashStart === "number") {
      const elapsed = (Date.now() / 1000) - data._flashStart;
      if (elapsed >= 0 && elapsed < t.damage_flash_decay_seconds) {
        const k = 1 - elapsed / t.damage_flash_decay_seconds;
        opacity = k * t.damage_flash_max_opacity;
      } else {
        data._flashStart = null;
      }
    }
    overlay._flashEl.style.opacity = opacity.toFixed(3);
  }
};

function resolveTuning(registry) {
  for (const tt of registry.byKind("tuning")) {
    if (tt.name !== D) continue;
    const tn = registry.facetData(tt.id, "tuning");
    if (!tn) return null;
    if (typeof tn.damage_flash_max_opacity   !== "number") return null;
    if (typeof tn.damage_flash_decay_seconds !== "number") return null;
    if (typeof tn.damage_flash_min_drop      !== "number") return null;
    return tn;
  }
  return null;
}
