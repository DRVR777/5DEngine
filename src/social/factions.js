// factions.js — per-faction reputation with tiers + cross-faction relations.
// Rep is an integer per (player, faction). Tier thresholds drive perks +
// access. Cross-faction relations (ally/rival/neutral) cascade rep changes.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAFactions = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const TIERS = [
    { name: "hated",      min: -Infinity, max: -500 },
    { name: "hostile",    min: -499,      max: -100 },
    { name: "neutral",    min: -99,       max: 99    },
    { name: "friendly",   min: 100,       max: 499   },
    { name: "honored",    min: 500,       max: 1499  },
    { name: "exalted",    min: 1500,      max: Infinity },
  ];

  function tierOf(rep) {
    for (const t of TIERS) if (rep >= t.min && rep <= t.max) return t.name;
    return "neutral";
  }

  function createFactionSystem(opts) {
    opts = opts || {};
    const factions = new Map();      // factionId → {name, kind, capital}
    const relations = new Map();     // "A::B" → "ally" | "rival" | "neutral"
    const playerRep = new Map();     // playerId → Map<factionId, rep>
    const allianceCascade = opts.allianceCascade != null ? opts.allianceCascade : 0.5;
    const rivalryCascade = opts.rivalryCascade != null ? opts.rivalryCascade : -0.5;
    const events = [];               // last 200 audit entries

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 200) events.shift();
    }
    function _relKey(a, b) { return [a, b].sort().join("::"); }
    function _wallet(p) {
      if (!playerRep.has(p)) playerRep.set(p, new Map());
      return playerRep.get(p);
    }

    function defineFaction(id, def) {
      if (factions.has(id)) throw new Error(`faction ${id} exists`);
      factions.set(id, Object.assign({ id, name: id, kind: "neutral" }, def || {}));
    }
    function getFaction(id) { return factions.get(id) || null; }
    function listFactions() { return Array.from(factions.keys()); }

    function setRelation(a, b, rel) {
      if (!factions.has(a) || !factions.has(b)) return { ok: false, reason: "missing_faction" };
      if (a === b) return { ok: false, reason: "self_relation" };
      if (!["ally", "rival", "neutral"].includes(rel)) return { ok: false, reason: "bad_rel" };
      relations.set(_relKey(a, b), rel);
      return { ok: true };
    }
    function getRelation(a, b) {
      if (a === b) return "self";
      return relations.get(_relKey(a, b)) || "neutral";
    }

    function getRep(playerId, factionId) {
      const w = playerRep.get(playerId);
      return w ? (w.get(factionId) || 0) : 0;
    }
    function getTier(playerId, factionId) {
      return tierOf(getRep(playerId, factionId));
    }

    // Adjust rep. Cascades to allies (positive fraction) + rivals
    // (negative fraction). Returns array of {factionId, delta, newRep, newTier}.
    function adjustRep(playerId, factionId, delta, opts2) {
      opts2 = opts2 || {};
      if (!factions.has(factionId)) return [];
      const changes = [];
      const w = _wallet(playerId);
      // Primary
      const prevTier = tierOf(w.get(factionId) || 0);
      w.set(factionId, (w.get(factionId) || 0) + delta);
      const newTier = tierOf(w.get(factionId));
      changes.push({ factionId, delta, newRep: w.get(factionId), prevTier, newTier });

      // Cascade
      if (opts2.skipCascade) {
        _log("rep_adjust", { playerId, factionId, delta, newRep: w.get(factionId) });
        return changes;
      }
      for (const otherId of factions.keys()) {
        if (otherId === factionId) continue;
        const rel = getRelation(factionId, otherId);
        let cascade = 0;
        if (rel === "ally") cascade = Math.round(delta * allianceCascade);
        else if (rel === "rival") cascade = Math.round(delta * rivalryCascade);
        if (cascade === 0) continue;
        const prevOther = w.get(otherId) || 0;
        const prevOtherTier = tierOf(prevOther);
        w.set(otherId, prevOther + cascade);
        const newOtherTier = tierOf(w.get(otherId));
        changes.push({
          factionId: otherId, delta: cascade, newRep: w.get(otherId),
          prevTier: prevOtherTier, newTier: newOtherTier, cascade: true, from: factionId,
        });
      }
      _log("rep_adjust", { playerId, factionId, delta, changes: changes.length });
      return changes;
    }

    // Check access: is the player at-least at the required tier?
    function hasAccess(playerId, factionId, requiredTier) {
      const reqIdx = TIERS.findIndex(t => t.name === requiredTier);
      if (reqIdx === -1) return false;
      const curIdx = TIERS.findIndex(t => t.name === getTier(playerId, factionId));
      return curIdx >= reqIdx;
    }

    function recentEvents(n) { return events.slice(-(n || 50)); }

    return {
      TIERS, tierOf,
      defineFaction, getFaction, listFactions,
      setRelation, getRelation,
      getRep, getTier, adjustRep, hasAccess, recentEvents,
      _factions: factions, _relations: relations, _playerRep: playerRep,
    };
  }

  return { createFactionSystem, TIERS, tierOf };
});
