// mission_dsl.js — declarative mission scripts.
// A mission is a JSON spec:
//   { id, name, objectives:[...], onStart?, onComplete?, onFail?,
//     cinematics?: {start: cutsceneId, end: cutsceneId} }
//
// Each objective:
//   { id, kind, ...params, optional? }
//
// Kinds (built-in):
//   "reach"     — player position within radius of target
//   "kill"      — defeat N enemies (matchTag optional)
//   "collect"   — pick up N items of itemType
//   "survive"   — stay alive for ms milliseconds
//   "escort"    — escort entity to target position
//   "timer"     — finish all remaining objectives before deadline
//   "any_of"    — sub-objectives, any one completes
//   "all_of"    — sub-objectives, all must complete
//   "custom"    — caller-supplied predicate(state) → boolean
//
// The MissionRunner ticks objectives, fires events to the cinematics
// Director (iter 75) when start/complete/fail, and tracks per-objective
// progress for HUD.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAMissionDSL = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const KINDS = ["reach", "kill", "collect", "survive", "escort", "timer", "any_of", "all_of", "custom"];

  function _dist(a, b) {
    const du = (a.u || 0) - (b.u || 0);
    const dv = (a.v || 0) - (b.v || 0);
    return Math.hypot(du, dv);
  }

  // Validate a mission spec at parse time.
  function parseMission(spec) {
    if (!spec || !spec.id) throw new Error("mission needs id");
    if (!Array.isArray(spec.objectives)) throw new Error("mission needs objectives[]");
    for (const obj of spec.objectives) _validateObjective(obj);
    return {
      id: spec.id,
      name: spec.name || spec.id,
      description: spec.description || "",
      objectives: spec.objectives,
      onStart: spec.onStart || null,
      onComplete: spec.onComplete || null,
      onFail: spec.onFail || null,
      cinematics: spec.cinematics || {},
      meta: spec.meta || {},
    };
  }

  function _validateObjective(obj) {
    if (!obj || !obj.id) throw new Error("objective needs id");
    if (!KINDS.includes(obj.kind)) {
      throw new Error("unknown objective kind: " + obj.kind);
    }
    if (obj.kind === "reach"  && (!obj.target || obj.radius == null)) {
      throw new Error("reach needs target + radius");
    }
    if (obj.kind === "kill"    && obj.count == null) throw new Error("kill needs count");
    if (obj.kind === "collect" && (obj.count == null || !obj.itemType)) {
      throw new Error("collect needs count + itemType");
    }
    if (obj.kind === "survive" && obj.duration == null) {
      throw new Error("survive needs duration");
    }
    if (obj.kind === "escort" && (!obj.entityId || !obj.target || obj.radius == null)) {
      throw new Error("escort needs entityId + target + radius");
    }
    if (obj.kind === "timer" && obj.duration == null) {
      throw new Error("timer needs duration");
    }
    if ((obj.kind === "any_of" || obj.kind === "all_of") && !Array.isArray(obj.sub)) {
      throw new Error(obj.kind + " needs sub[]");
    }
    if (obj.kind === "custom" && typeof obj.predicate !== "function") {
      throw new Error("custom needs predicate(state) function");
    }
  }

  function createRunner(opts) {
    opts = opts || {};
    const director = opts.director || null;   // cinematics director from iter 75
    const onLog = opts.onLog || null;
    const missions = new Map();        // missionId → {mission, state, status, startedAt, ...}
    const events = [];

    function _log(kind, detail) {
      const ev = { kind, detail, ts: Date.now() };
      events.push(ev);
      if (events.length > 500) events.shift();
      if (onLog) try { onLog(ev); } catch (e) {}
    }

    function _initObjectiveState(obj, elapsedMs) {
      const base = { id: obj.id, kind: obj.kind, completed: false, failed: false };
      switch (obj.kind) {
        case "kill":
        case "collect": return Object.assign(base, { progress: 0, target: obj.count });
        case "survive":
        case "timer":   return Object.assign(base, { startedAt: elapsedMs, deadline: elapsedMs + obj.duration });
        case "any_of":
        case "all_of":  return Object.assign(base, { sub: obj.sub.map(s => _initObjectiveState(s, elapsedMs)) });
        default:        return base;
      }
    }

    function start(missionOrSpec) {
      const m = (typeof missionOrSpec.objectives !== "undefined" && missionOrSpec.id != null)
        ? parseMission(missionOrSpec)
        : missionOrSpec;
      if (missions.has(m.id)) return { ok: false, reason: "already_started" };
      const runState = {
        mission: m,
        status: "active",
        startedAt: Date.now(),
        elapsedMs: 0,
        objStates: m.objectives.map(o => _initObjectiveState(o, 0)),
      };
      missions.set(m.id, runState);
      _log("start", { missionId: m.id });
      if (m.onStart) try { m.onStart(runState); } catch (e) {}
      if (director && m.cinematics.start) {
        try { director.play({ id: m.cinematics.start, tracks: [], duration: 0 }); } catch (e) {}
      }
      return { ok: true, missionId: m.id };
    }

    function _evalObjective(obj, state, world, elapsedMs) {
      if (state.completed || state.failed) return;
      switch (obj.kind) {
        case "reach": {
          const pos = world.getPosition && world.getPosition(obj.entityId || "player");
          if (pos && _dist(pos, obj.target) <= obj.radius) state.completed = true;
          break;
        }
        case "kill": {
          state.progress = world.getKillCount ? world.getKillCount(obj.matchTag) : state.progress;
          if (state.progress >= obj.count) state.completed = true;
          break;
        }
        case "collect": {
          state.progress = world.getCollectCount ? world.getCollectCount(obj.itemType) : state.progress;
          if (state.progress >= obj.count) state.completed = true;
          break;
        }
        case "survive": {
          if (world.isDead && world.isDead("player")) state.failed = true;
          else if (elapsedMs >= state.deadline) state.completed = true;
          break;
        }
        case "escort": {
          const pos = world.getPosition && world.getPosition(obj.entityId);
          const dead = world.isDead && world.isDead(obj.entityId);
          if (dead) state.failed = true;
          else if (pos && _dist(pos, obj.target) <= obj.radius) state.completed = true;
          break;
        }
        case "timer": {
          if (elapsedMs >= state.deadline) state.failed = true;
          break;
        }
        case "any_of": {
          for (let i = 0; i < obj.sub.length; i++) _evalObjective(obj.sub[i], state.sub[i], world, elapsedMs);
          if (state.sub.some(s => s.completed)) state.completed = true;
          if (state.sub.every(s => s.failed)) state.failed = true;
          break;
        }
        case "all_of": {
          for (let i = 0; i < obj.sub.length; i++) _evalObjective(obj.sub[i], state.sub[i], world, elapsedMs);
          if (state.sub.every(s => s.completed)) state.completed = true;
          if (state.sub.some(s => s.failed)) state.failed = true;
          break;
        }
        case "custom": {
          const res = obj.predicate(world, state);
          if (res === true) state.completed = true;
          else if (res === false && obj.failOnFalse) state.failed = true;
          break;
        }
      }
    }

    function tick(dt, world) {
      world = world || {};
      const completed = [];
      const failed = [];
      for (const [id, run] of missions) {
        if (run.status !== "active") continue;
        run.elapsedMs += dt * 1000;
        for (let i = 0; i < run.mission.objectives.length; i++) {
          _evalObjective(run.mission.objectives[i], run.objStates[i], world, run.elapsedMs);
        }
        // Mission complete if all required objectives complete
        const required = run.mission.objectives.map((o, i) => o.optional ? null : run.objStates[i]).filter(x => x);
        if (required.every(s => s.completed)) {
          run.status = "completed";
          _log("complete", { missionId: id });
          if (run.mission.onComplete) try { run.mission.onComplete(run); } catch (e) {}
          if (director && run.mission.cinematics.end) {
            try { director.play({ id: run.mission.cinematics.end, tracks: [], duration: 0 }); } catch (e) {}
          }
          completed.push(id);
        } else if (required.some(s => s.failed)) {
          run.status = "failed";
          _log("fail", { missionId: id });
          if (run.mission.onFail) try { run.mission.onFail(run); } catch (e) {}
          failed.push(id);
        }
      }
      return { completed, failed };
    }

    function abort(missionId) {
      const run = missions.get(missionId);
      if (!run) return { ok: false, reason: "missing" };
      if (run.status !== "active") return { ok: false, reason: "not_active" };
      run.status = "aborted";
      _log("abort", { missionId });
      return { ok: true };
    }

    function getMission(id) { return missions.get(id) || null; }
    function listActive() {
      return Array.from(missions.values()).filter(r => r.status === "active");
    }
    function listAll() { return Array.from(missions.values()); }
    function recentEvents(n) { return events.slice(-(n || 50)); }

    // Compute a HUD-friendly progress summary for a mission
    function progressOf(missionId) {
      const run = missions.get(missionId);
      if (!run) return null;
      const items = [];
      for (let i = 0; i < run.mission.objectives.length; i++) {
        const obj = run.mission.objectives[i];
        const st = run.objStates[i];
        items.push(_progressItem(obj, st, run.elapsedMs));
      }
      return { id: missionId, status: run.status, elapsedMs: run.elapsedMs, objectives: items };
    }

    function _progressItem(obj, st, elapsedMs) {
      const base = { id: obj.id, kind: obj.kind, completed: st.completed, failed: st.failed, optional: !!obj.optional };
      if (obj.kind === "kill" || obj.kind === "collect") {
        base.progress = st.progress; base.target = obj.count;
      }
      if (obj.kind === "survive" || obj.kind === "timer") {
        base.remainingMs = Math.max(0, st.deadline - elapsedMs);
      }
      if (obj.kind === "any_of" || obj.kind === "all_of") {
        base.sub = obj.sub.map((s, i) => _progressItem(s, st.sub[i], elapsedMs));
      }
      return base;
    }

    return {
      KINDS,
      start, abort, tick,
      getMission, listActive, listAll,
      progressOf, recentEvents,
    };
  }

  return {
    KINDS,
    parseMission,
    createRunner,
  };
});
