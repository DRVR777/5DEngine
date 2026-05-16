// friends.js — friend graph + online status + session invites.
// Asymmetric request → accept/decline; symmetric friendship once accepted.
// Block list is one-way (you blocked them). Blocking auto-cancels any
// pending request, removes any existing friendship, and prevents future
// invites/requests in either direction.
//
// Online status: online / away / busy / offline. Tracked per-player with
// last-seen ts. Status changes broadcast as events.
//
// Session invites: any friend can invite to a session id; recipient
// accepts/declines. Invites expire after a configurable TTL.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAFriends = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const STATUSES = ["online", "away", "busy", "offline"];

  function createSystem(opts) {
    opts = opts || {};
    const config = Object.assign({
      maxFriends: 200,
      inviteTtlMs: 5 * 60 * 1000,    // 5 min
    }, opts.config || {});

    const players = new Map();       // playerId → {status, lastSeen, friends:Set, blocked:Set, requestsIn:Set, requestsOut:Set, invitesIn:[], invitesOut:[]}
    const events = [];

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 500) events.shift();
    }

    function _ensure(playerId) {
      if (!playerId) throw new Error("playerId required");
      if (players.has(playerId)) return players.get(playerId);
      const p = {
        id: playerId,
        status: "offline",
        lastSeen: 0,
        friends: new Set(),
        blocked: new Set(),
        requestsIn: new Set(),     // who has sent me a request
        requestsOut: new Set(),    // requests I've sent
        invitesIn: [],             // pending session invites to me
        invitesOut: [],
      };
      players.set(playerId, p);
      return p;
    }

    // Send request from → to. Symmetric on accept.
    function sendRequest(from, to) {
      if (from === to) return { ok: false, reason: "self_request" };
      const f = _ensure(from), t = _ensure(to);
      if (f.blocked.has(to) || t.blocked.has(from)) {
        return { ok: false, reason: "blocked" };
      }
      if (f.friends.has(to)) return { ok: false, reason: "already_friends" };
      if (f.requestsOut.has(to)) return { ok: false, reason: "already_sent" };
      if (f.friends.size >= config.maxFriends) return { ok: false, reason: "too_many" };
      if (t.friends.size >= config.maxFriends) return { ok: false, reason: "their_list_full" };
      f.requestsOut.add(to);
      t.requestsIn.add(from);
      _log("request_sent", { from, to });
      return { ok: true };
    }

    function cancelRequest(from, to) {
      const f = players.get(from), t = players.get(to);
      if (!f || !f.requestsOut.has(to)) return { ok: false, reason: "no_request" };
      f.requestsOut.delete(to);
      if (t) t.requestsIn.delete(from);
      _log("request_cancelled", { from, to });
      return { ok: true };
    }

    function acceptRequest(me, from) {
      const m = players.get(me);
      if (!m || !m.requestsIn.has(from)) return { ok: false, reason: "no_request" };
      const f = _ensure(from);
      m.requestsIn.delete(from);
      f.requestsOut.delete(me);
      m.friends.add(from);
      f.friends.add(me);
      _log("accepted", { me, from });
      return { ok: true };
    }

    function declineRequest(me, from) {
      const m = players.get(me);
      if (!m || !m.requestsIn.has(from)) return { ok: false, reason: "no_request" };
      m.requestsIn.delete(from);
      const f = players.get(from);
      if (f) f.requestsOut.delete(me);
      _log("declined", { me, from });
      return { ok: true };
    }

    function removeFriend(me, other) {
      const m = players.get(me);
      if (!m || !m.friends.has(other)) return { ok: false, reason: "not_friends" };
      m.friends.delete(other);
      const o = players.get(other);
      if (o) o.friends.delete(me);
      _log("removed", { me, other });
      return { ok: true };
    }

    function block(me, other) {
      if (me === other) return { ok: false, reason: "self" };
      const m = _ensure(me);
      m.blocked.add(other);
      // Cancel any pending requests in both directions
      m.requestsIn.delete(other); m.requestsOut.delete(other);
      const o = players.get(other);
      if (o) {
        o.requestsIn.delete(me); o.requestsOut.delete(me);
        if (m.friends.has(other)) { m.friends.delete(other); o.friends.delete(me); }
      }
      _log("blocked", { me, other });
      return { ok: true };
    }
    function unblock(me, other) {
      const m = players.get(me);
      if (!m || !m.blocked.has(other)) return { ok: false };
      m.blocked.delete(other);
      return { ok: true };
    }
    function isBlocked(me, other) {
      const m = players.get(me);
      return m ? m.blocked.has(other) : false;
    }

    function listFriends(playerId) {
      const p = players.get(playerId);
      return p ? Array.from(p.friends) : [];
    }
    function listRequestsIn(playerId) {
      const p = players.get(playerId);
      return p ? Array.from(p.requestsIn) : [];
    }
    function listRequestsOut(playerId) {
      const p = players.get(playerId);
      return p ? Array.from(p.requestsOut) : [];
    }
    function listBlocked(playerId) {
      const p = players.get(playerId);
      return p ? Array.from(p.blocked) : [];
    }
    function isFriends(a, b) {
      const pa = players.get(a);
      return pa ? pa.friends.has(b) : false;
    }

    // Status
    function setStatus(playerId, status) {
      if (!STATUSES.includes(status)) return { ok: false, reason: "bad_status" };
      const p = _ensure(playerId);
      const prev = p.status;
      p.status = status;
      p.lastSeen = Date.now();
      _log("status", { playerId, prev, status });
      return { ok: true };
    }
    function getStatus(playerId) {
      const p = players.get(playerId);
      return p ? { status: p.status, lastSeen: p.lastSeen } : null;
    }
    function onlineFriends(playerId) {
      const p = players.get(playerId);
      if (!p) return [];
      return Array.from(p.friends).filter(fid => {
        const f = players.get(fid);
        return f && f.status !== "offline";
      });
    }

    // Session invites
    function invite(from, to, sessionId, opts2) {
      opts2 = opts2 || {};
      const f = players.get(from);
      if (!f || !f.friends.has(to)) return { ok: false, reason: "not_friends" };
      const t = _ensure(to);
      if (t.blocked.has(from)) return { ok: false, reason: "blocked" };
      const inv = {
        id: "inv_" + (events.length + 1),
        from, to, sessionId,
        createdAt: Date.now(),
        expiresAt: Date.now() + (opts2.ttlMs || config.inviteTtlMs),
        status: "pending",
        message: opts2.message || "",
      };
      f.invitesOut.push(inv);
      t.invitesIn.push(inv);
      _log("invite_sent", { from, to, sessionId });
      return { ok: true, inviteId: inv.id, invite: inv };
    }

    function _findInvite(playerId, inviteId) {
      const p = players.get(playerId);
      if (!p) return null;
      return p.invitesIn.find(i => i.id === inviteId) || null;
    }

    function acceptInvite(playerId, inviteId) {
      const inv = _findInvite(playerId, inviteId);
      if (!inv) return { ok: false, reason: "no_invite" };
      if (inv.status !== "pending") return { ok: false, reason: "already_resolved" };
      if (Date.now() > inv.expiresAt) { inv.status = "expired"; return { ok: false, reason: "expired" }; }
      inv.status = "accepted";
      _log("invite_accepted", { id: inviteId });
      return { ok: true, sessionId: inv.sessionId };
    }

    function declineInvite(playerId, inviteId) {
      const inv = _findInvite(playerId, inviteId);
      if (!inv) return { ok: false, reason: "no_invite" };
      if (inv.status !== "pending") return { ok: false, reason: "already_resolved" };
      inv.status = "declined";
      _log("invite_declined", { id: inviteId });
      return { ok: true };
    }

    function listInvitesIn(playerId, opts2) {
      opts2 = opts2 || {};
      const p = players.get(playerId);
      if (!p) return [];
      const now = Date.now();
      let invs = p.invitesIn;
      if (opts2.activeOnly !== false) {
        invs = invs.filter(i => i.status === "pending" && now <= i.expiresAt);
      }
      return invs.slice();
    }

    function expireOldInvites(now) {
      now = now != null ? now : Date.now();
      let n = 0;
      for (const p of players.values()) {
        for (const inv of p.invitesIn.concat(p.invitesOut)) {
          if (inv.status === "pending" && now > inv.expiresAt) {
            inv.status = "expired"; n++;
          }
        }
      }
      return n;
    }

    function recentEvents(n) { return events.slice(-(n || 50)); }
    function listPlayers() { return Array.from(players.keys()); }

    return {
      STATUSES,
      sendRequest, cancelRequest, acceptRequest, declineRequest,
      removeFriend,
      block, unblock, isBlocked,
      listFriends, listRequestsIn, listRequestsOut, listBlocked, isFriends,
      setStatus, getStatus, onlineFriends,
      invite, acceptInvite, declineInvite, listInvitesIn, expireOldInvites,
      listPlayers, recentEvents,
    };
  }

  return { STATUSES, createSystem };
});
