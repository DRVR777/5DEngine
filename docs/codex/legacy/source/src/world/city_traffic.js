// city_traffic.js — vehicles on CityPlan-generated road networks.
// Distinct from traffic.js (iter 54): that one drives a user-defined
// road graph. This one *derives* the graph from a CityPlan (iter 74),
// spawns vehicles on its road tiles, and ticks them between random
// destinations. Stops briefly at intersections to simulate light cycles.
//
// Modular: doesn't know about city_gen internals — works off the
// {roads, intersections, lots, cellSize, bounds} surface.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTACityTraffic = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function _dist(a, b) { return Math.hypot(a.u - b.u, a.v - b.v); }
  function _key(p) { return Math.round(p.u * 10) + ":" + Math.round(p.v * 10); }

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

  // Build an adjacency graph from a CityPlan.
  function buildRoadGraph(plan) {
    if (!plan || !plan.roads) throw new Error("plan with roads required");
    const nodeByKey = new Map();
    const nodeById = new Map();
    let nextId = 0;
    function _addNode(p, kind) {
      const k = _key(p);
      if (nodeByKey.has(k)) return nodeByKey.get(k).id;
      const id = "n" + (nextId++);
      const n = { id, u: p.u, v: p.v, kind };
      nodeByKey.set(k, n);
      nodeById.set(id, n);
      return id;
    }

    const adj = new Map();
    function _link(a, b) {
      if (!adj.has(a)) adj.set(a, new Set());
      if (!adj.has(b)) adj.set(b, new Set());
      adj.get(a).add(b);
      adj.get(b).add(a);
    }

    for (const r of plan.roads) {
      const f = _addNode(r.from, "road");
      const t = _addNode(r.to,   "road");
      _link(f, t);
    }
    const slack = (plan.cellSize || 10) * 0.6;
    for (const ix of (plan.intersections || [])) {
      const ixId = _addNode(ix.pos, "intersection");
      for (const n of nodeById.values()) {
        if (n.id === ixId) continue;
        if (_dist(ix.pos, n) <= slack) _link(ixId, n.id);
      }
    }

    return {
      nodes: Array.from(nodeById.values()),
      adj,
      getNode(id) { return nodeById.get(id) || null; },
      neighbors(id) { return Array.from(adj.get(id) || []); },
    };
  }

  // BFS shortest-path (unit cost).
  function pathBetween(graph, fromId, toId) {
    if (fromId === toId) return [fromId];
    const prev = new Map();
    const q = [fromId];
    prev.set(fromId, null);
    while (q.length) {
      const cur = q.shift();
      if (cur === toId) break;
      for (const nb of graph.neighbors(cur)) {
        if (prev.has(nb)) continue;
        prev.set(nb, cur);
        q.push(nb);
      }
    }
    if (!prev.has(toId)) return null;
    const out = [];
    let cur = toId;
    while (cur != null) { out.unshift(cur); cur = prev.get(cur); }
    return out;
  }

  function createSimulation(plan, opts) {
    opts = opts || {};
    const graph = buildRoadGraph(plan);
    const config = Object.assign({
      maxVehicles: 20,
      defaultSpeed: 8.0,
      intersectionPauseMs: 1500,
      arriveRadius: 1.0,
      seed: 1,
    }, opts.config || {});
    const rng = mulberry32(config.seed);

    const vehicles = new Map();
    let nextVehId = 1;
    let nowMs = 0;
    const events = [];

    function _log(kind, detail) {
      events.push({ kind, detail, ts: nowMs });
      if (events.length > 500) events.shift();
    }

    function _pickRandomNode(kind) {
      const candidates = graph.nodes.filter(n => kind == null || n.kind === kind);
      if (candidates.length === 0) return null;
      return candidates[Math.floor(rng() * candidates.length)];
    }

    function spawn(opts2) {
      opts2 = opts2 || {};
      if (vehicles.size >= config.maxVehicles) return { ok: false, reason: "full" };
      const fromNode = opts2.fromId
        ? graph.getNode(opts2.fromId)
        : _pickRandomNode("road");
      if (!fromNode) return { ok: false, reason: "no_roads" };
      const toNode = opts2.toId
        ? graph.getNode(opts2.toId)
        : _pickRandomNode(null);
      if (!toNode) return { ok: false, reason: "no_dest" };
      const path = pathBetween(graph, fromNode.id, toNode.id);
      if (!path) return { ok: false, reason: "no_path" };
      const id = "veh_" + nextVehId++;
      const v = {
        id, pos: { u: fromNode.u, v: fromNode.v },
        path, pathIdx: 0, speed: opts2.speed || config.defaultSpeed,
        kind: opts2.kind || "car",
        stopUntil: 0, done: false,
      };
      vehicles.set(id, v);
      _log("spawn", { id, from: fromNode.id, to: toNode.id, hops: path.length });
      return { ok: true, id, vehicle: v };
    }

    function despawn(id) {
      if (!vehicles.has(id)) return { ok: false };
      vehicles.delete(id);
      _log("despawn", { id });
      return { ok: true };
    }

    function _step(v, dt) {
      if (v.done) return;
      if (v.stopUntil > nowMs) return;
      const nextNodeId = v.path[v.pathIdx + 1];
      if (!nextNodeId) { v.done = true; _log("arrived", { id: v.id }); return; }
      const target = graph.getNode(nextNodeId);
      if (!target) { v.done = true; return; }
      const dx = target.u - v.pos.u, dy = target.v - v.pos.v;
      const d = Math.hypot(dx, dy);
      const step = v.speed * dt;
      if (d <= step + config.arriveRadius) {
        v.pos.u = target.u; v.pos.v = target.v;
        v.pathIdx++;
        if (target.kind === "intersection") {
          v.stopUntil = nowMs + config.intersectionPauseMs;
          _log("intersection", { id: v.id, nodeId: nextNodeId });
        }
      } else {
        v.pos.u += (dx / d) * step;
        v.pos.v += (dy / d) * step;
      }
    }

    function tick(dt) {
      nowMs += dt * 1000;
      for (const v of vehicles.values()) _step(v, dt);
    }

    function listVehicles() { return Array.from(vehicles.values()); }
    function getVehicle(id) { return vehicles.get(id) || null; }
    function activeCount() {
      let n = 0;
      for (const v of vehicles.values()) if (!v.done) n++;
      return n;
    }

    function clearArrived() {
      let removed = 0;
      for (const [id, v] of vehicles) {
        if (v.done) { vehicles.delete(id); removed++; }
      }
      return removed;
    }

    function recentEvents(n) { return events.slice(-(n || 50)); }

    return {
      graph, config,
      spawn, despawn, tick,
      listVehicles, getVehicle, activeCount, clearArrived,
      recentEvents,
      _now: () => nowMs,
    };
  }

  return {
    buildRoadGraph,
    pathBetween,
    createSimulation,
  };
});
