// traffic.js — agents that follow a road network of waypoints.
// Roads are a graph: { nodes:[{id,u,v}], edges:[{from,to,speedLimit}] }.
// Agents pick a destination, find a path (BFS over edges), and travel
// waypoint-to-waypoint at the lane speed limit.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTATraffic = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function createRoadNetwork() {
    const nodes = new Map();         // id → {id, u, v}
    const edges = new Map();         // edgeId → {from, to, speedLimit}
    const adj = new Map();           // nodeId → [edgeId,...]

    function addNode(id, u, v) {
      if (nodes.has(id)) return false;
      nodes.set(id, { id, u, v });
      adj.set(id, []);
      return true;
    }
    function addEdge(from, to, opts) {
      opts = opts || {};
      if (!nodes.has(from) || !nodes.has(to)) return null;
      const eid = `${from}->${to}`;
      edges.set(eid, { from, to, speedLimit: opts.speedLimit || 8 });
      adj.get(from).push(eid);
      return eid;
    }
    function addBidi(a, b, opts) {
      return [addEdge(a, b, opts), addEdge(b, a, opts)];
    }
    function getNode(id) { return nodes.get(id) || null; }
    function neighbors(nodeId) {
      const out = [];
      for (const eid of (adj.get(nodeId) || [])) {
        const e = edges.get(eid);
        if (e) out.push({ edgeId: eid, to: e.to, speedLimit: e.speedLimit });
      }
      return out;
    }

    // BFS from `from` to `to`. Returns array of nodeIds or null.
    function shortestPath(from, to) {
      if (!nodes.has(from) || !nodes.has(to)) return null;
      if (from === to) return [from];
      const queue = [from];
      const came = new Map();
      came.set(from, null);
      while (queue.length) {
        const cur = queue.shift();
        for (const n of neighbors(cur)) {
          if (came.has(n.to)) continue;
          came.set(n.to, cur);
          if (n.to === to) {
            const path = [to];
            let p = cur;
            while (p !== null) { path.push(p); p = came.get(p); }
            return path.reverse();
          }
          queue.push(n.to);
        }
      }
      return null;
    }

    return { nodes, edges, adj,
             addNode, addEdge, addBidi, getNode, neighbors, shortestPath };
  }

  // Create a traffic agent that follows a route.
  // pos: starting {u,v}; opts: {speed?, route?, network}
  function createAgent(opts) {
    opts = opts || {};
    if (!opts.network) throw new Error("network required");
    return {
      network: opts.network,
      pos: { u: opts.pos.u, v: opts.pos.v },
      route: opts.route || [],   // [nodeId,...]
      routeIdx: 0,                // current target waypoint index
      speed: opts.speed || 8,     // m/s
      heading: 0,
      arrivedAt: null,           // null while moving; node id when arrived
      currentDestId: opts.destId || null,
    };
  }

  function setDestination(agent, destId) {
    // Find nearest node to current pos as starting point
    let best = null, bestDist = Infinity;
    for (const node of agent.network.nodes.values()) {
      const d = Math.hypot(node.u - agent.pos.u, node.v - agent.pos.v);
      if (d < bestDist) { bestDist = d; best = node.id; }
    }
    if (!best) return false;
    const path = agent.network.shortestPath(best, destId);
    if (!path) return false;
    agent.route = path;
    agent.routeIdx = 0;
    agent.arrivedAt = null;
    agent.currentDestId = destId;
    return true;
  }

  // Advance the agent toward its current waypoint at agent.speed.
  // Returns events: { reachedWaypoint: nodeId | null, arrivedAtDest: bool }
  function tick(agent, dt) {
    if (!agent.route || agent.routeIdx >= agent.route.length) {
      return { reachedWaypoint: null, arrivedAtDest: agent.arrivedAt !== null };
    }
    const targetNodeId = agent.route[agent.routeIdx];
    const target = agent.network.getNode(targetNodeId);
    if (!target) {
      agent.routeIdx++;
      return { reachedWaypoint: null, arrivedAtDest: false };
    }
    const du = target.u - agent.pos.u, dv = target.v - agent.pos.v;
    const dist = Math.hypot(du, dv);
    const step = agent.speed * dt;
    if (dist <= step) {
      agent.pos.u = target.u; agent.pos.v = target.v;
      agent.routeIdx++;
      const reached = targetNodeId;
      const isDest = agent.routeIdx >= agent.route.length;
      if (isDest) agent.arrivedAt = targetNodeId;
      return { reachedWaypoint: reached, arrivedAtDest: isDest };
    }
    agent.pos.u += (du / dist) * step;
    agent.pos.v += (dv / dist) * step;
    agent.heading = Math.atan2(du, dv);
    return { reachedWaypoint: null, arrivedAtDest: false };
  }

  // Spawn N traffic agents wandering between random nodes.
  function spawnTraffic(network, n, opts) {
    opts = opts || {};
    const agents = [];
    const nodeIds = Array.from(network.nodes.keys());
    if (nodeIds.length < 2) return agents;
    for (let i = 0; i < n; i++) {
      const startId = nodeIds[Math.floor(Math.random() * nodeIds.length)];
      const start = network.getNode(startId);
      const destId = nodeIds[Math.floor(Math.random() * nodeIds.length)];
      const agent = createAgent({
        network,
        pos: { u: start.u, v: start.v },
        speed: opts.speed || 8,
      });
      setDestination(agent, destId);
      agents.push(agent);
    }
    return agents;
  }

  // Tick all + auto-respawn destination on arrival
  function tickFleet(agents, dt, opts) {
    opts = opts || {};
    const events = [];
    for (const a of agents) {
      const e = tick(a, dt);
      if (e.arrivedAtDest && opts.respawnOnArrival !== false) {
        const ids = Array.from(a.network.nodes.keys());
        const newDest = ids[Math.floor(Math.random() * ids.length)];
        setDestination(a, newDest);
      }
      events.push(e);
    }
    return events;
  }

  return {
    createRoadNetwork, createAgent, setDestination, tick, spawnTraffic, tickFleet,
  };
});
