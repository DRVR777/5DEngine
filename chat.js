// chat.js — text chat with rooms, @ mentions, history, mute/block list.
// Multi-room: each player can be in many rooms. Messages broadcast to all
// room members. @mentions trigger notification events.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAChat = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function createChatSystem(opts) {
    opts = opts || {};
    const rooms = new Map();          // roomId → { members:Set, history:[] }
    const sender = opts.sender || function () {};
    const maxHistory = opts.maxHistory || 100;
    const muted = new Map();          // playerId → Set<mutedPlayerId>
    const listeners = { message: [], mention: [], join: [], leave: [] };

    function on(event, fn) { (listeners[event] = listeners[event] || []).push(fn); }
    function emit(event, payload) {
      for (const fn of (listeners[event] || [])) try { fn(payload); } catch (e) {}
    }

    function _ensureRoom(roomId) {
      if (!rooms.has(roomId)) rooms.set(roomId, { id: roomId, members: new Set(), history: [] });
      return rooms.get(roomId);
    }

    function createRoom(roomId, opts2) {
      if (rooms.has(roomId)) return { ok: false, reason: "exists" };
      _ensureRoom(roomId);
      Object.assign(rooms.get(roomId), opts2 || {});
      return { ok: true };
    }

    function join(roomId, playerId) {
      const room = _ensureRoom(roomId);
      if (room.members.has(playerId)) return { ok: false, reason: "already_in" };
      room.members.add(playerId);
      emit("join", { roomId, playerId });
      sender({ cwp: "1.0", type: "chat.join", payload: { roomId, playerId } });
      return { ok: true, members: Array.from(room.members) };
    }

    function leave(roomId, playerId) {
      const room = rooms.get(roomId);
      if (!room || !room.members.has(playerId)) return { ok: false, reason: "not_in" };
      room.members.delete(playerId);
      emit("leave", { roomId, playerId });
      sender({ cwp: "1.0", type: "chat.leave", payload: { roomId, playerId } });
      return { ok: true };
    }

    // Parse @mentions: returns array of mentioned playerIds (with @ stripped).
    function parseMentions(text) {
      if (typeof text !== "string") return [];
      const out = [];
      const re = /@([a-zA-Z0-9_]+)/g;
      let m;
      while ((m = re.exec(text)) !== null) out.push(m[1]);
      return out;
    }

    function send(roomId, fromId, text, opts2) {
      opts2 = opts2 || {};
      const room = rooms.get(roomId);
      if (!room) return { ok: false, reason: "no_room" };
      if (!room.members.has(fromId)) return { ok: false, reason: "not_in_room" };
      if (typeof text !== "string" || !text.trim()) return { ok: false, reason: "empty_message" };
      const mentions = parseMentions(text);
      const msg = {
        id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        roomId, from: fromId, text, mentions,
        ts: opts2.ts || Date.now(),
      };
      // History trim
      room.history.push(msg);
      if (room.history.length > maxHistory) room.history.shift();
      // Notify members (skip muted-by-recipient)
      for (const memberId of room.members) {
        if (memberId === fromId) continue;
        const mutedSet = muted.get(memberId);
        if (mutedSet && mutedSet.has(fromId)) continue;
        emit("message", { roomId, from: fromId, to: memberId, text, mentions, msgId: msg.id });
        if (mentions.includes(memberId)) {
          emit("mention", { roomId, from: fromId, to: memberId, text, msgId: msg.id });
        }
      }
      sender({ cwp: "1.0", type: "chat.message", payload: msg });
      return { ok: true, msgId: msg.id, mentions };
    }

    function history(roomId, opts2) {
      opts2 = opts2 || {};
      const room = rooms.get(roomId);
      if (!room) return [];
      const all = room.history;
      const tail = opts2.n != null ? all.slice(-opts2.n) : all.slice();
      if (opts2.since) return tail.filter(m => m.ts > opts2.since);
      return tail;
    }

    function members(roomId) {
      const room = rooms.get(roomId);
      return room ? Array.from(room.members) : [];
    }
    function listRooms() { return Array.from(rooms.keys()); }
    function getRoomsFor(playerId) {
      const out = [];
      for (const [id, r] of rooms) if (r.members.has(playerId)) out.push(id);
      return out;
    }

    // Mute / block
    function mute(playerId, targetId) {
      if (!muted.has(playerId)) muted.set(playerId, new Set());
      muted.get(playerId).add(targetId);
    }
    function unmute(playerId, targetId) {
      if (muted.has(playerId)) muted.get(playerId).delete(targetId);
    }
    function isMuted(playerId, targetId) {
      const s = muted.get(playerId);
      return s ? s.has(targetId) : false;
    }
    function mutedList(playerId) {
      const s = muted.get(playerId);
      return s ? Array.from(s) : [];
    }

    return {
      rooms,
      createRoom, join, leave, send, history, members, listRooms, getRoomsFor,
      parseMentions, mute, unmute, isMuted, mutedList,
      on,
    };
  }

  return { createChatSystem };
});
