// cooking.js — recipes + ingredients + buff outputs + skill progression.
// Player picks a recipe, system checks ingredients in inventory bridge,
// consumes them, produces an output item, and grants temporary buffs
// when consumed. Higher skill level yields better quality (buff
// duration/magnitude); failed cooking burns ingredients.
//
// Skill XP per successful cook; failed cooks award reduced XP.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTACooking = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const QUALITIES = ["burnt", "poor", "normal", "good", "great", "perfect"];

  function _clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }

  function createSystem(opts) {
    opts = opts || {};
    const config = Object.assign({
      xpPerLevel: 200,
      baseFailChance: 0.2,
      skillFailReduction: 0.02,    // per level
      baseQualityVariance: 0.3,
      xpPerCook: 20,
      xpPerFail: 5,
    }, opts.config || {});

    const recipes = new Map();
    const buffs = new Map();        // playerId → [{name, magnitude, expiresAt}]
    const skills = new Map();
    const events = [];

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 500) events.shift();
    }

    function registerRecipe(r) {
      if (!r || !r.id) return { ok: false, reason: "missing_id" };
      if (recipes.has(r.id)) return { ok: false, reason: "duplicate" };
      if (!r.ingredients || typeof r.ingredients !== "object") {
        return { ok: false, reason: "missing_ingredients" };
      }
      if (!r.output) return { ok: false, reason: "missing_output" };
      recipes.set(r.id, {
        id: r.id,
        name: r.name || r.id,
        ingredients: Object.assign({}, r.ingredients),
        output: r.output,
        outputQty: r.outputQty || 1,
        buff: r.buff || null,         // {name, magnitude, durationMs}
        minSkill: r.minSkill || 1,
        baseQuality: r.baseQuality || "normal",
      });
      _log("register_recipe", { id: r.id });
      return { ok: true };
    }

    function unregisterRecipe(id) { return recipes.delete(id); }
    function listRecipes() { return Array.from(recipes.values()); }
    function getRecipe(id) { return recipes.get(id) || null; }

    function getLevel(playerId) {
      return 1 + Math.floor((skills.get(playerId) || 0) / config.xpPerLevel);
    }
    function getXP(playerId) { return skills.get(playerId) || 0; }

    function _qualityForSkill(level, rng) {
      // Higher skill → higher quality output
      const idx = _clamp(Math.floor((level - 1) * 0.5 + 2), 0, QUALITIES.length - 1);
      // Variance: ±2 quality steps weighted by skill
      const variance = config.baseQualityVariance * Math.max(0.1, 1 - level * 0.05);
      const r = (rng() - 0.5) * 2;     // [-1, +1]
      const offset = Math.round(r * variance * 2);
      const finalIdx = _clamp(idx + offset, 0, QUALITIES.length - 1);
      return QUALITIES[finalIdx];
    }

    // cook(playerId, recipeId, {inventory, rng, now})
    // inventory adapter: { hasAll(playerId, recipeIngredients) → bool,
    //                      consume(playerId, recipeIngredients) → bool,
    //                      give(playerId, itemId, qty) → void }
    function cook(playerId, recipeId, opts2) {
      opts2 = opts2 || {};
      const recipe = recipes.get(recipeId);
      if (!recipe) return { ok: false, reason: "no_recipe" };
      const level = getLevel(playerId);
      if (level < recipe.minSkill) {
        return { ok: false, reason: "skill_too_low", required: recipe.minSkill };
      }
      const inv = opts2.inventory;
      if (inv && inv.hasAll && !inv.hasAll(playerId, recipe.ingredients)) {
        return { ok: false, reason: "missing_ingredients" };
      }
      // Consume ingredients first (commit point)
      if (inv && inv.consume) {
        inv.consume(playerId, recipe.ingredients);
      }
      const rng = opts2.rng || Math.random;
      // Failure check
      const failChance = Math.max(0, config.baseFailChance - level * config.skillFailReduction);
      if (rng() < failChance) {
        skills.set(playerId, (skills.get(playerId) || 0) + config.xpPerFail);
        _log("cook_failed", { playerId, recipeId, level });
        return {
          ok: false, reason: "burnt",
          quality: "burnt",
          xpGained: config.xpPerFail,
          newLevel: getLevel(playerId),
        };
      }
      // Success
      const quality = _qualityForSkill(level, rng);
      if (inv && inv.give) inv.give(playerId, recipe.output, recipe.outputQty);
      skills.set(playerId, (skills.get(playerId) || 0) + config.xpPerCook);
      _log("cook_success", { playerId, recipeId, quality });
      return {
        ok: true,
        recipeId,
        output: recipe.output,
        outputQty: recipe.outputQty,
        quality,
        xpGained: config.xpPerCook,
        newLevel: getLevel(playerId),
        buff: recipe.buff,
      };
    }

    // Player consumes a cooked dish → applies its buff
    function consume(playerId, dishId, opts2) {
      opts2 = opts2 || {};
      // Look up the recipe to find buff
      const recipe = Array.from(recipes.values()).find(r => r.output === dishId);
      if (!recipe || !recipe.buff) return { ok: false, reason: "no_buff" };
      const now = opts2.now != null ? opts2.now : Date.now();
      // Quality modifies buff magnitude
      const quality = opts2.quality || "normal";
      const qualityIdx = QUALITIES.indexOf(quality);
      const magnitudeMul = qualityIdx >= 2 ? 1 + (qualityIdx - 2) * 0.25 : Math.max(0.1, qualityIdx * 0.5);
      const buff = {
        name: recipe.buff.name,
        magnitude: recipe.buff.magnitude * magnitudeMul,
        startedAt: now,
        expiresAt: now + (recipe.buff.durationMs || 60000),
        source: dishId,
        quality,
      };
      if (!buffs.has(playerId)) buffs.set(playerId, []);
      buffs.get(playerId).push(buff);
      _log("consumed", { playerId, dishId, buff: buff.name });
      return { ok: true, buff };
    }

    function activeBuffs(playerId, now) {
      now = now != null ? now : Date.now();
      const list = buffs.get(playerId) || [];
      return list.filter(b => now < b.expiresAt);
    }

    function clearBuff(playerId, name) {
      const list = buffs.get(playerId);
      if (!list) return { ok: false };
      const before = list.length;
      buffs.set(playerId, list.filter(b => b.name !== name));
      return { ok: true, removed: before - buffs.get(playerId).length };
    }

    function tickBuffs(now) {
      now = now != null ? now : Date.now();
      for (const [pid, list] of buffs) {
        const filtered = list.filter(b => now < b.expiresAt);
        if (filtered.length !== list.length) {
          buffs.set(pid, filtered);
          _log("buff_expired", { playerId: pid, removed: list.length - filtered.length });
        }
      }
    }

    function recentEvents(n) { return events.slice(-(n || 50)); }
    function getConfig() { return Object.assign({}, config); }

    return {
      QUALITIES,
      registerRecipe, unregisterRecipe, listRecipes, getRecipe,
      cook, consume,
      activeBuffs, clearBuff, tickBuffs,
      getLevel, getXP,
      recentEvents, getConfig,
    };
  }

  return { QUALITIES, createSystem };
});
