/**
 * 7D Protocol Adapter — dwrld events → Thing graph
 * 
 * Every protocol object maps to a Thing:
 *   node → Thing(kind="network.node")
 *   peer → Thing(kind="network.peer")  
 *   session → Thing(kind="crypto.session")
 *   message → Thing(kind="message")
 *   handshake → Thing(kind="crypto.handshake")
 */

export { buildGraph, eventToThing, queryGraph, queryEdges } from "./adapter.js";
export { ThingKind, type Thing, type ProtocolEvent } from "./things.js";
export { EventRecorder } from "./recorder.js";
