// status_effects.js — 5DEngine buff/debuff system
// Applies time-limited stat modifiers to any entity (hero, enemy, vehicle, NPC).
// Visual: holographic ring icons that slide in above the health bar area.
//
// API (window.StatusEffects):
//   apply(entityId, effectId, opts)   — add/refresh an effect on an entity
//   remove(entityId, effectId)        — remove one effect
//   clear(entityId)                   — remove all effects for an entity
//   tick(dt)                          — advance all timers; fire onTick callbacks
//   getActive(entityId)               → [{id, def, timeLeft, stacks}, ...]
//   getStat(entityId, stat)           → combined multiplier for stat (default 1.0)
//   define(id, opts)                  — register custom effect
//
// Built-in effect IDs:
//   poison, burning, slowdown, speedup, heal_regen, shield, stun, invisible
//
// opts for apply():
//   duration   — seconds (default from def)
//   stacks     — how many stacks to apply (default 1)
//   source     — entity ID that applied it (optional)
//   onExpire   — callback(entityId, effectId)
//
// Effect def opts (in define()):
//   label, icon, color (hex)
//   duration   — default duration in seconds
//   maxStacks  — max stacks allowed (default 1)
//   stats      — { speedMult, damageMult, defenceMult, regenMult } per stack
//   onApply(entityId, stacks)
//   onTick(entityId, stacks, dt)   — called every frame while active
//   onRemove(entityId)

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.StatusEffects = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const _defs   = new Map();
  const _active = new Map();   // entityId → Map<effectId, {def, timeLeft, stacks, onExpire}>
  let   _uiContainer = null;

  // ---- Built-in definitions ----
  const _builtins = [
    {
      id: "poison", label: "Poison", icon: "☠", color: 0x44cc44,
      duration: 5, maxStacks: 3,
      stats: { regenMult: 0.0 },
      onTick(eid, stacks, dt) {
        if (typeof window._entityDamage === "function") window._entityDamage(eid, stacks * 2 * dt, "poison");
      },
    },
    {
      id: "burning", label: "Burning", icon: "🔥", color: 0xff6600,
      duration: 4, maxStacks: 2,
      stats: { defenceMult: 0.7 },
      onTick(eid, stacks, dt) {
        if (typeof window._entityDamage === "function") window._entityDamage(eid, stacks * 3 * dt, "fire");
      },
    },
    {
      id: "slowdown", label: "Slowed", icon: "❄", color: 0x88ccff,
      duration: 3, maxStacks: 2,
      stats: { speedMult: 0.45 },
    },
    {
      id: "speedup", label: "Haste", icon: "⚡", color: 0xffee00,
      duration: 8, maxStacks: 1,
      stats: { speedMult: 1.6 },
    },
    {
      id: "heal_regen", label: "Regen", icon: "💚", color: 0x00ff88,
      duration: 6, maxStacks: 2,
      stats: { regenMult: 3.0 },
      onTick(eid, stacks, dt) {
        if (typeof window._entityHeal === "function") window._entityHeal(eid, stacks * 4 * dt);
      },
    },
    {
      id: "shield", label: "Shield", icon: "🛡", color: 0x00ccff,
      duration: 5, maxStacks: 1,
      stats: { defenceMult: 2.0 },
    },
    {
      id: "stun", label: "Stunned", icon: "💫", color: 0xffcc00,
      duration: 1.5, maxStacks: 1,
      stats: { speedMult: 0.0 },
    },
    {
      id: "invisible", label: "Invisible", icon: "👁", color: 0xaaaaff,
      duration: 5, maxStacks: 1,
      stats: {},
      onApply(eid) { if (eid === "hero" && window._setHeroOpacity) window._setHeroOpacity(0.15); },
      onRemove(eid) { if (eid === "hero" && window._setHeroOpacity) window._setHeroOpacity(1.0); },
    },
  ];
  for (const b of _builtins) define(b.id, b);

  function define(id, opts) {
    _defs.set(id, {
      id, label: opts.label || id, icon: opts.icon || "⬡",
      color: opts.color || 0x00ccff,
      duration: opts.duration || 5,
      maxStacks: opts.maxStacks || 1,
      stats: opts.stats || {},
      onApply:  opts.onApply  || null,
      onTick:   opts.onTick   || null,
      onRemove: opts.onRemove || null,
    });
  }

  function _getMap(entityId) {
    if (!_active.has(entityId)) _active.set(entityId, new Map());
    return _active.get(entityId);
  }

  function apply(entityId, effectId, opts = {}) {
    const def = _defs.get(effectId);
    if (!def) return;
    const map = _getMap(entityId);
    const existing = map.get(effectId);
    const addStacks = opts.stacks || 1;
    if (existing) {
      existing.timeLeft = Math.max(existing.timeLeft, opts.duration || def.duration);
      existing.stacks = Math.min(existing.stacks + addStacks, def.maxStacks);
      if (opts.onExpire) existing.onExpire = opts.onExpire;
    } else {
      map.set(effectId, {
        def,
        timeLeft: opts.duration || def.duration,
        stacks: Math.min(addStacks, def.maxStacks),
        onExpire: opts.onExpire || null,
      });
      if (def.onApply) def.onApply(entityId, addStacks);
    }
    _refreshUI(entityId);
  }

  function remove(entityId, effectId) {
    const map = _active.get(entityId);
    if (!map) return;
    const entry = map.get(effectId);
    if (!entry) return;
    map.delete(effectId);
    const def = _defs.get(effectId);
    if (def && def.onRemove) def.onRemove(entityId);
    if (entry.onExpire) entry.onExpire(entityId, effectId);
    _refreshUI(entityId);
  }

  function clear(entityId) {
    const map = _active.get(entityId);
    if (!map) return;
    for (const [eid] of map) remove(entityId, eid);
  }

  function tick(dt) {
    for (const [entityId, map] of _active) {
      let dirty = false;
      for (const [effectId, entry] of map) {
        if (entry.def.onTick) entry.def.onTick(entityId, entry.stacks, dt);
        entry.timeLeft -= dt;
        if (entry.timeLeft <= 0) {
          map.delete(effectId);
          if (entry.def.onRemove) entry.def.onRemove(entityId);
          if (entry.onExpire) entry.onExpire(entityId, effectId);
          dirty = true;
        }
      }
      if (dirty) _refreshUI(entityId);
    }
  }

  function getActive(entityId) {
    const map = _active.get(entityId);
    if (!map) return [];
    return [...map.entries()].map(([id, e]) => ({
      id, def: e.def, timeLeft: e.timeLeft, stacks: e.stacks,
    }));
  }

  function getStat(entityId, stat) {
    const map = _active.get(entityId);
    if (!map) return 1.0;
    let val = 1.0;
    for (const entry of map.values()) {
      const s = entry.def.stats[stat];
      if (s !== undefined) val *= Math.pow(s, entry.stacks);
    }
    return val;
  }

  // ---- Holographic status icon bar ----
  function _ensureContainer() {
    if (_uiContainer) return;
    _uiContainer = document.createElement("div");
    _uiContainer.id = "_sfxUI";
    _uiContainer.style.cssText =
      "position:fixed;bottom:130px;left:50%;transform:translateX(-50%);"+
      "display:flex;gap:6px;pointer-events:none;z-index:8000;";
    document.body.appendChild(_uiContainer);
  }

  const _entityEls = new Map();

  function _refreshUI(entityId) {
    if (entityId !== "hero") return;   // Only show hero effects on-screen
    _ensureContainer();
    let el = _entityEls.get(entityId);
    if (!el) {
      el = document.createElement("div");
      el.style.cssText = "display:flex;gap:5px;";
      _uiContainer.appendChild(el);
      _entityEls.set(entityId, el);
    }
    const actives = getActive(entityId);
    el.innerHTML = actives.map(a => {
      const hex = "#" + (a.def.color || 0x00ccff).toString(16).padStart(6,"0");
      const pct = Math.max(0, Math.min(1, a.timeLeft / a.def.duration));
      return `<div style="position:relative;width:34px;height:34px;border-radius:6px;`+
        `background:rgba(2,8,22,0.90);border:1px solid ${hex}44;`+
        `box-shadow:0 0 8px ${hex}44;display:flex;align-items:center;justify-content:center;flex-direction:column;">`+
        `<span style="font-size:15px;line-height:1">${a.def.icon}</span>`+
        `<div style="width:26px;height:2px;background:#1a2a3a;margin-top:2px;border-radius:1px;">`+
          `<div style="width:${pct*100}%;height:100%;background:${hex};border-radius:1px;"></div>`+
        `</div>`+
        (a.stacks > 1 ? `<span style="position:absolute;top:1px;right:3px;font-size:7px;color:${hex};">${a.stacks}</span>` : "")+
      `</div>`;
    }).join("");
  }

  return { define, apply, remove, clear, tick, getActive, getStat };
});
