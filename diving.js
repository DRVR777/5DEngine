// diving.js — diver mechanics: breath gauge, depth pressure, currents,
// shipwreck loot. Players dive (descend underwater); breath drains
// with depth; currents push them. Wrecks contain loot stacks; player
// collects loot tokens, surfaces to bank them.
//
// Diver state: { id, depth, breath, maxBreath, currentBag, surface }
// Wreck: { id, position{u,v,depth}, lootStacks[], explored }
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTADiving = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function _clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }
  function _dist(a, b) { return Math.hypot(a.u - b.u, a.v - b.v); }

  function createSystem(opts) {
    opts = opts || {};
    const config = Object.assign({
      defaultMaxBreath: 60,           // sec
      breathConsumePerSec: 1,         // base
      depthMultiplier: 0.03,          // +3%/m
      ascendRate: 3,                  // m/sec at surface command
      drownDamagePerSec: 10,
      lootReachRadius: 2,
    }, opts.config || {});

    const divers = new Map();
    const wrecks = new Map();
    let nextDiverId = 1;
    let nextWreckId = 1;
    const events = [];

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 500) events.shift();
    }

    function startDive(opts2) {
      opts2 = opts2 || {};
      if (!opts2.playerId) return { ok: false, reason: "missing_player" };
      // Prevent multiple active dives per player (any existing dive blocks)
      for (const d of divers.values()) {
        if (d.playerId === opts2.playerId) {
          return { ok: false, reason: "already_diving" };
        }
      }
      const id = opts2.id || ("dive_" + (nextDiverId++));
      const maxBreath = opts2.maxBreath || config.defaultMaxBreath;
      const diver = {
        id, playerId: opts2.playerId,
        position: opts2.position || { u: 0, v: 0 },
        depth: 0,
        breath: maxBreath,
        maxBreath,
        bag: [],   // [{itemId, qty}]
        surface: true,
        drowning: false,
        startedAt: Date.now(),
      };
      divers.set(id, diver);
      _log("dive_start", { id, playerId: opts2.playerId });
      return { ok: true, diveId: id };
    }

    function descend(diveId, deltaDepth, opts2) {
      opts2 = opts2 || {};
      const d = divers.get(diveId);
      if (!d) return { ok: false, reason: "no_dive" };
      if (deltaDepth <= 0) return { ok: false, reason: "must_descend" };
      d.depth = Math.max(0, d.depth + deltaDepth);
      d.surface = (d.depth === 0);
      _log("descend", { diveId, newDepth: d.depth });
      return { ok: true, depth: d.depth };
    }

    function ascend(diveId, deltaDepth, opts2) {
      opts2 = opts2 || {};
      const d = divers.get(diveId);
      if (!d) return { ok: false, reason: "no_dive" };
      d.depth = Math.max(0, d.depth - Math.abs(deltaDepth));
      if (d.depth === 0) {
        d.surface = true;
        // Refill breath instantly on surface
        d.breath = d.maxBreath;
        d.drowning = false;
        _log("surfaced", { diveId });
      }
      return { ok: true, depth: d.depth, surfaced: d.surface };
    }

    function move(diveId, deltaPos) {
      const d = divers.get(diveId);
      if (!d) return { ok: false };
      d.position.u += deltaPos.u || 0;
      d.position.v += deltaPos.v || 0;
      return { ok: true, position: { u: d.position.u, v: d.position.v } };
    }

    // tick(diveId, dt, {current, applyDamage}) drains breath + applies current
    function tick(diveId, dt, opts2) {
      opts2 = opts2 || {};
      const d = divers.get(diveId);
      if (!d) return null;
      // Currents push diver
      if (opts2.current && !d.surface) {
        d.position.u += (opts2.current.u || 0) * dt;
        d.position.v += (opts2.current.v || 0) * dt;
      }
      // Breath
      if (!d.surface && d.depth > 0) {
        const rate = config.breathConsumePerSec * (1 + d.depth * config.depthMultiplier);
        d.breath = Math.max(0, d.breath - rate * dt);
        if (d.breath === 0) {
          d.drowning = true;
          if (opts2.applyDamage) {
            try { opts2.applyDamage(d.playerId, config.drownDamagePerSec * dt, "drown"); }
            catch (e) {}
          }
        }
      }
      return d;
    }

    function endDive(diveId) {
      const d = divers.get(diveId);
      if (!d) return { ok: false };
      const surfacedLoot = d.surface ? d.bag.slice() : [];   // only count if at surface
      const drowned = d.drowning;
      divers.delete(diveId);
      _log("dive_end", { diveId, surfacedLoot: surfacedLoot.length, drowned });
      return { ok: true, surfacedLoot, drowned };
    }

    // Wrecks
    function registerWreck(opts2) {
      opts2 = opts2 || {};
      if (!opts2.position) return { ok: false, reason: "no_position" };
      const id = opts2.id || ("wreck_" + (nextWreckId++));
      if (wrecks.has(id)) return { ok: false, reason: "duplicate" };
      wrecks.set(id, {
        id, position: { u: opts2.position.u, v: opts2.position.v, depth: opts2.position.depth || 0 },
        name: opts2.name || id,
        lootStacks: (opts2.loot || []).map(l => Object.assign({}, l, { collected: false })),
        explored: false,
      });
      _log("wreck_added", { id });
      return { ok: true, wreckId: id };
    }

    function removeWreck(id) { return wrecks.delete(id); }
    function listWrecks() { return Array.from(wrecks.values()); }
    function getWreck(id) { return wrecks.get(id) || null; }

    // Player collects loot if within reach + at correct depth
    function collect(diveId, wreckId) {
      const d = divers.get(diveId);
      const w = wrecks.get(wreckId);
      if (!d) return { ok: false, reason: "no_dive" };
      if (!w) return { ok: false, reason: "no_wreck" };
      const surfDist = _dist(d.position, w.position);
      if (surfDist > config.lootReachRadius) return { ok: false, reason: "too_far" };
      if (Math.abs(d.depth - w.position.depth) > config.lootReachRadius) {
        return { ok: false, reason: "wrong_depth" };
      }
      const available = w.lootStacks.filter(l => !l.collected);
      if (available.length === 0) {
        w.explored = true;
        return { ok: false, reason: "empty" };
      }
      for (const l of available) {
        l.collected = true;
        d.bag.push({ itemId: l.itemId, qty: l.qty });
      }
      w.explored = true;
      _log("collected", { diveId, wreckId, items: available.length });
      return { ok: true, collected: available };
    }

    function getDive(id) { return divers.get(id) || null; }
    function listDives() { return Array.from(divers.values()); }

    function recentEvents(n) { return events.slice(-(n || 50)); }
    function getConfig() { return Object.assign({}, config); }

    return {
      startDive, descend, ascend, move, tick, endDive,
      registerWreck, removeWreck, listWrecks, getWreck,
      collect,
      getDive, listDives,
      recentEvents, getConfig,
    };
  }

  return { createSystem };
});
