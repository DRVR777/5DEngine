// event_bus.js — 5DEngine global pub/sub event bus
// Lightweight typed event system. All engine modules use this instead of
// window.dispatchEvent to avoid DOM overhead and stay testable.
//
// API (window.EventBus):
//   on(event, handler)       — subscribe; returns unsubscribe fn
//   once(event, handler)     — subscribe for one firing only
//   off(event, handler)      — unsubscribe
//   emit(event, payload)     — fire immediately to all handlers
//   emitAsync(event, payload)— fire in next microtask (avoids re-entrancy)
//   clear(event?)            — remove all handlers for event (or all events)

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.EventBus = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const _handlers = new Map();   // event → Set<handler>

  function _ensure(event) {
    if (!_handlers.has(event)) _handlers.set(event, new Set());
    return _handlers.get(event);
  }

  function on(event, handler) {
    _ensure(event).add(handler);
    return () => off(event, handler);
  }

  function once(event, handler) {
    const wrapped = (payload) => { off(event, wrapped); handler(payload); };
    return on(event, wrapped);
  }

  function off(event, handler) {
    const set = _handlers.get(event);
    if (set) set.delete(handler);
  }

  function emit(event, payload) {
    const set = _handlers.get(event);
    if (!set || !set.size) return;
    for (const h of set) { try { h(payload); } catch (e) { console.warn("[EventBus]", event, e); } }
  }

  function emitAsync(event, payload) {
    Promise.resolve().then(() => emit(event, payload));
  }

  function clear(event) {
    if (event) _handlers.delete(event);
    else _handlers.clear();
  }

  // Built-in engine event names (for IDE autocomplete)
  const EVENTS = Object.freeze({
    HERO_DIED:      "hero:died",
    HERO_RESPAWNED: "hero:respawned",
    HERO_DAMAGED:   "hero:damaged",
    ENEMY_KILLED:   "enemy:killed",
    QUEST_COMPLETE: "quest:complete",
    QUEST_STEP:     "quest:step",
    ZONE_ENTER:     "zone:enter",
    ZONE_EXIT:      "zone:exit",
    SCORE_CHANGED:  "score:changed",
    WEAPON_SWITCH:  "weapon:switch",
    VEHICLE_ENTER:  "vehicle:enter",
    VEHICLE_EXIT:   "vehicle:exit",
    SCENE_SAVED:    "scene:saved",
    SCENE_LOADED:   "scene:loaded",
    BUILD_MODE_ON:  "build:on",
    BUILD_MODE_OFF: "build:off",
  });

  return { on, once, off, emit, emitAsync, clear, EVENTS };
});
