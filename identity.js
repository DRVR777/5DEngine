// identity.js — local identity + friends list. Stub for the DWRLD sidecar
// identity API (per DWRLD_META_RUNTIME_SHARED_OS_LAYER.md).
//
// Real impl will resolve identities through the sidecar's capability-checked
// API. Today: in-memory + optional JSON persistence via inject `storage`.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAIdentity = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function makeProfile(handle, opts) {
    opts = opts || {};
    return {
      handle,
      pubkey: opts.pubkey || `pub_${handle}`,        // Ed25519 placeholder
      displayName: opts.displayName || handle,
      worldId: opts.worldId || null,                  // null = not in a world
      capabilities: opts.capabilities || ["chat", "trade"],
      createdAt: opts.createdAt || Date.now(),
    };
  }

  // FriendsList: who I trust + what worlds we share.
  function createFriendsList(opts) {
    opts = opts || {};
    const friends = new Map();   // handle → {profile, status, since, sharedWorlds, blocked}
    const requests = new Map();  // handle → {direction, ts}
    const storage = opts.storage || null;

    function load() {
      if (!storage) return;
      const raw = storage.read("friends.json");
      if (!raw) return;
      try {
        const data = JSON.parse(raw);
        for (const f of (data.friends || [])) friends.set(f.profile.handle, f);
        for (const r of (data.requests || [])) requests.set(r.handle, r);
      } catch (e) { /* corrupt store, start fresh */ }
    }
    function save() {
      if (!storage) return;
      storage.write("friends.json", JSON.stringify({
        friends: Array.from(friends.values()),
        requests: Array.from(requests.values()).map(r => ({ ...r })),
      }));
    }

    function sendRequest(handle, profile) {
      if (friends.has(handle)) return { ok: false, reason: "already_friends" };
      if (requests.has(handle)) return { ok: false, reason: "request_exists" };
      requests.set(handle, { handle, direction: "outgoing", ts: Date.now(), profile });
      save();
      return { ok: true };
    }
    function receiveRequest(profile) {
      if (friends.has(profile.handle)) return { ok: false, reason: "already_friends" };
      requests.set(profile.handle, { handle: profile.handle, direction: "incoming", ts: Date.now(), profile });
      save();
      return { ok: true };
    }
    function acceptRequest(handle) {
      const r = requests.get(handle);
      if (!r) return { ok: false, reason: "no_request" };
      requests.delete(handle);
      friends.set(handle, {
        profile: r.profile,
        status: "online",
        since: Date.now(),
        sharedWorlds: [],
        blocked: false,
      });
      save();
      return { ok: true };
    }
    function declineRequest(handle) {
      if (!requests.has(handle)) return { ok: false };
      requests.delete(handle);
      save();
      return { ok: true };
    }
    function removeFriend(handle) {
      const ok = friends.delete(handle);
      save();
      return { ok };
    }
    function block(handle) {
      const f = friends.get(handle);
      if (f) f.blocked = true;
      requests.delete(handle);
      save();
    }
    function setStatus(handle, status, worldId) {
      const f = friends.get(handle);
      if (!f) return;
      f.status = status;
      if (worldId !== undefined) f.profile.worldId = worldId;
    }
    function listFriends(filter) {
      const out = [];
      for (const f of friends.values()) {
        if (f.blocked) continue;
        if (filter === "online" && f.status !== "online") continue;
        out.push(f);
      }
      return out;
    }
    function listRequests(direction) {
      const out = [];
      for (const r of requests.values()) {
        if (direction && r.direction !== direction) continue;
        out.push(r);
      }
      return out;
    }
    function isFriend(handle) {
      const f = friends.get(handle);
      return !!(f && !f.blocked);
    }
    // Friends in the same world as me — for "near friend → world merge"
    function friendsInWorld(myWorldId) {
      const out = [];
      for (const f of friends.values()) {
        if (f.blocked) continue;
        if (f.profile.worldId === myWorldId) out.push(f);
      }
      return out;
    }

    load();

    return {
      sendRequest, receiveRequest, acceptRequest, declineRequest,
      removeFriend, block, setStatus,
      listFriends, listRequests, isFriend, friendsInWorld,
      _friendsMap: friends, _requestsMap: requests,
    };
  }

  return { makeProfile, createFriendsList };
});
