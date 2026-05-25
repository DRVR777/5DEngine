/** Structured event recorder — appends protocol events as JSONL */
import { appendFileSync, mkdirSync, existsSync } from "node:fs";

export class EventRecorder {
  constructor(nodeId, logDir = "/opt/wwc/logs") {
    this.node = nodeId;
    this.path = `${logDir}/protocol-events.jsonl`;
    if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
  }

  record(event, peer, detail) {
    const entry = { ts: Date.now(), node: this.node, event, peer, detail };
    appendFileSync(this.path, JSON.stringify(entry) + "\n");
    return entry;
  }

  relayConnected() { return this.record("relay.connected"); }
  peerDiscovered(peer) { return this.record("peer.discovered", peer); }
  handshakeStarted(peer, reason) { return this.record("handshake.started", peer, { reason }); }
  handshakeEstablished(peer) { return this.record("handshake.established", peer); }
  handshakeFailed(peer, reason) { return this.record("handshake.failed", peer, { reason }); }
  messageDecrypted(peer, detail) { return this.record("message.decrypted", peer, detail); }
  messageDelivered(peer) { return this.record("message.delivered", peer); }
  peerStale(peer, reason) { return this.record("peer.stale", peer, { reason }); }
  sessionReset(peer, reason) { return this.record("session.reset", peer, { reason }); }
}
