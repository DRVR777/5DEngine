// crime_police.js — bounty/heat-tier crime tracking + police response.
// Players accrue "heat" from crime events (kill, theft, vandalism).
// Heat maps to a tier (0..5). Higher tier = more aggressive police
// response (more cops, faster, more deadly).
//
// Heat decays per second when the player is not committing crimes
// AND not being chased. Going "off-grid" (hiding spots) accelerates
// decay. Bounty is a cumulative crime ledger; clearable by paying
// fine OR jailed.
//
// State machine: clean → wanted → chased → cornered → arrested/escaped.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTACrimePolice = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const TIERS = [
    { tier: 0, name: "clean",    heatMin: 0,   patrols: 0,  speedMul: 0,   deadlyMul: 0 },
    { tier: 1, name: "noticed",  heatMin: 50,  patrols: 1,  speedMul: 0.8, deadlyMul: 0.3 },
    { tier: 2, name: "wanted",   heatMin: 200, patrols: 3,  speedMul: 1.0, deadlyMul: 0.5 },
    { tier: 3, name: "fugitive", heatMin: 500, patrols: 6,  speedMul: 1.3, deadlyMul: 0.8 },
    { tier: 4, name: "manhunt",  heatMin: 1000,patrols: 12, speedMul: 1.6, deadlyMul: 1.2 },
    { tier: 5, name: "swat",     heatMin: 2000,patrols: 20, speedMul: 2.0, deadlyMul: 2.0 },
  ];

  const CRIME_HEAT = {
    petty_theft:   10,
    vandalism:     15,
    assault:       40,
    grand_theft:   60,
    arson:         80,
    homicide:      150,
    cop_killer:    300,
  };

  const STATES = ["clean", "wanted", "chased", "cornered", "arrested", "escaped"];

  function _tierFor(heat) {
    let best = TIERS[0];
    for (const t of TIERS) {
      if (heat >= t.heatMin) best = t;
    }
    return best;
  }

  function createSystem(opts) {
    opts = opts || {};
    const config = Object.assign({
      decayPerSec: 5,           // heat lost per sec when not committing
      hideMultiplier: 4,        // when hidden, decay × this
      bountyMultiplier: 2,      // bounty grows N x faster than heat
      maxHeat: 5000,
      fineMul: 0.5,             // pay 0.5x bounty in coin to clear
    }, opts.config || {});

    const players = new Map();    // playerId → {heat, bounty, state, lastCrimeTs, hidden, chasePos}
    const events = [];

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 500) events.shift();
    }

    function _ensure(playerId) {
      if (!players.has(playerId)) {
        players.set(playerId, {
          id: playerId, heat: 0, bounty: 0,
          state: "clean",
          lastCrimeTs: 0,
          hidden: false,
          chasePos: null,
        });
      }
      return players.get(playerId);
    }

    function getHeat(playerId) {
      const p = players.get(playerId);
      return p ? p.heat : 0;
    }
    function getBounty(playerId) {
      const p = players.get(playerId);
      return p ? p.bounty : 0;
    }
    function getState(playerId) {
      const p = players.get(playerId);
      return p ? p.state : "clean";
    }
    function getTier(playerId) {
      return _tierFor(getHeat(playerId));
    }

    // Record a crime → adds heat + bounty
    function recordCrime(playerId, opts2) {
      opts2 = opts2 || {};
      const p = _ensure(playerId);
      let heat;
      if (typeof opts2.heat === "number") heat = opts2.heat;
      else if (opts2.crime && CRIME_HEAT[opts2.crime] != null) heat = CRIME_HEAT[opts2.crime];
      else return { ok: false, reason: "unknown_crime" };
      if (opts2.witnessed === false) heat *= 0.2;   // mostly forgotten
      const now = opts2.ts != null ? opts2.ts : Date.now();
      p.heat = Math.min(config.maxHeat, p.heat + heat);
      p.bounty += heat * config.bountyMultiplier;
      p.lastCrimeTs = now;
      // Auto-transition state
      const prevState = p.state;
      if (p.heat >= TIERS[1].heatMin && p.state === "clean") {
        p.state = "wanted";
      }
      _log("crime", { playerId, crime: opts2.crime, heat, newHeat: p.heat });
      return {
        ok: true,
        heat: p.heat, bounty: p.bounty,
        tier: _tierFor(p.heat),
        stateChanged: prevState !== p.state,
      };
    }

    // Tick — decay heat, update state machine
    function tick(playerId, dt, opts2) {
      opts2 = opts2 || {};
      const now = opts2.now != null ? opts2.now : Date.now();
      const p = _ensure(playerId);
      // Decay only if not in active crime situation
      if (p.state !== "chased" && p.state !== "cornered") {
        const decayMul = p.hidden ? config.hideMultiplier : 1;
        p.heat = Math.max(0, p.heat - config.decayPerSec * dt * decayMul);
      }
      // State transitions on tier crossings
      const tier = _tierFor(p.heat);
      const prev = p.state;
      if (p.state === "wanted" && tier.tier === 0) {
        p.state = "clean";
        _log("clean", { playerId });
      }
      // Caller-driven state moves (chase, cornered, arrest) → external
      return {
        heat: p.heat, bounty: p.bounty,
        tier, state: p.state,
        stateChanged: prev !== p.state,
      };
    }

    // Caller triggers chase when a cop sees the wanted player
    function startChase(playerId, copPos) {
      const p = players.get(playerId);
      if (!p) return { ok: false };
      if (p.heat < TIERS[1].heatMin) return { ok: false, reason: "not_wanted" };
      if (p.state === "arrested") return { ok: false, reason: "arrested" };
      p.state = "chased";
      p.chasePos = copPos ? { u: copPos.u, v: copPos.v } : null;
      _log("chase_start", { playerId });
      return { ok: true, state: "chased" };
    }

    function setHidden(playerId, hidden) {
      const p = _ensure(playerId);
      p.hidden = !!hidden;
      _log("hidden", { playerId, hidden: p.hidden });
      return { ok: true };
    }

    // Escape: player got far enough from cops; clears chase but heat persists
    function escape(playerId) {
      const p = players.get(playerId);
      if (!p) return { ok: false };
      if (p.state !== "chased" && p.state !== "cornered") return { ok: false, reason: "not_chased" };
      p.state = "escaped";
      p.chasePos = null;
      _log("escape", { playerId });
      return { ok: true };
    }

    // Cornered → arrested if not breaking free
    function corner(playerId) {
      const p = players.get(playerId);
      if (!p) return { ok: false };
      if (p.state !== "chased") return { ok: false, reason: "not_chased" };
      p.state = "cornered";
      _log("cornered", { playerId });
      return { ok: true };
    }

    function arrest(playerId, opts2) {
      opts2 = opts2 || {};
      const p = players.get(playerId);
      if (!p) return { ok: false };
      if (p.state !== "cornered" && !opts2.force) return { ok: false, reason: "not_cornered" };
      const bountyOwed = p.bounty;
      p.state = "arrested";
      p.heat = 0;
      p.bounty = 0;
      p.hidden = false;
      _log("arrest", { playerId, bountyOwed });
      return { ok: true, bountyOwed };
    }

    // Player pays fine → clears bounty if can afford
    function payFine(playerId, opts2) {
      opts2 = opts2 || {};
      const p = players.get(playerId);
      if (!p) return { ok: false };
      if (p.bounty <= 0) return { ok: false, reason: "no_bounty" };
      const cost = p.bounty * config.fineMul;
      if (opts2.economy && opts2.economy.withdraw) {
        const w = opts2.economy.withdraw(playerId, opts2.ccy || "coin", cost);
        if (!w.ok) return { ok: false, reason: "insufficient" };
      }
      const cleared = p.bounty;
      p.bounty = 0;
      p.heat = 0;
      p.state = "clean";
      _log("paid_fine", { playerId, cost, cleared });
      return { ok: true, cost, cleared };
    }

    // Release from jail / serve time
    function release(playerId) {
      const p = players.get(playerId);
      if (!p) return { ok: false };
      if (p.state !== "arrested") return { ok: false, reason: "not_arrested" };
      p.state = "clean";
      _log("released", { playerId });
      return { ok: true };
    }

    // Project a player's response level for spawner
    function policeResponse(playerId) {
      const p = _ensure(playerId);
      const tier = _tierFor(p.heat);
      return {
        tier: tier.tier,
        name: tier.name,
        patrols: tier.patrols,
        speedMul: tier.speedMul,
        deadlyMul: tier.deadlyMul,
        chase: p.state === "chased" || p.state === "cornered",
      };
    }

    function listPlayers() { return Array.from(players.keys()); }
    function reset(playerId) {
      if (!players.has(playerId)) return { ok: false };
      players.delete(playerId);
      _log("reset", { playerId });
      return { ok: true };
    }
    function recentEvents(n) { return events.slice(-(n || 50)); }
    function getConfig() { return Object.assign({}, config); }

    return {
      TIERS, CRIME_HEAT, STATES,
      recordCrime, tick,
      getHeat, getBounty, getState, getTier,
      startChase, setHidden, escape, corner, arrest,
      payFine, release, policeResponse,
      listPlayers, reset, recentEvents, getConfig,
    };
  }

  return { TIERS, CRIME_HEAT, STATES, createSystem };
});
