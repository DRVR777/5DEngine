/**
 * ecs_status_effects.js — ECS status-effect (buff/debuff) system for 5DEngine
 *
 * ECS-native port of src/systems/status_effects.js.
 * Uses entity Health components and Core events instead of window globals.
 *
 * Entity component:
 *   StatusEffect: { effects: { [effectId]: { timeLeft, stacks } } }
 *
 * Built-in effect IDs (mirrored from status_effects.js):
 *   poison     — 2 * stacks HP/s damage, dur 5s, maxStacks 3
 *   burning    — 3 * stacks HP/s damage, dur 4s, maxStacks 2, defenceMult 0.7
 *   slowdown   — speedMult 0.45, dur 3s
 *   speedup    — speedMult 1.6, dur 8s
 *   heal_regen — 4 * stacks HP/s heal, dur 6s
 *   stun       — speedMult 0.0, dur 1.5s
 *   shield     — defenceMult 2.0, dur 5s
 *   invisible  — dur 5s (visual only, no stat change)
 *
 * Events emitted on Core:
 *   "status:applied"  { entityId, effectId, stacks, timeLeft }
 *   "status:expired"  { entityId, effectId }
 *   "status:cleared"  { entityId }
 *   "status:tick_dmg" { entityId, effectId, amount }  — when poison/burning ticks
 *   "status:tick_heal"{ entityId, effectId, amount }  — when heal_regen ticks
 *
 * Events listened to:
 *   "status:apply"    { entityId, effectId, opts? }  — apply effect via bus
 *   "status:remove"   { entityId, effectId }
 *   "status:clear"    { entityId }
 *
 * Usage:
 *   const sys = createStatusEffectSystem();
 *   Core.addSystem(sys, 15, "status_effects");  // between combat(10) and pickup(20)
 *   applyStatus(core, heroId, "poison");
 */

// Built-in effect definitions
const BUILTIN_EFFECTS = {
  poison: {
    label: "Poison", icon: "☠", duration: 5, maxStacks: 3,
    stats: { regenMult: 0.0 },
    dmgPerStackPerSec: 2,
  },
  burning: {
    label: "Burning", icon: "🔥", duration: 4, maxStacks: 2,
    stats: { defenceMult: 0.7 },
    dmgPerStackPerSec: 3,
  },
  slowdown: {
    label: "Slowed", icon: "❄", duration: 3, maxStacks: 2,
    stats: { speedMult: 0.45 },
  },
  speedup: {
    label: "Haste", icon: "⚡", duration: 8, maxStacks: 1,
    stats: { speedMult: 1.6 },
  },
  heal_regen: {
    label: "Regen", icon: "💚", duration: 6, maxStacks: 2,
    stats: { regenMult: 3.0 },
    healPerStackPerSec: 4,
  },
  stun: {
    label: "Stunned", icon: "💫", duration: 1.5, maxStacks: 1,
    stats: { speedMult: 0.0 },
  },
  shield: {
    label: "Shield", icon: "🛡", duration: 5, maxStacks: 1,
    stats: { defenceMult: 2.0 },
  },
  invisible: {
    label: "Invisible", icon: "👁", duration: 5, maxStacks: 1,
    stats: {},
  },
};

/**
 * applyStatus(core, entityId, effectId, opts?) → void
 *
 * Applies or refreshes an effect on the entity. Creates StatusEffect component
 * if absent.
 *
 * @param {object} core     - Core API
 * @param {number} entityId - Entity ID
 * @param {string} effectId - One of the BUILTIN_EFFECTS keys or a custom id
 * @param {object} [opts]   - { duration?, stacks?, defs? } — defs for custom effects
 */
export function applyStatus(core, entityId, effectId, opts = {}) {
  const def = (opts.defs || BUILTIN_EFFECTS)[effectId];
  if (!def) return;

  let se = core.getComponent(entityId, "StatusEffect");
  if (!se) {
    core.addComponent(entityId, "StatusEffect", { effects: {} });
    se = core.getComponent(entityId, "StatusEffect");
  }

  const existing = se.effects[effectId];
  const addStacks = opts.stacks || 1;
  if (existing) {
    existing.timeLeft = Math.max(existing.timeLeft, opts.duration ?? def.duration);
    existing.stacks   = Math.min(existing.stacks + addStacks, def.maxStacks);
  } else {
    se.effects[effectId] = {
      timeLeft: opts.duration ?? def.duration,
      stacks:   Math.min(addStacks, def.maxStacks),
    };
  }

  core.emit("status:applied", {
    entityId, effectId,
    stacks:   se.effects[effectId].stacks,
    timeLeft: se.effects[effectId].timeLeft,
  });
}

