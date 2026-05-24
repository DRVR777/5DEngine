import { createDefaultRegistry } from "../../experimental/holograph-runtime/src/registry.js";
import { installDefaultHandlers } from "../../experimental/holograph-runtime/src/handlers.js";

export function createServer7dBridge({ registry = installDefaultHandlers(createDefaultRegistry()), url = defaultUrl(), WebSocketImpl = globalThis.WebSocket } = {}) {
  let socket = null;
  const state = { connected: false, lastError: null, events: 0 };

  function connect() {
    if (!WebSocketImpl) {
      state.lastError = "WebSocket unavailable";
      return state;
    }
    socket = new WebSocketImpl(url);
    socket.addEventListener("open", () => { state.connected = true; });
    socket.addEventListener("close", () => { state.connected = false; });
    socket.addEventListener("error", (event) => { state.lastError = event?.message || "websocket error"; });
    socket.addEventListener("message", (event) => applyFrame(event.data));
    return state;
  }

  function applyFrame(raw) {
    let frame;
    try { frame = typeof raw === "string" ? JSON.parse(raw) : JSON.parse(String(raw)); }
    catch (error) { state.lastError = `bad frame: ${error.message}`; return; }
    state.events += 1;
    if (frame.type === "spawn" && frame.thing) registry.spawn(frame.thing);
    if (frame.type === "update" && frame.id && frame.facet) registry.updateFacet(frame.id, frame.facet, frame.data || {});
    if (frame.type === "despawn" && frame.id) registry.despawn(frame.id, frame.reason || "server");
  }

  return { registry, state, connect, applyFrame, close: () => socket?.close() };
}

// Legacy game.html imports `mountServer7dBridge` via src/engine_modules.js.
// Keep the old mount-style export as a compatibility alias for the newer
// createServer7dBridge factory.
export function mountServer7dBridge(options = {}) {
  return createServer7dBridge(options);
}

function defaultUrl() {
  if (typeof location !== "undefined") {
    const scheme = location.protocol === "https:" ? "wss" : "ws";
    return `${scheme}://${location.host}/7d-ws`;
  }
  return "ws://127.0.0.1:7700";
}
