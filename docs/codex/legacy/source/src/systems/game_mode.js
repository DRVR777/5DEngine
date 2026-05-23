// game_mode.js — survival vs creative as data-driven rule sets.
// A mode is a rules object that the engine consults; it does not branch
// on mode strings. Adding a new mode = one entry.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAGameMode = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const MODES = {
    survival: {
      name: "survival",
      damageEnabled: true,
      hungerEnabled: true,
      hungerRate: 1.0,        // hp/sec drain when starving
      starveAt: 0,            // hunger value at which damage starts
      hungerDrainPerSec: 0.5, // hunger meter ticks down
      maxHunger: 100,
      lootDropsEnabled: true,
      respawnDelaySec: 5,
      infiniteInventory: false,
      freeBuild: false,
      friendlyFire: true,
    },
    creative: {
      name: "creative",
      damageEnabled: false,
      hungerEnabled: false,
      hungerRate: 0,
      starveAt: 0,
      hungerDrainPerSec: 0,
      maxHunger: 100,
      lootDropsEnabled: false,
      respawnDelaySec: 0,
      infiniteInventory: true,
      freeBuild: true,
      friendlyFire: false,
    },
    peaceful: {
      name: "peaceful",
      damageEnabled: false,
      hungerEnabled: true,
      hungerRate: 0,
      starveAt: 0,
      hungerDrainPerSec: 0.2,
      maxHunger: 100,
      lootDropsEnabled: true,
      respawnDelaySec: 1,
      infiniteInventory: false,
      freeBuild: true,
      friendlyFire: false,
    },
  };

  function get(name) { return MODES[name] || null; }
  function names() { return Object.keys(MODES); }
  function register(name, def) {
    if (MODES[name]) throw new Error(`mode ${name} already registered`);
    MODES[name] = Object.assign({ name }, def);
  }

  // Decide whether to apply damage given the current mode + actor + target.
  function shouldApplyDamage(mode, attackerId, targetId) {
    if (!mode || !mode.damageEnabled) return false;
    if (attackerId === targetId) return true; // self-damage allowed (e.g. fall)
    if (!mode.friendlyFire && attackerId && attackerId.startsWith("player_")
        && targetId && targetId.startsWith("player_")) return false;
    return true;
  }

  // Hunger facet builder
  function makeHunger(mode) {
    return {
      current: (mode && mode.maxHunger) || 100,
      max: (mode && mode.maxHunger) || 100,
      lastTickT: -Infinity,
    };
  }

  // Tick hunger: drain based on mode.hungerDrainPerSec; if hungerEnabled
  // and current <= starveAt, return starve damage to be applied.
  function tickHunger(mode, hunger, dt, nowSec) {
    if (!mode || !mode.hungerEnabled || !hunger) return { starveDamage: 0 };
    hunger.current = Math.max(0, hunger.current - mode.hungerDrainPerSec * dt);
    hunger.lastTickT = nowSec != null ? nowSec : Date.now() / 1000;
    if (hunger.current <= mode.starveAt) {
      return { starveDamage: mode.hungerRate * dt };
    }
    return { starveDamage: 0 };
  }

  // Eat — heal hunger by `amount` (clamped to max).
  function eat(hunger, amount) {
    if (!hunger) return 0;
    const before = hunger.current;
    hunger.current = Math.min(hunger.max, before + amount);
    return hunger.current - before;
  }

  // Inventory rule: in creative mode, addItem is a no-op (always succeeds).
  // Wraps the existing inventory.addItem in mode-aware behavior.
  function modeAddItem(mode, inv, type, qty, addItem) {
    if (mode && mode.infiniteInventory) return 0;  // pretend success
    return addItem(inv, type, qty);
  }

  // Drop-loot rule: only fires in modes where lootDropsEnabled.
  function shouldDropLoot(mode) {
    return !!(mode && mode.lootDropsEnabled);
  }

  // Build permission: creative + peaceful allow free build, survival
  // requires resources.
  function canFreeBuild(mode) {
    return !!(mode && mode.freeBuild);
  }

  return {
    MODES,
    get, names, register,
    shouldApplyDamage,
    makeHunger, tickHunger, eat,
    modeAddItem, shouldDropLoot, canFreeBuild,
  };
});
