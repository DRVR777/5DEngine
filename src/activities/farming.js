// farming.js — plant/water/harvest cycle with seasons + yield variance.
// Each plot holds one crop. A crop has phases: planted → sprout →
// growing → mature → harvestable → wilted (if neglected). Watering
// advances growth; missed waterings retard or wilt the crop.
// Yield = baseYield × (1 + skill × 0.05) × seasonalMul × randomVariance.
//
// Seasons cycle: spring → summer → autumn → winter; each crop has
// preferred + forbidden seasons.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAFarming = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const SEASONS = ["spring", "summer", "autumn", "winter"];
  const PHASES  = ["empty", "planted", "sprout", "growing", "mature", "harvestable", "wilted"];

  // Default crops
  const DEFAULT_CROPS = {
    wheat:    { id: "wheat",    growMs: 60000, waterEveryMs: 20000, baseYield: 5,
                preferSeason: ["summer"], forbidSeason: ["winter"], yieldItem: "wheat_grain" },
    carrot:   { id: "carrot",   growMs: 45000, waterEveryMs: 15000, baseYield: 3,
                preferSeason: ["spring", "autumn"], forbidSeason: [], yieldItem: "carrot" },
    pumpkin:  { id: "pumpkin",  growMs: 120000, waterEveryMs: 30000, baseYield: 1,
                preferSeason: ["autumn"], forbidSeason: ["winter"], yieldItem: "pumpkin" },
    rice:     { id: "rice",     growMs: 90000, waterEveryMs: 10000, baseYield: 10,
                preferSeason: ["summer"], forbidSeason: ["winter"], yieldItem: "rice_bundle" },
  };

  function createSystem(opts) {
    opts = opts || {};
    const config = Object.assign({
      seasonDurationMs: 7 * 24 * 60 * 60 * 1000,  // 1 week per season
      missedWaterToWilt: 3,
      yieldVariance: 0.3,
      xpPerLevel: 100,
      xpPerHarvest: 10,
      preferSeasonMul: 1.5,
      forbidSeasonMul: 0.2,
    }, opts.config || {});

    const crops = new Map();
    for (const c of Object.values(DEFAULT_CROPS)) crops.set(c.id, c);
    const plots = new Map();       // plotId → {id, ownerId, cropId, plantedTs, lastWateredTs, missedWaterings, phase, harvested}
    const skills = new Map();
    let nextPlotId = 1;
    const events = [];
    let seasonStartTs = 0;

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 500) events.shift();
    }

    function _seasonAt(now) {
      const elapsed = now - seasonStartTs;
      const idx = Math.floor(elapsed / config.seasonDurationMs) % SEASONS.length;
      return SEASONS[(idx % SEASONS.length + SEASONS.length) % SEASONS.length];
    }

    function setSeasonStart(ts) { seasonStartTs = ts; }
    function currentSeason(now) {
      now = now != null ? now : Date.now();
      return _seasonAt(now);
    }

    function getLevel(playerId) {
      return 1 + Math.floor((skills.get(playerId) || 0) / config.xpPerLevel);
    }
    function getXP(playerId) { return skills.get(playerId) || 0; }

    function registerCrop(c) {
      if (!c || !c.id) return { ok: false, reason: "missing_id" };
      if (crops.has(c.id)) return { ok: false, reason: "duplicate" };
      crops.set(c.id, Object.assign({
        growMs: 60000, waterEveryMs: 20000, baseYield: 5,
        preferSeason: [], forbidSeason: [], yieldItem: c.id,
      }, c));
      return { ok: true };
    }

    function createPlot(opts2) {
      opts2 = opts2 || {};
      if (!opts2.ownerId) return { ok: false, reason: "missing_owner" };
      const id = opts2.id || ("plot_" + (nextPlotId++));
      if (plots.has(id)) return { ok: false, reason: "duplicate" };
      plots.set(id, {
        id, ownerId: opts2.ownerId,
        cropId: null, plantedTs: 0,
        lastWateredTs: 0, missedWaterings: 0,
        phase: "empty", harvested: false,
        location: opts2.location || null,
      });
      _log("create_plot", { id, ownerId: opts2.ownerId });
      return { ok: true, plotId: id };
    }

    function plant(plotId, ownerId, cropId, opts2) {
      opts2 = opts2 || {};
      const plot = plots.get(plotId);
      if (!plot) return { ok: false, reason: "no_plot" };
      if (plot.ownerId !== ownerId) return { ok: false, reason: "not_owner" };
      if (plot.phase !== "empty" && plot.phase !== "wilted" && plot.phase !== "harvestable") {
        return { ok: false, reason: "occupied" };
      }
      const crop = crops.get(cropId);
      if (!crop) return { ok: false, reason: "no_crop" };
      const now = opts2.now != null ? opts2.now : Date.now();
      plot.cropId = cropId;
      plot.plantedTs = now;
      plot.lastWateredTs = now;
      plot.missedWaterings = 0;
      plot.phase = "planted";
      plot.harvested = false;
      _log("planted", { plotId, cropId, ownerId });
      return { ok: true };
    }

    function water(plotId, ownerId, opts2) {
      opts2 = opts2 || {};
      const plot = plots.get(plotId);
      if (!plot) return { ok: false, reason: "no_plot" };
      if (plot.ownerId !== ownerId) return { ok: false, reason: "not_owner" };
      if (plot.phase === "empty" || plot.phase === "wilted") {
        return { ok: false, reason: "nothing_to_water" };
      }
      const now = opts2.now != null ? opts2.now : Date.now();
      plot.lastWateredTs = now;
      plot.missedWaterings = Math.max(0, plot.missedWaterings - 1);
      _log("watered", { plotId });
      return { ok: true };
    }

    // Tick a single plot — advance phase based on growth + check water + season
    function tickPlot(plotId, now) {
      now = now != null ? now : Date.now();
      const plot = plots.get(plotId);
      if (!plot || plot.phase === "empty" || plot.phase === "wilted") return null;
      const crop = crops.get(plot.cropId);
      if (!crop) return null;
      const season = _seasonAt(now);

      // Check water
      const sinceWater = now - plot.lastWateredTs;
      if (sinceWater > crop.waterEveryMs) {
        const missed = Math.floor(sinceWater / crop.waterEveryMs);
        if (missed > plot.missedWaterings) {
          plot.missedWaterings = missed;
          _log("missed_water", { plotId, missed });
        }
        if (plot.missedWaterings >= config.missedWaterToWilt) {
          plot.phase = "wilted";
          _log("wilted", { plotId });
          return plot;
        }
      }

      // Forbidden season → instant wilt
      if (crop.forbidSeason.includes(season)) {
        plot.phase = "wilted";
        _log("wilted_by_season", { plotId, season });
        return plot;
      }

      // Compute growth: time-elapsed / growMs (modified by season)
      let growMul = 1;
      if (crop.preferSeason.includes(season)) growMul = config.preferSeasonMul;
      const elapsed = now - plot.plantedTs;
      const progress = Math.min(1, (elapsed * growMul) / crop.growMs);

      if (progress < 0.2) plot.phase = "planted";
      else if (progress < 0.5) plot.phase = "sprout";
      else if (progress < 0.85) plot.phase = "growing";
      else if (progress < 1) plot.phase = "mature";
      else plot.phase = "harvestable";

      return plot;
    }

    function tickAll(now) {
      now = now != null ? now : Date.now();
      const out = [];
      for (const plot of plots.values()) {
        const r = tickPlot(plot.id, now);
        if (r) out.push(r);
      }
      return out;
    }

    function harvest(plotId, ownerId, opts2) {
      opts2 = opts2 || {};
      const plot = plots.get(plotId);
      if (!plot) return { ok: false, reason: "no_plot" };
      if (plot.ownerId !== ownerId) return { ok: false, reason: "not_owner" };
      // Tick first to ensure phase is current
      tickPlot(plotId, opts2.now);
      if (plot.phase !== "harvestable") {
        return { ok: false, reason: "not_ready", phase: plot.phase };
      }
      const crop = crops.get(plot.cropId);
      const skill = getLevel(ownerId);
      const season = _seasonAt(opts2.now != null ? opts2.now : Date.now());
      const seasonMul = crop.preferSeason.includes(season) ? config.preferSeasonMul : 1;
      const skillMul = 1 + skill * 0.05;
      const rng = opts2.rng || Math.random;
      const variance = 1 + (rng() - 0.5) * 2 * config.yieldVariance;
      const yieldQty = Math.max(1, Math.round(crop.baseYield * skillMul * seasonMul * variance));
      plot.phase = "empty";
      plot.cropId = null;
      plot.harvested = true;
      plot.plantedTs = 0;
      plot.lastWateredTs = 0;
      plot.missedWaterings = 0;
      skills.set(ownerId, (skills.get(ownerId) || 0) + config.xpPerHarvest);
      if (opts2.inventory && opts2.inventory.give) {
        opts2.inventory.give(ownerId, crop.yieldItem, yieldQty);
      }
      _log("harvested", { plotId, ownerId, yieldItem: crop.yieldItem, qty: yieldQty });
      return {
        ok: true,
        yieldItem: crop.yieldItem,
        qty: yieldQty,
        xpGained: config.xpPerHarvest,
        newLevel: getLevel(ownerId),
      };
    }

    // Clear wilted (reset to empty)
    function clearPlot(plotId, ownerId) {
      const plot = plots.get(plotId);
      if (!plot) return { ok: false, reason: "no_plot" };
      if (plot.ownerId !== ownerId) return { ok: false, reason: "not_owner" };
      plot.phase = "empty";
      plot.cropId = null;
      plot.plantedTs = 0;
      plot.lastWateredTs = 0;
      plot.missedWaterings = 0;
      _log("cleared", { plotId });
      return { ok: true };
    }

    function destroyPlot(plotId, ownerId) {
      const plot = plots.get(plotId);
      if (!plot) return { ok: false, reason: "no_plot" };
      if (plot.ownerId !== ownerId) return { ok: false, reason: "not_owner" };
      plots.delete(plotId);
      _log("destroyed", { plotId });
      return { ok: true };
    }

    function getPlot(id) { return plots.get(id) || null; }
    function listPlots(ownerId) {
      return Array.from(plots.values()).filter(p => !ownerId || p.ownerId === ownerId);
    }
    function listCrops() { return Array.from(crops.values()); }
    function recentEvents(n) { return events.slice(-(n || 50)); }
    function getConfig() { return Object.assign({}, config); }

    return {
      SEASONS, PHASES,
      registerCrop, createPlot,
      plant, water, tickPlot, tickAll, harvest,
      clearPlot, destroyPlot,
      currentSeason, setSeasonStart,
      getLevel, getXP,
      getPlot, listPlots, listCrops,
      recentEvents, getConfig,
    };
  }

  return { SEASONS, PHASES, DEFAULT_CROPS, createSystem };
});
