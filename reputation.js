// reputation.js — per-faction reputation with thresholds, cascades, decay.
// Each player has a rep score per faction. Score changes via delta()
// from caller events (helped faction → +N, attacked faction → -N).
// Score crossings trigger threshold events that gate quest access,
// merchant prices, NPC dialogue, etc.
//
// Cascades: a faction can declare allies + enemies. Helping an ally
// also helps the faction (smaller delta); hurting an enemy also helps
// the faction. Caller configures cascade weights per relationship.
//
// Decay: scores drift toward 0 over time (config decayPerHour) so
// past actions fade unless reinforced.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAReputation = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Thresholds: standing labels mapped to score windows
  const DEFAULT_THRESHOLDS = [
    { name: "hated",       max: -800 },
    { name: "hostile",     max: -400 },
    { name: "unfriendly",  max: -100 },
    { name: "neutral",     max:  100 },
    { name: "friendly",    max:  400 },
    { name: "honored",     max:  800 },
    { name: "exalted",     max:  Infinity },
  ];

  function _standingFor(score, thresholds) {
    for (const t of thresholds) if (score <= t.max) return t.name;
    return thresholds[thresholds.length - 1].name;
  }

  function _clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }

  function createSystem(opts) {
    opts = opts || {};
    const config = Object.assign({
      thresholds: DEFAULT_THRESHOLDS,
      minScore: -1000,
      maxScore: 1000,
      decayPerHour: 1,           // points toward 0 per hour
      allyWeight: 0.5,           // cascade weight for helping allies
      enemyWeight: 0.5,          // cascade weight for hurting enemies
    }, opts.config || {});

    const factions = new Map();   // factionId → {id, name, allies:[], enemies:[]}
    const repByPlayer = new Map(); // playerId → Map<factionId, {score, lastTouchedTs}>
    const events = [];

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 1000) events.shift();
    }

    function registerFaction(f) {
      if (!f || !f.id) return { ok: false, reason: "missing_id" };
      if (factions.has(f.id)) return { ok: false, reason: "duplicate" };
      factions.set(f.id, {
        id: f.id, name: f.name || f.id,
        allies: (f.allies || []).slice(),
        enemies: (f.enemies || []).slice(),
        meta: f.meta || {},
      });
      _log("register", { id: f.id });
      return { ok: true };
    }

    function unregisterFaction(id) { return factions.delete(id); }
    function listFactions() { return Array.from(factions.values()); }
    function getFaction(id) { return factions.get(id) || null; }

    function _ensure(playerId, factionId, now) {
      if (!repByPlayer.has(playerId)) repByPlayer.set(playerId, new Map());
      const map = repByPlayer.get(playerId);
      if (!map.has(factionId)) {
        map.set(factionId, { score: 0, lastTouchedTs: now != null ? now : Date.now() });
      }
      return map.get(factionId);
    }

    // Apply decay to a player's rep with a faction, returning their up-to-date score
    function _applyDecay(rep, now) {
      const elapsedH = (now - rep.lastTouchedTs) / 3600000;
      if (elapsedH <= 0) return rep.score;
      const decay = config.decayPerHour * elapsedH;
      if (rep.score > 0) rep.score = Math.max(0, rep.score - decay);
      else if (rep.score < 0) rep.score = Math.min(0, rep.score + decay);
      rep.lastTouchedTs = now;
      return rep.score;
    }

    function score(playerId, factionId, opts2) {
      opts2 = opts2 || {};
      const now = opts2.now != null ? opts2.now : Date.now();
      if (!factions.has(factionId)) return null;
      const rep = _ensure(playerId, factionId, now);
      return _applyDecay(rep, now);
    }

    function standing(playerId, factionId, opts2) {
      const s = score(playerId, factionId, opts2);
      if (s === null) return null;
      return _standingFor(s, config.thresholds);
    }

    // Apply a delta to faction rep, with cascade to allies/enemies.
    // Returns {primary, cascades:[{factionId, delta, newScore, newStanding}]}
    function delta(playerId, factionId, value, opts2) {
      opts2 = opts2 || {};
      if (!factions.has(factionId)) return { ok: false, reason: "no_faction" };
      if (typeof value !== "number") return { ok: false, reason: "bad_value" };
      const now = opts2.now != null ? opts2.now : Date.now();
      const f = factions.get(factionId);
      const beforeStanding = standing(playerId, factionId, { now });
      // Apply primary
      const rep = _ensure(playerId, factionId, now);
      _applyDecay(rep, now);
      rep.score = _clamp(rep.score + value, config.minScore, config.maxScore);
      rep.lastTouchedTs = now;
      const afterStanding = _standingFor(rep.score, config.thresholds);
      const standingChanged = beforeStanding !== afterStanding;
      _log("delta", { playerId, factionId, value, score: rep.score, standing: afterStanding });
      // Cascade: allies get +value * allyWeight, enemies get -value * enemyWeight
      const cascades = [];
      if (!opts2.skipCascade) {
        for (const allyId of f.allies) {
          if (!factions.has(allyId)) continue;
          const cv = value * config.allyWeight;
          const cb = standing(playerId, allyId, { now });
          const cRep = _ensure(playerId, allyId, now);
          _applyDecay(cRep, now);
          cRep.score = _clamp(cRep.score + cv, config.minScore, config.maxScore);
          cRep.lastTouchedTs = now;
          const ca = _standingFor(cRep.score, config.thresholds);
          cascades.push({
            factionId: allyId, delta: cv, newScore: cRep.score,
            newStanding: ca, standingChanged: cb !== ca, kind: "ally",
          });
        }
        for (const enemyId of f.enemies) {
          if (!factions.has(enemyId)) continue;
          const cv = -value * config.enemyWeight;
          const cb = standing(playerId, enemyId, { now });
          const cRep = _ensure(playerId, enemyId, now);
          _applyDecay(cRep, now);
          cRep.score = _clamp(cRep.score + cv, config.minScore, config.maxScore);
          cRep.lastTouchedTs = now;
          const ca = _standingFor(cRep.score, config.thresholds);
          cascades.push({
            factionId: enemyId, delta: cv, newScore: cRep.score,
            newStanding: ca, standingChanged: cb !== ca, kind: "enemy",
          });
        }
      }
      return {
        ok: true,
        primary: {
          factionId, delta: value, newScore: rep.score,
          newStanding: afterStanding, standingChanged,
        },
        cascades,
      };
    }

    function set(playerId, factionId, value, opts2) {
      opts2 = opts2 || {};
      if (!factions.has(factionId)) return { ok: false, reason: "no_faction" };
      const now = opts2.now != null ? opts2.now : Date.now();
      const rep = _ensure(playerId, factionId, now);
      rep.score = _clamp(value, config.minScore, config.maxScore);
      rep.lastTouchedTs = now;
      _log("set", { playerId, factionId, value });
      return { ok: true, newScore: rep.score };
    }

    function allOfPlayer(playerId, opts2) {
      opts2 = opts2 || {};
      const now = opts2.now != null ? opts2.now : Date.now();
      const map = repByPlayer.get(playerId) || new Map();
      const out = {};
      for (const fid of factions.keys()) {
        const rep = map.get(fid);
        const s = rep ? _applyDecay(rep, now) : 0;
        out[fid] = { score: s, standing: _standingFor(s, config.thresholds) };
      }
      return out;
    }

    function meetsStanding(playerId, factionId, name, opts2) {
      const cur = standing(playerId, factionId, opts2);
      if (!cur) return false;
      const thresholds = config.thresholds;
      const idxCur = thresholds.findIndex(t => t.name === cur);
      const idxReq = thresholds.findIndex(t => t.name === name);
      if (idxReq < 0) return false;
      return idxCur >= idxReq;
    }

    function reset(playerId, factionId) {
      const map = repByPlayer.get(playerId);
      if (!map) return { ok: false };
      if (factionId == null) repByPlayer.delete(playerId);
      else map.delete(factionId);
      _log("reset", { playerId, factionId: factionId || "ALL" });
      return { ok: true };
    }

    function listPlayers() { return Array.from(repByPlayer.keys()); }
    function recentEvents(n) { return events.slice(-(n || 50)); }

    return {
      DEFAULT_THRESHOLDS,
      registerFaction, unregisterFaction, listFactions, getFaction,
      delta, set, score, standing,
      allOfPlayer, meetsStanding,
      reset, listPlayers,
      recentEvents,
    };
  }

  return { DEFAULT_THRESHOLDS, createSystem };
});
