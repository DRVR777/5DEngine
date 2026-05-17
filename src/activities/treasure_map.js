// treasure_map.js — clue-chain treasure-map mini-system.
// A treasure chain = sequence of N clues; each clue points to a dig
// spot. Player digs at the location → finds either:
//   (a) Next clue (if not last in chain)
//   (b) Final reward (last clue)
//
// Dig validation: player must be within digRadius of clue.location.
// Each chain has a unique id and tracks per-player progress.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTATreasureMap = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function _dist(a, b) { return Math.hypot(a.u - b.u, a.v - b.v); }

  function createSystem(opts) {
    opts = opts || {};
    const config = Object.assign({
      digRadius: 3,
      maxDigsPerSpot: 3,    // false-dig limit per location
    }, opts.config || {});

    const chains = new Map();       // chainId → {id, clues[], reward}
    const progress = new Map();     // playerId+chainId → {currentClueIdx, completed, digsSpent}
    const events = [];
    let nextChainId = 1;

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 500) events.shift();
    }

    function registerChain(opts2) {
      opts2 = opts2 || {};
      if (!Array.isArray(opts2.clues) || opts2.clues.length === 0) {
        return { ok: false, reason: "no_clues" };
      }
      for (const c of opts2.clues) {
        if (!c || !c.location || typeof c.location.u !== "number") {
          return { ok: false, reason: "bad_clue" };
        }
      }
      const id = opts2.id || ("chain_" + (nextChainId++));
      if (chains.has(id)) return { ok: false, reason: "duplicate" };
      chains.set(id, {
        id,
        name: opts2.name || id,
        clues: opts2.clues.map((c, i) => ({
          idx: i,
          location: c.location,
          hint: c.hint || "",
          terrain: c.terrain || "ground",
        })),
        reward: opts2.reward || null,
        difficulty: opts2.difficulty || 1,
      });
      _log("register_chain", { id });
      return { ok: true, chainId: id };
    }

    function unregisterChain(id) { return chains.delete(id); }
    function listChains() { return Array.from(chains.values()); }
    function getChain(id) { return chains.get(id) || null; }

    function _key(playerId, chainId) { return playerId + "::" + chainId; }

    function _ensureProgress(playerId, chainId) {
      const k = _key(playerId, chainId);
      if (!progress.has(k)) {
        progress.set(k, {
          playerId, chainId,
          currentClueIdx: 0,
          completed: false,
          digsSpent: 0,
          startedAt: Date.now(),
        });
      }
      return progress.get(k);
    }

    // Start chain for player — returns first clue
    function startChain(playerId, chainId) {
      const c = chains.get(chainId);
      if (!c) return { ok: false, reason: "no_chain" };
      const p = _ensureProgress(playerId, chainId);
      if (p.completed) return { ok: false, reason: "already_completed" };
      _log("start_chain", { playerId, chainId });
      return {
        ok: true,
        clue: c.clues[p.currentClueIdx],
        total: c.clues.length,
      };
    }

    // Player digs at position → checks if it matches current clue
    function dig(playerId, chainId, position, opts2) {
      opts2 = opts2 || {};
      const c = chains.get(chainId);
      if (!c) return { ok: false, reason: "no_chain" };
      const p = _ensureProgress(playerId, chainId);
      if (p.completed) return { ok: false, reason: "already_completed" };
      const clue = c.clues[p.currentClueIdx];
      const d = _dist(position, clue.location);
      p.digsSpent++;
      if (d > config.digRadius) {
        _log("dig_miss", { playerId, chainId, distance: d });
        if (p.digsSpent > config.maxDigsPerSpot * c.clues.length) {
          return { ok: false, reason: "too_many_digs" };
        }
        return { ok: false, reason: "miss", distance: d };
      }
      // Hit!
      const isLast = p.currentClueIdx >= c.clues.length - 1;
      if (isLast) {
        p.completed = true;
        _log("treasure_found", { playerId, chainId, reward: c.reward });
        // Grant reward via inventory bridge if supplied
        if (c.reward && opts2.inventory && opts2.inventory.give) {
          for (const item of (Array.isArray(c.reward) ? c.reward : [c.reward])) {
            opts2.inventory.give(playerId, item.itemId, item.qty);
          }
        }
        return {
          ok: true,
          finalDig: true,
          reward: c.reward,
        };
      }
      p.currentClueIdx++;
      _log("clue_unlocked", { playerId, chainId, nextIdx: p.currentClueIdx });
      return {
        ok: true,
        finalDig: false,
        nextClue: c.clues[p.currentClueIdx],
        progress: { current: p.currentClueIdx + 1, total: c.clues.length },
      };
    }

    function getProgress(playerId, chainId) {
      return progress.get(_key(playerId, chainId)) || null;
    }

    function getCurrentClue(playerId, chainId) {
      const c = chains.get(chainId);
      if (!c) return null;
      const p = progress.get(_key(playerId, chainId));
      if (!p || p.completed) return null;
      return c.clues[p.currentClueIdx];
    }

    function abandonChain(playerId, chainId) {
      const k = _key(playerId, chainId);
      if (!progress.has(k)) return { ok: false };
      progress.delete(k);
      _log("abandoned", { playerId, chainId });
      return { ok: true };
    }

    function playerStats(playerId) {
      let started = 0, completed = 0, totalDigs = 0;
      for (const p of progress.values()) {
        if (p.playerId !== playerId) continue;
        started++;
        if (p.completed) completed++;
        totalDigs += p.digsSpent;
      }
      return { started, completed, totalDigs };
    }

    function recentEvents(n) { return events.slice(-(n || 50)); }
    function getConfig() { return Object.assign({}, config); }

    return {
      registerChain, unregisterChain, listChains, getChain,
      startChain, dig, abandonChain,
      getProgress, getCurrentClue, playerStats,
      recentEvents, getConfig,
    };
  }

  return { createSystem };
});
