// npc_routing.js — A* pathfinding for NPCs over a road/walk graph.
// Distinct from the city traffic BFS (iter 82, unit cost): this is
// weighted A* with euclidean heuristic so NPCs pick efficient
// routes when edges have varying lengths. Also exposes:
//   - createNPCRouter(graph, opts) — agent that re-paths on demand
//   - replan(npc, newTarget) — switch destinations mid-route
//   - blockNode/unblockNode — closed roads / blocked alleys
//
// Edge cost is euclidean distance between node positions by default;
// override via opts.edgeCostFn(a, b, edgeKind).
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTANPCRouting = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function _dist(a, b) { return Math.hypot(a.u - b.u, a.v - b.v); }

  // Min-heap (binary heap) for the open set
  function _Heap() {
    const a = [];
    function up(i) {
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (a[p][0] <= a[i][0]) break;
        [a[i], a[p]] = [a[p], a[i]];
        i = p;
      }
    }
    function down(i) {
      const n = a.length;
      while (true) {
        const l = 2*i+1, r = 2*i+2;
        let m = i;
        if (l < n && a[l][0] < a[m][0]) m = l;
        if (r < n && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return {
      size: () => a.length,
      push(prio, val) { a.push([prio, val]); up(a.length - 1); },
      pop() {
        if (a.length === 0) return null;
        const top = a[0];
        const last = a.pop();
        if (a.length > 0) { a[0] = last; down(0); }
        return top;
      },
    };
  }

  // A* over a graph with {nodes, getNode(id), neighbors(id)}.
  // edgeCostFn(nodeA, nodeB) → number. Default: euclidean.
  // heuristicFn(nodeA, target) → number. Default: euclidean.
  function astar(graph, fromId, toId, opts) {
    opts = opts || {};
    const isBlocked = opts.isBlocked || (() => false);
    const edgeCost = opts.edgeCost || ((a, b) => _dist(a, b));
    const heuristic = opts.heuristic || ((a, t) => _dist(a, t));
    const target = graph.getNode(toId);
    if (!target) return null;
    if (fromId === toId) return [fromId];

    const gScore = new Map();
    const prev = new Map();
    const open = _Heap();
    gScore.set(fromId, 0);
    const startNode = graph.getNode(fromId);
    if (!startNode) return null;
    open.push(heuristic(startNode, target), fromId);

    let visited = 0;
    while (open.size()) {
      const [, cur] = open.pop();
      if (cur === toId) {
        const out = [];
        let n = cur;
        while (n != null) { out.unshift(n); n = prev.get(n); }
        return { path: out, visited };
      }
      const curNode = graph.getNode(cur);
      if (!curNode) continue;
      visited++;
      for (const nb of graph.neighbors(cur)) {
        if (isBlocked(nb)) continue;
        const nbNode = graph.getNode(nb);
        if (!nbNode) continue;
        const tentative = gScore.get(cur) + edgeCost(curNode, nbNode);
        if (!gScore.has(nb) || tentative < gScore.get(nb)) {
          gScore.set(nb, tentative);
          prev.set(nb, cur);
          const f = tentative + heuristic(nbNode, target);
          open.push(f, nb);
        }
      }
    }
    return null;
  }

  // NPC router: maintains a blocked-set, a registry of NPCs each with
  // current/target node + path + index, and a tick that advances them.
  function createRouter(graph, opts) {
    opts = opts || {};
    if (!graph) throw new Error("graph required");
    const blocked = new Set();
    const npcs = new Map();
    let nextId = 1;
    const events = [];
    const config = Object.assign({
      defaultSpeed: 1.5,        // m/s
      arriveRadius: 0.5,
    }, opts.config || {});

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 500) events.shift();
    }

    function blockNode(id) { blocked.add(id); _log("block", { id }); }
    function unblockNode(id) { blocked.delete(id); _log("unblock", { id }); }
    function isBlocked(id) { return blocked.has(id); }

    function spawn(opts2) {
      opts2 = opts2 || {};
      const fromNode = graph.getNode(opts2.fromId);
      if (!fromNode) return { ok: false, reason: "bad_from" };
      const toNode = graph.getNode(opts2.toId);
      if (!toNode) return { ok: false, reason: "bad_to" };
      const ast = astar(graph, opts2.fromId, opts2.toId, {
        isBlocked: (id) => blocked.has(id),
      });
      if (!ast) return { ok: false, reason: "no_path" };
      const id = "npc_" + nextId++;
      const n = {
        id, pos: { u: fromNode.u, v: fromNode.v },
        path: ast.path, pathIdx: 0,
        speed: opts2.speed || config.defaultSpeed,
        done: false, target: opts2.toId,
        visited: ast.visited,
      };
      npcs.set(id, n);
      _log("spawn", { id, from: opts2.fromId, to: opts2.toId, hops: ast.path.length });
      return { ok: true, id, npc: n };
    }

    function despawn(id) {
      if (!npcs.has(id)) return { ok: false };
      npcs.delete(id);
      _log("despawn", { id });
      return { ok: true };
    }

    function replan(id, newTargetId) {
      const n = npcs.get(id);
      if (!n) return { ok: false, reason: "missing" };
      const cur = n.path[n.pathIdx];
      if (!cur) return { ok: false, reason: "off_path" };
      const ast = astar(graph, cur, newTargetId, {
        isBlocked: (xId) => blocked.has(xId),
      });
      if (!ast) return { ok: false, reason: "no_path" };
      n.path = ast.path; n.pathIdx = 0;
      n.target = newTargetId; n.done = false;
      n.visited = ast.visited;
      _log("replan", { id, to: newTargetId });
      return { ok: true };
    }

    function _step(n, dt) {
      if (n.done) return;
      const nextId = n.path[n.pathIdx + 1];
      if (!nextId) { n.done = true; _log("arrived", { id: n.id }); return; }
      // If the next node is now blocked, replan from current node
      if (blocked.has(nextId)) {
        const r = replan(n.id, n.target);
        if (!r.ok) { n.done = true; return; }
        return;
      }
      const target = graph.getNode(nextId);
      const dx = target.u - n.pos.u, dy = target.v - n.pos.v;
      const d = Math.hypot(dx, dy);
      const step = n.speed * dt;
      if (d <= step + config.arriveRadius) {
        n.pos.u = target.u; n.pos.v = target.v;
        n.pathIdx++;
      } else {
        n.pos.u += (dx / d) * step;
        n.pos.v += (dy / d) * step;
      }
    }

    function tick(dt) {
      for (const n of npcs.values()) _step(n, dt);
    }

    function get(id) { return npcs.get(id) || null; }
    function list() { return Array.from(npcs.values()); }
    function activeCount() {
      let n = 0;
      for (const x of npcs.values()) if (!x.done) n++;
      return n;
    }
    function recentEvents(n) { return events.slice(-(n || 50)); }

    return {
      graph, config,
      blockNode, unblockNode, isBlocked,
      spawn, despawn, replan, tick,
      get, list, activeCount,
      recentEvents,
    };
  }

  return {
    astar,
    createRouter,
  };
});
