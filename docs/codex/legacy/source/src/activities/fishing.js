// fishing.js — cast/reel/catch fishing minigame.
// Player casts with chosen bait, a fish bites after a random delay,
// player has a tension-window to reel in. Each fish species has a
// rarity, prefer-bait, and bite-window/reel-strength. Skill XP
// accumulates with each successful catch.
//
// Flow:
//   cast(playerId, {baitId, location}) → cast token
//   tick(token, dt, {rng}) → state events (waiting/biting/escaped/caught)
//   reel(token) → success if in window; calculates struggle
//
// Skill level affects:
//   - bite-window length (more time)
//   - escape chance per missed reel
//   - rare-fish bias
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAFishing = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const STATES = ["cast", "waiting", "biting", "caught", "escaped", "cancelled"];

  // Default species pool — caller can extend via registerSpecies
  const DEFAULT_SPECIES = [
    { id: "minnow",   rarity: 0.50, biteWindowS: 4, reelStrength: 1, preferBait: ["worm", "any"], xp: 5 },
    { id: "bass",     rarity: 0.25, biteWindowS: 3, reelStrength: 2, preferBait: ["worm", "lure"], xp: 12 },
    { id: "pike",     rarity: 0.15, biteWindowS: 2.5, reelStrength: 3, preferBait: ["lure", "fish"], xp: 25 },
    { id: "carp",     rarity: 0.07, biteWindowS: 3, reelStrength: 2, preferBait: ["bread"], xp: 30 },
    { id: "trophy",   rarity: 0.03, biteWindowS: 2, reelStrength: 5, preferBait: ["rare_lure"], xp: 100 },
  ];

  const DEFAULT_BAITS = ["worm", "lure", "fish", "bread", "rare_lure"];

  function _pickSpecies(species, baitId, skillLevel, rng) {
    // Weight by rarity, boost preferred baits
    let total = 0;
    const weights = species.map(s => {
      let w = s.rarity;
      if (s.preferBait.includes(baitId) || s.preferBait.includes("any")) w *= 3;
      w *= (1 + skillLevel * 0.05);
      total += w;
      return w;
    });
    const target = rng() * total;
    let acc = 0;
    for (let i = 0; i < weights.length; i++) {
      acc += weights[i];
      if (target < acc) return species[i];
    }
    return species[species.length - 1];
  }

  function createSystem(opts) {
    opts = opts || {};
    const config = Object.assign({
      bitePreroll: [1.5, 8.0],     // sec range before fish bites
      bitePrerollAtMaxSkill: [0.8, 4.0],
      baseBiteWindowMul: 1.0,
      baseEscapeChance: 0.3,        // chance of escape per failed reel
      xpPerLevel: 100,
    }, opts.config || {});

    const species = new Map();
    for (const s of DEFAULT_SPECIES) species.set(s.id, s);
    const baits = new Set(DEFAULT_BAITS);
    const skills = new Map();      // playerId → xp
    const tokens = new Map();      // tokenId → {playerId, baitId, location, state, startTs, fish, biteAt, deadline}
    let nextToken = 1;
    const events = [];

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 500) events.shift();
    }

    function _level(xp) { return 1 + Math.floor(xp / config.xpPerLevel); }
    function getLevel(playerId) {
      return _level(skills.get(playerId) || 0);
    }
    function getXP(playerId) { return skills.get(playerId) || 0; }

    function registerSpecies(s) {
      if (!s || !s.id) return { ok: false, reason: "missing_id" };
      if (species.has(s.id)) return { ok: false, reason: "duplicate" };
      species.set(s.id, Object.assign({ rarity: 0.1, biteWindowS: 3, reelStrength: 1, preferBait: ["any"], xp: 5 }, s));
      return { ok: true };
    }

    function registerBait(name) {
      if (!name) return { ok: false };
      baits.add(name);
      return { ok: true };
    }

    function cast(opts2) {
      opts2 = opts2 || {};
      if (!opts2.playerId) return { ok: false, reason: "missing_player" };
      if (!opts2.baitId || !baits.has(opts2.baitId)) {
        return { ok: false, reason: "unknown_bait" };
      }
      const now = opts2.now != null ? opts2.now : Date.now();
      const id = "tk_" + (nextToken++);
      const skill = getLevel(opts2.playerId);
      const rng = opts2.rng || Math.random;
      const minS = config.bitePreroll[0];
      const maxS = config.bitePreroll[1];
      const preroll = minS + rng() * (maxS - minS);
      const token = {
        id, playerId: opts2.playerId,
        baitId: opts2.baitId,
        location: opts2.location || "shore",
        state: "waiting",
        startTs: now,
        biteAt: now + preroll * 1000,
        deadline: null,
        fish: null,
        reelAttempts: 0,
      };
      tokens.set(id, token);
      _log("cast", { id, playerId: opts2.playerId, baitId: opts2.baitId });
      return { ok: true, tokenId: id };
    }

    function cancelCast(tokenId, playerId) {
      const t = tokens.get(tokenId);
      if (!t) return { ok: false, reason: "missing" };
      if (t.playerId !== playerId) return { ok: false, reason: "not_owner" };
      if (t.state === "caught" || t.state === "escaped" || t.state === "cancelled") {
        return { ok: false, reason: "not_active" };
      }
      t.state = "cancelled";
      _log("cancelled", { id: tokenId });
      return { ok: true };
    }

    function tick(tokenId, dt, opts2) {
      opts2 = opts2 || {};
      const t = tokens.get(tokenId);
      if (!t) return null;
      if (t.state === "caught" || t.state === "escaped" || t.state === "cancelled") return t;
      const now = opts2.now != null ? opts2.now : (t.startTs + (dt * 1000));
      const rng = opts2.rng || Math.random;
      if (t.state === "waiting" && now >= t.biteAt) {
        // Bite! Pick a fish + set deadline
        const skill = getLevel(t.playerId);
        const fish = _pickSpecies(Array.from(species.values()), t.baitId, skill, rng);
        const windowMul = config.baseBiteWindowMul * (1 + skill * 0.05);
        t.fish = fish;
        t.state = "biting";
        t.deadline = now + fish.biteWindowS * windowMul * 1000;
        _log("bite", { tokenId, fish: fish.id });
      } else if (t.state === "biting" && now >= t.deadline) {
        t.state = "escaped";
        _log("escaped", { tokenId, fish: t.fish ? t.fish.id : null });
      }
      return t;
    }

    function reel(tokenId, opts2) {
      opts2 = opts2 || {};
      const t = tokens.get(tokenId);
      if (!t) return { ok: false, reason: "missing" };
      if (t.state !== "biting") {
        // Reel during waiting → no fish was on (player spam-clicked)
        if (t.state === "waiting") return { ok: false, reason: "no_bite" };
        return { ok: false, reason: "wrong_state", state: t.state };
      }
      const rng = opts2.rng || Math.random;
      t.reelAttempts++;
      // Escape roll on each attempt — strong fish more likely to escape
      const skill = getLevel(t.playerId);
      const escChance = config.baseEscapeChance * (t.fish.reelStrength / Math.max(1, skill));
      if (rng() < escChance) {
        t.state = "escaped";
        _log("escaped_on_reel", { tokenId, fish: t.fish.id });
        return { ok: false, reason: "escaped" };
      }
      // Success
      t.state = "caught";
      const xp = t.fish.xp;
      skills.set(t.playerId, (skills.get(t.playerId) || 0) + xp);
      _log("caught", { tokenId, fish: t.fish.id, xp });
      return { ok: true, fish: t.fish, xpGained: xp, newLevel: getLevel(t.playerId) };
    }

    function getToken(id) { return tokens.get(id) || null; }
    function activeTokens(playerId) {
      const out = [];
      for (const t of tokens.values()) {
        if (t.playerId === playerId && (t.state === "waiting" || t.state === "biting")) out.push(t);
      }
      return out;
    }
    function listSpecies() { return Array.from(species.values()); }
    function listBaits() { return Array.from(baits); }
    function recentEvents(n) { return events.slice(-(n || 50)); }
    function getConfig() { return Object.assign({}, config); }

    return {
      STATES,
      registerSpecies, registerBait,
      cast, cancelCast, tick, reel,
      getToken, activeTokens,
      getLevel, getXP,
      listSpecies, listBaits,
      recentEvents, getConfig,
    };
  }

  return { STATES, DEFAULT_SPECIES, DEFAULT_BAITS, createSystem };
});
