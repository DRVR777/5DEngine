// portal_gen.js — procedural connections between worlds.
// Given N worlds, generates a connection graph based on a "weight"
// function over pairs (similarity, distance, theme match, etc).
// Outputs portal-edge specs that the world_graph can install.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAPortalGen = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Strategies: "ring", "star", "spanning_tree", "fully_connected",
  // "weighted" (uses scoreFn), "k_nearest".
  const STRATEGIES = ["ring", "star", "spanning_tree", "fully_connected", "weighted", "k_nearest"];

  // Generate connection specs given a list of worlds.
  //   worlds: [{id, ...meta}]
  //   opts: {strategy, scoreFn (worldA, worldB) → 0..1, k, hub, seed}
  function generate(worlds, opts) {
    opts = opts || {};
    const strategy = opts.strategy || "spanning_tree";
    if (!STRATEGIES.includes(strategy)) {
      throw new Error(`unknown strategy: ${strategy}`);
    }
    if (worlds.length < 2) return [];

    let edges = [];
    switch (strategy) {
      case "ring":           edges = _ring(worlds);                       break;
      case "star":           edges = _star(worlds, opts.hub);             break;
      case "spanning_tree":  edges = _spanningTree(worlds, opts.scoreFn); break;
      case "fully_connected":edges = _fullyConnected(worlds);             break;
      case "weighted":       edges = _weighted(worlds, opts);             break;
      case "k_nearest":      edges = _kNearest(worlds, opts.k || 2, opts.scoreFn); break;
    }

    return edges.map(e => ({
      from: e.from, to: e.to,
      kind: opts.kind || "auto_portal",
      weight: e.weight != null ? e.weight : 1,
      params: opts.params || {},
    }));
  }

  // Ring: A→B→C→D→A
  function _ring(worlds) {
    const out = [];
    for (let i = 0; i < worlds.length; i++) {
      const a = worlds[i].id, b = worlds[(i + 1) % worlds.length].id;
      out.push({ from: a, to: b });
    }
    return out;
  }

  // Star: pick a hub, every other connects to it.
  function _star(worlds, hubId) {
    const hub = hubId || worlds[0].id;
    const out = [];
    for (const w of worlds) {
      if (w.id === hub) continue;
      out.push({ from: hub, to: w.id });
    }
    return out;
  }

  // Minimum spanning tree via prim-style greedy on the scoreFn-weight graph.
  // Higher score = "stronger" connection = preferred (so we use 1-score as
  // "distance"). No scoreFn → use 1 for everything (any tree wins).
  function _spanningTree(worlds, scoreFn) {
    if (worlds.length === 1) return [];
    scoreFn = scoreFn || ((a, b) => 1);
    const inTree = new Set([worlds[0].id]);
    const out = [];
    while (inTree.size < worlds.length) {
      let best = null, bestScore = -Infinity;
      for (const u of inTree) {
        const uW = worlds.find(w => w.id === u);
        for (const w of worlds) {
          if (inTree.has(w.id)) continue;
          const s = scoreFn(uW, w);
          if (s > bestScore) { bestScore = s; best = { from: u, to: w.id, weight: s }; }
        }
      }
      if (!best) break;
      out.push(best);
      inTree.add(best.to);
    }
    return out;
  }

  // Every pair
  function _fullyConnected(worlds) {
    const out = [];
    for (let i = 0; i < worlds.length; i++) {
      for (let j = i + 1; j < worlds.length; j++) {
        out.push({ from: worlds[i].id, to: worlds[j].id });
      }
    }
    return out;
  }

  // Weighted: include any pair with score >= threshold
  function _weighted(worlds, opts) {
    if (!opts.scoreFn) throw new Error("weighted requires scoreFn");
    const threshold = opts.threshold != null ? opts.threshold : 0.5;
    const out = [];
    for (let i = 0; i < worlds.length; i++) {
      for (let j = i + 1; j < worlds.length; j++) {
        const s = opts.scoreFn(worlds[i], worlds[j]);
        if (s >= threshold) out.push({ from: worlds[i].id, to: worlds[j].id, weight: s });
      }
    }
    return out;
  }

  // k-nearest: for each world, connect to its k highest-scoring neighbors
  function _kNearest(worlds, k, scoreFn) {
    scoreFn = scoreFn || ((a, b) => 1);
    const out = [];
    const seen = new Set();
    for (const w of worlds) {
      const scored = worlds
        .filter(other => other.id !== w.id)
        .map(other => ({ other, score: scoreFn(w, other) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, k);
      for (const { other, score } of scored) {
        const key = [w.id, other.id].sort().join("::");
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ from: w.id, to: other.id, weight: score });
      }
    }
    return out;
  }

  // Helper: install generated edges into a world_graph.
  function applyToGraph(graph, edges, opts2) {
    opts2 = opts2 || {};
    const installed = [];
    for (const e of edges) {
      const eid = opts2.bidirectional
        ? graph.addBidirectional(e.from, e.to, { weight: e.weight, kind: e.kind, params: e.params })
        : [graph.addPortal(e.from, e.to, { weight: e.weight, kind: e.kind, params: e.params })];
      if (eid && eid[0]) installed.push(...eid.filter(Boolean));
    }
    return installed;
  }

  return { STRATEGIES, generate, applyToGraph };
});
