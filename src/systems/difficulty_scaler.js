// difficulty_scaler.js — dynamic difficulty adjustment (DDA).
// Tracks per-player recent performance (deaths/sec, accuracy, time-
// to-clear-encounter) and computes scaling multipliers for enemy
// HP, damage, count. Caller applies multipliers when spawning enemies
// or computing damage.
//
// Performance metric is a rolling window. A "performance score" in
// [-1, +1] is computed:
//   -1 = struggling (high deaths, low accuracy, slow clears)
//    0 = baseline
//   +1 = stomping (low deaths, high accuracy, fast clears)
//
// Scaling multipliers:
//   hpMul     ∈ [0.5, 2.0]  (more HP if stomping)
//   dmgMul    ∈ [0.5, 2.0]  (more damage if stomping)
//   countMul  ∈ [0.5, 2.0]  (more enemies if stomping)
//
// Player level adds a baseline curve (higher level = harder).
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTADifficultyScaler = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function _clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }

  function createScaler(opts) {
    opts = opts || {};
    const config = Object.assign({
      windowSize: 20,         // last N encounters
      hpRange: [0.5, 2.0],
      dmgRange: [0.5, 2.0],
      countRange: [0.5, 2.0],
      levelCurve: (lvl) => 1 + (lvl - 1) * 0.05,    // +5% per level
      manualOverride: null,
    }, opts.config || {});

    const players = new Map();      // playerId → {level, encounters:[]}
    const events = [];

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 500) events.shift();
    }

    function _ensure(playerId) {
      if (!players.has(playerId)) {
        players.set(playerId, { level: 1, encounters: [] });
      }
      return players.get(playerId);
    }

    function setLevel(playerId, level) {
      if (typeof level !== "number" || level < 1) return { ok: false };
      _ensure(playerId).level = level;
      _log("set_level", { playerId, level });
      return { ok: true };
    }

    function getLevel(playerId) {
      const p = players.get(playerId);
      return p ? p.level : 1;
    }

    // record({playerId, deaths, kills, accuracy, durationS, won})
    function recordEncounter(opts2) {
      opts2 = opts2 || {};
      if (!opts2.playerId) return { ok: false, reason: "missing_player" };
      const p = _ensure(opts2.playerId);
      const e = {
        deaths: opts2.deaths || 0,
        kills: opts2.kills || 0,
        accuracy: typeof opts2.accuracy === "number" ? _clamp(opts2.accuracy, 0, 1) : 0.5,
        durationS: opts2.durationS || 60,
        won: opts2.won !== false,
        ts: opts2.ts != null ? opts2.ts : Date.now(),
      };
      p.encounters.push(e);
      while (p.encounters.length > config.windowSize) p.encounters.shift();
      _log("encounter", { playerId: opts2.playerId, won: e.won, deaths: e.deaths });
      return { ok: true };
    }

    // Compute the performance score [-1, +1] for a player
    function performance(playerId) {
      const p = players.get(playerId);
      if (!p || p.encounters.length === 0) return 0;
      let losses = 0, wins = 0, totalDeaths = 0, totalAcc = 0, totalDur = 0, totalKills = 0;
      for (const e of p.encounters) {
        if (e.won) wins++; else losses++;
        totalDeaths += e.deaths;
        totalAcc += e.accuracy;
        totalDur += e.durationS;
        totalKills += e.kills;
      }
      const n = p.encounters.length;
      const winRate = wins / n;                       // 0..1
      const avgDeaths = totalDeaths / n;              // higher = struggling
      const avgAcc = totalAcc / n;                    // 0..1
      const avgKillRate = totalKills / Math.max(1, totalDur);   // kills/sec

      // Each metric contributes to score:
      //   winRate: > 0.7 → +, < 0.3 → -
      //   deaths:  < 0.5 → +, > 2 → -
      //   acc:     > 0.7 → +, < 0.3 → -
      //   killRate: > 0.5 → +, < 0.1 → -
      let score = 0;
      score += (winRate - 0.5) * 1.0;            // ±0.5
      score += _clamp((1 - avgDeaths / 2), -1, 1) * 0.3;   // ±0.3
      score += (avgAcc - 0.5) * 0.4;             // ±0.2
      score += _clamp((avgKillRate - 0.3) / 0.5, -1, 1) * 0.3;

      return _clamp(score, -1, 1);
    }

    function multipliers(playerId) {
      if (config.manualOverride) {
        return Object.assign({ hpMul: 1, dmgMul: 1, countMul: 1 }, config.manualOverride);
      }
      const p = _ensure(playerId);
      const level = p.level;
      const score = performance(playerId);
      const baselineMul = config.levelCurve(level);

      // Map score [-1, +1] → multiplier in range. score=+1 → max, score=-1 → min.
      function _scale(range) {
        const [min, max] = range;
        const mid = (min + max) / 2;
        const half = (max - min) / 2;
        return mid + score * half;
      }
      return {
        hpMul: _scale(config.hpRange) * baselineMul,
        dmgMul: _scale(config.dmgRange) * baselineMul,
        countMul: _scale(config.countRange) * baselineMul,
        score,
        level,
      };
    }

    function reset(playerId) {
      if (!players.has(playerId)) return { ok: false };
      players.delete(playerId);
      _log("reset", { playerId });
      return { ok: true };
    }

    function setManualOverride(mults) {
      config.manualOverride = mults;
      return { ok: true };
    }
    function clearManualOverride() {
      config.manualOverride = null;
      return { ok: true };
    }

    function listPlayers() { return Array.from(players.keys()); }
    function getEncounters(playerId) {
      const p = players.get(playerId);
      return p ? p.encounters.slice() : [];
    }
    function recentEvents(n) { return events.slice(-(n || 50)); }
    function getConfig() { return Object.assign({}, config); }

    return {
      setLevel, getLevel,
      recordEncounter, performance, multipliers,
      reset, listPlayers, getEncounters,
      setManualOverride, clearManualOverride,
      recentEvents, getConfig,
    };
  }

  return { createScaler };
});
