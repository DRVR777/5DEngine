import { eventToThing, buildGraph } from "../../packages/protocol-adapter/adapter.js";
import { strict as assert } from "node:assert";

const NOW = Date.now();
const NODE = "CDBA-CE7B";
const PEER = "8776-AD81";

// ── handshake.started → crypto.handshake Thing ──────────────────────────

{
  const things = eventToThing({ ts: NOW, node: NODE, event: "handshake.started", peer: PEER, reason: "auto-handshake" });
  const h = things.find(t => t.kind === "crypto.handshake");
  assert.ok(h, "handshake Thing exists");
  assert.equal(h.state.phase, "initiated");
  assert.equal(h.state.initiator, NODE);
  assert.equal(h.state.responder, PEER);
  assert.equal(h.state.reason, "auto-handshake");
  assert.ok(h.edges.some(e => e.relation === "between" && e.targetId === `node:${NODE}`));
  assert.ok(h.edges.some(e => e.relation === "between" && e.targetId === `node:${PEER}`));
  console.log("✓ handshake.started → crypto.handshake");
}

// ── handshake.established → session + channel Things ────────────────────

{
  const things = eventToThing({ ts: NOW, node: NODE, event: "handshake.established", peer: PEER });
  const session = things.find(t => t.kind === "crypto.session");
  const channel = things.find(t => t.kind === "crypto.channel");
  assert.ok(session, "session Thing exists");
  assert.ok(session.state.established);
  assert.ok(session.state.secure);
  assert.ok(channel, "channel Thing exists");
  assert.ok(channel.state.active);
  assert.ok(channel.edges.some(e => e.relation === "secures" && e.targetId === session.id));
  console.log("✓ handshake.established → session + channel");
}

// ── message.decrypted → message Thing ───────────────────────────────────

{
  const things = eventToThing({ ts: NOW, node: NODE, event: "message.decrypted", peer: PEER, detail: { size: 235 } });
  const msg = things.find(t => t.kind === "message");
  assert.ok(msg, "message Thing exists");
  assert.equal(msg.state.from, PEER);
  assert.equal(msg.state.to, NODE);
  assert.equal(msg.state.size, 235);
  assert.ok(msg.edges.some(e => e.relation === "from" && e.targetId === `node:${PEER}`));
  console.log("✓ message.decrypted → message");
}

// ── peer.stale → network.peer with stale=true ──────────────────────────

{
  const things = eventToThing({ ts: NOW, node: NODE, event: "peer.stale", peer: PEER, reason: "heartbeat missed" });
  const peer = things.find(t => t.kind === "network.peer");
  assert.ok(peer, "peer Thing exists");
  assert.equal(peer.state.stale, true);
  assert.equal(peer.state.reason, "heartbeat missed");
  console.log("✓ peer.stale → stale peer");
}

// ── buildGraph batches events correctly ─────────────────────────────────

{
  const events = [
    { ts: NOW, node: NODE, event: "handshake.started", peer: PEER, reason: "test" },
    { ts: NOW + 1, node: NODE, event: "handshake.established", peer: PEER },
    { ts: NOW + 2, node: NODE, event: "message.decrypted", peer: PEER },
  ];
  const graph = buildGraph(events);
  const sessions = [...graph.values()].filter(t => t.kind === "crypto.session");
  const messages = [...graph.values()].filter(t => t.kind === "message");
  assert.equal(sessions.length, 1, "one session in graph");
  assert.equal(messages.length, 1, "one message in graph");
  console.log("✓ buildGraph batches events");
}

// ── audit log entry for every event ─────────────────────────────────────

{
  const things = eventToThing({ ts: NOW, node: NODE, event: "relay.connected" });
  const audit = things.find(t => t.kind === "audit.log");
  assert.ok(audit, "audit log entry exists");
  assert.equal(audit.state.event, "relay.connected");
  console.log("✓ every event creates audit log entry");
}

console.log("\nAll 6 protocol-adapter tests passed.");