/**
 * removeStatus(core, entityId, effectId) → void
 */
export function removeStatus(core, entityId, effectId) {
  const se = core.getComponent(entityId, "StatusEffect");
  if (!se || !se.effects[effectId]) return;
  delete se.effects[effectId];
  core.emit("status:expired", { entityId, effectId });
}

/**
 * getStatMul(core, entityId, stat) → number
 *
 * Returns combined multiplicative modifier for a stat from all active effects.
 * stat is one of: speedMult, defenceMult, regenMult.
 * Returns 1.0 if no modifiers.
 */
export function getStatMul(core, entityId, stat) {
  const se = core.getComponent(entityId, "StatusEffect");
  if (!se) return 1.0;
  let mul = 1.0;
  for (const [effectId, entry] of Object.entries(se.effects)) {
    const def = BUILTIN_EFFECTS[effectId];
    if (def && def.stats && def.stats[stat] !== undefined) {
      mul *= Math.pow(def.stats[stat], entry.stacks);
    }
  }
  return mul;
}

/**
 * createStatusEffectSystem(customDefs?) → system function
 *
 * @param {object} [customDefs] - Additional effect definitions (merged with builtins)
 */
export function createStatusEffectSystem(customDefs = {}) {
  const _defs   = Object.assign({}, BUILTIN_EFFECTS, customDefs);
  let   _wired  = false;

  function system(dt, core) {
    if (!_wired) {
      _wired = true;

      core.on("status:apply", ({ entityId, effectId, opts }) => {
        applyStatus(core, entityId, effectId, Object.assign({ defs: _defs }, opts || {}));
      });
      core.on("status:remove", ({ entityId, effectId }) => {
        removeStatus(core, entityId, effectId);
      });
      core.on("status:clear", ({ entityId }) => {
        const se = core.getComponent(entityId, "StatusEffect");
        if (!se) return;
        for (const effectId of Object.keys(se.effects)) {
          delete se.effects[effectId];
          core.emit("status:expired", { entityId, effectId });
        }
        core.emit("status:cleared", { entityId });
      });
    }

    // Tick all entities with StatusEffect
    const ids = core.query("StatusEffect", "Health");
    for (const entityId of ids) {
      const se     = core.getComponent(entityId, "StatusEffect");
      const health = core.getComponent(entityId, "Health");
      if (!se || !health) continue;

      for (const [effectId, entry] of Object.entries(se.effects)) {
        const def = _defs[effectId];
        if (!def) continue;

        // Apply per-frame damage (poison, burning)
        if (def.dmgPerStackPerSec) {
          const dmg = def.dmgPerStackPerSec * entry.stacks * dt;
          health.hp = Math.max(0, health.hp - dmg);
          core.emit("status:tick_dmg", { entityId, effectId, amount: dmg });
        }

        // Apply per-frame heal (heal_regen)
        if (def.healPerStackPerSec) {
          const heal = def.healPerStackPerSec * entry.stacks * dt;
          const gained = Math.min(heal, (health.maxHp || 100) - health.hp);
          health.hp = Math.min(health.maxHp || 100, health.hp + heal);
          if (gained > 0) core.emit("status:tick_heal", { entityId, effectId, amount: gained });
        }

        // Decrement timer
        entry.timeLeft -= dt;
        if (entry.timeLeft <= 0) {
          delete se.effects[effectId];
          core.emit("status:expired", { entityId, effectId });
        }
      }
    }
  }

  system.defs       = _defs;
  system.applyStatus = (core, entityId, effectId, opts) =>
    applyStatus(core, entityId, effectId, Object.assign({ defs: _defs }, opts || {}));

  return system;
}

export default { createStatusEffectSystem, applyStatus, removeStatus, getStatMul };
