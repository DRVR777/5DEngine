/**
 * player_profile.js — Player identity in the dworld:// namespace.
 *
 * Every player in the hivemind P2P network has a persistent identity that
 * lives beyond any single session. This facet stores and manages it.
 *
 * Identity components:
 *   - peer_id: the worldwidecomms node ID (hardware-derived or user-set)
 *   - alias: display name (user-set, changeable)
 *   - avatar: visual representation (color, glyph, or GLTF reference)
 *   - reputation: contribution history (relay_credits, chunks_hosted, etc.)
 *   - network_budget: bandwidth constraints (per POOR_HUMAN progressive loading spec)
 *   - node_role: "game" | "relay" | "inference" | "storage" | "iot"
 *
 * GENESIS_WRITER (2026-05-29): Per Node AI Identity Doctrine —
 *   the player's profile IS their gene. Between sessions, only the profile persists.
 *   The running game instance is the organism; the profile is the DNA.
 *
 * ARCHITECT (2026-05-29): Replacing stub.
 *   Default policy: play-only nodes contribute nothing. They get full game access.
 *   Relay nodes earn relay_credits. Inference nodes earn inference_credits.
 *   This satisfies POOR_HUMAN's "play only, contribute nothing" valid mode.
 */

const STORAGE_KEY = "5dengine_player_profile_v1";
const DEFAULT_AVATAR_COLORS = [
  0x00aaff, 0xff4400, 0x00ff88, 0xff8800, 0xaa00ff,
  0x00ffff, 0xff0088, 0xffff00, 0x88ff00, 0x0088ff,
];

export default {
  priority: 1,  // load first — everything else may read the profile

  init(_thing, data) {
    if (data._loaded) return;
    data._loaded = true;

    // Try to load persisted profile from LocalStorage
    const saved = _loadProfile();
    if (saved) {
      Object.assign(data, saved);
    } else {
      // Generate new identity on first boot
      data.peer_id = _generatePeerId();
      data.alias = `player_${data.peer_id.slice(-4)}`;
      data.avatar = {
        color: DEFAULT_AVATAR_COLORS[Math.floor(Math.random() * DEFAULT_AVATAR_COLORS.length)],
        glyph: null,
      };
      data.reputation = {
        relay_credits: 0,
        chunks_hosted: 0,
        sessions_completed: 0,
        join_date: new Date().toISOString(),
      };
      // Per POOR_HUMAN: "play only, contribute nothing" is explicitly valid
      data.network_budget = {
        per_session_mb: 200,    // 200MB default (user can set lower for metered)
        background_mb: 0,       // no background download by default
        tier: "standard",       // "minimal" (64KB) | "standard" | "extended" | "unlimited"
      };
      data.node_role = "game";  // "game" | "relay" | "inference" | "storage" | "iot"
      data.contribute_to_network = false;  // OPT-IN, not forced
      data.public_key = null;
      _saveProfile(data);
    }

    if (!data.session) {
      data.session = {
        joined_at: new Date().toISOString(),
        world_id: null,
        peers_seen: [],
      };
    }
  },

  tick(_thing, data, _dt, _registry) {
    if (!data || !data._dirty) return;
    _saveProfile(data);
    data._dirty = false;
  },

  onPeerConnected(data, peerId) {
    if (data.session && !data.session.peers_seen.includes(peerId)) {
      data.session.peers_seen.push(peerId);
    }
    data._dirty = true;
  },

  onChunkRelayed(data, byteCount) {
    if (!data.reputation) return;
    data.reputation.relay_credits += Math.floor(byteCount / 1024);
    data._dirty = true;
  },

  /** Public profile slice for AGENT channel broadcast */
  toPublicProfile(data) {
    return {
      peer_id: data.peer_id,
      alias: data.alias || "anonymous",
      avatar: data.avatar || { color: 0x888888 },
      reputation_summary: {
        relay_credits: data.reputation?.relay_credits || 0,
        sessions: data.reputation?.sessions_completed || 0,
      },
      node_role: data.node_role || "game",
      contribute: !!data.contribute_to_network,
    };
  },
};

function _generatePeerId() {
  const hex = () => Math.floor(Math.random() * 0x10000).toString(16).toUpperCase().padStart(4, "0");
  return `${hex()}-${hex()}`;
}
function _loadProfile() {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function _saveProfile(data) {
  try {
    if (typeof localStorage === "undefined") return;
    const toSave = {
      peer_id: data.peer_id, alias: data.alias, avatar: data.avatar,
      reputation: data.reputation, network_budget: data.network_budget,
      node_role: data.node_role, contribute_to_network: data.contribute_to_network,
      public_key: data.public_key,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch { /* quota exceeded */ }
}
