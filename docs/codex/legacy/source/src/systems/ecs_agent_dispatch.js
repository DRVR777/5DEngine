/**
 * ecs_agent_dispatch.js — Agent packet dispatch system for 5DEngine
 *
 * Listens to important Core events and relays them as structured packets to
 * the WorldWideComms bridge via socket.io → game_server.py → TCP port 7780.
 *
 * Wire protocol (handled server-side in game_server.py):
 *   Browser emits:  socket.io "bridge_frame" { channel, data }
 *   Server packs:   [uint8 channel][uint32 length][JSON bytes]  → TCP
 *
 * Channel IDs:
 *   1 = GAME_EVENT — battle events, wave transitions, hero state
 *   2 = AGENT_CMD  — inbound commands from agents (received only)
 *
 * Packet shape (all events):
 *   { type: "<event_name>", ts: <epoch_ms>, ...payload }
 *
 * Events dispatched:
 *   wave:start, wave:end, wave:all_complete, wave:countdown
 *   hero:damaged, hero:died
 *   pickup:collected
 *   shop:bought
 *   perk:applied
 *   enemy:killed (if emitted by combat system)
 *
 * Usage:
 *   const dispatch = createAgentDispatch({ getSocket: () => window.io?.() });
 *   Core.addSystem(dispatch, 99, "agent_dispatch"); // run last
 *
 * When no socket is available (not running via game_server.py), the system
 * silently does nothing. All errors are non-fatal.
 */

const CHANNEL_GAME_EVENT = 1;

// Events to relay — { coreName, packetType }
const RELAY_EVENTS = [
  "wave:start",
  "wave:end",
  "wave:all_complete",
  "wave:countdown",
  "hero:damaged",
  "hero:died",
  "pickup:collected",
  "shop:bought",
  "perk:applied",
  "enemy:killed",
];

/**
 * createAgentDispatch(opts) → system function
 *
 * @param {object} opts
 * @param {Function} opts.getSocket - () → socket.io socket | null
 *                                    Called lazily on first tick. Return null to disable.
 * @param {number}  [opts.channel]  - Channel ID to send on (default: 1 = GAME_EVENT)
 */
export function createAgentDispatch({ getSocket, channel = CHANNEL_GAME_EVENT } = {}) {
  let _wired  = false;
  let _socket = null;

  function _send(type, payload) {
    if (!_socket) return;
    try {
      const packet = Object.assign({ type, ts: Date.now() }, payload);
      _socket.emit("bridge_frame", { channel, data: packet });
    } catch (_) { /* non-fatal — bridge may be offline */ }
  }

  function system(dt, core) {
    // Lazy socket init — getSocket() may return null until socket.io CDN loads
    if (!_wired) {
      try {
        _socket = getSocket ? getSocket() : null;
      } catch (_) { _socket = null; }

      if (!_socket) return; // retry next tick
      _wired = true;

      for (const eventName of RELAY_EVENTS) {
        core.on(eventName, (payload) => _send(eventName, payload || {}));
      }
    }
  }

  // Expose for testing / manual dispatch
  system.send = _send;
  system.isConnected = () => _socket != null;

  return system;
}

export default { createAgentDispatch };
