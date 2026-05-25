import type { ProtocolEvent, Thing, ThingKind } from "./things.js";

export function eventToThing(event: ProtocolEvent): Thing[] {
  const things: Thing[] = [];
  const ts = event.ts;

  things.push({
    id: `audit:${event.node}:${ts}:${event.event}`,
    kind: "audit.log", state: { ...event }, edges: [], ts, version: 1,
  });

  const handlers: Record<string, () => void> = {
    "relay.connected": () => things.push({
      id: `node:${event.node}`, kind: "network.node", label: event.node,
      state: { relayConnected: true, lastRelayConnect: ts },
      edges: [{ relation: "connects_through", targetId: "relay:local" }], ts, version: 1,
    }),
    "peer.discovered": () => things.push({
      id: `peer:${event.peer}`, kind: "network.peer", label: event.peer,
      state: { discovered: true, discoveredAt: ts },
      edges: [{ relation: "known_by", targetId: `node:${event.node}` }], ts, version: 1,
    }),
    "handshake.started": () => things.push({
      id: `handshake:${event.node}:${event.peer}`, kind: "crypto.handshake",
      state: { phase: "initiated", initiator: event.node, responder: event.peer, reason: event.reason },
      edges: [{ relation: "between", targetId: `node:${event.node}` }, { relation: "between", targetId: `node:${event.peer}` }],
      ts, version: 1,
    }),
    "handshake.established": () => {
      things.push({
        id: `session:${event.node}:${event.peer}`, kind: "crypto.session",
        state: { established: true, secure: true, establishedAt: ts },
        edges: [{ relation: "between", targetId: `node:${event.node}` }, { relation: "between", targetId: `node:${event.peer}` }],
        ts, version: 1,
      });
      things.push({
        id: `channel:${event.node}:${event.peer}`, kind: "crypto.channel",
        state: { active: true, establishedAt: ts },
        edges: [{ relation: "secures", targetId: `session:${event.node}:${event.peer}` }], ts, version: 1,
      });
    },
    "handshake.failed": () => things.push({
      id: `handshake:${event.node}:${event.peer}`, kind: "crypto.handshake",
      state: { phase: "failed", reason: event.reason, failedAt: ts }, edges: [], ts, version: 1,
    }),
    "message.decrypted": () => things.push({
      id: `msg:${event.node}:${ts}`, kind: "message",
      state: { from: event.peer, to: event.node, decrypted: true, ...event.detail },
      edges: [{ relation: "from", targetId: `node:${event.peer}` }, { relation: "to", targetId: `node:${event.node}` }],
      ts, version: 1,
    }),
    "message.delivered": () => things.push({
      id: `msg:${event.node}:${ts}`, kind: "message.receipt",
      state: { delivered: true, deliveredAt: ts, to: event.peer }, edges: [], ts, version: 2,
    }),
    "peer.stale": () => things.push({
      id: `peer:${event.peer}`, kind: "network.peer",
      state: { stale: true, staleAt: ts, reason: event.reason }, edges: [], ts, version: 1,
    }),
    "session.reset": () => things.push({
      id: `session:${event.node}:${event.peer}`, kind: "crypto.session",
      state: { established: false, reset: true, resetAt: ts, reason: event.reason }, edges: [], ts, version: 2,
    }),
  };

  handlers[event.event]?.();
  return things;
}

export function buildGraph(events: ProtocolEvent[]): Map<string, Thing> {
  const graph = new Map<string, Thing>();
  for (const event of events) {
    for (const thing of eventToThing(event)) {
      const existing = graph.get(thing.id);
      if (!existing || thing.version >= existing.version) graph.set(thing.id, thing);
    }
  }
  return graph;
}

export function queryGraph(graph: Map<string, Thing>, kind: ThingKind): Thing[] {
  return [...graph.values()].filter(t => t.kind === kind);
}

export function queryEdges(graph: Map<string, Thing>, sourceId: string, relation?: string): Thing[] {
  const source = graph.get(sourceId);
  if (!source) return [];
  const targets = relation ? source.edges.filter(e => e.relation === relation) : source.edges;
  return targets.map(e => graph.get(e.targetId)).filter(Boolean) as Thing[];
}
