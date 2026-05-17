// ride_along.js — spectate a friend's gameplay via a replay buffer.
// The host streams compact frames (position, look, action) into a
// rolling ring buffer; spectators "tune in" and the buffer is rebroadcast
// at playback speed. Includes a join-in-progress catchup, a follow mode
// (track host's exact view), and a free-cam mode (cam decoupled from
// host, but world state still driven by host).
//
// The replay buffer is content-addressed by (sessionId, hostId, seq);
// transport is the caller's job (CWP envelope, websocket, etc.) —
// this module is just the buffer + playback machinery.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTARideAlong = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // A frame: { seq, ts, pos:{u,v,y}, look:{yaw,pitch}, vel?, action? }
  function createBuffer(opts) {
    opts = opts || {};
    const capacity = opts.capacity || 600;     // 10s @ 60Hz
    const frames = [];
    let nextSeq = 0;
    let dropped = 0;

    function push(frame) {
      if (!frame || frame.pos == null || frame.look == null) {
        return { ok: false, reason: "bad_frame" };
      }
      const seq = nextSeq++;
      const f = {
        seq,
        ts: frame.ts != null ? frame.ts : Date.now(),
        pos: { u: frame.pos.u, v: frame.pos.v, y: frame.pos.y || 0 },
        look: { yaw: frame.look.yaw || 0, pitch: frame.look.pitch || 0 },
        vel: frame.vel ? { u: frame.vel.u || 0, v: frame.vel.v || 0, y: frame.vel.y || 0 } : null,
        action: frame.action || null,
      };
      frames.push(f);
      while (frames.length > capacity) { frames.shift(); dropped++; }
      return { ok: true, seq };
    }

    function get(seq) {
      // Frames are seq-ordered; binary search
      let lo = 0, hi = frames.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (frames[mid].seq === seq) return frames[mid];
        if (frames[mid].seq < seq) lo = mid + 1; else hi = mid - 1;
      }
      return null;
    }

    function size() { return frames.length; }
    function range() {
      if (frames.length === 0) return null;
      return { first: frames[0].seq, last: frames[frames.length - 1].seq };
    }
    function getDropped() { return dropped; }
    function snapshot() { return frames.slice(); }

    // Frames between [fromSeq..toSeq] inclusive
    function slice(fromSeq, toSeq) {
      return frames.filter(f => f.seq >= fromSeq && f.seq <= toSeq);
    }

    return { push, get, size, range, snapshot, slice, getDropped, capacity };
  }

  // Spectator: feeds itself frames at playback speed, exposes the
  // current frame, switches between follow/free modes.
  function createSpectator(opts) {
    opts = opts || {};
    const buffer = opts.buffer || createBuffer();
    let mode = opts.mode || "follow";   // "follow" | "free"
    let playSpeed = opts.playSpeed || 1;
    let cursorSeq = opts.cursorSeq != null ? opts.cursorSeq : 0;
    let lastFrame = null;
    const subscribers = [];
    let paused = false;

    function _validMode(m) { return m === "follow" || m === "free"; }

    // Push a frame from the host stream
    function feed(frame) { return buffer.push(frame); }

    // Tick — advance cursor by dt seconds * playSpeed * 60 (frames assumed 60Hz)
    function tick(dt) {
      if (paused) return null;
      const range = buffer.range();
      if (!range) return null;

      // Skip ahead by some integer count of frames
      const stepFloat = Math.max(0, dt * playSpeed * 60);
      const step = Math.max(1, Math.floor(stepFloat));
      cursorSeq = Math.min(cursorSeq + step, range.last);
      // Make sure cursor is at least at the buffer's first available frame
      if (cursorSeq < range.first) cursorSeq = range.first;

      const f = buffer.get(cursorSeq);
      if (f) {
        lastFrame = f;
        for (const cb of subscribers) {
          try { cb(f, mode); } catch (e) {}
        }
      }
      return f;
    }

    // Jump to live edge (latest frame) — useful for catchup
    function catchup() {
      const range = buffer.range();
      if (!range) return null;
      cursorSeq = range.last;
      const f = buffer.get(cursorSeq);
      lastFrame = f;
      return f;
    }

    // Seek to a specific seq
    function seek(seq) {
      const range = buffer.range();
      if (!range) return { ok: false, reason: "empty" };
      if (seq < range.first || seq > range.last) {
        return { ok: false, reason: "out_of_range", range };
      }
      cursorSeq = seq;
      lastFrame = buffer.get(seq);
      return { ok: true, frame: lastFrame };
    }

    function setMode(m) {
      if (!_validMode(m)) return { ok: false, reason: "bad_mode" };
      mode = m;
      return { ok: true };
    }

    function setPlaySpeed(s) {
      if (typeof s !== "number" || s <= 0 || s > 8) {
        return { ok: false, reason: "out_of_range" };
      }
      playSpeed = s;
      return { ok: true };
    }

    function pause() { paused = true; return { ok: true }; }
    function resume() { paused = false; return { ok: true }; }
    function isPaused() { return paused; }

    function getCursor() { return cursorSeq; }
    function getMode() { return mode; }
    function getPlaySpeed() { return playSpeed; }
    function getLastFrame() { return lastFrame; }

    function subscribe(cb) {
      subscribers.push(cb);
      return () => { const i = subscribers.indexOf(cb); if (i >= 0) subscribers.splice(i, 1); };
    }

    return {
      buffer, feed, tick, catchup, seek,
      setMode, setPlaySpeed, pause, resume, isPaused,
      getCursor, getMode, getPlaySpeed, getLastFrame,
      subscribe,
    };
  }

  return {
    createBuffer,
    createSpectator,
  };
});
