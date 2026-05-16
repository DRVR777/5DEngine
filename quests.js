// quests.js — quest definitions + objective tracking + reward delivery.
// Quests are data: { id, name, objectives:[...], rewards:[...], next?, repeatable }.
// Each objective has a `kind` (e.g. "kill", "collect", "reach", "talk")
// and a `target` describing what counts toward completion.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAQuests = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Built-in objective evaluators. Each takes (objective, eventPayload) and
  // returns true if the event satisfies the objective (or a partial number
  // for cumulative goals).
  const OBJECTIVE_KINDS = {
    kill: (obj, evt) => {
      if (evt.type !== "kill") return 0;
      if (obj.target.entityType && evt.entityType !== obj.target.entityType) return 0;
      return 1;
    },
    collect: (obj, evt) => {
      if (evt.type !== "collect") return 0;
      if (obj.target.itemType && evt.itemType !== obj.target.itemType) return 0;
      return evt.qty || 1;
    },
    reach: (obj, evt) => {
      if (evt.type !== "position") return 0;
      const t = obj.target;
      if (Math.hypot(evt.u - t.u, evt.v - t.v) <= (t.radius || 2)) return 1;
      return 0;
    },
    talk: (obj, evt) => {
      if (evt.type !== "talk") return 0;
      if (obj.target.npcId && evt.npcId !== obj.target.npcId) return 0;
      return 1;
    },
    timer: (obj, evt) => {
      if (evt.type !== "tick") return 0;
      return evt.dt || 1;
    },
  };

  function registerObjectiveKind(kind, evalFn) {
    if (OBJECTIVE_KINDS[kind]) throw new Error(`objective kind ${kind} exists`);
    OBJECTIVE_KINDS[kind] = evalFn;
  }

  function createQuestSystem() {
    const definitions = new Map();    // questId → quest def
    const active = new Map();         // questId → { state, progress[], startedAt }
    const completed = new Map();      // questId → completedAt
    const listeners = { start: [], progress: [], complete: [], fail: [] };

    function on(event, fn) { (listeners[event] = listeners[event] || []).push(fn); }
    function emit(event, payload) {
      for (const fn of (listeners[event] || [])) try { fn(payload); } catch (e) {}
    }

    function defineQuest(def) {
      if (!def || !def.id) throw new Error("quest must have id");
      if (definitions.has(def.id)) throw new Error(`quest ${def.id} exists`);
      if (!Array.isArray(def.objectives) || def.objectives.length === 0) {
        throw new Error("quest needs at least one objective");
      }
      definitions.set(def.id, def);
    }

    function startQuest(questId) {
      const def = definitions.get(questId);
      if (!def) return { ok: false, reason: "no_such_quest" };
      if (active.has(questId)) return { ok: false, reason: "already_active" };
      if (completed.has(questId) && !def.repeatable) return { ok: false, reason: "already_completed" };
      const progress = def.objectives.map(obj => ({
        kind: obj.kind,
        target: obj.target,
        required: obj.qty || 1,
        current: 0,
        done: false,
      }));
      const inst = { state: "active", progress, startedAt: Date.now() };
      active.set(questId, inst);
      if (completed.has(questId)) completed.delete(questId);   // for repeats
      emit("start", { questId, def });
      return { ok: true, questId };
    }

    function abandonQuest(questId) {
      if (!active.has(questId)) return false;
      active.delete(questId);
      emit("fail", { questId, reason: "abandoned" });
      return true;
    }

    // Process an event against all active quests.
    // event = { type, ... }  e.g. {type:"kill", entityType:"goblin"}
    function ingestEvent(event) {
      const updates = [];
      for (const [questId, inst] of active) {
        if (inst.state !== "active") continue;
        let any = false;
        for (let i = 0; i < inst.progress.length; i++) {
          const p = inst.progress[i];
          if (p.done) continue;
          const evalFn = OBJECTIVE_KINDS[p.kind];
          if (!evalFn) continue;
          const inc = evalFn(p, event);
          if (inc > 0) {
            p.current = Math.min(p.required, p.current + inc);
            if (p.current >= p.required) p.done = true;
            any = true;
          }
        }
        if (any) {
          updates.push({ questId, progress: inst.progress.map(p => ({ ...p })) });
          emit("progress", { questId, progress: inst.progress });
          if (inst.progress.every(p => p.done)) {
            inst.state = "complete";
            completed.set(questId, Date.now());
            const def = definitions.get(questId);
            const rewards = def.rewards || [];
            active.delete(questId);
            emit("complete", { questId, rewards });
            // Auto-start the next quest in a chain
            if (def.next) startQuest(def.next);
          }
        }
      }
      return updates;
    }

    function activeQuests() {
      return Array.from(active.entries()).map(([id, inst]) => ({
        id, state: inst.state, progress: inst.progress, startedAt: inst.startedAt,
      }));
    }
    function completedQuests() { return Array.from(completed.keys()); }
    function getProgress(questId) {
      const inst = active.get(questId);
      if (!inst) return null;
      return inst.progress.map(p => ({ ...p }));
    }
    function isComplete(questId) { return completed.has(questId); }

    return {
      OBJECTIVE_KINDS, registerObjectiveKind,
      defineQuest, startQuest, abandonQuest, ingestEvent,
      activeQuests, completedQuests, getProgress, isComplete,
      on,
    };
  }

  return { createQuestSystem, OBJECTIVE_KINDS };
});
