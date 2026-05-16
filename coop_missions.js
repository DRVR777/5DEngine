// coop_missions.js — multiplayer mission state sync via vector clocks.
// Each player runs their own MissionRunner (iter 84). This module
// reconciles their per-objective progress so the team mission completes
// when the *combined* progress hits goals. Late joiners catch up by
// merging the current shared state.
//
// Vector clock per session: { playerId → counter }. Each event from
// player P bumps clock[P]. Merge takes max of each entry.
//
// Per-objective merge:
//   kill / collect: progress = sum of all players' contributions
//   reach / escort / survive / timer: any one completion → completed;
//                                     any fail → failed
//   any_of / all_of / custom: state forwarded; runner-side handles.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTACoopMissions = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function _cloneClock(c) { return Object.assign({}, c || {}); }

  function _mergeClock(a, b) {
    const out = _cloneClock(a);
    for (const [k, v] of Object.entries(b)) {
      out[k] = Math.max(out[k] || 0, v);
    }
    return out;
  }

  function _clockDominates(a, b) {
    // a dominates b iff a[k] >= b[k] for all k in b
    for (const [k, v] of Object.entries(b)) {
      if ((a[k] || 0) < v) return false;
    }
    return true;
  }

  // Per-objective merge strategy
  function _mergeObjective(missionDef, objIdx, perPlayerStates) {
    const obj = missionDef.objectives[objIdx];
    const merged = { id: obj.id, kind: obj.kind, completed: false, failed: false };

    // Cumulative kinds — sum across players
    if (obj.kind === "kill" || obj.kind === "collect") {
      let total = 0;
      for (const ps of perPlayerStates) {
        const o = ps[objIdx];
        if (!o) continue;
        total += o.progress || 0;
      }
      merged.progress = total;
      merged.target = obj.count;
      merged.completed = total >= obj.count;
      return merged;
    }

    // Any-one kinds — any player completes
    if (obj.kind === "reach" || obj.kind === "escort" || obj.kind === "survive" ||
        obj.kind === "custom") {
      let anyComp = false, anyFail = false;
      for (const ps of perPlayerStates) {
        const o = ps[objIdx];
        if (!o) continue;
        if (o.completed) anyComp = true;
        if (o.failed) anyFail = true;
      }
      merged.completed = anyComp;
      merged.failed = anyFail;
      return merged;
    }

    // Timer: any one running == still running; all-failed == failed
    if (obj.kind === "timer") {
      const failed = perPlayerStates.every(ps => (ps[objIdx] || {}).failed);
      merged.failed = failed;
      return merged;
    }

    // any_of / all_of fall through to per-player evaluation
    if (obj.kind === "any_of" || obj.kind === "all_of") {
      const sub = obj.sub.map((s, i) => {
        const subStates = perPlayerStates.map(ps => {
          const parent = ps[objIdx];
          return parent && parent.sub ? parent.sub[i] : {};
        });
        return _mergeObjective({ objectives: obj.sub }, i, subStates);
      });
      merged.sub = sub;
      if (obj.kind === "any_of") merged.completed = sub.some(s => s.completed);
      if (obj.kind === "all_of") merged.completed = sub.every(s => s.completed);
      merged.failed = obj.kind === "any_of" ? sub.every(s => s.failed) : sub.some(s => s.failed);
      return merged;
    }

    return merged;
  }

  function createSession(opts) {
    opts = opts || {};
    if (!opts.missionId) throw new Error("missionId required");
    if (!opts.mission || !Array.isArray(opts.mission.objectives)) {
      throw new Error("mission with objectives[] required");
    }
    const session = {
      missionId: opts.missionId,
      mission: opts.mission,
      clock: {},                            // vector clock
      players: new Map(),                   // playerId → {joinedAt, objStates[]}
      mergedStates: opts.mission.objectives.map(() => ({})),
      status: "active",                     // active | completed | failed | aborted
      events: [],
    };

    function _log(kind, detail) {
      session.events.push({ kind, detail, ts: Date.now() });
      if (session.events.length > 500) session.events.shift();
    }

    function joinPlayer(playerId, opts2) {
      opts2 = opts2 || {};
      if (session.players.has(playerId)) return { ok: false, reason: "already_joined" };
      const ps = {
        joinedAt: Date.now(),
        objStates: session.mission.objectives.map(o => ({
          id: o.id, kind: o.kind, completed: false, failed: false,
          progress: 0,
        })),
      };
      session.players.set(playerId, ps);
      session.clock[playerId] = (session.clock[playerId] || 0);
      _log("join", { playerId });
      return {
        ok: true,
        snapshot: getSnapshot(),
      };
    }

    function leavePlayer(playerId) {
      if (!session.players.has(playerId)) return { ok: false };
      session.players.delete(playerId);
      _log("leave", { playerId });
      return { ok: true };
    }

    // Apply an update from a player: per-objective progress patch.
    // update: { playerId, patches: [{idx, completed?, failed?, progress?}], clockBump }
    function applyUpdate(update) {
      if (!update || !update.playerId) return { ok: false, reason: "bad_update" };
      const ps = session.players.get(update.playerId);
      if (!ps) return { ok: false, reason: "not_joined" };
      session.clock[update.playerId] = (session.clock[update.playerId] || 0) + 1;
      for (const p of (update.patches || [])) {
        const cur = ps.objStates[p.idx];
        if (!cur) continue;
        if (typeof p.progress === "number") cur.progress = Math.max(cur.progress || 0, p.progress);
        if (p.completed === true) cur.completed = true;
        if (p.failed === true) cur.failed = true;
      }
      _recomputeMerged();
      _log("update", { playerId: update.playerId, patches: (update.patches || []).length });
      return { ok: true, clock: _cloneClock(session.clock), merged: session.mergedStates.slice() };
    }

    function _recomputeMerged() {
      const allStates = Array.from(session.players.values()).map(p => p.objStates);
      for (let i = 0; i < session.mission.objectives.length; i++) {
        session.mergedStates[i] = _mergeObjective(session.mission, i, allStates);
      }
      // Mission complete if all required objectives merged.completed
      const required = session.mission.objectives.map((o, i) => o.optional ? null : session.mergedStates[i]).filter(x => x);
      if (required.length > 0 && required.every(s => s.completed)) {
        if (session.status === "active") {
          session.status = "completed";
          _log("complete", { missionId: session.missionId });
        }
      } else if (required.some(s => s.failed)) {
        if (session.status === "active") {
          session.status = "failed";
          _log("fail", { missionId: session.missionId });
        }
      }
    }

    // Late-joiner catchup: returns merged state + current clock + mission spec
    function getSnapshot() {
      return {
        missionId: session.missionId,
        mission: session.mission,
        clock: _cloneClock(session.clock),
        merged: session.mergedStates.slice(),
        status: session.status,
        players: Array.from(session.players.keys()),
      };
    }

    // Merge a remote snapshot into ours (idempotent if their clock dominates ours)
    function mergeSnapshot(snap) {
      if (!snap || !snap.clock) return { ok: false, reason: "bad_snap" };
      // If remote dominates us, take their merged state
      if (_clockDominates(snap.clock, session.clock)) {
        session.clock = _cloneClock(snap.clock);
        if (snap.merged) session.mergedStates = snap.merged.slice();
        if (snap.status && session.status === "active") session.status = snap.status;
        _log("merge_remote", { players: snap.players });
        return { ok: true, took: "remote" };
      }
      // If we dominate, no-op
      if (_clockDominates(session.clock, snap.clock)) {
        return { ok: true, took: "local" };
      }
      // Concurrent: take entry-wise max for clock, then merge per-player states best-effort
      session.clock = _mergeClock(session.clock, snap.clock);
      if (snap.merged) {
        for (let i = 0; i < session.mergedStates.length; i++) {
          const a = session.mergedStates[i] || {};
          const b = snap.merged[i] || {};
          session.mergedStates[i] = {
            id: a.id || b.id,
            kind: a.kind || b.kind,
            completed: !!a.completed || !!b.completed,
            failed: !!a.failed || !!b.failed,
            progress: Math.max(a.progress || 0, b.progress || 0),
            target: a.target || b.target,
          };
        }
      }
      _log("merge_concurrent", {});
      return { ok: true, took: "concurrent" };
    }

    function getStatus() { return session.status; }
    function getClock() { return _cloneClock(session.clock); }
    function getMerged() { return session.mergedStates.slice(); }
    function listPlayers() { return Array.from(session.players.keys()); }
    function recentEvents(n) { return session.events.slice(-(n || 50)); }
    function abort() {
      if (session.status !== "active") return { ok: false };
      session.status = "aborted";
      _log("abort", {});
      return { ok: true };
    }

    return {
      joinPlayer, leavePlayer,
      applyUpdate, getSnapshot, mergeSnapshot,
      getStatus, getClock, getMerged, listPlayers,
      abort, recentEvents,
    };
  }

  return {
    createSession,
    _mergeClock, _clockDominates,
  };
});
