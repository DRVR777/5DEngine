// health.js — health facet + damage/regen/death events.
//
// Health is just a facet on the entity envelope:
//   entity.health = { current, max, regenRate, regenDelay, lastDamageT }
// Damage events flow through the registry — anything subscribing to
// "death" can react (drop loot, ragdoll, broadcast, etc).
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAHealth = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const listeners = { damage: [], death: [], heal: [] };

  function on(event, fn) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(fn);
  }
  function off(event, fn) {
    if (!listeners[event]) return;
    listeners[event] = listeners[event].filter(f => f !== fn);
  }
  function emit(event, payload) {
    const fns = listeners[event] || [];
    for (const fn of fns) try { fn(payload); } catch (e) { /* swallow */ }
  }
  function clearListeners() {
    for (const k of Object.keys(listeners)) listeners[k] = [];
  }

  // Build a default health facet
  function makeHealth(max, opts) {
    opts = opts || {};
    return {
      current: opts.current != null ? opts.current : max,
      max,
      regenRate: opts.regenRate != null ? opts.regenRate : 0,
      regenDelay: opts.regenDelay != null ? opts.regenDelay : 5,   // sec post-hit
      lastDamageT: -Infinity,
      dead: false,
    };
  }

  // Apply damage; emit "damage" then "death" if drops to 0.
  // Returns the new current health.
  function applyDamage(entity, amount, sourceId, nowSec) {
    if (!entity || !entity.health) return null;
    if (entity.health.dead) return entity.health.current;
    const before = entity.health.current;
    entity.health.current = Math.max(0, before - amount);
    entity.health.lastDamageT = nowSec != null ? nowSec : (Date.now() / 1000);
    emit("damage", { entity, amount, sourceId, before, after: entity.health.current });
    if (entity.health.current === 0 && !entity.health.dead) {
      entity.health.dead = true;
      emit("death", { entity, sourceId });
    }
    return entity.health.current;
  }

  // Heal: explicit healing (potion, regen, etc). Doesn't reset lastDamageT.
  function applyHeal(entity, amount) {
    if (!entity || !entity.health) return null;
    if (entity.health.dead) return entity.health.current;
    const before = entity.health.current;
    entity.health.current = Math.min(entity.health.max, before + amount);
    emit("heal", { entity, amount, before, after: entity.health.current });
    return entity.health.current;
  }

  // Tick: passive regen. Only fires after regenDelay seconds since last damage.
  function tick(entity, dt, nowSec) {
    if (!entity || !entity.health) return;
    if (entity.health.dead) return;
    if (entity.health.regenRate <= 0) return;
    const t = nowSec != null ? nowSec : (Date.now() / 1000);
    if (t - entity.health.lastDamageT < entity.health.regenDelay) return;
    if (entity.health.current >= entity.health.max) return;
    applyHeal(entity, entity.health.regenRate * dt);
  }

  // Respawn: reset to full health, dead=false. Caller decides where to place.
  function respawn(entity) {
    if (!entity || !entity.health) return;
    entity.health.current = entity.health.max;
    entity.health.dead = false;
    entity.health.lastDamageT = -Infinity;
  }

  return {
    makeHealth, applyDamage, applyHeal, tick, respawn,
    on, off, emit, clearListeners,
  };
});
