/**
 * dworld_identity.js — ANKHOR facet handler for the dworld-identity facet.
 *
 * Every entity in the P2P game has a cryptographic identity.
 * This facet stores and processes the identity data for Things in the registry.
 *
 * Facet data schema:
 *   {
 *     node_id:         string  — "CDBA-CE7B" (8 hex chars)
 *     game_pubkey_hex: string  — hex-encoded Ed25519 game domain public key
 *     net_pubkey_hex:  string  — hex-encoded Ed25519 network domain public key
 *     display_name:    string  — human-readable name
 *     session_epoch:   number  — current epoch counter from their signer
 *     last_seen_ts:    number  — unix ms, updated on each verified packet
 *     trust_scope:     string  — "public" | "friends-only" | "private"
 *     kind:            string  — "player" | "ai-agent" | "pi-agent" | "iot-sensor"
 *     created_at:      number  — unix ms when identity was first seen
 *   }
 *
 * Tick behavior:
 *   - Updates last_seen_ts from net-sig if present
 *   - Emits "identity:timeout" event if no update in 30 seconds
 *   - Marks thing as offline if timed out
 */

const TIMEOUT_MS = 30_000; // 30 seconds without update = offline

export default {
  priority: 2,  // Run very early — other facets may depend on identity data

  tick(thing, data, dt, registry) {
    if (!data || !data.node_id) return;

    const now = Date.now();

    // Sync session_epoch from net-sig facet if present
    const netSig = registry.facetData(thing.id, "net-sig");
    if (netSig && netSig.epoch > (data.session_epoch || 0)) {
      data.session_epoch = netSig.epoch;
    }

    // Update last_seen from net-sig timestamp
    if (netSig && netSig.ts && netSig.ts > (data.last_seen_ts || 0)) {
      data.last_seen_ts = netSig.ts;
    }

    // Timeout detection for remote players
    if (data.last_seen_ts && data.kind !== "local-player") {
      const age = now - data.last_seen_ts;
      if (age > TIMEOUT_MS && !data._timeout_notified) {
        data._timeout_notified = true;
        data.online = false;
        // Emit to EventBus if available
        if (typeof window !== "undefined" && window.EventBus) {
          window.EventBus.emit("identity:timeout", {
            thing_id: thing.id,
            node_id:  data.node_id,
            display_name: data.display_name,
            age_ms:  age,
          });
        }
      } else if (age <= TIMEOUT_MS) {
        data._timeout_notified = false;
        data.online = true;
      }
    }
  },

  /**
   * Build a Thing for a newly discovered remote player.
   * Called by the NetworkBridge when a new peer identity packet arrives.
   *
   * @param {Object} identityPacket  — { node_id, game_pubkey_hex, net_pubkey_hex, display_name, ... }
   * @returns Thinga-shaped object ready to pass to registry.spawn()
   */
  buildRemotePlayerThing(identityPacket) {
    const nodeId = identityPacket.node_id || "????-????";
    return {
      id:   `hero/${nodeId}`,
      kind: "hero",
      name: `remote_${nodeId}`,
      facets: [
        {
          name: "dworld-identity",
          data: {
            node_id:         nodeId,
            game_pubkey_hex: identityPacket.game_pubkey_hex || "",
            net_pubkey_hex:  identityPacket.net_pubkey_hex  || "",
            display_name:    identityPacket.display_name    || nodeId,
            session_epoch:   0,
            last_seen_ts:    Date.now(),
            trust_scope:     "public",
            kind:            "player",
            online:          true,
            created_at:      Date.now(),
          }
        },
        {
          name: "position",
          data: { x: 0, y: 0, z: 0, heading: 0, velocity: null }
        },
        {
          name: "health",
          data: { hp: 100, armor: 0, maxHp: 100 }
        },
        {
          name: "net-sig",
          data: {
            epoch:      0,
            seq:        0,
            epoch_root: null,
            epoch_sig:  null,
            verified:   false,
            ts:         Date.now(),
          }
        },
        {
          name: "remote-controlled",
          data: {
            source:    "net",
            authority: nodeId,
            lerp_factor: 0.15,  // interpolation speed for position updates
          }
        }
      ]
    };
  }
};
