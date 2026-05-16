// garage.js — player-owned vehicle storage + paint + tuning + parts.
// Each garage slot holds one vehicle: {id, model, paint, tunings, mods}.
// Players can paint, swap tuning kits, and install parts from a
// parts library. Each tuning + part has stat-deltas the renderer/
// physics layer reads from getStats(vehicleId).
//
// Parts library is registry-driven; caller adds parts via registerPart.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAGarage = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const PART_SLOTS = ["engine", "wheels", "brakes", "exhaust", "spoiler", "armor", "nitro"];

  // Tunings = preset stat packages
  const DEFAULT_TUNINGS = {
    stock:     { name: "Stock",     accel: 0,  topSpeed: 0,  grip: 0 },
    sport:     { name: "Sport",     accel: 10, topSpeed: 5,  grip: 5 },
    drag:      { name: "Drag",      accel: 25, topSpeed: 15, grip: -10 },
    offroad:   { name: "Off-road",  accel: -5, topSpeed: -10, grip: 20 },
    drift:     { name: "Drift",     accel: 5,  topSpeed: 0,  grip: -15 },
  };

  function createSystem(opts) {
    opts = opts || {};
    const config = Object.assign({
      maxSlotsPerGarage: 10,
    }, opts.config || {});

    const garages = new Map();       // playerId → {vehicles:Map<vehicleId, slot>}
    const partsLib = new Map();      // partId → {slot, stats:{...}, cost, ccy}
    const tunings = new Map();
    for (const [id, t] of Object.entries(DEFAULT_TUNINGS)) tunings.set(id, t);
    let nextVehicleId = 1;
    const events = [];

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 500) events.shift();
    }

    function _ensureGarage(playerId) {
      if (!garages.has(playerId)) {
        garages.set(playerId, { id: playerId, vehicles: new Map() });
      }
      return garages.get(playerId);
    }

    function registerPart(part) {
      if (!part || !part.id) return { ok: false, reason: "missing_id" };
      if (!PART_SLOTS.includes(part.slot)) return { ok: false, reason: "bad_slot" };
      if (partsLib.has(part.id)) return { ok: false, reason: "duplicate" };
      partsLib.set(part.id, Object.assign({
        cost: 0, ccy: "coin", stats: {},
      }, part));
      _log("register_part", { id: part.id, slot: part.slot });
      return { ok: true };
    }

    function listParts(slot) {
      const out = [];
      for (const p of partsLib.values()) {
        if (!slot || p.slot === slot) out.push(p);
      }
      return out;
    }

    function registerTuning(t) {
      if (!t || !t.id) return { ok: false, reason: "missing_id" };
      if (tunings.has(t.id)) return { ok: false, reason: "duplicate" };
      tunings.set(t.id, t);
      return { ok: true };
    }

    function listTunings() { return Array.from(tunings.values()); }

    function storeVehicle(playerId, opts2) {
      opts2 = opts2 || {};
      const g = _ensureGarage(playerId);
      if (g.vehicles.size >= config.maxSlotsPerGarage) {
        return { ok: false, reason: "full" };
      }
      const id = opts2.id || ("veh_" + (nextVehicleId++));
      if (g.vehicles.has(id)) return { ok: false, reason: "duplicate" };
      const slot = {
        id, model: opts2.model || "generic",
        paint: opts2.paint || { primary: "#ffffff", secondary: null, finish: "gloss" },
        tuning: opts2.tuning || "stock",
        parts: {},          // slot → partId
        baseStats: opts2.baseStats || { accel: 50, topSpeed: 100, grip: 50, armor: 100 },
        storedAt: Date.now(),
      };
      g.vehicles.set(id, slot);
      _log("store", { playerId, vehicleId: id, model: slot.model });
      return { ok: true, vehicleId: id, slot };
    }

    function removeVehicle(playerId, vehicleId) {
      const g = garages.get(playerId);
      if (!g) return { ok: false, reason: "no_garage" };
      if (!g.vehicles.has(vehicleId)) return { ok: false, reason: "no_vehicle" };
      g.vehicles.delete(vehicleId);
      _log("remove", { playerId, vehicleId });
      return { ok: true };
    }

    function getVehicle(playerId, vehicleId) {
      const g = garages.get(playerId);
      if (!g) return null;
      return g.vehicles.get(vehicleId) || null;
    }

    function listVehicles(playerId) {
      const g = garages.get(playerId);
      if (!g) return [];
      return Array.from(g.vehicles.values());
    }

    function paint(playerId, vehicleId, paintSpec) {
      const v = getVehicle(playerId, vehicleId);
      if (!v) return { ok: false, reason: "no_vehicle" };
      if (paintSpec.primary) v.paint.primary = paintSpec.primary;
      if (paintSpec.secondary !== undefined) v.paint.secondary = paintSpec.secondary;
      if (paintSpec.finish) v.paint.finish = paintSpec.finish;
      _log("paint", { playerId, vehicleId });
      return { ok: true, paint: v.paint };
    }

    function setTuning(playerId, vehicleId, tuningId) {
      const v = getVehicle(playerId, vehicleId);
      if (!v) return { ok: false, reason: "no_vehicle" };
      if (!tunings.has(tuningId)) return { ok: false, reason: "no_tuning" };
      v.tuning = tuningId;
      _log("tune", { playerId, vehicleId, tuning: tuningId });
      return { ok: true };
    }

    function installPart(playerId, vehicleId, partId, opts2) {
      opts2 = opts2 || {};
      const v = getVehicle(playerId, vehicleId);
      if (!v) return { ok: false, reason: "no_vehicle" };
      const part = partsLib.get(partId);
      if (!part) return { ok: false, reason: "no_part" };
      if (opts2.economy && opts2.economy.withdraw && part.cost > 0) {
        const w = opts2.economy.withdraw(playerId, part.ccy, part.cost);
        if (!w.ok) return { ok: false, reason: "insufficient_funds" };
      }
      v.parts[part.slot] = partId;
      _log("install_part", { playerId, vehicleId, slot: part.slot, partId });
      return { ok: true, slot: part.slot };
    }

    function uninstallPart(playerId, vehicleId, slot) {
      const v = getVehicle(playerId, vehicleId);
      if (!v) return { ok: false, reason: "no_vehicle" };
      if (!v.parts[slot]) return { ok: false, reason: "no_part_installed" };
      const removed = v.parts[slot];
      delete v.parts[slot];
      _log("uninstall_part", { playerId, vehicleId, slot });
      return { ok: true, removed };
    }

    // Compute total stats: base + tuning delta + sum of part deltas
    function getStats(playerId, vehicleId) {
      const v = getVehicle(playerId, vehicleId);
      if (!v) return null;
      const stats = Object.assign({}, v.baseStats);
      const tuning = tunings.get(v.tuning);
      if (tuning) {
        for (const [k, dx] of Object.entries(tuning)) {
          if (k === "name") continue;
          if (typeof dx === "number") stats[k] = (stats[k] || 0) + dx;
        }
      }
      for (const partId of Object.values(v.parts)) {
        const p = partsLib.get(partId);
        if (!p) continue;
        for (const [k, dx] of Object.entries(p.stats || {})) {
          stats[k] = (stats[k] || 0) + dx;
        }
      }
      return stats;
    }

    function recentEvents(n) { return events.slice(-(n || 50)); }
    function getConfig() { return Object.assign({}, config); }

    return {
      PART_SLOTS,
      registerPart, listParts,
      registerTuning, listTunings,
      storeVehicle, removeVehicle, getVehicle, listVehicles,
      paint, setTuning, installPart, uninstallPart, getStats,
      recentEvents, getConfig,
    };
  }

  return { PART_SLOTS, DEFAULT_TUNINGS, createSystem };
});
