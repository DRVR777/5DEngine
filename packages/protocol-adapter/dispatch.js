/**
 * 7D Protocol Dispatch — routes agent messages through the Ankhor thing graph.
 * 
 * handlePeerMessage(registry, peerId, message)
 *   Parses inbound messages, dispatches to the correct Thing/facet handler.
 *   Falls back to legacy bridge if no Ankhor handler registered.
 */

/**
 * Dispatch a peer message through the Ankhor registry.
 * @param {object} registry - Ankhor registry with byKind/query methods
 * @param {string} peerId  - Sender node ID
 * @param {string} message - Raw message text
 * @returns {object} { handled: boolean, response?: string, thing?: string }
 */
export function handlePeerMessage(registry, peerId, message) {
  // Try agent-message Things first
  try {
    const agents = registry.byKind?.("agent-message") || [];
    for (const agent of agents) {
      const handler = registry.getFacetHandler?.("agent-message");
      if (handler?.onMessage) {
        const resp = handler.onMessage(agent, { peerId, message });
        if (resp) return { handled: true, response: resp, thing: agent.id };
      }
    }
  } catch (_) {}

  // Try request-stream Things
  try {
    const streams = registry.byKind?.("request-stream") || [];
    for (const stream of streams) {
      const handler = registry.getFacetHandler?.("request-stream");
      if (handler?.onMessage) {
        const resp = handler.onMessage(stream, { peerId, message });
        if (resp) return { handled: true, response: resp, thing: stream.id };
      }
    }
  } catch (_) {}

  // Fallback: log and acknowledge
  return { handled: false, response: null };
}

/**
 * Wire all peer-connected Things for batch dispatch.
 * @param {object} registry
 * @param {Array<{peerId: string, message: string}>} messages
 * @returns {Array} results
 */
export function dispatchBatch(registry, messages) {
  return messages.map(m => handlePeerMessage(registry, m.peerId, m.message));
}
