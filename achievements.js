// achievements.js — unlock conditions + reward grants + chain deps.
// Achievements are declared with a kind that names the check predicate,
// parameters, optional dependency list, rarity tier, hidden flag, and
// reward. The runtime evaluates achievements when triggered events
// arrive (kill, mission_complete, collect, etc.) or via explicit poll.
//
// Built-in kinds (caller-extendable via registerKind):
//   "stat_threshold" — stats.lifetime(kind) >= threshold
//   "stat_in_day"    — stats.dayStats(today)[kind] >= threshold
//   "mission_done"   — specific mission completed
//   "event_count"    — N occurrences of a kind in the audit log
//   "custom"         — caller predicate(state, ctx) → bool
//
// Chain dependencies: an achievement gated on others' unlock first.
// Rarity tiers: common / uncommon / rare / epic / legendary; provided
// for UI badging — caller may map to score weights.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAAchievements = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const RARITY = ["common", "uncommon", "rare", "epic", "legendary"];
  const KIND_NAMES = ["stat_threshold", "stat_in_day", "mission_done", "event_count", "custom"];

  function createSystem(opts) {
    opts = opts || {};
    const config = Object.assign({
      autoEvaluateOnEvent: true,
    }, opts.config || {});

    const defs = new Map();           // id → {id, kind, params, rarity, requires[], hidden, reward, name, description}
    const unlocked = new Map();       // playerId → Map<achievementId, {ts, rewardClaimed}>
    const progress = new Map();       // playerId+achId → current progress 0..target
    const events = [];                // global audit
    const playerEventCounts = new Map(); // playerId+eventKind → count

    const customKinds = new Map();
    // Register built-in kinds
    customKinds.set("stat_threshold", (def, ctx) => {
      if (!ctx.stats) return false;
      const cur = ctx.stats.lifetime(ctx.playerId, def.params.statKind) || 0;
      return cur >= def.params.threshold;
    });
    customKinds.set("stat_in_day", (def, ctx) => {
      if (!ctx.stats) return false;
      const today = ctx.stats.utcDayKey(Date.now());
      const day = ctx.stats.dayStats(ctx.playerId, today);
      if (!day) return false;
      return (day[def.params.statKind] || 0) >= def.params.threshold;
    });
    customKinds.set("mission_done", (def, ctx) => {
      // Caller must supply ctx.completedMissions: Set<missionId>
      return ctx.completedMissions && ctx.completedMissions.has(def.params.missionId);
    });
    customKinds.set("event_count", (def, ctx) => {
      const key = ctx.playerId + "::" + def.params.eventKind;
      return (playerEventCounts.get(key) || 0) >= def.params.count;
    });
    customKinds.set("custom", (def, ctx) => {
      if (typeof def.params.predicate !== "function") return false;
      try { return !!def.params.predicate(ctx); }
      catch (e) { return false; }
    });

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 1000) events.shift();
    }

    function registerKind(name, fn) {
      if (typeof name !== "string" || !name) throw new Error("name");
      if (typeof fn !== "function") throw new Error("fn");
      customKinds.set(name, fn);
      return { ok: true };
    }

    function register(def) {
      if (!def || !def.id) return { ok: false, reason: "missing_id" };
      if (defs.has(def.id)) return { ok: false, reason: "duplicate" };
      if (!def.kind) return { ok: false, reason: "missing_kind" };
      if (!customKinds.has(def.kind)) return { ok: false, reason: "unknown_kind" };
      const rarity = def.rarity || "common";
      if (!RARITY.includes(rarity)) return { ok: false, reason: "bad_rarity" };
      defs.set(def.id, {
        id: def.id,
        name: def.name || def.id,
        description: def.description || "",
        kind: def.kind,
        params: def.params || {},
        rarity,
        requires: (def.requires || []).slice(),
        hidden: !!def.hidden,
        reward: def.reward || null,
      });
      _log("register", { id: def.id, rarity });
      return { ok: true };
    }

    function unregister(id) { return defs.delete(id); }
    function getDef(id) { return defs.get(id) || null; }
    function listDefs() { return Array.from(defs.values()); }

    function _ensurePlayer(playerId) {
      if (!unlocked.has(playerId)) unlocked.set(playerId, new Map());
      return unlocked.get(playerId);
    }

    function isUnlocked(playerId, achId) {
      const pm = unlocked.get(playerId);
      return pm ? pm.has(achId) : false;
    }

    function _depsMet(def, playerId) {
      for (const d of def.requires) if (!isUnlocked(playerId, d)) return false;
      return true;
    }

    // Evaluate all achievements for a player and unlock any newly-met
    function evaluate(playerId, ctx) {
      ctx = ctx || {};
      ctx.playerId = playerId;
      const pm = _ensurePlayer(playerId);
      const newly = [];
      for (const def of defs.values()) {
        if (pm.has(def.id)) continue;
        if (!_depsMet(def, playerId)) continue;
        const checkFn = customKinds.get(def.kind);
        if (!checkFn) continue;
        let met = false;
        try { met = checkFn(def, ctx); }
        catch (e) { met = false; }
        if (met) {
          pm.set(def.id, { ts: Date.now(), rewardClaimed: false });
          newly.push(def);
          _log("unlock", { playerId, achId: def.id, rarity: def.rarity });
        }
      }
      return newly;
    }

    // Record an event count for a player (used by "event_count" kind)
    function recordEvent(playerId, eventKind, ctx) {
      const key = playerId + "::" + eventKind;
      playerEventCounts.set(key, (playerEventCounts.get(key) || 0) + 1);
      _log("event", { playerId, eventKind });
      if (config.autoEvaluateOnEvent) return evaluate(playerId, ctx);
      return [];
    }

    // Claim reward — caller-supplied grant fn
    function claimReward(playerId, achId, grantFn) {
      const pm = unlocked.get(playerId);
      if (!pm || !pm.has(achId)) return { ok: false, reason: "not_unlocked" };
      const status = pm.get(achId);
      if (status.rewardClaimed) return { ok: false, reason: "already_claimed" };
      const def = defs.get(achId);
      if (!def.reward) {
        status.rewardClaimed = true;
        return { ok: true, reward: null };
      }
      if (typeof grantFn === "function") {
        try { grantFn(playerId, def.reward); }
        catch (e) { return { ok: false, reason: "grant_threw", message: e.message }; }
      }
      status.rewardClaimed = true;
      _log("claim", { playerId, achId });
      return { ok: true, reward: def.reward };
    }

    function unlockedFor(playerId) {
      const pm = unlocked.get(playerId);
      if (!pm) return [];
      return Array.from(pm.entries()).map(([id, status]) => ({
        id, ...status,
        def: defs.get(id),
      }));
    }

    function visibleFor(playerId) {
      // Return all NOT-hidden defs + hidden ones already unlocked
      const out = [];
      const pm = unlocked.get(playerId) || new Map();
      for (const def of defs.values()) {
        if (!def.hidden || pm.has(def.id)) {
          out.push({
            id: def.id, name: def.name, description: def.description,
            rarity: def.rarity, unlocked: pm.has(def.id),
            requires: def.requires, hidden: def.hidden,
          });
        }
      }
      return out;
    }

    function progressOf(playerId, achId, ctx) {
      ctx = ctx || {};
      const def = defs.get(achId);
      if (!def) return null;
      if (isUnlocked(playerId, achId)) return { current: 1, target: 1, pct: 1, met: true };
      ctx.playerId = playerId;
      switch (def.kind) {
        case "stat_threshold": {
          if (!ctx.stats) return null;
          const cur = ctx.stats.lifetime(playerId, def.params.statKind) || 0;
          return { current: cur, target: def.params.threshold,
                   pct: Math.min(1, cur / def.params.threshold), met: false };
        }
        case "event_count": {
          const key = playerId + "::" + def.params.eventKind;
          const cur = playerEventCounts.get(key) || 0;
          return { current: cur, target: def.params.count,
                   pct: Math.min(1, cur / def.params.count), met: false };
        }
        default:
          return { current: 0, target: 1, pct: 0, met: false };
      }
    }

    function totalRarityScore(playerId) {
      const pm = unlocked.get(playerId);
      if (!pm) return 0;
      const weights = { common: 1, uncommon: 3, rare: 8, epic: 20, legendary: 50 };
      let total = 0;
      for (const id of pm.keys()) {
        const def = defs.get(id);
        if (def) total += weights[def.rarity] || 1;
      }
      return total;
    }

    function recentEvents(n) { return events.slice(-(n || 50)); }

    return {
      RARITY, KIND_NAMES,
      registerKind,
      register, unregister, getDef, listDefs,
      evaluate, recordEvent, claimReward,
      isUnlocked, unlockedFor, visibleFor, progressOf,
      totalRarityScore,
      recentEvents,
    };
  }

  return { RARITY, KIND_NAMES, createSystem };
});
