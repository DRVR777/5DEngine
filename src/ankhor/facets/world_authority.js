/** world-authority facet — Declares ownership and write policy for a world slice.
 *
 *  In the P2P hivemind, each "world slice" is a named region of the shared
 *  world. A slice has an owner (the node whose AI has elevated authority)
 *  and a write policy (who can spawn/despawn/mutate objects in this slice).
 *
 *  This facet lives on a Thinga of kind "world" and determines:
 *  - Who controls this slice of reality
 *  - Who can write to it (build, spawn, mutate)
 *  - What the fallback is when the owner is offline
 *
 *  WRITE POLICIES:
 *    "owner_only"        — only the owner node can mutate. Read-only for all.
 *    "contributors_only" — nodes with reputation score > threshold can mutate
 *    "trusted_peers"     — owner has explicitly allow-listed peer IDs
 *    "open"              — anyone can mutate (no restrictions, like creative mode)
 *    "ai_governed"       — the owner's AI agent moderates mutations in real-time
 *
 *  AUTHORITY LEVELS (descending):
 *    5 = god         — owner of this slice, unrestricted
 *    4 = admin       — trusted admin (set by owner, can kick/ban)
 *    3 = builder     — can place/remove world objects
 *    2 = member      — can interact, use, pickup, but not build
 *    1 = visitor     — read-only presence (can walk around, talk to NPCs)
 *    0 = denied      — blocked by owner or AI governor
 *
 *  Data schema:
 *  {
 *    slice_id: "worlds/default",
 *    owner_peer_id: null,       // wwc identity hash of the owner
 *    authority_level: 1,        // THIS node's authority in this slice
 *    write_policy: "open",      // see above
 *    rep_threshold: 0.3,        // minimum reputation score for "contributors_only"
 *    trusted_peers: [],         // explicit allow-list for "trusted_peers" policy
 *    offline_policy: "freeze",  // when owner is offline: "freeze"|"open"|"ai_hold"
 *    ai_governor: null,         // peerId of AI agent moderating this slice (if ai_governed)
 *
 *    // REGISTERS:
 *    _r_owner_online: false,    // true when owner's wwc node is connected
 *    _r_my_authority: 1,        // cached authority level for the local player
 *  }
 *
 *  Written by RICH_HUMAN_20260324 for the Council — 2026-05-29
 *  Session: 2026-05-29_go-thru-5dengine-and-change-whatever-they-want-to_2098afea
 */

export default {
  priority: 15,

  init(_thing, data) {
    // Initialize registers
    data._r_owner_online = false;
    data._r_my_authority = data.authority_level || 1;

    // Default policy is open (permissionless world)
    if (!data.write_policy) data.write_policy = "open";
    if (!data.offline_policy) data.offline_policy = "freeze";
    if (!data.trusted_peers) data.trusted_peers = [];
    if (data.rep_threshold === undefined) data.rep_threshold = 0.3;
  },

  tick(_thing, data, _dt, registry) {
    if (!data) return;

    // Check if owner is online by looking for their node in the registry
    if (data.owner_peer_id) {
      const ownerThingId = `remote-player/${data.owner_peer_id}`;
      data._r_owner_online = registry.rows.has(ownerThingId) &&
                             !registry.rows.get(ownerThingId)?.deleted_at;
    } else {
      // No owner set = local player IS the owner (solo mode or first boot)
      data._r_owner_online = true;
      data._r_my_authority = 5;  // god mode in unowned slice
    }

    // Recalculate local player's authority
    data._r_my_authority = _resolveLocalAuthority(data, registry);
  },
};

/** Resolve the local player's authority level in this slice. */
function _resolveLocalAuthority(data, registry) {
  // No owner → open world, everyone is god
  if (!data.owner_peer_id) return 5;

  // Get local player's peer ID
  const localPeerId = _getLocalPeerId(registry);

  // Owner always has authority 5
  if (localPeerId && localPeerId === data.owner_peer_id) return 5;

  // Explicit deny overrides everything
  // (future: check a deny-list facet)

  // Policy-based authority
  switch (data.write_policy) {
    case "open":
      return 3;  // everyone can build

    case "owner_only":
      return 1;  // visitors only

    case "trusted_peers":
      if (localPeerId && data.trusted_peers.includes(localPeerId)) return 3;
      return 1;

    case "contributors_only": {
      // Check reputation score from local player profile
      const rep = _getLocalReputation(registry);
      return rep >= (data.rep_threshold || 0.3) ? 3 : 1;
    }

    case "ai_governed":
      // Default to member until AI governor elevates
      return 2;

    default:
      return 1;
  }
}

/** Get the local player's peer ID from the hero Thinga's identity facet. */
function _getLocalPeerId(registry) {
  const heroes = registry.byKind("hero");
  for (const h of heroes) {
    const identity = registry.facetData(h.id, "identity");
    if (identity && identity.type !== "remote" && identity.peerId) {
      return identity.peerId;
    }
  }
  return null;
}

/** Get the local player's reputation score. */
function _getLocalReputation(registry) {
  const heroes = registry.byKind("hero");
  for (const h of heroes) {
    const rep = registry.facetData(h.id, "reputation");
    if (rep && typeof rep.trustScore === "number") return rep.trustScore;
  }
  return 0.5;  // default neutral reputation
}

// ── Authority check helpers (used by other facets) ────────────────────────

/** Returns true if the local player can build/mutate in this world slice.
 *  Other facets can call this to gate spawn/despawn/build operations. */
export function canWrite(worldAuthorityData) {
  return (worldAuthorityData?._r_my_authority || 0) >= 3;
}

/** Returns true if the local player is an admin in this slice. */
export function isAdmin(worldAuthorityData) {
  return (worldAuthorityData?._r_my_authority || 0) >= 4;
}

/** Returns true if the local player is the owner of this slice. */
export function isOwner(worldAuthorityData) {
  return (worldAuthorityData?._r_my_authority || 0) >= 5;
}
