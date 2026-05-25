/** Structured event recorder — appends protocol events as JSONL */
import { appendFileSync, mkdirSync, existsSync } from "node:fs";
import type { ProtocolEvent } from "./things.js";

export class EventRecorder {
  #path: string;
  #node: string;

  constructor(nodeId: string, logDir = "/opt/wwc/logs") {
    this.#node = nodeId;
    this.#path = `${logDir}/protocol-events.jsonl`;
    if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
  }

  record(event: string, peer?: string, detail?: Record<string, unknown>) {
    const entry: ProtocolEvent = {
      ts: Date.now(),
      node: this.#node,
      event,
      peer,
      detail,
    };
    appendFileSync(this.#path, JSON.stringify(entry) + "\n");
    return entry;
  }

  relayConnected() { return this.record("relay.connected"); }
  peerDiscovered(peer: string) { return this.record("peer.discovered", peer); }
  handshakeStarted(peer: string, reason?: string) { return this.record("handshake.started", peer, { reason }); }
  handshakeEstablished(peer: string) { return this.record("handshake.established", peer); }
  handshakeFailed(peer: string, reason?: string) { return this.record("handshake.failed", peer, { reason }); }
  messageDecrypted(peer: string, detail?: Record<string, unknown>) { return this.record("message.decrypted", peer, detail); }
  messageDelivered(peer: string) { return this.record("message.delivered", peer); }
  peerStale(peer: string, reason?: string) { return this.record("peer.stale", peer, { reason }); }
  sessionReset(peer: string, reason?: string) { return this.record("session.reset", peer, { reason }); }
}
