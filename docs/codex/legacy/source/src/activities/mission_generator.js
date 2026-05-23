// mission_generator.js — template-driven random mission spawner.
// Templates declare the SHAPE of a mission (objective kinds + which
// fields get randomized) and the generator fills in the random
// parameters from caller-supplied pools. Output is a mission spec
// the iter 84 mission_dsl can parse.
//
// Template:
//   {
//     id, name, baseObjectives:[obj-template, ...],
//     difficulty: 1..5,
//     randomizers: {
//       targetPool: [{u,v,y,name}, ...],
//       enemyTags: [...],
//       itemTypes: [...],
//       missionIds: [...],          // for nested mission_run challenges
//       minigameIds: [...],
//     },
//   }
//
// Objective template per kind:
//   { kind: "reach", targetFrom: "pool", radius: [min,max] }
//   { kind: "kill",  count: [min,max], matchTagFrom: "pool" }
//   { kind: "collect", count:[min,max], itemTypeFrom:"pool" }
//   { kind: "survive", duration: [min,max] }
//   { kind: "timer", duration: [min,max] }
//
// Difficulty scales count + duration via a multiplier curve.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAMissionGenerator = factory();
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

  function _pickRange(range, rng) {
    if (Array.isArray(range)) {
      const [min, max] = range;
      return min + Math.floor(rng() * (max - min + 1));
    }
    return range;
  }

  function _pickFromPool(pool, rng) {
    if (!pool || pool.length === 0) return null;
    return pool[Math.floor(rng() * pool.length)];
  }

  // Difficulty multipliers: 1 → 1.0, 5 → 3.0 (subtle cubic-ish curve)
  function _diffMul(difficulty) {
    const d = Math.max(1, Math.min(5, difficulty));
    return 1 + (d - 1) * 0.5;     // 1.0, 1.5, 2.0, 2.5, 3.0
  }

  function createGenerator(opts) {
    opts = opts || {};
    const templates = new Map();
    const events = [];
    let nextMissionId = 1;

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 500) events.shift();
    }

    function registerTemplate(t) {
      if (!t || !t.id) return { ok: false, reason: "missing_id" };
      if (templates.has(t.id)) return { ok: false, reason: "duplicate" };
      if (!Array.isArray(t.baseObjectives) || t.baseObjectives.length === 0) {
        return { ok: false, reason: "missing_objectives" };
      }
      templates.set(t.id, {
        id: t.id,
        name: t.name || t.id,
        baseObjectives: t.baseObjectives.slice(),
        difficulty: t.difficulty || 1,
        randomizers: t.randomizers || {},
        tags: t.tags || [],
      });
      _log("register", { id: t.id });
      return { ok: true };
    }

    function unregisterTemplate(id) {
      return templates.delete(id);
    }

    function listTemplates() { return Array.from(templates.values()); }

    function _materializeObjective(objTmpl, rnd, mul) {
      const out = { id: objTmpl.id || ("obj_" + Math.floor(Math.random() * 1e6)), kind: objTmpl.kind };
      if (objTmpl.optional) out.optional = true;
      switch (objTmpl.kind) {
        case "reach": {
          let target;
          if (objTmpl.target) target = objTmpl.target;
          else if (objTmpl.targetFrom === "pool" && rnd.pools.targetPool) {
            const t = _pickFromPool(rnd.pools.targetPool, rnd.rng);
            target = t ? { u: t.u, v: t.v, y: t.y || 0 } : null;
          }
          if (!target) throw new Error("reach: no target");
          out.target = target;
          out.radius = _pickRange(objTmpl.radius || 2, rnd.rng);
          if (objTmpl.entityId) out.entityId = objTmpl.entityId;
          break;
        }
        case "kill": {
          const c = _pickRange(objTmpl.count, rnd.rng);
          out.count = Math.max(1, Math.round(c * mul));
          if (objTmpl.matchTagFrom === "pool" && rnd.pools.enemyTags) {
            out.matchTag = _pickFromPool(rnd.pools.enemyTags, rnd.rng);
          } else if (objTmpl.matchTag) {
            out.matchTag = objTmpl.matchTag;
          }
          break;
        }
        case "collect": {
          const c = _pickRange(objTmpl.count, rnd.rng);
          out.count = Math.max(1, Math.round(c * mul));
          if (objTmpl.itemTypeFrom === "pool" && rnd.pools.itemTypes) {
            out.itemType = _pickFromPool(rnd.pools.itemTypes, rnd.rng);
          } else if (objTmpl.itemType) {
            out.itemType = objTmpl.itemType;
          }
          if (!out.itemType) throw new Error("collect: no itemType");
          break;
        }
        case "survive": {
          out.duration = Math.round(_pickRange(objTmpl.duration, rnd.rng) * mul);
          break;
        }
        case "timer": {
          // Timer: tighter window = harder. Scale INVERSELY with difficulty
          // so harder = less time. Use 1/mul.
          out.duration = Math.round(_pickRange(objTmpl.duration, rnd.rng) / mul);
          break;
        }
        case "escort": {
          let target;
          if (objTmpl.target) target = objTmpl.target;
          else if (objTmpl.targetFrom === "pool" && rnd.pools.targetPool) {
            const t = _pickFromPool(rnd.pools.targetPool, rnd.rng);
            target = t ? { u: t.u, v: t.v, y: t.y || 0 } : null;
          }
          if (!target) throw new Error("escort: no target");
          out.target = target;
          out.radius = _pickRange(objTmpl.radius || 2, rnd.rng);
          out.entityId = objTmpl.entityId || ("vip_" + Math.floor(rnd.rng() * 1000));
          break;
        }
        default:
          throw new Error("unknown kind: " + objTmpl.kind);
      }
      return out;
    }

    function generate(templateId, opts2) {
      opts2 = opts2 || {};
      const t = templates.get(templateId);
      if (!t) return { ok: false, reason: "no_template" };
      const seed = opts2.seed != null ? opts2.seed : Math.floor(Math.random() * 1e9);
      const rng = mulberry32(seed);
      const difficulty = opts2.difficulty || t.difficulty;
      const mul = _diffMul(difficulty);
      const pools = Object.assign({}, t.randomizers, opts2.poolsOverride || {});
      const rnd = { rng, pools };
      const objectives = [];
      try {
        for (const objTmpl of t.baseObjectives) {
          objectives.push(_materializeObjective(objTmpl, rnd, mul));
        }
      } catch (e) {
        return { ok: false, reason: "materialize_failed", message: e.message };
      }
      const missionId = "gen_" + (nextMissionId++);
      const mission = {
        id: missionId,
        name: t.name + " #" + missionId,
        objectives,
        meta: {
          templateId, difficulty, seed,
          generatedAt: Date.now(),
        },
      };
      _log("generate", { templateId, missionId, difficulty });
      return { ok: true, mission };
    }

    // Generate N missions with difficulty curve (e.g. 1..5 over N)
    function generateCampaign(templateId, n, opts2) {
      opts2 = opts2 || {};
      const out = [];
      const seedBase = opts2.seed != null ? opts2.seed : Math.floor(Math.random() * 1e9);
      for (let i = 0; i < n; i++) {
        const difficulty = opts2.difficultyCurve
          ? opts2.difficultyCurve(i, n)
          : Math.min(5, Math.max(1, Math.ceil((i + 1) / n * 5)));
        const r = generate(templateId, { difficulty, seed: seedBase + i });
        if (r.ok) out.push(r.mission);
      }
      return out;
    }

    function recentEvents(n) { return events.slice(-(n || 50)); }

    return {
      registerTemplate, unregisterTemplate, listTemplates,
      generate, generateCampaign,
      recentEvents,
      _diffMul, _pickRange, _pickFromPool,
    };
  }

  return { createGenerator };
});
