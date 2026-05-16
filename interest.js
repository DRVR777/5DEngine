// interest.js — three-tier interest management for multiplayer.
// Per DECENTRALIZED_GAME_SERVER_NETWORKING_STRATEGY.md:
//   foreground:  ≤ 80 m   → 60 Hz updates (full snapshot)
//   midground:  80–300 m  →  5 Hz updates (compressed)
//   background:   > 300 m →  1 Hz updates (presence only)
//
// Pure functions on positions; no transport coupling.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAInterest = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const TIERS = {
    foreground: { maxRange:  80, hz: 60, name: "foreground" },
    midground:  { maxRange: 300, hz:  5, name: "midground"  },
    background: { maxRange: Infinity, hz: 1, name: "background" },
  };

  function classify(distance) {
    if (distance <= TIERS.foreground.maxRange) return "foreground";
    if (distance <= TIERS.midground.maxRange)  return "midground";
    return "background";
  }

  function tierOf(distance) {
    return TIERS[classify(distance)];
  }

  function dist(a, b) { return Math.hypot(a.u - b.u, a.v - b.v); }

  // For an observer at observerPos, classify a list of peers into tiers.
  // peers: [{id, pos:{u,v}}]. Returns { foreground:[], midground:[], background:[] }.
  function classifyPeers(observerPos, peers) {
    const out = { foreground: [], midground: [], background: [] };
    for (const p of peers) {
      const d = dist(observerPos, p.pos);
      out[classify(d)].push({ id: p.id, distance: d, pos: p.pos });
    }
    return out;
  }

  // For each peer, decide IF it should send an update this tick given its
  // tier's hz target and its lastSentT. Returns peers that should send now.
  function shouldUpdate(peer, nowSec) {
    const tier = tierOf(peer.distance);
    const interval = 1.0 / tier.hz;
    if (peer.lastSentT == null || (nowSec - peer.lastSentT) >= interval) {
      return { send: true, tier: tier.name, intervalUsed: interval };
    }
    return { send: false, tier: tier.name, intervalUsed: interval };
  }

  // Composed: per-tick decision for many peers from one observer.
  // peers: [{id, pos, lastSentT}]. Returns the subset that should send.
  function pickUpdates(observerPos, peers, nowSec) {
    const result = [];
    for (const p of peers) {
      const d = dist(observerPos, p.pos);
      const decision = shouldUpdate({ distance: d, lastSentT: p.lastSentT }, nowSec);
      if (decision.send) {
        result.push({ id: p.id, tier: decision.tier, distance: d });
      }
    }
    return result;
  }

  // Rough message-rate budget: given N peers around me classified into tiers,
  // returns total messages/sec implied by full-rate updates. Useful for
  // bandwidth budgeting.
  function rateBudget(classified) {
    return classified.foreground.length * TIERS.foreground.hz
         + classified.midground.length  * TIERS.midground.hz
         + classified.background.length * TIERS.background.hz;
  }

  // Override the tier table (for testing or custom topologies).
  function setTier(tierName, def) {
    if (!TIERS[tierName]) throw new Error(`unknown tier ${tierName}`);
    Object.assign(TIERS[tierName], def);
  }

  return {
    TIERS, classify, tierOf,
    classifyPeers, shouldUpdate, pickUpdates,
    rateBudget, setTier, dist,
  };
});
