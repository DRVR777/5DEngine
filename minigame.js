// minigame.js — generic minigame harness.
// A minigame is a 1-shot session with: start, score events, optional
// retry budget, optional time limit, and a finish (win or lose).
// Sessions are independent — multiple can run in parallel (eg. two
// players each playing a different minigame). The session ID is the
// caller's key.
//
// Hooks integrate with leaderboards (iter 86) and daily_challenges
// (iter 87): caller supplies them via opts and we submit/grant on win.
//
// Modes:
//   "single"  — one run, ends on win/lose/timeout
//   "arcade"  — N retries, best score reported on final game-over
//   "endless" — no time/score cap; ends only on explicit endRun
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAMinigame = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const MODES = ["single", "arcade", "endless"];

  function createHarness(opts) {
    opts = opts || {};
    const config = Object.assign({
      defaultMode: "single",
      defaultTimeLimitMs: 60000,
      defaultRetryBudget: 3,
    }, opts.config || {});

    const sessions = new Map();        // sessionId → {state, mode, playerId, ...}
    let nextSession = 1;
    const events = [];

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 1000) events.shift();
    }

    // start({playerId, gameId, mode, timeLimitMs, retryBudget, meta, ts})
    function start(s) {
      s = s || {};
      if (!s.playerId || !s.gameId) return { ok: false, reason: "missing_ids" };
      const mode = s.mode || config.defaultMode;
      if (!MODES.includes(mode)) return { ok: false, reason: "bad_mode" };
      const id = "mg_" + (nextSession++);
      const ts = s.ts != null ? s.ts : Date.now();
      const sess = {
        id, playerId: s.playerId, gameId: s.gameId,
        mode,
        timeLimitMs: s.timeLimitMs != null ? s.timeLimitMs : (mode === "endless" ? Infinity : config.defaultTimeLimitMs),
        retryBudget: s.retryBudget != null ? s.retryBudget : (mode === "arcade" ? config.defaultRetryBudget : 0),
        retriesUsed: 0,
        currentScore: 0,
        bestScore: 0,
        startedAt: ts, elapsedMs: 0,
        status: "running",             // running | won | lost | timeout | aborted
        history: [],                   // [{event, score, ts}]
        meta: Object.assign({}, s.meta || {}),
      };
      sessions.set(id, sess);
      _log("start", { id, playerId: s.playerId, gameId: s.gameId, mode });
      return { ok: true, id, session: sess };
    }

    function get(id) { return sessions.get(id) || null; }

    function listActive() {
      return Array.from(sessions.values()).filter(s => s.status === "running");
    }
    function listForPlayer(playerId) {
      return Array.from(sessions.values()).filter(s => s.playerId === playerId);
    }

    // Score: add (or set) for the current run
    function addScore(id, delta, opts2) {
      opts2 = opts2 || {};
      const s = sessions.get(id);
      if (!s) return { ok: false, reason: "missing" };
      if (s.status !== "running") return { ok: false, reason: "not_running" };
      if (typeof delta !== "number") return { ok: false, reason: "bad_delta" };
      s.currentScore += delta;
      s.history.push({ event: "score", delta, total: s.currentScore, ts: opts2.ts || Date.now() });
      _log("score", { id, delta, total: s.currentScore });
      return { ok: true, currentScore: s.currentScore };
    }

    function setScore(id, score) {
      const s = sessions.get(id);
      if (!s) return { ok: false, reason: "missing" };
      if (s.status !== "running") return { ok: false, reason: "not_running" };
      s.currentScore = score;
      s.history.push({ event: "set", total: score, ts: Date.now() });
      return { ok: true };
    }

    // Tick — advances elapsedMs; if past timeLimit, ends the run.
    function tick(id, dt) {
      const s = sessions.get(id);
      if (!s || s.status !== "running") return null;
      s.elapsedMs += dt * 1000;
      if (s.timeLimitMs !== Infinity && s.elapsedMs >= s.timeLimitMs) {
        return _endRun(s, "timeout");
      }
      return { id, elapsedMs: s.elapsedMs, status: s.status };
    }

    function _endRun(s, outcome) {
      if (s.currentScore > s.bestScore) s.bestScore = s.currentScore;
      if (s.mode === "arcade" && (outcome === "lost" || outcome === "timeout")
          && s.retriesUsed < s.retryBudget) {
        s.retriesUsed++;
        s.currentScore = 0; s.elapsedMs = 0; s.status = "running";
        _log("retry", { id: s.id, retriesUsed: s.retriesUsed });
        s.history.push({ event: "retry", retriesUsed: s.retriesUsed, ts: Date.now() });
        return { id: s.id, retried: true, status: "running" };
      }
      // Final game over
      s.status = outcome;
      _log("end", { id: s.id, outcome, bestScore: s.bestScore });
      s.history.push({ event: "end", outcome, bestScore: s.bestScore, ts: Date.now() });
      return { id: s.id, status: outcome, bestScore: s.bestScore, currentScore: s.currentScore };
    }

    // Caller-driven win/lose/abort
    function win(id, opts2)  { opts2 = opts2 || {}; const s = sessions.get(id); if (!s) return { ok: false }; const r = _endRun(s, "won"); if (r.retried) return r; if (opts2.leaderboard) _submitLeaderboard(s, opts2.leaderboard); if (opts2.dailyChallenges) _submitChallenges(s, opts2.dailyChallenges); return r; }
    function lose(id) { const s = sessions.get(id); if (!s) return { ok: false }; return _endRun(s, "lost"); }
    function abort(id) {
      const s = sessions.get(id);
      if (!s) return { ok: false };
      s.status = "aborted";
      _log("abort", { id });
      return { ok: true };
    }

    function _submitLeaderboard(s, lb) {
      try {
        lb.submit({
          boardId: s.gameId, playerId: s.playerId, score: s.bestScore,
          ts: Date.now(), meta: { mode: s.mode, retriesUsed: s.retriesUsed },
        });
      } catch (e) {}
    }
    function _submitChallenges(s, dc) {
      try {
        const today = dc.pickForDay(Date.now());
        for (const c of today) {
          if (c.kind === "win_minigame" && c.minigameId === s.gameId) {
            dc.submitCompletion({
              playerId: s.playerId, challengeId: c.id,
              proof: { minigameId: s.gameId, won: true },
            });
          }
        }
      } catch (e) {}
    }

    function recentEvents(n) { return events.slice(-(n || 50)); }

    return {
      MODES,
      start, get, listActive, listForPlayer,
      addScore, setScore, tick, win, lose, abort,
      recentEvents,
    };
  }

  return { MODES, createHarness };
});
