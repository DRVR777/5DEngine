// daily_challenges.js — deterministic daily challenges + reward grants.
// Every UTC day picks N challenges from a registered pool, using the
// date as the RNG seed (so all players see the same challenges).
// Players submit completion (with proof: leaderboard rank, mission
// completion, etc.) → reward grants into a ledger. Ledger is
// append-only and per-player-deduped (one completion per challenge/day).
//
// Pool entry:
//   { id, name, kind, rewardCcy, rewardAmount, ... params }
//
// Kinds (caller-defined predicate):
//   "reach_score"  — submitter must hit score >= threshold
//   "mission_run"  — submitter completes mission X
//   "collect_n"    — submitter collects N of itemType
//   "win_minigame" — submitter wins minigame Y
//   "custom"       — caller-supplied verify(submission) → bool
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTADailyChallenges = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // YYYYMMDD → integer key
  function utcDayKey(ts) {
    const d = new Date(ts);
    const y = d.getUTCFullYear();
    const m = (d.getUTCMonth() + 1).toString().padStart(2, "0");
    const day = d.getUTCDate().toString().padStart(2, "0");
    return Number(y + m + day);
  }

  // Seeded shuffle (deterministic for given seed)
  function _shuffle(arr, rng) {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  function createSystem(opts) {
    opts = opts || {};
    const config = Object.assign({
      challengesPerDay: 3,
      baseSeed: 1337,
    }, opts.config || {});

    const pool = new Map();         // id → challenge def
    const ledger = [];              // grant history
    const seenKey = new Set();      // player + day + challenge dedupe
    const events = [];

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 500) events.shift();
    }

    function registerChallenge(c) {
      if (!c || !c.id) return { ok: false, reason: "missing_id" };
      if (pool.has(c.id)) return { ok: false, reason: "duplicate" };
      if (!c.kind) return { ok: false, reason: "missing_kind" };
      if (typeof c.rewardAmount !== "number" || c.rewardAmount < 0) {
        return { ok: false, reason: "bad_reward" };
      }
      pool.set(c.id, Object.assign({ rewardCcy: "coin" }, c));
      _log("register", { id: c.id });
      return { ok: true };
    }

    function unregisterChallenge(id) {
      if (!pool.has(id)) return { ok: false };
      pool.delete(id);
      _log("unregister", { id });
      return { ok: true };
    }

    function listPool() { return Array.from(pool.values()); }

    // Pick today's challenges (deterministic by day)
    function pickForDay(ts) {
      ts = ts != null ? ts : Date.now();
      const day = utcDayKey(ts);
      const items = Array.from(pool.values());
      if (items.length === 0) return [];
      const rng = mulberry32(config.baseSeed + day);
      const shuffled = _shuffle(items, rng);
      return shuffled.slice(0, Math.min(config.challengesPerDay, shuffled.length));
    }

    // Submit a completion claim. submission has {playerId, challengeId,
    // proof: {...kind-specific}, ts?}.
    // Returns {ok, grant?: {playerId, ccy, amount, ts}, reason?}.
    function submitCompletion(submission, opts2) {
      opts2 = opts2 || {};
      const econ = opts2.economy;   // optional: deposit method
      if (!submission || !submission.playerId || !submission.challengeId) {
        return { ok: false, reason: "bad_submission" };
      }
      const ts = submission.ts != null ? submission.ts : Date.now();
      const day = utcDayKey(ts);
      const todays = pickForDay(ts);
      const challenge = todays.find(c => c.id === submission.challengeId);
      if (!challenge) return { ok: false, reason: "not_today" };

      // Dedupe per (player, day, challenge)
      const dedupeKey = submission.playerId + "::" + day + "::" + submission.challengeId;
      if (seenKey.has(dedupeKey)) return { ok: false, reason: "already_claimed" };

      // Verify
      const verifyResult = _verify(challenge, submission, opts2);
      if (!verifyResult.ok) return { ok: false, reason: verifyResult.reason };

      seenKey.add(dedupeKey);
      const grant = {
        id: "grant_" + (ledger.length + 1),
        playerId: submission.playerId,
        challengeId: challenge.id,
        ccy: challenge.rewardCcy,
        amount: challenge.rewardAmount,
        day, ts,
      };
      ledger.push(grant);
      if (econ && typeof econ.deposit === "function") {
        try { econ.deposit(submission.playerId, challenge.rewardCcy, challenge.rewardAmount); } catch (e) {}
      }
      _log("grant", { playerId: grant.playerId, amount: grant.amount, ccy: grant.ccy });
      return { ok: true, grant };
    }

    function _verify(challenge, submission, opts2) {
      const p = submission.proof || {};
      switch (challenge.kind) {
        case "reach_score":
          if (typeof p.score !== "number") return { ok: false, reason: "no_score_proof" };
          if (p.score < challenge.threshold) return { ok: false, reason: "score_too_low" };
          return { ok: true };
        case "mission_run":
          if (p.missionId !== challenge.missionId) return { ok: false, reason: "wrong_mission" };
          if (!p.completed) return { ok: false, reason: "not_completed" };
          return { ok: true };
        case "collect_n":
          if (typeof p.count !== "number") return { ok: false, reason: "no_count_proof" };
          if (p.count < challenge.count) return { ok: false, reason: "not_enough" };
          if (p.itemType !== challenge.itemType) return { ok: false, reason: "wrong_item" };
          return { ok: true };
        case "win_minigame":
          if (p.minigameId !== challenge.minigameId) return { ok: false, reason: "wrong_minigame" };
          if (!p.won) return { ok: false, reason: "not_won" };
          return { ok: true };
        case "custom":
          if (typeof challenge.verify !== "function") return { ok: false, reason: "no_verify_fn" };
          try {
            const r = challenge.verify(submission, opts2);
            return r ? { ok: true } : { ok: false, reason: "verify_failed" };
          } catch (e) {
            return { ok: false, reason: "verify_threw" };
          }
        default:
          return { ok: false, reason: "unknown_kind" };
      }
    }

    function ledgerOf(playerId) {
      return ledger.filter(g => g.playerId === playerId);
    }

    function dayLedger(ts) {
      const day = utcDayKey(ts != null ? ts : Date.now());
      return ledger.filter(g => g.day === day);
    }

    function hasCompleted(playerId, challengeId, ts) {
      const day = utcDayKey(ts != null ? ts : Date.now());
      return seenKey.has(playerId + "::" + day + "::" + challengeId);
    }

    function recentEvents(n) { return events.slice(-(n || 50)); }
    function recentGrants(n) { return ledger.slice(-(n || 50)); }

    return {
      utcDayKey,
      registerChallenge, unregisterChallenge, listPool,
      pickForDay, submitCompletion,
      ledgerOf, dayLedger, hasCompleted,
      recentEvents, recentGrants,
    };
  }

  return { utcDayKey, createSystem };
});
