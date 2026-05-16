// world_graph.js — worlds as graph nodes with portal edges (per conviction.pdf).
// Each world has its own coordinate origin and physics profile. Crossing a
// portal IS a world-process handoff, not a coordinate transform — the
// invariant that lets interiors be larger than exteriors.
//
// merge(A, B): adds a bidirectional portal between A and B. A friend coming
// near triggers this; the merged graph is a union, not a coordinate fusion.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAWorldGraph = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function createWorldGraph() {
    const nodes  = new Map();        // worldId → { worldRef, meta }
    const edges  = new Map();        // edgeId → { from, to, weight, kind, params }
    const adjOut = new Map();        // worldId → Set<edgeId>

    function addWorld(worldId, worldRef, meta) {
      if (nodes.has(worldId)) return false;
      nodes.set(worldId, { worldRef, meta: meta || {} });
      adjOut.set(worldId, new Set());
      return true;
    }

    function removeWorld(worldId) {
      if (!nodes.has(worldId)) return false;
      // Remove all edges touching this world
      for (const [eid, e] of edges) {
        if (e.from === worldId || e.to === worldId) edges.delete(eid);
      }
      adjOut.delete(worldId);
      nodes.delete(worldId);
      return true;
    }

    // Add a directed portal edge. For bidirectional, call twice or use addBidirectional.
    function addPortal(fromId, toId, opts) {
      opts = opts || {};
      if (!nodes.has(fromId) || !nodes.has(toId)) return null;
      const eid = `${fromId}__${toId}__${opts.kind || "door"}_${Math.random().toString(36).slice(2, 6)}`;
      edges.set(eid, {
        from: fromId, to: toId,
        weight: opts.weight != null ? opts.weight : 1.0,
        kind: opts.kind || "door",
        params: opts.params || {},
      });
      adjOut.get(fromId).add(eid);
      return eid;
    }

    function addBidirectional(aId, bId, opts) {
      const e1 = addPortal(aId, bId, opts);
      const e2 = addPortal(bId, aId, opts);
      return [e1, e2];
    }

    function neighbors(worldId) {
      const set = adjOut.get(worldId);
      if (!set) return [];
      const out = [];
      for (const eid of set) {
        const e = edges.get(eid);
        if (e) out.push({ edgeId: eid, to: e.to, weight: e.weight, kind: e.kind });
      }
      return out;
    }

    function getEdge(eid) { return edges.get(eid) || null; }

    function getWorld(worldId) {
      const n = nodes.get(worldId);
      return n ? n.worldRef : null;
    }

    // Merge B into A's reachable graph by adding a portal between them.
    // Both stay independent processes; merge = "adjacent" relationship.
    function mergeWorlds(aId, bId, portalOpts) {
      if (!nodes.has(aId) || !nodes.has(bId)) return { ok: false, reason: "missing_world" };
      // Already merged (any portal between them)?
      for (const e of edges.values()) {
        if ((e.from === aId && e.to === bId) || (e.from === bId && e.to === aId)) {
          return { ok: false, reason: "already_merged" };
        }
      }
      const [e1, e2] = addBidirectional(aId, bId, portalOpts || { kind: "merge_portal", weight: 0 });
      return { ok: true, edges: [e1, e2] };
    }

    // BFS reachability — for "what worlds can I get to from here"
    function reachable(fromId, maxHops) {
      const seen = new Set([fromId]);
      const queue = [{ id: fromId, hops: 0 }];
      const out = [{ id: fromId, hops: 0 }];
      const cap = maxHops != null ? maxHops : Infinity;
      while (queue.length) {
        const { id, hops } = queue.shift();
        if (hops >= cap) continue;
        for (const n of neighbors(id)) {
          if (seen.has(n.to)) continue;
          seen.add(n.to);
          out.push({ id: n.to, hops: hops + 1 });
          queue.push({ id: n.to, hops: hops + 1 });
        }
      }
      return out;
    }

    // Move an entity between worlds via a portal — world-process handoff.
    // (Pure data move: remove from src.entities, add to dst.entities.)
    function traversePortal(eid, entityId) {
      const e = edges.get(eid);
      if (!e) return { ok: false, reason: "no_edge" };
      const src = getWorld(e.from), dst = getWorld(e.to);
      if (!src || !dst) return { ok: false, reason: "missing_world_ref" };
      const ent = src.entities && src.entities.get(entityId);
      if (!ent) return { ok: false, reason: "no_entity" };
      src.entities.delete(entityId);
      // Reset coordinates to dst origin (entity enters at portal destination point)
      if (ent.position && e.params.spawnAt) {
        ent.position.u = e.params.spawnAt.u || 0;
        ent.position.v = e.params.spawnAt.v || 0;
      }
      dst.entities.set(entityId, ent);
      return { ok: true, entity: ent, fromWorldId: e.from, toWorldId: e.to };
    }

    return {
      addWorld, removeWorld, addPortal, addBidirectional,
      mergeWorlds, neighbors, getEdge, getWorld, reachable, traversePortal,
      _nodes: nodes, _edges: edges,
    };
  }

  // Proximity-based merge proposal: when a friend's world is "near" mine
  // (per their last-known position vs mine, both supplied as data), propose
  // a merge to the network. Pure decision function.
  function shouldMergeOnProximity(myWorldId, myPos, friendsInWorld, threshold) {
    threshold = threshold || 5;
    const proposals = [];
    for (const f of friendsInWorld) {
      if (!f.lastKnownPos || !f.profile.worldId || f.profile.worldId === myWorldId) continue;
      const d = Math.hypot(f.lastKnownPos.u - myPos.u, f.lastKnownPos.v - myPos.v);
      if (d <= threshold) proposals.push({ friend: f.profile.handle, otherWorldId: f.profile.worldId, distance: d });
    }
    return proposals;
  }

  return { createWorldGraph, shouldMergeOnProximity };
});
