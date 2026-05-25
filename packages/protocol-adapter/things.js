/** Thing type system — every protocol object becomes a Thing */

export type ThingKind =
  | "network.node" | "network.peer" | "network.route"
  | "network.relay" | "network.directory"
  | "crypto.handshake" | "crypto.session" | "crypto.channel"
  | "message" | "message.envelope" | "message.receipt"
  | "agent" | "agent.capability"
  | "work.order" | "work.result"
  | "trust.event" | "trust.ledger"
  | "audit.log";

export interface Thing {
  id: string;
  kind: ThingKind;
  label?: string;
  state: Record<string, unknown>;
  edges: Edge[];
  ts: number;
  version: number;
}

interface Edge {
  relation: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}

export interface ProtocolEvent {
  ts: number;
  node: string;
  event: string;
  peer?: string;
  reason?: string;
  detail?: Record<string, unknown>;
}
