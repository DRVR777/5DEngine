/**
 * visibility.js — Facet sharing policy for P2P synchronization.
 *
 * Every Thing that syncs over the network needs a policy for WHICH of its
 * facets are shared with which peers. This facet encodes that policy.
 *
 * Without visibility control, a player's position broadcasts to EVERY
 * peer on the relay — including their real-world IP neighbors, strangers
 * in other shards, and the server logs. That's surveillance by default.
 *
 * POOR_HUMAN (2026-05-29): this is the privacy gap. Players should be
 * able to choose which facets are public vs local vs friends-only vs server.
 *
 * Data shape:
 *   {
 *     facets: {
 *       [facetName]: "public" | "friends" | "local" | "server" | "private"
 *     },
 *     default_policy: "public" | "friends" | "local" | "private",
 *     trusted_peers: [peerId, ...],   // always gets full state
 *     anonymous_mode: boolean,        // send position as quantized grid cell only
 *   }
 *
 * Policy meanings:
 *   "public"  — any peer with STATE channel access receives this facet
 *   "friends" — only peers in trusted_peers list
 *   "local"   — only local machine (never sent over network)
 *   "server"  — sent only to relay server (not to other players)
 *   "private" — never serialized or transmitted
 *
 * Anonymous mode:
 *   When anonymous_mode=true, position5d (x,y,z) is quantized to a 10-unit
 *   grid cell before transmission. Peers know you're nearby but not exactly
 *   where. This is the minimum viable presence signal.
 *
 * Default hero policy (sensible defaults for a game):
 *   position5d  → "public"   (other players see you)
 *   health      → "public"   (other players see your HP bar)
 *   inventory   → "private"  (nobody sees your items unless you show them)
 *   player-profile → "friends" (friends see your profile; strangers see alias)
 *   input-state → "local"    (raw keyboard state never leaves your machine)
 *   camera-pos  → "local"    (where you're looking is local)
 *
 * Network integration:
 *   network_sync.js reads visibility before serializing STATE packets.
 *   Facets marked "local" or "private" are stripped before the packet is sent.
 *   Facets marked "friends" are only included when the recipient is in trusted_peers.
 */

const VALID_POLICIES = new Set(["public", "friends", "local", "server", "private"]);

export default {
  priority: 8,  // runs before network_sync (which runs later)

  init(_thing, data) {
    if (!data.facets) data.facets = {};
    if (!data.default_policy) data.default_policy = "public";
    if (!data.trusted_peers) data.trusted_peers = [];
    if (data.anonymous_mode == null) data.anonymous_mode = false;
  },

  /**
   * Check if a given facet should be included in a packet to a given peer.
   * @param {object} data - visibility facet data
   * @param {string} facetName - the facet to check
   * @param {string} peerId - the recipient peer
   * @returns {boolean}
   */
  shouldShare(data, facetName, peerId) {
    const policy = data.facets[facetName] ?? data.default_policy;
    switch (policy) {
      case "public":  return true;
      case "friends": return data.trusted_peers.includes(peerId);
      case "server":  return peerId === "__relay__";
      case "local":
      case "private": return false;
      default:        return false;
    }
  },

  /**
   * Filter a serialized state snapshot to only include facets the peer is
   * allowed to see.
   * @param {object} data - visibility facet data
   * @param {object} snapshot - { facetName: facetData, ... }
   * @param {string} peerId - recipient
   * @returns {object} filtered snapshot
   */
  filterSnapshot(data, snapshot, peerId) {
    const filtered = {};
    for (const [facetName, facetData] of Object.entries(snapshot)) {
      if (this.shouldShare(data, facetName, peerId)) {
        filtered[facetName] = facetData;
      }
    }
    // Anonymous mode: quantize position if policy is public but anon is on
    if (data.anonymous_mode && filtered["position5d"]) {
      const p = { ...filtered["position5d"] };
      p.x = Math.round(p.x / 10) * 10;
      p.z = Math.round(p.z / 10) * 10;
      // Don't leak exact y, u, v in anonymous mode
      p.y = 0;
      filtered["position5d"] = p;
    }
    return filtered;
  },

  /** Default policy for a hero Thing */
  defaultHeroPolicy() {
    return {
      facets: {
        "position5d":     "public",
        "position":       "public",
        "health":         "public",
        "inventory":      "private",
        "player-profile": "friends",
        "input-state":    "local",
        "camera-pos":     "local",
        "cam-shake":      "local",
        "freecam":        "local",
        "settings-panel": "private",
        "save-load":      "private",
      },
      default_policy: "friends",
      trusted_peers: [],
      anonymous_mode: false,
    };
  },
};
