/** hud-overlay facet — singleton HUD. On first tick, creates a DOM
 *  container appended to document.body styled from hud-default-tuning.
 *  Each tick, reads hero state + enemy count + hero-shoot._seq and
 *  paints HP bar + kill counter + shots-fired counter + crosshair.
 *
 *  All visual values come from hud-default-tuning — no hardcoded
 *  numbers in handler code (per CLAUDE.md refusals).
 *
 *  Kill counting heuristic: when registry.byKind("enemy").length
 *  shrinks vs last tick, increment kills by the delta. Best-effort
 *  until the actor lift gives us real kill events.
 *
 *  Future widgets (boss bar, wave HUD, combo, weapon hud, vignette,
 *  status tint, clock, debug) go in sibling facets on the same hud
 *  Thinga; each owns its own sub-div.
 *
 *  Data: { _installed, _el, _hpFill, _hpLabel, _killsEl, _ammoEl,
 *          _lastEnemyCount, kills } */
const D = "hud-default-tuning";

export default {
  priority: 95,
  tick(thing, data, _dt, registry) {
    if (typeof document === "undefined") return;
    const t = resolveTuning(registry);
    if (!t) return;

    if (!data._installed) installDom(data, t);

    const heroes = registry.byKind("hero");
    if (heroes.length === 0) return;
    const hero = heroes[0];
    const health = registry.facetData(hero.id, "health");
    if (!health) return;

    const enemyCount = registry.byKind("enemy").length;
    if (data._lastEnemyCount !== null && enemyCount < data._lastEnemyCount) {
      data.kills += (data._lastEnemyCount - enemyCount);
    }
    data._lastEnemyCount = enemyCount;

    paintHp(data, t, health.hp || 0, health.maxHp || 0);
    paintKills(data, t, data.kills);
    paintAmmo(data, t, registry, hero.id);
  }
};

function resolveTuning(registry) {
  for (const tt of registry.byKind("tuning")) {
    if (tt.name !== D) continue;
    return registry.facetData(tt.id, "tuning");
  }
  return null;
}

function installDom(data, t) {
  const root = document.createElement("div");
  root.style.cssText = `
    position:fixed; inset:0; pointer-events:${t.container_pointer_events};
    z-index:${t.container_z_index};
    font-family:${t.font_family}; font-size:${t.font_size_px}px;
    color:${t.hp_label_color}; user-select:none;
  `;

  const hpBg = document.createElement("div");
  hpBg.style.cssText = `
    position:absolute; left:${t.hp_x_px}px; top:${t.hp_y_px}px;
    width:${t.hp_width_px}px; height:${t.hp_height_px}px;
    background:${t.hp_bg_color}; border:1px solid ${t.hp_border_color};
    border-radius:3px; overflow:hidden;
  `;
  const hpFill = document.createElement("div");
  hpFill.style.cssText = `position:absolute; left:0; top:0; bottom:0; width:0; transition:width 0.12s linear;`;
  const hpLabel = document.createElement("div");
  hpLabel.style.cssText = `
    position:absolute; left:0; right:0; top:0; bottom:0;
    display:flex; align-items:center; justify-content:center;
    color:${t.hp_label_color}; text-shadow:1px 1px 0 rgba(0,0,0,0.7);
  `;
  hpBg.appendChild(hpFill);
  hpBg.appendChild(hpLabel);
  root.appendChild(hpBg);

  const killsEl = document.createElement("div");
  killsEl.style.cssText = `position:absolute; left:${t.kills_x_px}px; top:${t.kills_y_px}px; color:${t.kills_color};`;
  root.appendChild(killsEl);

  const ammoEl = document.createElement("div");
  ammoEl.style.cssText = `position:absolute; right:${t.ammo_right_px}px; bottom:${t.ammo_bottom_px}px; color:${t.ammo_color};`;
  root.appendChild(ammoEl);

  const ch = document.createElement("div");
  const s = t.crosshair_size_px, w = t.crosshair_thickness_px;
  ch.style.cssText = `
    position:absolute; left:50%; top:50%; transform:translate(-50%, -50%);
    width:${s * 2}px; height:${s * 2}px;
  `;
  ch.innerHTML = `
    <div style="position:absolute; left:0; top:${s - w / 2}px; width:100%; height:${w}px; background:${t.crosshair_color}"></div>
    <div style="position:absolute; left:${s - w / 2}px; top:0; width:${w}px; height:100%; background:${t.crosshair_color}"></div>
  `;
  root.appendChild(ch);

  document.body.appendChild(root);
  data._installed = true;
  data._el        = root;
  data._hpFill    = hpFill;
  data._hpLabel   = hpLabel;
  data._killsEl   = killsEl;
  data._ammoEl    = ammoEl;
}

function paintHp(data, t, hp, maxHp) {
  const safeMax = maxHp > 0 ? maxHp : 1;
  const frac = Math.max(0, Math.min(1, hp / safeMax));
  const color = frac > t.hp_mid_threshold ? t.hp_fill_color_high
              : frac > t.hp_low_threshold ? t.hp_fill_color_mid
              : t.hp_fill_color_low;
  if (data._hpFill) {
    data._hpFill.style.width = (frac * 100).toFixed(1) + "%";
    data._hpFill.style.background = color;
  }
  if (data._hpLabel) {
    data._hpLabel.textContent = `HP ${Math.max(0, Math.round(hp))} / ${Math.round(maxHp)}`;
  }
}

function paintKills(data, t, kills) {
  if (data._killsEl) data._killsEl.textContent = `${kills} ${t.kills_label}`;
}

function paintAmmo(data, t, registry, heroId) {
  const shoot = registry.facetData(heroId, "hero-shoot");
  const shots = (shoot && typeof shoot._seq === "number") ? shoot._seq : 0;
  if (data._ammoEl) data._ammoEl.textContent = `${t.ammo_label}: ${shots}`;
}
